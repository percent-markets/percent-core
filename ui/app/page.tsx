'use client';

import { useState, useMemo, useCallback, useEffect, memo } from 'react';
import dynamic from 'next/dynamic';
import { usePrivyWallet } from '@/hooks/usePrivyWallet';
import { useWalletBalances } from '@/hooks/useWalletBalances';
import Sidebar from '@/components/Sidebar';
import TradingInterface from '@/components/TradingInterface';
import Header from '@/components/Header';
import { useProposals } from '@/hooks/useProposals';
import { useTradeHistory } from '@/hooks/useTradeHistory';
import { IoMdStopwatch } from 'react-icons/io';
import { formatNumber, formatCurrency } from '@/lib/formatters';
import { api } from '@/lib/api';

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

const CountdownTimer = memo(({ endsAt, onTimerEnd, isPending }: { endsAt: number; onTimerEnd?: () => void; isPending?: boolean }) => {
  const [timeLeft, setTimeLeft] = useState('');
  const [hasEnded, setHasEnded] = useState(false);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = Date.now();
      const diff = endsAt - now;
      
      if (diff <= 0) {
        setTimeLeft('00:00:00');
        // Only trigger onTimerEnd if proposal is pending and we haven't already triggered
        if (!hasEnded && isPending) {
          setHasEnded(true);
          onTimerEnd?.();
        }
        return;
      }
      
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      
      setTimeLeft(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
    };

    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 1000);
    
    return () => clearInterval(interval);
  }, [endsAt, hasEnded, onTimerEnd, isPending]);

  return <>{timeLeft}</>;
});

CountdownTimer.displayName = 'CountdownTimer';

