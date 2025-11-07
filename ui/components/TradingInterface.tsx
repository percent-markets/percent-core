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
  onTradeSuccess?: () => void;
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
  onTradeSuccess,
  visualFocusClassName = ''
}: TradingInterfaceProps) => {
  const { authenticated, walletAddress, login } = usePrivyWallet();
  const isConnected = authenticated;
  const { sol: solPrice, zc: zcPrice } = useTokenPrices();
  const [amount, setAmount] = useState('');
  const [percentage, setPercentage] = useState('');
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

  const [percentQuickAmounts, setPercentQuickAmounts] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('percentQuickAmounts');
      return saved ? JSON.parse(saved) : ['10', '25', '50', '100'];
    }
    return ['10', '25', '50', '100'];
  });

  const [tempSolAmounts, setTempSolAmounts] = useState(['0.01', '0.1', '1', '10']);
  const [tempZCAmounts, setTempZCAmounts] = useState(['10000', '100000', '1000000', '10000000']);
  const [tempPercentAmounts, setTempPercentAmounts] = useState(['10', '25', '50', '100']);

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

  // Check if user has zero balances across all conditional tokens
  const hasZeroBalances = useMemo(() => {
    if (!userBalances) return true;

    const basePassConditional = parseFloat(userBalances.base.passConditional || '0');
    const baseFailConditional = parseFloat(userBalances.base.failConditional || '0');
    const quotePassConditional = parseFloat(userBalances.quote.passConditional || '0');
    const quoteFailConditional = parseFloat(userBalances.quote.failConditional || '0');

    return basePassConditional === 0 &&
           baseFailConditional === 0 &&
           quotePassConditional === 0 &&
           quoteFailConditional === 0;
  }, [userBalances]);

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
      setPercentage('');

      // Refresh user balances
      refetchBalances();

      // Refresh trade history
      onTradeSuccess?.();

    } catch (error) {
      console.error('Trade failed:', error);
      // Error toast is already shown by openPosition function
    } finally {
      setIsTrading(false);
    }
  }, [isConnected, login, walletAddress, amount, proposalId, selectedMarket, sellingToken, wallets, refetchBalances, onTradeSuccess]);
  
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
      return isEditingQuickAmounts ? tempPercentAmounts : percentQuickAmounts;
    }
  }, [sellingToken, isEditingQuickAmounts, tempSolAmounts, tempPercentAmounts, solQuickAmounts, percentQuickAmounts]);

  // Format quick amount for display (show % for percentages)
  const formatQuickAmountDisplay = (val: string): string => {
    if (sellingToken === 'zc') {
      return val + '%';
    }
    return val;
  };

  const handleEditToggle = useCallback(() => {
    if (isEditingQuickAmounts) {
      // Save the changes
      setSolQuickAmounts([...tempSolAmounts]);
      setZCQuickAmounts([...tempZCAmounts]);
      setPercentQuickAmounts([...tempPercentAmounts]);

      // Save to localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('solQuickAmounts', JSON.stringify(tempSolAmounts));
        localStorage.setItem('zcQuickAmounts', JSON.stringify(tempZCAmounts));
        localStorage.setItem('percentQuickAmounts', JSON.stringify(tempPercentAmounts));
      }
    } else {
      // Start editing, copy current values to temp
      setTempSolAmounts([...solQuickAmounts]);
      setTempZCAmounts([...zcQuickAmounts]);
      setTempPercentAmounts([...percentQuickAmounts]);
    }
    setIsEditingQuickAmounts(!isEditingQuickAmounts);
  }, [isEditingQuickAmounts, tempSolAmounts, tempZCAmounts, tempPercentAmounts, solQuickAmounts, zcQuickAmounts, percentQuickAmounts]);

  const handleQuickAmountChange = useCallback((index: number, value: string) => {
    // Only allow numbers and decimal points
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      if (sellingToken === 'sol') {
        const newAmounts = [...tempSolAmounts];
        newAmounts[index] = value;
        setTempSolAmounts(newAmounts);
      } else {
        const newAmounts = [...tempPercentAmounts];
        newAmounts[index] = value;
        setTempPercentAmounts(newAmounts);
      }
    }
  }, [sellingToken, tempSolAmounts, tempPercentAmounts]);

  // Handle percentage quick amount click
  const handlePercentageClick = useCallback((percentValue: string) => {
    if (!userBalances) return;

    // Get the ZC balance based on selectedMarket
    let balance: string;
    if (selectedMarket === 'pass') {
      balance = userBalances.base.passConditional;
    } else {
      balance = userBalances.base.failConditional;
    }

    // Convert from smallest units to decimal
    const maxAmount = toDecimal(parseFloat(balance), 'zc');

    // Calculate percentage
    const percent = parseFloat(percentValue);
    const calculatedAmount = (maxAmount * percent) / 100;

    // Set the percentage for display and amount for calculations
    if (calculatedAmount > 0) {
      setPercentage(percentValue);
      setAmount(calculatedAmount.toString());
    } else {
      toast.error(`No ${selectedMarket} ZC balance available`);
    }
  }, [userBalances, selectedMarket]);

  // Handle SOL quick amount click (with auto-cap to max balance)
  const handleSolQuickAmountClick = useCallback((quickValue: string) => {
    if (!userBalances) return;

    // Get the SOL balance based on selectedMarket
    let balance: string;
    if (selectedMarket === 'pass') {
      balance = userBalances.quote.passConditional;
    } else {
      balance = userBalances.quote.failConditional;
    }

    // Convert from smallest units to decimal
    const maxAmount = toDecimal(parseFloat(balance), 'sol');

    // Parse the quick value
    const requestedAmount = parseFloat(quickValue);

    // Cap to max balance if requested amount exceeds it
    const cappedAmount = Math.min(requestedAmount, maxAmount);

    // Set the capped amount
    if (cappedAmount > 0) {
      setAmount(cappedAmount.toString());
    } else {
      setAmount(quickValue); // If no balance, still allow setting the value
    }
  }, [userBalances, selectedMarket]);

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
      {/* Buy/Sell toggle */}
      <div className="flex flex-row flex-1 min-h-[40px] max-h-[40px] gap-[2px] p-[3px] justify-center items-center rounded-[6px] mb-2 border border-[#191919]">
        <button
          onClick={() => {
            setSellingToken('sol');
            setAmount('');
            setPercentage('');
          }}
          className={`flex flex-row flex-1 min-h-[34px] max-h-[34px] px-4 justify-center items-center rounded-[6px] transition cursor-pointer ${
            sellingToken === 'sol'
              ? 'text-[#181818] font-bold'
              : 'bg-transparent text-[#6B6E71] font-medium'
          }`}
          style={sellingToken === 'sol' ? { backgroundColor: '#6ECC94', fontFamily: 'IBM Plex Mono, monospace' } : { fontFamily: 'IBM Plex Mono, monospace' }}
        >
          <span className="text-[12px] leading-[16px]">
            {selectedMarket === 'pass' ? 'BUY (BULLISH)' : 'BUY (BEARISH)'}
          </span>
        </button>
        <button
          onClick={() => {
            setSellingToken('zc');
            setAmount('');
            setPercentage('');
          }}
          className={`flex flex-row flex-1 min-h-[34px] max-h-[34px] px-4 justify-center items-center rounded-[6px] transition cursor-pointer ${
            sellingToken === 'zc'
              ? 'text-[#181818] font-bold'
              : 'bg-transparent text-[#6B6E71] font-medium'
          }`}
          style={sellingToken === 'zc' ? { backgroundColor: '#FF6F94', fontFamily: 'IBM Plex Mono, monospace' } : { fontFamily: 'IBM Plex Mono, monospace' }}
        >
          <span className="text-[12px] leading-[16px]">
            {selectedMarket === 'pass' ? 'SELL (BEARISH)' : 'SELL (BULLISH)'}
          </span>
        </button>
      </div>

      {/* Amount Input with MAX and Token Toggle */}
      <div>
        <div className="relative">
          <input
            type="text"
            inputMode="decimal"
            pattern="[0-9]*[.]?[0-9]*"
            value={sellingToken === 'zc' ? percentage : amount}
            onChange={(e) => {
              const value = e.target.value;
              if (value === '' || /^\d*\.?\d*$/.test(value)) {
                if (sellingToken === 'zc') {
                  // Update percentage and calculate amount
                  setPercentage(value);
                  if (value && userBalances) {
                    const balance = selectedMarket === 'pass'
                      ? userBalances.base.passConditional
                      : userBalances.base.failConditional;
                    const maxAmount = toDecimal(parseFloat(balance), 'zc');
                    const calculatedAmount = (maxAmount * parseFloat(value)) / 100;
                    setAmount(calculatedAmount.toString());
                  } else {
                    setAmount('');
                  }
                } else {
                  setAmount(value);
                }
              }
            }}
            placeholder={!authenticated ? "LOG IN TO TRADE" : hasZeroBalances ? "DEPOSIT FUNDS" : "0.0"}
            disabled={!authenticated || hasZeroBalances}
            className={`w-full h-[56px] px-3 pr-16 bg-[#2a2a2a] rounded-t-[6px] text-white placeholder-gray-600 focus:outline-none border-t border-l border-r border-[#191919] text-2xl font-ibm-plex-mono ${
              !authenticated || hasZeroBalances ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            style={{ WebkitAppearance: 'none', MozAppearance: 'textfield', fontFamily: 'IBM Plex Mono, monospace', letterSpacing: '0em' }}
          />
          {/* Token Label */}
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            <span className="flex items-center justify-center px-2 h-7 text-xs font-semibold text-[#AFAFAF]">
              {sellingToken === 'sol' ? 'SOL' : '%'}
            </span>
          </div>
        </div>
      </div>

      {/* Quick Amount Buttons */}
      <div className="flex mb-3">
        {quickAmounts.map((val: string, index: number) => (
          <button
            key={index}
            onClick={isEditingQuickAmounts ? undefined : () => {
              if (sellingToken === 'zc') {
                handlePercentageClick(val);
              } else {
                handleSolQuickAmountClick(val);
              }
            }}
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
            className={`flex-1 py-1.5 border-b border-l border-r border-[#191919] text-sm text-center ${
              isEditingQuickAmounts
                ? 'text-[#6B6E71] cursor-text focus:bg-[#2a2a2a] focus:text-white focus:outline-none'
                : 'text-[#6B6E71] hover:bg-[#303030] transition cursor-pointer'
            } ${
              index === 0 ? 'rounded-bl-[6px]' : ''
            } ${
              index > 0 ? 'border-l-0' : ''
            }`}
          >
            {isEditingQuickAmounts ? val : formatQuickAmountDisplay(val)}
          </button>
        ))}
        <button
          onClick={handleEditToggle}
          className={`px-3 py-1.5 border-b border-r border-[#191919] rounded-br-[6px] text-sm transition cursor-pointer text-[#6B6E71] hover:bg-[#303030]`}
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
        <div className="my-3 px-3 py-2 border border-[#191919] rounded-[6px]">
          {isLoadingQuote ? (
            <div className="flex items-center gap-2 text-sm" style={{ color: '#DDDDD7' }}>
              <div className="animate-spin h-3 w-3 border border-t-transparent rounded-full" style={{ borderColor: '#DDDDD7' }}></div>
              <span>Calculating...</span>
            </div>
          ) : quote ? (
            <div className="space-y-1">
              {/* Expected Output */}
              <div className="flex justify-between items-center text-sm">
                <span style={{ color: '#DDDDD7' }}>Expected Output:</span>
                <span className="font-medium" style={{ color: '#DDDDD7' }}>
                  ~{formatNumber(
                    toDecimal(parseFloat(quote.swapOutAmount), sellingToken === 'zc' ? 'sol' : 'zc'),
                    sellingToken === 'zc' ? 4 : 2
                  )} {sellingToken === 'zc' ? 'SOL' : '$ZC'}
                </span>
              </div>

              {/* Price Impact */}
              <div className="flex justify-between items-center text-sm">
                <span style={{ color: '#DDDDD7' }}>Price Impact:</span>
                <span className={`font-medium ${
                  quote.priceImpact < 1 ? '' :
                  quote.priceImpact < 3 ? 'text-yellow-400' :
                  quote.priceImpact < 5 ? 'text-orange-400' :
                  ''
                }`}
                style={
                  quote.priceImpact < 1 ? { color: '#6ECC94' } :
                  quote.priceImpact >= 5 ? { color: '#FF6F94' } :
                  undefined
                }>
                  {quote.priceImpact.toFixed(2)}%
                </span>
              </div>

              {/* Warning for high price impact */}
              {quote.priceImpact >= 1 && (
                <div className={`mt-2 pt-2 border-t border-[#191919] text-sm ${
                  quote.priceImpact < 3 ? 'text-yellow-400' :
                  quote.priceImpact < 5 ? 'text-orange-400' :
                  ''
                }`}
                style={quote.priceImpact >= 5 ? { color: '#FF6F94' } : undefined}>
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
        <div className="text-xs px-1" style={{ color: '#FF6F94' }}>
          {balanceError}
        </div>
      )}

      {/* Swap Button */}
      <button
        onClick={handleTrade}
        disabled={!amount || parseFloat(amount) <= 0 || isTrading || !!balanceError}
        className={`w-full h-[56px] rounded-full font-semibold transition cursor-pointer flex items-center justify-center gap-1 mt-6 uppercase font-ibm-plex-mono ${
          amount && parseFloat(amount) > 0 && !balanceError && !isTrading
            ? ''
            : 'bg-[#414346] cursor-not-allowed'
        }`}
        style={
          amount && parseFloat(amount) > 0 && !balanceError && !isTrading
            ? {
                backgroundColor: sellingToken === 'sol' ? '#6ECC94' : '#FF6F94',
                color: '#161616',
                fontFamily: 'IBM Plex Mono, monospace',
                letterSpacing: '0em'
              }
            : { color: '#161616', fontFamily: 'IBM Plex Mono, monospace', letterSpacing: '0em' }
        }
      >
        {isTrading ? (
          <div className="animate-spin h-4 w-4 rounded-full border-2 border-[#161616] border-t-transparent"></div>
        ) : (
          <span>
            {(() => {
              const action = sellingToken === 'sol' ? 'BUY' : 'SELL';
              const market = selectedMarket === 'pass' ? 'PASS' : 'FAIL';
              const token = sellingToken === 'sol' ? 'SOL' : 'ZC';

              // Format amount with K/M notation for ZC
              let formattedAmount = amount;
              if (sellingToken === 'zc' && amount) {
                const num = parseFloat(amount);
                if (!isNaN(num)) {
                  if (num >= 1000000) {
                    formattedAmount = (num / 1000000).toFixed(2).replace(/\.?0+$/, '') + 'M';
                  } else if (num >= 1000) {
                    formattedAmount = (num / 1000).toFixed(2).replace(/\.?0+$/, '') + 'K';
                  }
                }
              }

              return `${action} ${market} ${formattedAmount} ${token}`;
            })()}
          </span>
        )}
      </button>
        </div>
      )}
    </div>
  );
});

TradingInterface.displayName = 'TradingInterface';

export default TradingInterface;