'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { usePrivyWallet } from '@/hooks/usePrivyWallet';
import { useWalletBalances } from '@/hooks/useWalletBalances';
import { useTokenPrices } from '@/hooks/useTokenPrices';
// import Sidebar from '@/components/Sidebar';
import TradingInterface from '@/components/TradingInterface';
import Header from '@/components/Header';
import { CountdownTimer } from '@/components/CountdownTimer';
import { ChartBox } from '@/components/ChartBox';
import { ModeToggle } from '@/components/ModeToggle';
import { DepositCard } from '@/components/DepositCard';
import { useProposals } from '@/hooks/useProposals';
import { useTradeHistory } from '@/hooks/useTradeHistory';
import { useUserBalances } from '@/hooks/useUserBalances';
import { useClaimablePositions } from '@/hooks/useClaimablePositions';
import { formatNumber, formatCurrency } from '@/lib/formatters';
import { useSolanaWallets } from '@privy-io/react-auth/solana';
import { Transaction } from '@solana/web3.js';
import toast from 'react-hot-toast';
import { getProposalContent } from '@/lib/proposalContent';
import { renderToStaticMarkup } from 'react-dom/server';
import { CheckCircle2, XCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { claimWinnings } from '@/lib/trading';
import { buildApiUrl } from '@/lib/api-utils';
import Masonry from 'react-masonry-css';

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
  const [navTab, setNavTab] = useState<'live' | 'history'>('live');
  const [hoveredProposalId, setHoveredProposalId] = useState<number | null>(null);
  const [proposalPfgs, setProposalPfgs] = useState<Record<number, number>>({});
  const [claimingProposalId, setClaimingProposalId] = useState<number | null>(null);
  const [isPassMode, setIsPassMode] = useState(true);

  // Fetch wallet balances
  const { sol: solBalance, zc: zcBalance } = useWalletBalances(walletAddress);

  // Fetch token prices for USD conversion
  const { sol: solPrice, zc: zcPrice } = useTokenPrices();

  // Get Solana wallets for transaction signing
  const { wallets } = useSolanaWallets();

  // Fetch claimable positions for history view
  const { positions: claimablePositions, refetch: refetchClaimable } = useClaimablePositions(walletAddress);

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

      // Refresh claimable positions to update UI
      refetchClaimable();

    } catch (error) {
      console.error('Claim failed:', error);
      // Error toast is already shown by claimWinnings function
    } finally {
      setClaimingProposalId(null);
    }
  }, [authenticated, login, walletAddress, createTransactionSigner, refetchClaimable]);

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
    refetch: refetchTrades,
    getTimeAgo,
    getTokenUsed
  } = useTradeHistory(proposal?.id || null);

  // Calculate market caps based on live prices and SOL price
  const marketCaps = useMemo(() => {
    const TOTAL_SUPPLY = proposal?.totalSupply || 1_000_000_000;
    if (!solPrice) {
      return { pass: null, fail: null };
    }
    return {
      pass: livePrices.pass ? livePrices.pass * TOTAL_SUPPLY * solPrice : null,
      fail: livePrices.fail ? livePrices.fail * TOTAL_SUPPLY * solPrice : null,
    };
  }, [livePrices.pass, livePrices.fail, solPrice, proposal?.totalSupply]);

  const handleSelectProposal = useCallback((id: number) => {
    setSelectedProposalId(id);
  }, []);
  
  const handleMarketChange = useCallback((market: 'pass' | 'fail') => {
    setSelectedMarket(market);
    // Also sync the mode toggle
    setIsPassMode(market === 'pass');
  }, []);

  const handleModeToggle = useCallback((newIsPassMode: boolean) => {
    setIsPassMode(newIsPassMode);
    // Also sync the selected market
    setSelectedMarket(newIsPassMode ? 'pass' : 'fail');
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

  /* TRADING FUNCTIONS - COMMENTED OUT UNTIL TRADING MODAL IS IMPLEMENTED
  // Handle MAX button click - TODO: Move to trading modal
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
      const buildResponse = await fetch(buildApiUrl(API_BASE_URL, `/api/vaults/${proposal.id}/${vaultType}/buildSplitTx`), {
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
      const executeResponse = await fetch(buildApiUrl(API_BASE_URL, `/api/vaults/${proposal.id}/${vaultType}/executeSplitTx`), {
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
      const buildResponse = await fetch(buildApiUrl(API_BASE_URL, `/api/vaults/${proposal.id}/${vaultType}/buildMergeTx`), {
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
      const executeResponse = await fetch(buildApiUrl(API_BASE_URL, `/api/vaults/${proposal.id}/${vaultType}/executeMergeTx`), {
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
  */

  // Calculate PFG percentage to match backend logic
  const pfgPercentage = useMemo(() => {
    // Match backend calculation exactly from app/twap-oracle.ts
    if (twapData.passTwap !== null && twapData.failTwap !== null && twapData.failTwap > 0) {
      const percentage = ((twapData.passTwap - twapData.failTwap) / twapData.failTwap) * 100;
      return percentage;
    }
    return null;
  }, [twapData.passTwap, twapData.failTwap]);

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
      <div className="flex h-screen" style={{ backgroundColor: '#0a0a0a' }}>
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
            navTab={navTab}
            onNavTabChange={setNavTab}
            isPassMode={isPassMode}
          />

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
    <div className="flex h-screen" style={{ backgroundColor: '#0a0a0a' }}>
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
          navTab={navTab}
          onNavTabChange={setNavTab}
          isPassMode={isPassMode}
        />

        {/* Content Area */}
        <div className="flex-1 flex overflow-hidden">
          {navTab === 'live' && (
            <div className="flex-1 flex justify-center overflow-y-auto">
              <div className="w-full max-w-[1332px] 2xl:max-w-[1512px] pt-8 pb-8">
                <div className="mb-6">
                  <h2 className="text-2xl font-medium" style={{ color: '#E9E9E3' }}>Live Proposal</h2>
                </div>

                {/* 2-column layout: 2/3 left, 1/3 right */}
                <div className="grid grid-cols-3 gap-4">
                  {/* Left Column (2/3 width) */}
                  <div className="col-span-2 flex flex-col gap-4 pb-12">
                    {/* Top Row: Title/Description and Time Left */}
                    <div className="flex gap-4 items-stretch">
                      {/* Title and Description */}
                      {(() => {
                        // Clean description first - remove GitHub URLs
                        let cleanedDescription = proposal.description;
                        let githubUrl = null;

                        const descriptionStr = typeof proposal.description === 'string'
                          ? proposal.description
                          : '';

                        if (descriptionStr) {
                          const githubMatch = descriptionStr.match(/(https?:\/\/github\.com\/[^\s\)\],]+)/i);
                          githubUrl = githubMatch ? githubMatch[1] : null;

                          // Remove GitHub URL from description
                          cleanedDescription = descriptionStr.replace(/(https?:\/\/github\.com\/[^\s\)\],]+)/gi, '').trim();
                        }

                        const content = getProposalContent(proposal.id, proposal.title, cleanedDescription, process.env.NEXT_PUBLIC_MODERATOR_ID);
                        const rawContent = content.content || cleanedDescription || '';

                        const cardInner = (
                          <div className="flex flex-col justify-between h-full">
                            <h1 className="text-sm font-semibold font-ibm-plex-mono tracking-[0.2em] mb-6 uppercase flex items-center justify-between" style={{ color: '#DDDDD7' }}>
                              PROPOSAL ZC-{proposal.id}
                              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                              </svg>
                            </h1>
                            <div className="text-lg font-normal mb-2" style={{ color: '#E9E9E3' }}>
                              {content.title}
                            </div>
                            <div className="text-sm description-links" style={{ color: '#DDDDD7' }}>
                              {rawContent}
                            </div>
                          </div>
                        );

                        return githubUrl ? (
                          <a href={githubUrl} target="_blank" rel="noopener noreferrer" className="flex-[4] h-full">
                            <div className="bg-[#121212] border border-[#191919] rounded-[9px] py-4 px-5 hover:border-[#2A2A2A] transition-all duration-300 cursor-pointer h-full">
                              {cardInner}
                            </div>
                          </a>
                        ) : (
                          <div className="flex-[4] bg-[#121212] border border-[#191919] rounded-[9px] py-4 px-5 transition-all duration-300">
                            {cardInner}
                          </div>
                        );
                      })()}

                      {/* Time Remaining */}
                      <div className="flex-1 bg-[#121212] border border-[#191919] rounded-[9px] py-4 px-5 transition-all duration-300">
                        <div className="text-white flex flex-col items-center">
                          <span className="text-sm font-semibold font-ibm-plex-mono tracking-[0.2em] uppercase mb-6 block w-full text-left" style={{ color: '#DDDDD7' }}>TIME REMAINING</span>
                          <CountdownTimer
                            endsAt={proposal.finalizedAt}
                            onTimerEnd={handleTimerEnd}
                            isPending={proposal.status === 'Pending'}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Chart */}
                    <ChartBox
                      proposalId={proposal.id}
                      selectedMarket={selectedMarket}
                      trades={trades.filter(trade => trade.market === selectedMarket)}
                      tradesLoading={tradesLoading}
                      getTimeAgo={getTimeAgo}
                      getTokenUsed={getTokenUsed}
                    />
                  </div>

                  {/* Right Column (1/3 width) */}
                  <div className="col-span-1 flex flex-col gap-4 pb-12">
                    {/* Deposit Card */}
                    <DepositCard
                      proposalId={proposal.id}
                      solBalance={solBalance}
                      zcBalance={zcBalance}
                      onDepositSuccess={refetchBalances}
                    />

                    {/* Mode Toggle */}
                    <ModeToggle
                      isPassMode={isPassMode}
                      onToggle={handleModeToggle}
                      pfgPercentage={pfgPercentage}
                      passMarketCap={marketCaps.pass}
                      failMarketCap={marketCaps.fail}
                    />

                    {/* Trading Interface */}
                    <div className="bg-[#121212] border border-[#191919] rounded-[9px] py-4 px-5 transition-all duration-300">
                      <div className="text-white flex flex-col items-center">
                        <span className="text-sm font-semibold font-ibm-plex-mono tracking-[0.2em] uppercase mb-6 block w-full text-center" style={{ color: '#DDDDD7' }}>
                          III. Trade {selectedMarket === 'pass' ? 'Pass' : 'Fail'} Coin
                        </span>
                        <div className="w-full">
                          <TradingInterface
                            proposalId={proposal.id}
                            selectedMarket={selectedMarket}
                            onMarketChange={handleMarketChange}
                            passPrice={livePrices.pass || 0.5}
                            failPrice={livePrices.fail || 0.5}
                            proposalStatus="Pending"
                            userBalances={userBalances}
                            refetchBalances={refetchBalances}
                            onTradeSuccess={refetchTrades}
                          />
                        </div>
                      </div>
                    </div>

                    {/* User Balances - Separate ZC and SOL cards */}
                    <div className="flex gap-4">
                        {/* ZC Balance Card */}
                        <div className="flex-1 bg-[#121212] border border-[#191919] rounded-[9px] py-3 px-5 transition-all duration-300">
                          <div className="text-white flex flex-col">
                            <span className="text-sm font-semibold font-ibm-plex-mono tracking-[0.2em] uppercase mb-6 text-center block" style={{ color: '#DDDDD7' }}>
                              {selectedMarket === 'pass' ? (
                                <>
                                  IV. BULLISH{' '}
                                  <svg className="w-4 h-4 inline-block pb-0.5 -ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 20 20" strokeWidth="1.5">
                                    <circle cx="10" cy="10" r="8" />
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 10l2 2 4-4" />
                                  </svg>
                                  {' '}PROPOSAL BAL
                                </>
                              ) : (
                                <>
                                  IV. BEARISH{' '}
                                  <svg className="w-4 h-4 inline-block pb-0.5 -ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 20 20" strokeWidth="1.5">
                                    <circle cx="10" cy="10" r="8" />
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 7l6 6M13 7l-6 6" />
                                  </svg>
                                  {' '}PROPOSAL BAL
                                </>
                              )}
                            </span>
                            <div className="group flex items-center justify-center border border-[#191919] rounded-[6px] py-3 px-4 text-lg font-ibm-plex-mono cursor-default" style={{ color: '#DDDDD7', fontFamily: 'IBM Plex Mono, monospace' }}>
                              <span className="group-hover:hidden">
                                {formatNumber(userBalances ? parseFloat(selectedMarket === 'pass' ? userBalances.base.passConditional : userBalances.base.failConditional || '0') / 1e6 : 0, 0)} {selectedMarket === 'pass' ? 'PASS' : 'FAIL'}
                              </span>
                              {zcPrice && (
                                <span className="hidden group-hover:inline">
                                  {formatCurrency(userBalances ? (parseFloat(selectedMarket === 'pass' ? userBalances.base.passConditional : userBalances.base.failConditional || '0') / 1e6) * zcPrice : 0, 2)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* SOL Balance Card */}
                        <div className="flex-1 bg-[#121212] border border-[#191919] rounded-[9px] py-3 px-5 transition-all duration-300">
                          <div className="text-white flex flex-col">
                            <span className="text-sm font-semibold font-ibm-plex-mono tracking-[0.2em] uppercase mb-6 text-center block" style={{ color: '#DDDDD7' }}>
                              {selectedMarket === 'pass' ? (
                                <>
                                  IV. BEARISH{' '}
                                  <svg className="w-4 h-4 inline-block pb-0.5 -ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 20 20" strokeWidth="1.5">
                                    <circle cx="10" cy="10" r="8" />
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 7l6 6M13 7l-6 6" />
                                  </svg>
                                  {' '}PROPOSAL BAL
                                </>
                              ) : (
                                <>
                                  IV. BULLISH{' '}
                                  <svg className="w-4 h-4 inline-block pb-0.5 -ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 20 20" strokeWidth="1.5">
                                    <circle cx="10" cy="10" r="8" />
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 10l2 2 4-4" />
                                  </svg>
                                  {' '}PROPOSAL BAL
                                </>
                              )}
                            </span>
                            <div className="group flex items-center justify-center border border-[#191919] rounded-[6px] py-3 px-4 text-lg font-ibm-plex-mono cursor-default" style={{ color: '#DDDDD7', fontFamily: 'IBM Plex Mono, monospace' }}>
                              <span className="group-hover:hidden">
                                {formatNumber(userBalances ? parseFloat(selectedMarket === 'pass' ? userBalances.quote.passConditional : userBalances.quote.failConditional || '0') / 1e9 : 0, 6)} SOL
                              </span>
                              {solPrice && (
                                <span className="hidden group-hover:inline">
                                  {formatCurrency(userBalances ? (parseFloat(selectedMarket === 'pass' ? userBalances.quote.passConditional : userBalances.quote.failConditional || '0') / 1e9) * solPrice : 0, 2)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                    </div>
                  </div>
                </div>

                {/* Hidden component for TWAP updates */}
                <div className="hidden">
                  <LivePriceDisplay
                    proposalId={proposal.id}
                    onPricesUpdate={handlePricesUpdate}
                    onTwapUpdate={handleTwapUpdate}
                  />
                </div>
              </div>
            </div>
          )}

          {navTab === 'history' && (
            <div className="flex-1 flex justify-center overflow-y-auto">
              <div className="w-full max-w-[1332px] 2xl:max-w-[1512px] pt-8">
                <div className="mb-6">
                  <h2 className="text-2xl font-medium" style={{ color: '#E9E9E3' }}>History</h2>
                </div>
                <Masonry
                  breakpointCols={3}
                  className="flex w-auto pb-8"
                  columnClassName="bg-clip-padding"
                  style={{ marginLeft: '-16px' }}
                >
                  {sortedProposals
                    .filter(proposal => proposal.status === 'Passed' || proposal.status === 'Failed')
                    .map((proposal) => {
                    const proposalContent = getProposalContent(proposal.id, proposal.title, proposal.description, process.env.NEXT_PUBLIC_MODERATOR_ID);
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
                        className={`bg-[#121212] border border-[#191919] rounded-[9px] py-4 px-5 transition-all duration-300 ml-4 mb-4 ${
                          hasClaimableRewards ? 'cursor-pointer hover:border-[#2A2A2A]' : ''
                        } ${isCurrentlyClaiming ? 'opacity-60 pointer-events-none' : ''}`}
                      >
                        <div className="text-white flex flex-col">
                          <div className="flex items-center justify-between gap-2 mb-6">
                            <div className="flex items-center gap-2 flex-wrap">
                              <div className="text-sm font-semibold font-ibm-plex-mono tracking-[0.2em]" style={{ color: '#DDDDD7' }}>ZC-{proposal.id}</div>
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

                          <div className="text-lg font-normal mb-2" style={{ color: '#E9E9E3' }}>{proposalContent.title}</div>

                          {/* Show summary or full content based on hover */}
                          <div className={`text-sm ${proposalRewards.length > 0 ? 'mb-6' : ''}`} style={{ color: '#DDDDD7' }}>
                            {isHovered ? (
                              proposalContent.content || <p>{proposal.description}</p>
                            ) : (
                              summaryPreview
                            )}
                          </div>

                          {/* Only show claim row if user has claimable rewards */}
                          {proposalRewards.length > 0 && (
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5">
                                <div className="relative flex items-center justify-center">
                                  <div className="w-2 h-2 rounded-full absolute" style={{ backgroundColor: '#BEE8FC', opacity: 0.75, animation: 'ping 3s cubic-bezier(0, 0, 0.2, 1) infinite' }}></div>
                                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#BEE8FC' }}></div>
                                </div>
                                <span className="text-sm" style={{ color: '#BEE8FC' }}>Click to claim</span>
                              </div>

                              {/* Rewards display */}
                              <div className="text-sm" style={{ color: '#BEE8FC' }}>
                                {(() => {
                                  const zcReward = proposalRewards.find(r => r.claimableToken === 'zc');
                                  const solReward = proposalRewards.find(r => r.claimableToken === 'sol');

                                  const parts = [];
                                  if (zcReward) {
                                    parts.push(`${formatNumber(zcReward.claimableAmount, 0)} ZC`);
                                  }
                                  if (solReward) {
                                    parts.push(`${solReward.claimableAmount.toFixed(4)} SOL`);
                                  }

                                  return parts.join(' / ');
                                })()}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </Masonry>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
