'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { usePrivyWallet } from '@/hooks/usePrivyWallet';
import { useWalletBalances } from '@/hooks/useWalletBalances';
import { useTokenPrices } from '@/hooks/useTokenPrices';
// import Sidebar from '@/components/Sidebar';
import TradingInterface from '@/components/TradingInterface';
import Header from '@/components/Header';
import { ProposalHeader } from '@/components/ProposalHeader';
import { MarketEntryControls } from '@/components/MarketEntryControls';
import { TradeHistoryTable } from '@/components/TradeHistoryTable';
import MarketChart from '@/components/MarketChart';
import { useProposals } from '@/hooks/useProposals';
import { useTradeHistory } from '@/hooks/useTradeHistory';
import { useUserBalances } from '@/hooks/useUserBalances';
import { useClaimablePositions } from '@/hooks/useClaimablePositions';
import { useVisualFocus } from '@/hooks/useVisualFocus';
import { formatNumber, formatVolume, formatCurrency } from '@/lib/formatters';
import { useSolanaWallets } from '@privy-io/react-auth/solana';
import { Transaction } from '@solana/web3.js';
import toast from 'react-hot-toast';
import { getProposalContent } from '@/lib/proposalContent';
import { renderToStaticMarkup } from 'react-dom/server';
import { CheckCircle2, XCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { claimWinnings } from '@/lib/trading';

const LivePriceDisplay = dynamic(() => import('@/components/LivePriceDisplay').then(mod => mod.LivePriceDisplay), {
  ssr: false,
  loading: () => (
    <div className="bg-[#181818] rounded-lg p-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="animate-pulse">
            <div className="h-24 bg-gray-700 rounded"></div>
          </div>
        ))}
      </div>
    </div>
  )
});