export default function HomePage() {
  const { ready, authenticated, user, walletAddress } = usePrivyWallet();
  const { proposals, loading, refetch } = useProposals();
  const [livePrices, setLivePrices] = useState<{ pass: number | null; fail: number | null }>({ pass: null, fail: null });
  const [twapData, setTwapData] = useState<{ passTwap: number | null; failTwap: number | null }>({ passTwap: null, failTwap: null });
  
  // Fetch wallet balances
  const { sol: solBalance, oogway: oogwayBalance } = useWalletBalances(walletAddress);
  
  // Memoize sorted proposals
  const sortedProposals = useMemo(() => 
    [...proposals].sort((a, b) => b.finalizedAt - a.finalizedAt),
    [proposals]
  );
  
  const [selectedProposalId, setSelectedProposalId] = useState<number | null>(null);
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
    getTokenUsed,
    calculateVolume
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

  // Fetch TWAP data when proposal changes
  useEffect(() => {
    if (proposal?.id) {
      api.getTWAP(proposal.id).then(data => {
        if (data) {
          setTwapData({ passTwap: data.passTwap, failTwap: data.failTwap });
        }
      });
      
      // Poll for TWAP updates every 30 seconds
      const interval = setInterval(() => {
        api.getTWAP(proposal.id).then(data => {
          if (data) {
            setTwapData({ passTwap: data.passTwap, failTwap: data.failTwap });
          }
        });
      }, 30000);
      
      return () => clearInterval(interval);
    }
  }, [proposal?.id]);

  // Calculate PFG percentage from TWAP data ONLY - no spot price fallback for governance
  const pfgPercentage = useMemo(() => {
    // ONLY use TWAP for governance decisions
    if (twapData.passTwap !== null && twapData.failTwap !== null && twapData.failTwap > 0) {
      return ((twapData.passTwap - twapData.failTwap) / twapData.failTwap) * 100;
    }
    // No fallback - return null if TWAP unavailable
    return null;
  }, [twapData.passTwap, twapData.failTwap]);

  if (loading) {
    return (
      <div className="flex h-screen bg-[#181818]">
        {/* Sidebar with skeleton */}
        <Sidebar 
          selectedProposal={0}
          onSelectProposal={handleSelectProposal}
          proposals={proposals}
          loading={loading}
        />
        {/* Main content skeleton */}
        <div className="flex-1 flex items-center justify-center">
          <div className="text-gray-500">Loading...</div>
        </div>
      </div>
    );
  }

  if (!proposal || proposals.length === 0) {
    return (
      <div className="flex h-screen bg-[#181818]">
        {/* Sidebar */}
        <Sidebar 
          selectedProposal={0}
          onSelectProposal={handleSelectProposal}
          proposals={proposals}
          loading={loading}
        />
        
        {/* Main Content */}
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <Header 
            walletAddress={walletAddress}
            authenticated={authenticated}
            solBalance={solBalance}
            oogwayBalance={oogwayBalance}
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
    <div className="flex h-screen bg-[#181818]">
      {/* Sidebar */}
      <Sidebar 
        selectedProposal={selectedProposalId || 0}
        onSelectProposal={handleSelectProposal}
        proposals={proposals}
        loading={loading}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <Header 
          walletAddress={walletAddress}
          authenticated={authenticated}
          solBalance={solBalance}
          oogwayBalance={oogwayBalance}
        />
        
        {/* Content Area */}
        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 p-8 pr-10 overflow-y-auto border-r border-[#2A2A2A]">
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-4">
                <span className={`text-xs px-2 py-1 rounded-full inline-flex items-center gap-1 ${
                  proposal.status === 'Pending'
                    ? 'bg-orange-400/20 text-orange-400 animate-pulse'
                    : proposal.status === 'Passed' || proposal.status === 'Executed'
                    ? 'bg-emerald-400/20 text-emerald-400'
                    : 'bg-rose-400/20 text-rose-400'
                }`}>
                  {proposal.status === 'Pending' ? 'Live' : proposal.status === 'Executed' ? 'Passed' : proposal.status}
                  {proposal.status === 'Pending' && (
                    <span className="relative w-3 h-3 flex items-center justify-center">
                      <span className="absolute w-3 h-3 bg-orange-400 rounded-full animate-ping opacity-75"></span>
                      <span className="relative w-2 h-2 bg-orange-400 rounded-full"></span>
                    </span>
                  )}
                  {(proposal.status === 'Passed' || proposal.status === 'Executed') && (
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  )}
                  {proposal.status === 'Failed' && (
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  )}
                </span>
                <span className="w-px h-4 bg-[#3D3D3D]"></span>
                <span className="text-xs text-gray-500">
                  {new Date(proposal.finalizedAt).toLocaleDateString('en-US', { 
                    month: 'long', 
                    day: 'numeric', 
                    year: 'numeric'
                  })} at {new Date(proposal.finalizedAt).toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              </div>
              <div className="mb-4">
                <h1 className="text-3xl font-semibold">
                  {proposal.description}
                </h1>
                <p className="text-sm text-gray-500 mt-4">Proposal #{proposal.id}</p>
              </div>
            </div>

            {/* Progress Bar Component */}
            <div>
              <div className="bg-[#0F0F0F] border-t border-l border-r border-[#3D3D3D] px-4 py-4">
                <div className="flex items-center gap-6">
                  {/* Progress Bar */}
                  <div className="relative flex-1">
                    <div className="relative h-10 bg-[#2A2A2A] rounded-full overflow-hidden border border-[#2A2A2A] flex items-center">
                      {/* Pass/Failed/Passed text at the end - behind progress bar */}
                      <span 
                        className={`absolute right-4 text-sm font-medium z-10 ${
                          proposal.status === 'Failed' 
                            ? 'text-rose-400'
                            : proposal.status === 'Passed' || proposal.status === 'Executed'
                            ? 'text-white'
                            : 'text-gray-500'
                        }`}
                      >
                        {proposal.status === 'Failed' ? 'Failed' : (proposal.status === 'Passed' || proposal.status === 'Executed') ? 'Passed' : `Target PFG: ${(proposal.passThresholdBps / 100).toFixed(2)}%`}
                      </span>
                      {/* Progress Fill - on top to overlap text */}
                      <div 
                        className={`absolute left-0 top-0 h-full rounded-full transition-all duration-500 flex items-center justify-end pr-3 z-20 ${
                          proposal.status === 'Passed' || proposal.status === 'Executed'
                            ? 'bg-emerald-500'
                            : proposal.status === 'Failed'
                            ? 'bg-rose-500'
                            : 'bg-emerald-500'
                        }`}
                        style={{ 
                          width: `${
                            (proposal.status === 'Passed' || proposal.status === 'Executed') ? 100 
                            : proposal.status === 'Failed' ? 0 
                            : pfgPercentage !== null 
                              ? Math.min(100, Math.max(0, (pfgPercentage / (proposal.passThresholdBps / 100)) * 100))
                              : 0
                          }%` 
                        }}
                      >
                        {/* Percentage Text inside progress - show TWAP-based PFG for Pending status */}
                        {proposal.status === 'Pending' && (
                          <span className="text-base font-bold text-white">
                            {pfgPercentage !== null 
                              ? pfgPercentage >= (proposal.passThresholdBps / 100) 
                                ? `${pfgPercentage.toFixed(1)}% (Target: ${(proposal.passThresholdBps / 100).toFixed(1)}%)`
                                : `${pfgPercentage.toFixed(1)}%`
                              : 'Loading TWAP...'
                            }
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Countdown Timer */}
                  <div className="flex items-center justify-center gap-2 w-36">
                    {/* Stopwatch Icon */}
                    <IoMdStopwatch className="w-6 h-6 text-gray-400 flex-shrink-0" />
                    <div className="text-2xl font-mono font-bold text-white">
                      <CountdownTimer 
                      endsAt={proposal.finalizedAt} 
                      onTimerEnd={handleTimerEnd}
                      isPending={proposal.status === 'Pending'}
                    />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Live Price Display */}
            <div>
              <LivePriceDisplay 
                proposalId={proposal.id} 
                onPricesUpdate={handlePricesUpdate}
              />
            </div>

            {/* Trading History Table */}
            <div className="bg-[#0F0F0F] border-b border-l border-r border-[#3D3D3D]">
              {/* Table Header */}
              <div className="grid grid-cols-6 gap-4 px-4 py-3 text-xs text-[#9C9D9E] font-medium border-b border-[#2A2A2A]">
                <div>Trader</div>
                <div>Bet</div>
                <div>Type</div>
                <div>Price</div>
                <div>Amount</div>
                <div className="flex justify-between">
                  <span>Volume</span>
                  <span>Age</span>
                </div>
              </div>
              
              {/* Table Body - Scrollable */}
              <div className="max-h-[400px] overflow-y-auto scrollbar-hide">
                {tradesLoading ? (
                  <div className="px-4 py-8 text-center text-[#9C9D9E] text-xs">
                    Loading trades...
                  </div>
                ) : trades.length === 0 ? (
                  <div className="px-4 py-8 text-center text-[#9C9D9E] text-xs">
                    No trades yet
                  </div>
                ) : (
                  trades.map((trade) => {
                    const tokenUsed = getTokenUsed(trade.isBaseToQuote, trade.market);
                    const volume = calculateVolume(trade.amountIn, trade.isBaseToQuote, trade.market);
                    const isBuy = trade.isBaseToQuote;

                    return (
                      <div key={trade.id} className="grid grid-cols-6 gap-4 px-4 py-3 text-xs hover:bg-[#272A2D]/30 transition-colors">
                        <div className="text-white">{formatAddress(trade.userAddress)}</div>
                        <div className={trade.market === 'pass' ? 'text-emerald-400' : 'text-rose-400'}>
                          {trade.market === 'pass' ? 'Pass' : 'Fail'}
                        </div>
                        <div className={isBuy ? 'text-emerald-400' : 'text-rose-400'}>
                          {isBuy ? 'buy' : 'sell'}
                        </div>
                        <div className="text-white">{formatCurrency(parseFloat(trade.price), 3)}</div>
                        <div className="text-white">
                          {formatNumber(parseFloat(trade.amountIn), 2)} {tokenUsed}
                        </div>
                        <div className="flex justify-between">
                          <span className="text-white">{formatCurrency(volume, 2)}</span>
                          <span className="text-[#9C9D9E]">{getTimeAgo(trade.timestamp)}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Trading Panel - Sticky Position */}
          <div className="w-[352px] p-8 overflow-y-auto">
            <div className="sticky top-0">
              <TradingInterface 
                proposalId={proposal.id}
                selectedMarket={selectedMarket}
                onMarketChange={handleMarketChange}
                passPrice={0.5}
                failPrice={0.5}
                proposalStatus={proposal.status as 'Pending' | 'Passed' | 'Failed'}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
