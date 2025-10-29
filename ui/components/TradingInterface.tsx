'use client';

import { useState, useCallback, useMemo, memo, useEffect, useRef } from 'react';
import { usePrivyWallet } from '@/hooks/usePrivyWallet';
import { useTokenPrices } from '@/hooks/useTokenPrices';
import { formatNumber, formatCurrency } from '@/lib/formatters';
import { openPosition, claimWinnings } from '@/lib/trading';
import { useSolanaWallets } from '@privy-io/react-auth/solana';
import { Transaction } from '@solana/web3.js';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';
import { getDecimals, toDecimal, toSmallestUnits } from '@/lib/constants/tokens';
import { PayoutCard } from './trading/PayoutCard';
import type { UserBalancesResponse } from '@/types/api';

interface TradingInterfaceProps {
  proposalId: number;
  selectedMarket: 'pass' | 'fail';
  onMarketChange: (market: 'pass' | 'fail') => void;
  passPrice: number;
  failPrice: number;
  proposalStatus?: 'Pending' | 'Passed' | 'Failed';
  userBalances: UserBalancesResponse | null;
  refetchBalances: () => void;
  visualFocusClassName?: string;
}

const TradingInterface = memo(({
  proposalId,
  selectedMarket,
  onMarketChange,
  passPrice,
  failPrice,
  proposalStatus = 'Pending',
  userBalances,
  refetchBalances,
  visualFocusClassName = ''
}: TradingInterfaceProps) => {
  const { authenticated, walletAddress, login } = usePrivyWallet();
  const isConnected = authenticated;
  const { sol: solPrice, zc: zcPrice } = useTokenPrices();
  const [amount, setAmount] = useState('');
  const [sellingToken, setSellingToken] = useState<'sol' | 'zc'>('sol');
  const [isEditingQuickAmounts, setIsEditingQuickAmounts] = useState(false);
  const [hoveredPayout, setHoveredPayout] = useState<string | null>(null);
  
  // Load saved values from localStorage or use defaults
  const [solQuickAmounts, setSolQuickAmounts] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('solQuickAmounts');
      return saved ? JSON.parse(saved) : ['0.01', '0.1', '1', '10'];
    }
    return ['0.01', '0.1', '1', '10'];
  });
  
  const [zcQuickAmounts, setZCQuickAmounts] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('zcQuickAmounts');
      return saved ? JSON.parse(saved) : ['10000', '100000', '1000000', '10000000'];
    }
    return ['10000', '100000', '1000000', '10000000'];
  });

  const [tempSolAmounts, setTempSolAmounts] = useState(['0.01', '0.1', '1', '10']);
  const [tempZCAmounts, setTempZCAmounts] = useState(['10000', '100000', '1000000', '10000000']);

  // Calculate user's position from balances
  const userPosition = useMemo(() => {
    if (!userBalances) return null;

    const basePassConditional = parseFloat(userBalances.base.passConditional || '0');
    const baseFailConditional = parseFloat(userBalances.base.failConditional || '0');
    const quotePassConditional = parseFloat(userBalances.quote.passConditional || '0');
    const quoteFailConditional = parseFloat(userBalances.quote.failConditional || '0');

    // For finished proposals, only consider winning tokens
    if (proposalStatus === 'Passed') {
      // Only Pass tokens are claimable
      const hasWinningTokens = basePassConditional > 0 || quotePassConditional > 0;
      if (!hasWinningTokens) return null;

      return {
        type: 'pass' as const,
        passZCAmount: basePassConditional,
        passSolAmount: quotePassConditional,
        failZCAmount: 0, // Losing tokens don't count
        failSolAmount: 0
      };
    } else if (proposalStatus === 'Failed') {
      // Only Fail tokens are claimable
      const hasWinningTokens = baseFailConditional > 0 || quoteFailConditional > 0;
      if (!hasWinningTokens) return null;

      return {
        type: 'fail' as const,
        passZCAmount: 0, // Losing tokens don't count
        passSolAmount: 0,
        failZCAmount: baseFailConditional,
        failSolAmount: quoteFailConditional
      };
    }

    // For pending proposals, check if user has ANY conditional tokens
    const hasAnyPassTokens = basePassConditional > 0 || quotePassConditional > 0;
    const hasAnyFailTokens = baseFailConditional > 0 || quoteFailConditional > 0;

    if (!hasAnyPassTokens && !hasAnyFailTokens) {
      return null;
    }

    // Determine position type based on which tokens they have more of
    // This handles both traditional positions and post-swap positions
    const totalPassValue = basePassConditional + quotePassConditional;
    const totalFailValue = baseFailConditional + quoteFailConditional;

    const positionType = totalPassValue >= totalFailValue ? 'pass' : 'fail';

    // Track individual token amounts and types for payout display
    // Base = ZC, Quote = SOL
    return {
      type: positionType as 'pass' | 'fail',
      passZCAmount: basePassConditional,
      passSolAmount: quotePassConditional,
      failZCAmount: baseFailConditional,
      failSolAmount: quoteFailConditional
    };
  }, [userBalances, proposalStatus]);

  const { wallets } = useSolanaWallets();
  const [isTrading, setIsTrading] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);

  // Transaction signer helper
  const createTransactionSigner = useCallback(() => {
    return async (transaction: Transaction) => {
      const wallet = wallets[0];
      if (!wallet) throw new Error('No Solana wallet found');
      return await wallet.signTransaction(transaction);
    };
  }, [wallets]);

  // Quote state for slippage calculation
  const [quote, setQuote] = useState<{
    swapOutAmount: string;
    minSwapOutAmount: string;
    priceImpact: number;
  } | null>(null);
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);
  const quoteTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch quote when amount, sellingToken, or selectedMarket changes
  useEffect(() => {
    // Clear any pending timeout
    if (quoteTimeoutRef.current) {
      clearTimeout(quoteTimeoutRef.current);
    }

    // Don't fetch if no amount or amount is invalid
    if (!amount || parseFloat(amount) <= 0) {
      setQuote(null);
      return;
    }

    // Debounce quote fetching by 500ms
    quoteTimeoutRef.current = setTimeout(async () => {
      setIsLoadingQuote(true);

      try {
        // Convert amount to smallest units
        const amountInSmallestUnits = toSmallestUnits(parseFloat(amount), sellingToken);

        // Skip if amount is too small (would result in 0 after conversion)
        if (amountInSmallestUnits === 0) {
          setQuote(null);
          setIsLoadingQuote(false);
          return;
        }

        // Determine swap direction
        const isBaseToQuote = sellingToken === 'zc';

        // Fetch quote from API
        const quoteData = await api.getSwapQuote(
          proposalId,
          selectedMarket,
          isBaseToQuote,
          amountInSmallestUnits.toString(),
          2000 // 20% slippage
        );

        if (quoteData) {
          setQuote({
            swapOutAmount: quoteData.swapOutAmount,
            minSwapOutAmount: quoteData.minSwapOutAmount,
            priceImpact: quoteData.priceImpact
          });
        } else {
          setQuote(null);
        }
      } catch (error) {
        console.error('Error fetching quote:', error);
        setQuote(null);
      } finally {
        setIsLoadingQuote(false);
      }
    }, 500);

    // Cleanup on unmount
    return () => {
      if (quoteTimeoutRef.current) {
        clearTimeout(quoteTimeoutRef.current);
      }
    };
  }, [amount, sellingToken, selectedMarket, proposalId]);

  // Handle MAX button click - set amount to user's balance for selected market and token
  const handleMaxClick = useCallback(() => {
    if (!userBalances) return;

    let balance: string;

    // Get the correct balance based on selectedMarket and sellingToken
    if (selectedMarket === 'pass') {
      // Pass market
      if (sellingToken === 'zc') {
        // Selling Pass-ZC
        balance = userBalances.base.passConditional;
      } else {
        // Selling Pass-SOL
        balance = userBalances.quote.passConditional;
      }
    } else {
      // Fail market
      if (sellingToken === 'zc') {
        // Selling Fail-ZC
        balance = userBalances.base.failConditional;
      } else {
        // Selling Fail-SOL
        balance = userBalances.quote.failConditional;
      }
    }

    // Convert from smallest units to human-readable
    const maxAmount = toDecimal(parseFloat(balance), sellingToken);

    if (maxAmount > 0) {
      setAmount(maxAmount.toString());
    } else {
      toast.error(`No ${selectedMarket}-${sellingToken.toUpperCase()} balance available`);
    }
  }, [userBalances, selectedMarket, sellingToken]);

  // Check if amount exceeds available balance
  const balanceError = useMemo(() => {
    if (!amount || !userBalances) return null;

    const inputAmount = parseFloat(amount);
    if (isNaN(inputAmount) || inputAmount <= 0) return null;

    let balance: string;

    // Get the correct balance based on selectedMarket and sellingToken
    if (selectedMarket === 'pass') {
      if (sellingToken === 'zc') {
        balance = userBalances.base.passConditional;
      } else {
        balance = userBalances.quote.passConditional;
      }
    } else {
      if (sellingToken === 'zc') {
        balance = userBalances.base.failConditional;
      } else {
        balance = userBalances.quote.failConditional;
      }
    }

    const maxAmount = toDecimal(parseFloat(balance), sellingToken);

    if (inputAmount > maxAmount) {
      return `Insufficient balance. Max: ${formatNumber(maxAmount, sellingToken === 'sol' ? 3 : 0)} ${sellingToken === 'sol' ? 'SOL' : '$ZC'}`;
    }

    return null;
  }, [amount, userBalances, selectedMarket, sellingToken]);

  const handleTrade = useCallback(async () => {
    if (!isConnected) {
      login();
      return;
    }

    if (!walletAddress) {
      toast.error('No wallet address found');
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    setIsTrading(true);

    try {
      await openPosition({
        proposalId,
        market: selectedMarket, // Which AMM market (pass or fail)
        inputToken: sellingToken, // Which conditional token we're selling
        inputAmount: amount,
        userAddress: walletAddress,
        signTransaction: createTransactionSigner()
      });

      // Clear the amount after successful trade
      setAmount('');

      // Refresh user balances
      refetchBalances();

    } catch (error) {
      console.error('Trade failed:', error);
      // Error toast is already shown by openPosition function
    } finally {
      setIsTrading(false);
    }
  }, [isConnected, login, walletAddress, amount, proposalId, selectedMarket, sellingToken, wallets, refetchBalances]);
  
  const handleClaim = useCallback(async () => {
    if (!isConnected) {
      login();
      return;
    }
    
    if (!walletAddress) {
      toast.error('No wallet address found');
      return;
    }
    
    if (!userPosition) {
      toast.error('No position to claim');
      return;
    }
    
    if (proposalStatus !== 'Passed' && proposalStatus !== 'Failed') {
      toast.error('Cannot claim from pending proposal');
      return;
    }
    
    setIsClaiming(true);
    
    try {
      await claimWinnings({
        proposalId,
        proposalStatus: proposalStatus as 'Passed' | 'Failed',
        userPosition,
        userAddress: walletAddress,
        signTransaction: createTransactionSigner()
      });

      // Refresh user balances after claiming
      refetchBalances();

    } catch (error) {
      console.error('Claim failed:', error);
      // Error toast is already shown by claimWinnings function
    } finally {
      setIsClaiming(false);
    }
  }, [isConnected, login, walletAddress, userPosition, proposalStatus, proposalId, wallets, refetchBalances]);

  // Quick amount buttons - depends on selling token
  const quickAmounts = useMemo(() => {
    if (sellingToken === 'sol') {
      return isEditingQuickAmounts ? tempSolAmounts : solQuickAmounts;
    } else {
      return isEditingQuickAmounts ? tempZCAmounts : zcQuickAmounts;
    }
  }, [sellingToken, isEditingQuickAmounts, tempSolAmounts, tempZCAmounts, solQuickAmounts, zcQuickAmounts]);

  // Format quick amount for display (abbreviate K/M for ZC)
  const formatQuickAmountDisplay = (val: string): string => {
    if (sellingToken === 'zc' && !isEditingQuickAmounts) {
      const num = parseFloat(val);
      if (num >= 1000000) {
        return (num / 1000000) + 'M';
      } else if (num >= 1000) {
        return (num / 1000) + 'K';
      }
    }
    return val;
  };

  const handleEditToggle = useCallback(() => {
    if (isEditingQuickAmounts) {
      // Save the changes
      setSolQuickAmounts([...tempSolAmounts]);
      setZCQuickAmounts([...tempZCAmounts]);

      // Save to localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('solQuickAmounts', JSON.stringify(tempSolAmounts));
        localStorage.setItem('zcQuickAmounts', JSON.stringify(tempZCAmounts));
      }
    } else {
      // Start editing, copy current values to temp
      setTempSolAmounts([...solQuickAmounts]);
      setTempZCAmounts([...zcQuickAmounts]);
    }
    setIsEditingQuickAmounts(!isEditingQuickAmounts);
  }, [isEditingQuickAmounts, tempSolAmounts, tempZCAmounts, solQuickAmounts, zcQuickAmounts]);

  const handleQuickAmountChange = useCallback((index: number, value: string) => {
    // Only allow numbers and decimal points
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      if (sellingToken === 'sol') {
        const newAmounts = [...tempSolAmounts];
        newAmounts[index] = value;
        setTempSolAmounts(newAmounts);
      } else {
        const newAmounts = [...tempZCAmounts];
        newAmounts[index] = value;
        setTempZCAmounts(newAmounts);
      }
    }
  }, [sellingToken, tempSolAmounts, tempZCAmounts]);

  // Don't show login button in trading interface when not authenticated
  if (!authenticated) {
    return null;
  }

  return (
    <div>
      {/* Payouts Section - Only show for finished proposals with user position */}
      {userPosition && (proposalStatus === 'Passed' || proposalStatus === 'Failed') && (
        <div className="mb-8">
          <div className="text-xs text-gray-400 mb-2">
            Payout
          </div>
          <div className="space-y-2">
            {proposalStatus === 'Passed' && (
              <>
                {userPosition.passZCAmount > 0 && (
                  <PayoutCard
                    status="pass"
                    label="Passed (ZC)"
                    amount={userPosition.passZCAmount}
                    token="zc"
                    tokenPrice={zcPrice}
                    isHovered={hoveredPayout === 'pass-zc'}
                    onHover={setHoveredPayout}
                    hoverId="pass-zc"
                  />
                )}
                {userPosition.passSolAmount > 0 && (
                  <PayoutCard
                    status="pass"
                    label="Passed (SOL)"
                    amount={userPosition.passSolAmount}
                    token="sol"
                    tokenPrice={solPrice}
                    isHovered={hoveredPayout === 'pass-sol'}
                    onHover={setHoveredPayout}
                    hoverId="pass-sol"
                  />
                )}
              </>
            )}
            {proposalStatus === 'Failed' && (
              <>
                {userPosition.failZCAmount > 0 && (
                  <PayoutCard
                    status="fail"
                    label="Failed (ZC)"
                    amount={userPosition.failZCAmount}
                    token="zc"
                    tokenPrice={zcPrice}
                    isHovered={hoveredPayout === 'fail-zc'}
                    onHover={setHoveredPayout}
                    hoverId="fail-zc"
                  />
                )}
                {userPosition.failSolAmount > 0 && (
                  <PayoutCard
                    status="fail"
                    label="Failed (SOL)"
                    amount={userPosition.failSolAmount}
                    token="sol"
                    tokenPrice={solPrice}
                    isHovered={hoveredPayout === 'fail-sol'}
                    onHover={setHoveredPayout}
                    hoverId="fail-sol"
                  />
                )}
              </>
            )}
          </div>
        </div>
      )}
        
      {/* Claim section for closed proposals */}
      {proposalStatus !== 'Pending' && (
        <div className="mt-4">
          {userPosition ? (
            /* Claim Button */
            <button
                onClick={handleClaim}
                disabled={isClaiming}
                className={`w-full py-3 rounded-lg font-semibold transition cursor-pointer ${
                  isClaiming
                    ? 'bg-gray-500 cursor-not-allowed'
                    : 'bg-[#4CBBF4] hover:bg-[#3AA5E3]'
                } text-[#181818]`}
              >
                {isClaiming ? 'Claiming...' : 'Claim'}
              </button>
            ) : (
              <div className="text-center py-6 text-gray-400 text-sm">
                Nothing to claim
              </div>
            )}
        </div>
      )}

      {/* Only show betting interface for pending proposals */}
      {proposalStatus === 'Pending' && (
        <div className={visualFocusClassName}>
      {/* Market Selection (which AMM to trade on) */}
      <div className="mb-2">
        <div className="text-xs text-gray-400">
          Select Market
        </div>
      </div>

      {/* Pass/Fail market toggle */}
      <div className="flex flex-row flex-1 min-h-[40px] max-h-[40px] gap-[2px] p-[3px] justify-center items-center rounded-full mb-2 border border-[#2A2A2A]">
        <button
          onClick={() => {
            onMarketChange('pass');
            setAmount('');
          }}
          className={`flex flex-row flex-1 min-h-[34px] max-h-[34px] px-4 justify-center items-center rounded-full transition cursor-pointer ${
            selectedMarket === 'pass'
              ? 'bg-emerald-500 text-[#181818] font-bold'
              : 'bg-transparent text-gray-400 font-medium hover:text-gray-300'
          }`}
        >
          <span className="text-[12px] leading-[16px]">Pass</span>
        </button>
        <button
          onClick={() => {
            onMarketChange('fail');
            setAmount('');
          }}
          className={`flex flex-row flex-1 min-h-[34px] max-h-[34px] px-4 justify-center items-center rounded-full transition cursor-pointer ${
            selectedMarket === 'fail'
              ? 'bg-rose-500 text-[#181818] font-bold'
              : 'bg-transparent text-gray-400 font-medium hover:text-gray-300'
          }`}
        >
          <span className="text-[12px] leading-[16px]">Fail</span>
        </button>
      </div>

      {/* Amount Input with MAX and Token Toggle */}
      <div>
        <div className="relative">
          <input
            type="text"
            inputMode="decimal"
            pattern="[0-9]*[.]?[0-9]*"
            value={amount}
            onChange={(e) => {
              const value = e.target.value;
              if (value === '' || /^\d*\.?\d*$/.test(value)) {
                setAmount(value);
              }
            }}
            placeholder="0.0"
            className="w-full px-3 py-3 pr-32 bg-[#2a2a2a] rounded-t-lg text-white placeholder-gray-600 focus:outline-none border-t border-l border-r border-[#2A2A2A]"
            style={{ WebkitAppearance: 'none', MozAppearance: 'textfield' }}
          />
          {/* MAX and Token Toggle Buttons */}
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {/* MAX Button */}
            <button
              onClick={handleMaxClick}
              disabled={!userBalances}
              className={`flex items-center justify-center px-2 h-7 rounded text-xs font-medium transition ${
                userBalances
                  ? 'bg-[#333] text-gray-300 hover:bg-[#404040] cursor-pointer'
                  : 'bg-[#1a1a1a] text-gray-600 cursor-not-allowed'
              }`}
            >
              MAX
            </button>

            {/* Token Toggle */}
            <button
              onClick={() => {
                setSellingToken(sellingToken === 'sol' ? 'zc' : 'sol');
                setAmount('');
              }}
              className="flex items-center justify-center gap-1 px-2 h-7 bg-[#333] rounded hover:bg-[#404040] transition cursor-pointer"
            >
              {sellingToken === 'zc' ? (
                <>
                  <span className="text-xs text-[#AFAFAF] font-medium">sell</span>
                  <span className="text-xs text-[#AFAFAF] font-bold">$ZC</span>
                </>
              ) : (
                <>
                  <span className="text-xs text-[#AFAFAF] font-medium">buy with</span>
                  <svg className="h-3 w-3" viewBox="0 0 101 88" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M100.48 69.3817L83.8068 86.8015C83.4444 87.1799 83.0058 87.4816 82.5185 87.6878C82.0312 87.894 81.5055 88.0003 80.9743 88H1.93563C1.55849 88 1.18957 87.8926 0.874202 87.6912C0.558829 87.4897 0.31074 87.2029 0.160416 86.8659C0.0100923 86.529 -0.0359181 86.1566 0.0280382 85.7945C0.0919944 85.4324 0.263131 85.0964 0.520422 84.8278L17.2061 67.408C17.5676 67.0306 18.0047 66.7295 18.4904 66.5234C18.9762 66.3172 19.5002 66.2104 20.0301 66.2095H99.0644C99.4415 66.2095 99.8104 66.3169 100.126 66.5183C100.441 66.7198 100.689 67.0065 100.84 67.3435C100.99 67.6804 101.036 68.0529 100.972 68.415C100.908 68.7771 100.737 69.1131 100.48 69.3817ZM83.8068 36.3032C83.4444 35.9248 83.0058 35.6231 82.5185 35.4169C82.0312 35.2108 81.5055 35.1045 80.9743 35.1048H1.93563C1.55849 35.1048 1.18957 35.2121 0.874202 35.4136C0.558829 35.6151 0.31074 35.9019 0.160416 36.2388C0.0100923 36.5758 -0.0359181 36.9482 0.0280382 37.3103C0.0919944 37.6723 0.263131 38.0083 0.520422 38.277L17.2061 55.6968C17.5676 56.0742 18.0047 56.3752 18.4904 56.5814C18.9762 56.7875 19.5002 56.8944 20.0301 56.8952H99.0644C99.4415 56.8952 99.8104 56.7879 100.126 56.5864C100.441 56.3849 100.689 56.0981 100.84 55.7612C100.99 55.4242 101.036 55.0518 100.972 54.6897C100.908 54.3277 100.737 53.9917 100.48 53.723L83.8068 36.3032ZM1.93563 21.7905H80.9743C81.5055 21.7898 82.0312 21.6835 82.5185 21.4773C83.0058 21.2712 83.4444 20.9695 83.8068 20.5911L100.48 3.17133C100.737 2.90265 100.908 2.56667 100.972 2.2046C101.036 1.84253 100.99 1.47008 100.84 1.13314C100.689 0.796193 100.441 0.509443 100.126 0.307961C99.8104 0.106479 99.4415 -0.000854492 99.0644 -0.000854492H20.0301C19.5002 -0.00013126 18.9762 0.106791 18.4904 0.312929C18.0047 0.519068 17.5676 0.820087 17.2061 1.19754L0.524723 18.6173C0.267481 18.8859 0.0963642 19.2219 0.0323936 19.584C-0.0315771 19.946 0.0144792 20.3184 0.164862 20.6554C0.315245 20.9923 0.563347 21.2791 0.878727 21.4806C1.19411 21.682 1.56303 21.7894 1.94013 21.7896L1.93563 21.7905Z" fill="#AFAFAF"/>
                  </svg>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Quick Amount Buttons */}
      <div className="flex mb-3">
        {quickAmounts.map((val: string, index: number) => (
          <button
            key={index}
            onClick={isEditingQuickAmounts ? undefined : () => setAmount(val)}
            contentEditable={isEditingQuickAmounts}
            suppressContentEditableWarning={true}
            onBlur={isEditingQuickAmounts ? (e) => {
              let currentValue = e.currentTarget.textContent || '';
              currentValue = currentValue.trim();

              // Format the number: remove leading zeros, handle decimal points
              if (currentValue && !isNaN(parseFloat(currentValue))) {
                const num = parseFloat(currentValue);
                // Format based on whether it's a whole number or has decimals
                currentValue = num.toString();
                e.currentTarget.textContent = currentValue;
              } else if (currentValue === '' || currentValue === '.') {
                // If empty or just a dot, default to 0
                currentValue = '0';
                e.currentTarget.textContent = currentValue;
              }

              handleQuickAmountChange(index, currentValue);
            } : undefined}
            className={`flex-1 py-1.5 border-b border-l border-r border-[#2A2A2A] text-sm text-center ${
              isEditingQuickAmounts
                ? 'text-gray-400 cursor-text focus:bg-[#2a2a2a] focus:text-white focus:outline-none'
                : 'text-gray-400 hover:bg-[#303030] transition cursor-pointer'
            } ${
              index === 0 ? 'rounded-bl-lg' : ''
            } ${
              index > 0 ? 'border-l-0' : ''
            }`}
          >
            {formatQuickAmountDisplay(val)}
          </button>
        ))}
        <button
          onClick={handleEditToggle}
          className={`px-3 py-1.5 border-b border-r border-[#2A2A2A] rounded-br-lg text-sm transition cursor-pointer text-gray-400 hover:bg-[#303030]`}
          title={isEditingQuickAmounts ? 'Save' : 'Edit quick amounts'}
        >
          {isEditingQuickAmounts ? (
            <svg className="w-3.5 h-3.5 inline" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          ) : '✎'}
        </button>
      </div>

      {/* Slippage Display */}
      {amount && parseFloat(amount) > 0 && (
        <div className="my-3 px-3 py-2 bg-[#1a1a1a] border border-[#2A2A2A] rounded-lg">
          {isLoadingQuote ? (
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <div className="animate-spin h-3 w-3 border border-gray-400 border-t-transparent rounded-full"></div>
              <span>Calculating...</span>
            </div>
          ) : quote ? (
            <div className="space-y-1">
              {/* Expected Output */}
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-400">Expected Output:</span>
                <span className="text-white font-medium">
                  ~{formatNumber(
                    toDecimal(parseFloat(quote.swapOutAmount), sellingToken === 'zc' ? 'sol' : 'zc'),
                    sellingToken === 'zc' ? 4 : 2
                  )} {sellingToken === 'zc' ? 'SOL' : '$ZC'}
                </span>
              </div>

              {/* Price Impact */}
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-400">Price Impact:</span>
                <span className={`font-medium ${
                  quote.priceImpact < 1 ? 'text-emerald-400' :
                  quote.priceImpact < 3 ? 'text-yellow-400' :
                  quote.priceImpact < 5 ? 'text-orange-400' :
                  'text-red-400'
                }`}>
                  {quote.priceImpact.toFixed(2)}%
                  {quote.priceImpact < 1 ? ' 🟢' :
                   quote.priceImpact < 3 ? ' 🟡' :
                   quote.priceImpact < 5 ? ' 🟠' :
                   ' 🔴'}
                </span>
              </div>

              {/* Warning for high price impact */}
              {quote.priceImpact >= 1 && (
                <div className={`mt-2 pt-2 border-t border-[#2A2A2A] text-xs ${
                  quote.priceImpact < 3 ? 'text-yellow-400' :
                  quote.priceImpact < 5 ? 'text-orange-400' :
                  'text-red-400'
                }`}>
                  ⚠️ {quote.priceImpact < 3 ? 'Moderate' :
                       quote.priceImpact < 5 ? 'High' :
                       'Very high'} price impact
                  {quote.priceImpact >= 5 && '. Proceed with caution.'}
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}

      {/* Balance Error Message */}
      {balanceError && (
        <div className="text-xs text-rose-400 px-1">
          {balanceError}
        </div>
      )}

      {/* Swap Button */}
      <button
        onClick={handleTrade}
        disabled={!amount || parseFloat(amount) <= 0 || isTrading || !!balanceError}
        className={`w-full py-3 rounded-full font-semibold transition cursor-pointer flex items-center justify-center gap-1 ${
          selectedMarket === 'pass'
            ? amount && parseFloat(amount) > 0 && !balanceError
              ? 'bg-emerald-500 hover:bg-emerald-600 text-[#181818]'
              : 'bg-[#2a2a2a] text-gray-600 cursor-not-allowed'
            : amount && parseFloat(amount) > 0 && !balanceError
              ? 'bg-rose-500 hover:bg-rose-600 text-[#181818]'
              : 'bg-[#2a2a2a] text-gray-600 cursor-not-allowed'
        }`}
      >
        <span>
          {isTrading ? (
            'Swapping...'
          ) : (
            sellingToken === 'sol' ? 'Swap for $ZC' : 'Swap for SOL'
          )}
        </span>
      </button>
        </div>
      )}
    </div>
  );
});

TradingInterface.displayName = 'TradingInterface';

export default TradingInterface;