export default function HomePage() {
  const { ready, authenticated, user, walletAddress, login } = usePrivyWallet();
  const { proposals, loading, refetch } = useProposals();
  const [livePrices, setLivePrices] = useState<{ pass: number | null; fail: number | null }>({ pass: null, fail: null });
  const [twapData, setTwapData] = useState<{ passTwap: number | null; failTwap: number | null }>({ passTwap: null, failTwap: null });
  const [activeTab, setActiveTab] = useState<'trade' | 'description'>('trade');
  const [navTab, setNavTab] = useState<'live' | 'history'>('live');
  const [marketMode, setMarketMode] = useState<'enter' | 'exit'>('enter');
  const [amount, setAmount] = useState<string>('');
  const [selectedToken, setSelectedToken] = useState<'sol' | 'zc'>('sol');
  const [isEntering, setIsEntering] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [hoveredProposalId, setHoveredProposalId] = useState<number | null>(null);
  const [proposalPfgs, setProposalPfgs] = useState<Record<number, number>>({});
  const [claimingProposalId, setClaimingProposalId] = useState<number | null>(null);

  // Fetch wallet balances
  const { sol: solBalance, zc: zcBalance } = useWalletBalances(walletAddress);

  // Fetch token prices for USD conversion
  const { sol: solPrice, zc: zcPrice } = useTokenPrices();

  // Get Solana wallets for transaction signing
  const { wallets } = useSolanaWallets();

  // Fetch claimable positions for history view
  const { positions: claimablePositions } = useClaimablePositions(walletAddress);

  // Transaction signer helper for claiming
  const createTransactionSigner = useCallback(() => {
    return async (transaction: Transaction) => {
      const wallet = wallets[0];
      if (!wallet) throw new Error('No Solana wallet found');
      return await wallet.signTransaction(transaction);
    };
  }, [wallets]);

  // Handle claim from history card
  const handleClaimFromHistory = useCallback(async (
    proposalId: number,
    proposalStatus: 'Passed' | 'Failed',
    proposalRewards: Array<{ claimableToken: 'sol' | 'zc', claimableAmount: number, positionType: 'pass' | 'fail' }>
  ) => {
    if (!authenticated) {
      login();
      return;
    }

    if (!walletAddress) {
      toast.error('No wallet address found');
      return;
    }

    if (proposalRewards.length === 0) {
      toast.error('No position to claim');
      return;
    }

    // Determine user position type from rewards
    const userPositionType = proposalRewards[0].positionType;
    const userPosition = { type: userPositionType };

    setClaimingProposalId(proposalId);

    try {
      await claimWinnings({
        proposalId,
        proposalStatus,
        userPosition,
        userAddress: walletAddress,
        signTransaction: createTransactionSigner()
      });

      // The claimable positions will automatically refresh since they depend on wallet balances
      // which are refetched by the useClaimablePositions hook

    } catch (error) {
      console.error('Claim failed:', error);
      // Error toast is already shown by claimWinnings function
    } finally {
      setClaimingProposalId(null);
    }
  }, [authenticated, login, walletAddress, createTransactionSigner]);

  // Memoize sorted proposals
  const sortedProposals = useMemo(() =>
    [...proposals].sort((a, b) => b.finalizedAt - a.finalizedAt),
    [proposals]
  );

  // Fetch TWAP data for all finalized proposals when on history tab
  useEffect(() => {
    if (navTab === 'history' && sortedProposals.length > 0) {
      const fetchPfgs = async () => {
        const pfgMap: Record<number, number> = {};

        for (const proposal of sortedProposals) {
          if (proposal.status === 'Passed' || proposal.status === 'Failed') {
            const twapData = await api.getTWAP(proposal.id);
            if (twapData && twapData.failTwap > 0) {
              const pfg = ((twapData.passTwap - twapData.failTwap) / twapData.failTwap) * 100;
              pfgMap[proposal.id] = pfg;
            }
          }
        }

        setProposalPfgs(pfgMap);
      };

      fetchPfgs();
    }
  }, [navTab, sortedProposals]);

  const [selectedProposalId, setSelectedProposalId] = useState<number | null>(null);

  // Fetch user balances for the selected proposal
  const { data: userBalances, refetch: refetchBalances } = useUserBalances(selectedProposalId, walletAddress);
  const [selectedMarket, setSelectedMarket] = useState<'pass' | 'fail'>('pass');
  
  // Set initial selected proposal when proposals load
  useEffect(() => {
    if (sortedProposals.length > 0 && selectedProposalId === null) {
      setSelectedProposalId(sortedProposals[0].id);
    }
  }, [sortedProposals, selectedProposalId]);
  
  const proposal = useMemo(() =>
    proposals.find(p => p.id === selectedProposalId) || sortedProposals[0] || null,
    [selectedProposalId, proposals, sortedProposals]
  );

  // Fetch trade history for the selected proposal
  const {
    trades,
    loading: tradesLoading,
    getTimeAgo,
    formatAddress,
    getTokenUsed
  } = useTradeHistory(proposal?.id || null);
  
  const handleSelectProposal = useCallback((id: number) => {
    setSelectedProposalId(id);
  }, []);
  
  const handleMarketChange = useCallback((market: 'pass' | 'fail') => {
    setSelectedMarket(market);
  }, []);

  const handleTimerEnd = useCallback(() => {
    // Wait 5 seconds after timer ends to refetch proposals
    setTimeout(() => {
      refetch();
    }, 5000);
  }, [refetch]);

  const handlePricesUpdate = useCallback((prices: { pass: number | null; fail: number | null }) => {
    setLivePrices(prices);
  }, []);

  const handleTwapUpdate = useCallback((twap: { passTwap: number | null; failTwap: number | null }) => {
    console.log('TWAP update from LivePriceDisplay:', twap);
    setTwapData(twap);
  }, []);

  // Calculate if user has any position
  const hasPosition = useMemo(() => {
    if (!userBalances) return false;
    return (
      parseFloat(userBalances.base.passConditional || '0') > 0 ||
      parseFloat(userBalances.base.failConditional || '0') > 0 ||
      parseFloat(userBalances.quote.passConditional || '0') > 0 ||
      parseFloat(userBalances.quote.failConditional || '0') > 0
    );
  }, [userBalances]);

  // Check if user has any wallet balance
  const hasWalletBalance = useMemo(() => {
    return solBalance > 0 || zcBalance > 0;
  }, [solBalance, zcBalance]);

  // Visual focus states for highlighting/dimming UI elements
  const visualFocus = useVisualFocus(
    hasPosition,
    selectedMarket,
    proposal?.status as 'Pending' | 'Passed' | 'Failed' | 'Executed',
    hasWalletBalance
  );

  // Handle MAX button click
  const handleMaxClick = useCallback(() => {
    if (marketMode === 'enter') {
      let maxBalance = selectedToken === 'sol' ? solBalance : zcBalance;

      // Reserve 0.02 SOL for transaction fees when entering with SOL
      if (selectedToken === 'sol' && maxBalance !== null) {
        const SOL_GAS_RESERVE = 0.02;
        maxBalance = Math.max(0, maxBalance - SOL_GAS_RESERVE);
      }

      setAmount(maxBalance?.toString() || '0');
    } else {
      // Exit mode: calculate min of pass and fail for selected token
      if (userBalances) {
        let maxExitAmount = 0;
        if (selectedToken === 'sol') {
          const passSol = parseFloat(userBalances.quote.passConditional || '0') / 1e9;
          const failSol = parseFloat(userBalances.quote.failConditional || '0') / 1e9;
          maxExitAmount = Math.min(passSol, failSol);
        } else {
          const passZC = parseFloat(userBalances.base.passConditional || '0') / 1e6;
          const failZC = parseFloat(userBalances.base.failConditional || '0') / 1e6;
          maxExitAmount = Math.min(passZC, failZC);
        }
        setAmount(maxExitAmount.toString());
      }
    }
  }, [marketMode, selectedToken, solBalance, zcBalance, userBalances]);

  // Handle Enter Market - Split tokens into conditional tokens
  const handleEnterMarket = useCallback(async () => {
    if (!authenticated || !walletAddress) {
      toast.error('Please connect your wallet');
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    if (!proposal || proposal.id === undefined) {
      toast.error('No proposal selected');
      return;
    }

    setIsEntering(true);
    const toastId = toast.loading('Entering market...');

    try {
      // Determine vault type based on selected token
      const vaultType = selectedToken === 'sol' ? 'quote' : 'base';

      // Convert amount to smallest units
      const decimals = selectedToken === 'sol' ? 9 : 6; // SOL: 9, ZC: 6
      const amountInSmallestUnits = Math.floor(parseFloat(amount) * Math.pow(10, decimals));

      // Build split transaction
      const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const buildResponse = await fetch(`${API_BASE_URL}/api/vaults/${proposal.id}/${vaultType}/buildSplitTx`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user: walletAddress,
          amount: amountInSmallestUnits.toString()
        })
      });

      if (!buildResponse.ok) {
        const error = await buildResponse.json();
        throw new Error(error.message || 'Failed to build split transaction');
      }

      const buildData = await buildResponse.json();

      // Sign the transaction
      const splitTx = Transaction.from(Buffer.from(buildData.transaction, 'base64'));
      const wallet = wallets[0];
      if (!wallet) throw new Error('No Solana wallet found');
      const signedTx = await wallet.signTransaction(splitTx);

      // Execute split transaction
      const executeResponse = await fetch(`${API_BASE_URL}/api/vaults/${proposal.id}/${vaultType}/executeSplitTx`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transaction: Buffer.from(signedTx.serialize({ requireAllSignatures: false })).toString('base64')
        })
      });

      if (!executeResponse.ok) {
        const error = await executeResponse.json();
        throw new Error(error.message || 'Failed to execute split transaction');
      }

      toast.success('Successfully entered market!', { id: toastId, duration: 5000 });

      // Clear amount and refresh balances
      setAmount('');
      refetchBalances();

    } catch (error) {
      console.error('Enter market failed:', error);
      toast.error(
        `Failed to enter market: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { id: toastId }
      );
    } finally {
      setIsEntering(false);
    }
  }, [authenticated, walletAddress, amount, proposal, selectedToken, wallets, refetchBalances]);

  // Handle Exit Market - Merge conditional tokens back
  const handleExitMarket = useCallback(async () => {
    if (!authenticated || !walletAddress) {
      toast.error('Please connect your wallet');
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    if (!proposal || proposal.id === undefined) {
      toast.error('No proposal selected');
      return;
    }

    if (!userBalances) {
      toast.error('Unable to get user balances');
      return;
    }

    setIsExiting(true);
    const toastId = toast.loading('Exiting market...');

    try {
      // Determine vault type based on selected token
      const vaultType = selectedToken === 'sol' ? 'quote' : 'base';

      // Convert amount to smallest units
      const decimals = selectedToken === 'sol' ? 9 : 6; // SOL: 9, ZC: 6
      const amountInSmallestUnits = Math.floor(parseFloat(amount) * Math.pow(10, decimals));

      // Build merge transaction
      const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const buildResponse = await fetch(`${API_BASE_URL}/api/vaults/${proposal.id}/${vaultType}/buildMergeTx`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user: walletAddress,
          amount: amountInSmallestUnits.toString()
        })
      });

      if (!buildResponse.ok) {
        const error = await buildResponse.json();
        throw new Error(error.message || 'Failed to build merge transaction');
      }

      const buildData = await buildResponse.json();

      // Sign the transaction
      const mergeTx = Transaction.from(Buffer.from(buildData.transaction, 'base64'));
      const wallet = wallets[0];
      if (!wallet) throw new Error('No Solana wallet found');
      const signedTx = await wallet.signTransaction(mergeTx);

      // Execute merge transaction
      const executeResponse = await fetch(`${API_BASE_URL}/api/vaults/${proposal.id}/${vaultType}/executeMergeTx`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transaction: Buffer.from(signedTx.serialize({ requireAllSignatures: false })).toString('base64')
        })
      });

      if (!executeResponse.ok) {
        const error = await executeResponse.json();
        throw new Error(error.message || 'Failed to execute merge transaction');
      }

      toast.success('Successfully exited market!', { id: toastId, duration: 5000 });

      // Clear amount and refresh balances
      setAmount('');
      refetchBalances();

    } catch (error) {
      console.error('Exit market failed:', error);
      toast.error(
        `Failed to exit market: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { id: toastId }
      );
    } finally {
      setIsExiting(false);
    }
  }, [authenticated, walletAddress, amount, proposal, selectedToken, userBalances, wallets, refetchBalances]);

  // Calculate PFG percentage and passing status to match backend logic
  const { pfgPercentage, isPassing } = useMemo(() => {
    // Match backend calculation exactly from app/twap-oracle.ts
    if (twapData.passTwap !== null && twapData.failTwap !== null && twapData.failTwap > 0) {
      const percentage = ((twapData.passTwap - twapData.failTwap) / twapData.failTwap) * 100;
      // Backend checks: difference > threshold
      // Where threshold = (failTwap * passThresholdBps) / 10000
      // Which simplifies to: percentage > passThresholdBps/100
      const thresholdPercentage = proposal ? proposal.passThresholdBps / 100 : 0;
      const passing = percentage > thresholdPercentage;
      return { pfgPercentage: percentage, isPassing: passing };
    }
    return { pfgPercentage: null, isPassing: false };
  }, [twapData.passTwap, twapData.failTwap, proposal?.passThresholdBps]);

  if (loading) {
    return (
      <div className="flex h-screen bg-[#0a0a0a]">
        {/* Main content skeleton */}
        <div className="flex-1 flex items-center justify-center">
          <div className="text-gray-500">Loading...</div>
        </div>
      </div>
    );
  }

  if (!proposal || proposals.length === 0) {
    return (
      <div className="flex h-screen bg-[#0a0a0a]">
        {/* Main Content */}
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <Header
            walletAddress={walletAddress}
            authenticated={authenticated}
            solBalance={solBalance}
            zcBalance={zcBalance}
            hasWalletBalance={hasWalletBalance}
            login={login}
          />

          {/* Tab Navigation */}
          <div className="px-8">
            <div className="flex pt-1">
              <button
                onClick={() => setNavTab('live')}
                className={`text-sm py-1 px-4 transition-all duration-200 ease-in-out cursor-pointer my-0.5 hover:bg-white/10 hover:rounded relative ${
                  navTab === 'live'
                    ? 'text-white'
                    : 'text-gray-400 hover:text-gray-300'
                }`}
              >
                {navTab === 'live' && (
                  <div className="absolute -top-[7px] left-0 right-0 h-[2px] bg-white z-10" />
                )}
                Live
              </button>
              <button
                onClick={() => setNavTab('history')}
                className={`text-sm py-1 px-4 transition-all duration-200 ease-in-out cursor-pointer my-0.5 hover:bg-white/10 hover:rounded relative ${
                  navTab === 'history'
                    ? 'text-white'
                    : 'text-gray-400 hover:text-gray-300'
                }`}
              >
                {navTab === 'history' && (
                  <div className="absolute -top-[7px] left-0 right-0 h-[2px] bg-white z-10" />
                )}
                History
              </button>
            </div>
          </div>

          {/* Empty state */}
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <h2 className="text-2xl font-semibold text-gray-400 mb-2">No Proposals</h2>
              <p className="text-gray-500">Check back later for new governance proposals</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#0a0a0a]">
      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <Header
          walletAddress={walletAddress}
          authenticated={authenticated}
          solBalance={solBalance}
          zcBalance={zcBalance}
          hasWalletBalance={hasWalletBalance}
          login={login}
        />

        {/* Tab Navigation */}
        <div className="px-8">
          <div className="flex pt-1">
            <button
              onClick={() => setNavTab('live')}
              className={`text-sm py-1 px-4 transition-all duration-200 ease-in-out cursor-pointer my-0.5 hover:bg-white/10 hover:rounded relative ${
                navTab === 'live'
                  ? 'text-white'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              {navTab === 'live' && (
                <div className="absolute -top-[7px] left-0 right-0 h-[2px] bg-white z-10" />
              )}
              Live
            </button>
            <button
              onClick={() => setNavTab('history')}
              className={`text-sm py-1 px-4 transition-all duration-200 ease-in-out cursor-pointer my-0.5 hover:bg-white/10 hover:rounded relative ${
                navTab === 'history'
                  ? 'text-white'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              {navTab === 'history' && (
                <div className="absolute -top-[7px] left-0 right-0 h-[2px] bg-white z-10" />
              )}
              History
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex overflow-hidden">
          {navTab === 'live' && (
            <>
          <div className="flex-1 p-8 pr-10 overflow-y-auto border-r border-[#2A2A2A]">
            <ProposalHeader
              proposalId={proposal.id}
              status={proposal.status as 'Pending' | 'Passed' | 'Failed' | 'Executed'}
              finalizedAt={proposal.finalizedAt}
              description={proposal.description}
              activeTab={activeTab}
              onTabChange={setActiveTab}
              onTimerEnd={handleTimerEnd}
              pfgPercentage={pfgPercentage}
            />

            {/* Trade Tab Content */}
            {activeTab === 'trade' && (
              <div className="mb-8">
              {/* User Market Balances */}
              {authenticated && walletAddress && userBalances && (
                <div className="grid grid-cols-2 gap-4 mt-1">
                  {/* Pass Market Column */}
                  <div className={`overflow-hidden rounded-lg ${visualFocus.passMarket.className}`}>
                    {/* Pass Market Balance */}
                    <div className="bg-[#1A1A1A] p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-emerald-400">If Pass</span>
                        <div className="flex items-center gap-2 text-base font-bold text-white">
                          <span
                            className="group relative cursor-default"
                            title={zcPrice ? formatCurrency((parseFloat(userBalances.base.passConditional || '0') / 1e6) * zcPrice, 2) : 'Price unavailable'}
                          >
                            {formatNumber(parseFloat(userBalances.base.passConditional || '0') / 1e6, 0)} $ZC
                            {zcPrice && (
                              <span className="absolute left-0 top-full mt-1 px-2 py-1 bg-[#2a2a2a] border border-[#404040] rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                {formatCurrency((parseFloat(userBalances.base.passConditional || '0') / 1e6) * zcPrice, 2)}
                              </span>
                            )}
                          </span>
                          <span className="text-gray-600">|</span>
                          <div className="flex items-center gap-1 group relative cursor-default" title={solPrice ? formatCurrency((parseFloat(userBalances.quote.passConditional || '0') / 1e9) * solPrice, 2) : 'Price unavailable'}>
                            <span>{formatNumber(parseFloat(userBalances.quote.passConditional || '0') / 1e9, 6)}</span>
                            <svg className="h-3 w-3" viewBox="0 0 101 88" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M100.48 69.3817L83.8068 86.8015C83.4444 87.1799 83.0058 87.4816 82.5185 87.6878C82.0312 87.894 81.5055 88.0003 80.9743 88H1.93563C1.55849 88 1.18957 87.8926 0.874202 87.6912C0.558829 87.4897 0.31074 87.2029 0.160416 86.8659C0.0100923 86.529 -0.0359181 86.1566 0.0280382 85.7945C0.0919944 85.4324 0.263131 85.0964 0.520422 84.8278L17.2061 67.408C17.5676 67.0306 18.0047 66.7295 18.4904 66.5234C18.9762 66.3172 19.5002 66.2104 20.0301 66.2095H99.0644C99.4415 66.2095 99.8104 66.3169 100.126 66.5183C100.441 66.7198 100.689 67.0065 100.84 67.3435C100.99 67.6804 101.036 68.0529 100.972 68.415C100.908 68.7771 100.737 69.1131 100.48 69.3817ZM83.8068 36.3032C83.4444 35.9248 83.0058 35.6231 82.5185 35.4169C82.0312 35.2108 81.5055 35.1045 80.9743 35.1048H1.93563C1.55849 35.1048 1.18957 35.2121 0.874202 35.4136C0.558829 35.6151 0.31074 35.9019 0.160416 36.2388C0.0100923 36.5758 -0.0359181 36.9482 0.0280382 37.3103C0.0919944 37.6723 0.263131 38.0083 0.520422 38.277L17.2061 55.6968C17.5676 56.0742 18.0047 56.3752 18.4904 56.5814C18.9762 56.7875 19.5002 56.8944 20.0301 56.8952H99.0644C99.4415 56.8952 99.8104 56.7879 100.126 56.5864C100.441 56.3849 100.689 56.0981 100.84 55.7612C100.99 55.4242 101.036 55.0518 100.972 54.6897C100.908 54.3277 100.737 53.9917 100.48 53.723L83.8068 36.3032ZM1.93563 21.7905H80.9743C81.5055 21.7898 82.0312 21.6835 82.5185 21.4773C83.0058 21.2712 83.4444 20.9695 83.8068 20.5911L100.48 3.17133C100.737 2.90265 100.908 2.56667 100.972 2.2046C101.036 1.84253 100.99 1.47008 100.84 1.13314C100.689 0.796193 100.441 0.509443 100.126 0.307961C99.8104 0.106479 99.4415 -0.000854492 99.0644 -0.000854492H20.0301C19.5002 -0.00013126 18.9762 0.106791 18.4904 0.312929C18.0047 0.519068 17.5676 0.820087 17.2061 1.19754L0.524723 18.6173C0.267481 18.8859 0.0963642 19.2219 0.0323936 19.584C-0.0315771 19.946 0.0144792 20.3184 0.164862 20.6554C0.315245 20.9923 0.563347 21.2791 0.878727 21.4806C1.19411 21.682 1.56303 21.7894 1.94013 21.7896L1.93563 21.7905Z" fill="#AFAFAF"/>
                            </svg>
                            {solPrice && (
                              <span className="absolute right-0 top-full mt-1 px-2 py-1 bg-[#2a2a2a] border border-[#404040] rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                {formatCurrency((parseFloat(userBalances.quote.passConditional || '0') / 1e9) * solPrice, 2)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Pass Market Chart */}
                    <div className="bg-[#1A1A1A] overflow-hidden">
                      <MarketChart proposalId={proposal.id} market="pass" height={512} />
                    </div>
                  </div>

                  {/* Fail Market Column */}
                  <div className={`overflow-hidden rounded-lg ${visualFocus.failMarket.className}`}>
                    {/* Fail Market Balance */}
                    <div className="bg-[#1A1A1A] p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-rose-400">If Fail</span>
                        <div className="flex items-center gap-2 text-base font-bold text-white">
                          <span
                            className="group relative cursor-default"
                            title={zcPrice ? formatCurrency((parseFloat(userBalances.base.failConditional || '0') / 1e6) * zcPrice, 2) : 'Price unavailable'}
                          >
                            {formatNumber(parseFloat(userBalances.base.failConditional || '0') / 1e6, 0)} $ZC
                            {zcPrice && (
                              <span className="absolute left-0 top-full mt-1 px-2 py-1 bg-[#2a2a2a] border border-[#404040] rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                {formatCurrency((parseFloat(userBalances.base.failConditional || '0') / 1e6) * zcPrice, 2)}
                              </span>
                            )}
                          </span>
                          <span className="text-gray-600">|</span>
                          <div className="flex items-center gap-1 group relative cursor-default" title={solPrice ? formatCurrency((parseFloat(userBalances.quote.failConditional || '0') / 1e9) * solPrice, 2) : 'Price unavailable'}>
                            <span>{formatNumber(parseFloat(userBalances.quote.failConditional || '0') / 1e9, 6)}</span>
                            <svg className="h-3 w-3" viewBox="0 0 101 88" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M100.48 69.3817L83.8068 86.8015C83.4444 87.1799 83.0058 87.4816 82.5185 87.6878C82.0312 87.894 81.5055 88.0003 80.9743 88H1.93563C1.55849 88 1.18957 87.8926 0.874202 87.6912C0.558829 87.4897 0.31074 87.2029 0.160416 86.8659C0.0100923 86.529 -0.0359181 86.1566 0.0280382 85.7945C0.0919944 85.4324 0.263131 85.0964 0.520422 84.8278L17.2061 67.408C17.5676 67.0306 18.0047 66.7295 18.4904 66.5234C18.9762 66.3172 19.5002 66.2104 20.0301 66.2095H99.0644C99.4415 66.2095 99.8104 66.3169 100.126 66.5183C100.441 66.7198 100.689 67.0065 100.84 67.3435C100.99 67.6804 101.036 68.0529 100.972 68.415C100.908 68.7771 100.737 69.1131 100.48 69.3817ZM83.8068 36.3032C83.4444 35.9248 83.0058 35.6231 82.5185 35.4169C82.0312 35.2108 81.5055 35.1045 80.9743 35.1048H1.93563C1.55849 35.1048 1.18957 35.2121 0.874202 35.4136C0.558829 35.6151 0.31074 35.9019 0.160416 36.2388C0.0100923 36.5758 -0.0359181 36.9482 0.0280382 37.3103C0.0919944 37.6723 0.263131 38.0083 0.520422 38.277L17.2061 55.6968C17.5676 56.0742 18.0047 56.3752 18.4904 56.5814C18.9762 56.7875 19.5002 56.8944 20.0301 56.8952H99.0644C99.4415 56.8952 99.8104 56.7879 100.126 56.5864C100.441 56.3849 100.689 56.0981 100.84 55.7612C100.99 55.4242 101.036 55.0518 100.972 54.6897C100.908 54.3277 100.737 53.9917 100.48 53.723L83.8068 36.3032ZM1.93563 21.7905H80.9743C81.5055 21.7898 82.0312 21.6835 82.5185 21.4773C83.0058 21.2712 83.4444 20.9695 83.8068 20.5911L100.48 3.17133C100.737 2.90265 100.908 2.56667 100.972 2.2046C101.036 1.84253 100.99 1.47008 100.84 1.13314C100.689 0.796193 100.441 0.509443 100.126 0.307961C99.8104 0.106479 99.4415 -0.000854492 99.0644 -0.000854492H20.0301C19.5002 -0.00013126 18.9762 0.106791 18.4904 0.312929C18.0047 0.519068 17.5676 0.820087 17.2061 1.19754L0.524723 18.6173C0.267481 18.8859 0.0963642 19.2219 0.0323936 19.584C-0.0315771 19.946 0.0144792 20.3184 0.164862 20.6554C0.315245 20.9923 0.563347 21.2791 0.878727 21.4806C1.19411 21.682 1.56303 21.7894 1.94013 21.7896L1.93563 21.7905Z" fill="#AFAFAF"/>
                            </svg>
                            {solPrice && (
                              <span className="absolute right-0 top-full mt-1 px-2 py-1 bg-[#2a2a2a] border border-[#404040] rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                {formatCurrency((parseFloat(userBalances.quote.failConditional || '0') / 1e9) * solPrice, 2)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Fail Market Chart */}
                    <div className="bg-[#1A1A1A] overflow-hidden">
                      <MarketChart proposalId={proposal.id} market="fail" height={512} />
                    </div>
                  </div>
                </div>
              )}

            {/* Hidden component for TWAP updates */}
            <div className="hidden">
              <LivePriceDisplay
                proposalId={proposal.id}
                onPricesUpdate={handlePricesUpdate}
                onTwapUpdate={handleTwapUpdate}
              />
            </div>

            <div className="mt-6">
              <TradeHistoryTable
                trades={trades}
                loading={tradesLoading}
                getTimeAgo={getTimeAgo}
                formatAddress={formatAddress}
                getTokenUsed={getTokenUsed}
              />
            </div>
              </div>
            )}
          </div>

          {/* Trading Panel - Sticky Position */}
          <div className="w-[352px] p-8 overflow-y-auto">
            <div className="sticky top-0 space-y-6">
              {authenticated && proposal.status === 'Pending' && (
                <div className={visualFocus.entryControls.className}>
                  <MarketEntryControls
                  marketMode={marketMode}
                  amount={amount}
                  selectedToken={selectedToken}
                  isEntering={isEntering}
                  isExiting={isExiting}
                  hasPosition={hasPosition}
                  solBalance={solBalance}
                  zcBalance={zcBalance}
                  userBalances={userBalances}
                  onMarketModeChange={(mode) => {
                    setMarketMode(mode);
                    setAmount('');
                  }}
                  onAmountChange={setAmount}
                  onTokenChange={(token) => {
                    setSelectedToken(token);
                    setAmount('');
                  }}
                  onMaxClick={handleMaxClick}
                  onSubmit={() => {
                    if (marketMode === 'enter') {
                      handleEnterMarket();
                    } else {
                      handleExitMarket();
                    }
                  }}
                  />
                </div>
              )}

              <TradingInterface
              proposalId={proposal.id}
              selectedMarket={selectedMarket}
              onMarketChange={handleMarketChange}
              passPrice={0.5}
              failPrice={0.5}
              proposalStatus={
                proposal.status === 'Executed' ? 'Passed' :
                proposal.status as 'Pending' | 'Passed' | 'Failed'
              }
              userBalances={userBalances}
              refetchBalances={refetchBalances}
              visualFocusClassName={visualFocus.tradingInterface.className}
              />
            </div>
          </div>
            </>
          )}

          {navTab === 'history' && (
            <div className="flex-1 flex justify-center overflow-y-auto">
              <div className="w-full max-w-[1332px] 2xl:max-w-[1512px] pt-8">
                <div className="text-white mb-6">
                  <h2 className="text-2xl font-medium">History</h2>
                </div>
                <div className="grid grid-cols-3 gap-4 auto-rows-auto items-start pb-8">
                  {sortedProposals.map((proposal) => {
                    const proposalContent = getProposalContent(proposal.id, proposal.description);
                    const isHovered = hoveredProposalId === proposal.id;

                    // Extract first section (Executive Summary) for preview
                    let summaryPreview = proposal.description;
                    if (proposalContent.content) {
                      try {
                        const htmlString = renderToStaticMarkup(proposalContent.content as React.ReactElement);
                        // Extract content between first and second <h3> tags (the first section)
                        const sections = htmlString.split(/<h3/);
                        if (sections.length > 1) {
                          // Get the first section with its heading
                          const firstSectionWithHeading = '<h3' + sections[1];
                          // Extract up to the closing tag of the section or next heading
                          const sectionEnd = sections.length > 2 ? firstSectionWithHeading.indexOf('</div>') : firstSectionWithHeading.length;
                          const firstSection = sectionEnd > 0 ? firstSectionWithHeading.substring(0, sectionEnd) : firstSectionWithHeading;

                          summaryPreview = firstSection
                            .replace(/<[^>]*>/g, ' ')
                            .replace(/&gt;/g, '>')
                            .replace(/&lt;/g, '<')
                            .replace(/&amp;/g, '&')
                            .replace(/&apos;/g, "'")
                            .replace(/&quot;/g, '"')
                            .replace(/\s+/g, ' ')
                            .trim()
                            // Remove "Executive Summary" or "Summary" heading text
                            .replace(/^(Executive Summary|Summary)\s+/i, '');
                        }
                      } catch (e) {
                        summaryPreview = proposal.description;
                      }
                    }

                    // Get claimable rewards for this proposal
                    const proposalRewards = claimablePositions.filter(pos => pos.proposalId === proposal.id);
                    const hasClaimableRewards = proposalRewards.length > 0;
                    const isCurrentlyClaiming = claimingProposalId === proposal.id;

                    return (
                      <div
                        key={proposal.id}
                        onMouseEnter={() => setHoveredProposalId(proposal.id)}
                        onMouseLeave={() => setHoveredProposalId(null)}
                        onClick={() => {
                          if (hasClaimableRewards && !isCurrentlyClaiming) {
                            handleClaimFromHistory(
                              proposal.id,
                              proposal.status as 'Passed' | 'Failed',
                              proposalRewards
                            );
                          }
                        }}
                        className={`bg-[#121212] border border-[#191919] rounded-[9px] p-3 hover:border-[#2A2A2A] transition-all duration-300 ${
                          hasClaimableRewards ? 'cursor-pointer' : ''
                        } ${isCurrentlyClaiming ? 'opacity-60 pointer-events-none' : ''}`}
                      >
                        <div className="text-white flex flex-col gap-4">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <div className="text-sm font-semibold">ZC-{proposal.id}</div>
                              {proposal.status === 'Passed' && (
                                <span className="flex items-center gap-1 px-2 py-0.5 text-xs font-normal rounded-full" style={{ backgroundColor: '#6ECC9433', color: '#6ECC94' }}>
                                  Pass
                                  <CheckCircle2 className="w-3 h-3" />
                                </span>
                              )}
                              {proposal.status === 'Failed' && (
                                <span className="flex items-center gap-1 px-2 py-0.5 text-xs font-normal rounded-full" style={{ backgroundColor: '#FF6F9433', color: '#FF6F94' }}>
                                  Fail
                                  <XCircle className="w-3 h-3" />
                                </span>
                              )}
                              {proposalPfgs[proposal.id] !== undefined && (
                                <span className="px-2 py-0.5 text-xs font-normal rounded-full bg-gray-500/20 text-gray-300">
                                  Final PFG: {proposalPfgs[proposal.id].toFixed(1)}%
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-[#B0AFAB]">
                              {new Date(proposal.finalizedAt).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric'
                              })}
                            </div>
                          </div>

                          <div className="text-lg font-semibold">{proposalContent.title}</div>

                          {/* Show summary or full content based on hover */}
                          <div className="relative">
                            {/* Summary preview - shown when not hovered */}
                            <div
                              className={`text-sm text-gray-300 transition-all duration-300 ease-in-out ${
                                isHovered ? 'opacity-0 max-h-0 overflow-hidden' : 'opacity-100 max-h-[1000px]'
                              }`}
                            >
                              {summaryPreview}
                            </div>

                            {/* Full content - shown when hovered */}
                            <div
                              className={`text-sm text-gray-300 transition-all duration-300 ease-in-out ${
                                isHovered ? 'opacity-100 max-h-[5000px]' : 'opacity-0 max-h-0 overflow-hidden'
                              }`}
                            >
                              {proposalContent.content || <p>{proposal.description}</p>}
                            </div>
                          </div>

                          {/* Only show claim row if user has claimable rewards */}
                          {proposalRewards.length > 0 && (
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5">
                                <div className="relative flex items-center justify-center">
                                  <div className="w-2 h-2 rounded-full absolute" style={{ backgroundColor: '#EF6300', opacity: 0.75, animation: 'ping 3s cubic-bezier(0, 0, 0.2, 1) infinite' }}></div>
                                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#EF6300' }}></div>
                                </div>
                                <span className="text-sm font-normal" style={{ color: '#EF6300' }}>Click to claim</span>
                              </div>

                              {/* Rewards display */}
                              <div className="flex items-center gap-2 text-sm text-white">
                                {proposalRewards.map((reward, idx) => (
                                  <div key={idx} className="flex items-center gap-2">
                                    {idx > 0 && (
                                      <div className="w-px h-4 bg-[#2A2A2A]"></div>
                                    )}
                                    <span className="font-medium">
                                      {reward.claimableToken === 'zc'
                                        ? formatNumber(reward.claimableAmount, 0)
                                        : reward.claimableAmount.toFixed(4)
                                      } {reward.claimableToken === 'zc' ? 'ZC' : 'SOL'}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
