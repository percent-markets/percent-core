'use client';

import { useState, useMemo, useCallback, useEffect, memo } from 'react';
import dynamic from 'next/dynamic';
import { useWallet } from '@solana/wallet-adapter-react';
import Sidebar from '@/components/Sidebar';
import TradingInterface from '@/components/TradingInterface';
import { mockProposals } from '@/lib/mock-data';
import { IoMdStopwatch } from 'react-icons/io';

const TradingViewChart = dynamic(() => import('@/components/TradingViewChart'), {
  ssr: false,
  loading: () => (
    <div className="h-[500px] bg-[#181818] rounded-lg flex items-center justify-center">
      <div className="text-gray-500">Loading chart...</div>
    </div>
  )
});

const CountdownTimer = memo(({ endsAt }: { endsAt: Date }) => {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date();
      const diff = endsAt.getTime() - now.getTime();
      
      if (diff <= 0) {
        setTimeLeft('00:00:00');
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
  }, [endsAt]);

  return <>{timeLeft}</>;
});

CountdownTimer.displayName = 'CountdownTimer';

export default function HomePage() {
  const { publicKey } = useWallet();
  
  // Wallet info
  const walletAddress = useMemo(() => publicKey?.toBase58() || '', [publicKey]);
  const shortAddress = useMemo(() => 
    walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : 'Connect wallet',
    [walletAddress]
  );
  const avatarText = useMemo(() => 
    walletAddress ? walletAddress.slice(0, 2).toUpperCase() : '??',
    [walletAddress]
  );
  
  // Memoize sorted proposals
  const sortedProposals = useMemo(() => 
    [...mockProposals].sort((a, b) => b.endsAt.getTime() - a.endsAt.getTime()),
    []
  );
  
  const [selectedProposalId, setSelectedProposalId] = useState(sortedProposals[0].id);
  const [selectedMarket, setSelectedMarket] = useState<'pass' | 'fail'>('pass');
  
  const proposal = useMemo(() => 
    mockProposals.find(p => p.id === selectedProposalId) || sortedProposals[0],
    [selectedProposalId, sortedProposals]
  );
  
  const handleSelectProposal = useCallback((id: number) => {
    setSelectedProposalId(id);
  }, []);
  
  const handleMarketChange = useCallback((market: 'pass' | 'fail') => {
    setSelectedMarket(market);
  }, []);

  return (
    <div className="flex h-screen bg-[#181818]">
      {/* Sidebar */}
      <Sidebar 
        selectedProposal={selectedProposalId}
        onSelectProposal={handleSelectProposal}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header - Same height as sidebar header */}
        <div className="h-14 flex items-center justify-between px-8 bg-[#181818] border-b border-[#2A2A2A]">
          <div className="flex items-center gap-6">
            <img 
              src="/percent-logo-big.svg" 
              alt="percent.markets" 
              className="h-8"
            />
            <div className="flex items-center gap-2">
              <a 
                href="https://x.com/percentmarkets" 
                target="_blank" 
                rel="noopener noreferrer"
                className="w-7 h-7 bg-[#272727] hover:bg-[#303030] rounded-md transition-colors mb-0.5 flex items-center justify-center"
              >
                <svg className="h-3.5 w-3.5 fill-[#AFAFAF]" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
              </a>
              <a 
                href="https://discord.gg/your-discord" 
                target="_blank" 
                rel="noopener noreferrer"
                className="w-7 h-7 bg-[#272727] hover:bg-[#303030] rounded-md transition-colors mb-0.5 flex items-center justify-center"
              >
                <svg className="h-4 w-4 fill-[#AFAFAF]" viewBox="0 0 24 24">
                  <path d="M19.27 5.33C17.94 4.71 16.5 4.26 15 4a.09.09 0 0 0-.07.03c-.18.33-.39.76-.53 1.09a16.09 16.09 0 0 0-4.8 0c-.14-.34-.35-.76-.54-1.09c-.01-.02-.04-.03-.07-.03c-1.5.26-2.93.71-4.27 1.33c-.01 0-.02.01-.03.02c-2.72 4.07-3.47 8.03-3.1 11.95c0 .02.01.04.03.05c1.8 1.32 3.53 2.12 5.24 2.65c.03.01.06 0 .07-.02c.4-.55.76-1.13 1.07-1.74c.02-.04 0-.08-.04-.09c-.57-.22-1.11-.48-1.64-.78c-.04-.02-.04-.08-.01-.11c.11-.08.22-.17.33-.25c.02-.02.05-.02.07-.01c3.44 1.57 7.15 1.57 10.55 0c.02-.01.05-.01.07.01c.11.09.22.17.33.25c.04.03.04.09-.01.11c-.52.31-1.07.56-1.64.78c-.04.01-.05.06-.04.09c.32.61.68 1.19 1.07 1.74c.02.03.05.03.07.02c1.72-.53 3.45-1.33 5.25-2.65c.02-.01.03-.03.03-.05c.44-4.53-.73-8.46-3.1-11.95c-.01-.01-.02-.02-.04-.02zM8.52 14.91c-1.03 0-1.89-.95-1.89-2.12s.84-2.12 1.89-2.12c1.06 0 1.9.96 1.89 2.12c0 1.17-.84 2.12-1.89 2.12zm6.97 0c-1.03 0-1.89-.95-1.89-2.12s.84-2.12 1.89-2.12c1.06 0 1.9.96 1.89 2.12c0 1.17-.83 2.12-1.89 2.12z"/>
                </svg>
              </a>
              <a 
                href="https://axiom.trade/discover" 
                target="_blank" 
                rel="noopener noreferrer"
                className="w-7 h-7 bg-[#272727] hover:bg-[#303030] rounded-md transition-colors mb-0.5 flex items-center justify-center"
              >
                <img 
                  src="/percent-logo.svg" 
                  alt="Axiom Trade" 
                  className="h-3 w-3"
                  style={{ filter: 'brightness(0) saturate(100%) invert(71%) sepia(5%) saturate(166%) hue-rotate(315deg) brightness(85%) contrast(84%)' }}
                />
              </a>
            </div>
          </div>
          
          {/* Wallet Info */}
          <button className="group flex items-center gap-3 transition cursor-pointer">
            <span className="text-sm text-[#AFAFAF] group-hover:text-gray-300 transition-colors">{shortAddress}</span>
            <div className="w-8 h-8 bg-[#272727] group-hover:bg-[#303030] rounded-full flex items-center justify-center transition-colors">
              <span className="text-xs font-medium text-[#AFAFAF]">{avatarText}</span>
            </div>
          </button>
        </div>
        
        {/* Content Area */}
        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 p-8 overflow-y-auto scrollbar-hide border-r border-[#2A2A2A]">
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-2">
                <span className={`text-xs px-2 py-1 rounded-full inline-flex items-center gap-1 ${
                  proposal.status === 'Pending'
                    ? 'bg-orange-500/20 text-orange-500 animate-pulse'
                    : proposal.status === 'Passed'
                    ? 'bg-green-500/20 text-green-500'
                    : 'bg-red-500/20 text-red-500'
                }`}>
                  {proposal.status === 'Pending' ? 'Live' : proposal.status}
                  {proposal.status === 'Pending' && (
                    <span className="relative w-3 h-3 flex items-center justify-center">
                      <span className="absolute w-3 h-3 bg-orange-500 rounded-full animate-ping opacity-75"></span>
                      <span className="relative w-2 h-2 bg-orange-500 rounded-full"></span>
                    </span>
                  )}
                  {proposal.status === 'Passed' && (
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
                  {proposal.endsAt.toLocaleDateString('en-US', { 
                    month: 'long', 
                    day: 'numeric', 
                    year: 'numeric'
                  })} at {proposal.endsAt.toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              </div>
              <h1 className="text-3xl font-semibold mb-4">
                {proposal.title}
              </h1>
              <p className="text-gray-400 text-sm leading-relaxed">{proposal.description}</p>
            </div>

            {/* Progress Bar Component */}
            <div>
              <div className="bg-[#0F0F0F] border-t border-l border-r border-[#3D3D3D] px-4 py-4">
                <div className="flex items-center gap-6">
                  {/* Progress Bar */}
                  <div className="relative flex-1">
                    <div className="relative h-10 bg-[#2A2A2A] rounded-full overflow-hidden border border-[#2A2A2A] flex items-center">
                      {/* Progress Fill */}
                      <div 
                        className={`absolute left-0 top-0 h-full rounded-full transition-all duration-500 flex items-center justify-end pr-3 ${
                          proposal.status === 'Passed' 
                            ? 'bg-green-500'
                            : proposal.status === 'Failed'
                            ? 'bg-red-500'
                            : 'bg-green-500'
                        }`}
                        style={{ width: `${proposal.status === 'Passed' ? 100 : Math.max(proposal.passPrice * 100, 8)}%` }}
                      >
                        {/* Percentage Text inside progress - hidden for Passed status */}
                        {proposal.status !== 'Passed' && (
                          <span className="text-base font-bold text-white" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>
                            {(proposal.passPrice * 100).toFixed(0)}%
                          </span>
                        )}
                      </div>
                      {/* Pass/Failed/Passed text at the end */}
                      <span 
                        className={`absolute right-4 text-sm font-medium ${
                          proposal.status === 'Failed' 
                            ? 'text-red-500'
                            : proposal.status === 'Passed'
                            ? 'text-white'
                            : 'text-gray-500'
                        }`}
                        style={{ fontFamily: 'IBM Plex Mono, monospace' }}
                      >
                        {proposal.status === 'Failed' ? 'Failed' : proposal.status === 'Passed' ? 'Passed' : 'In Progress'}
                      </span>
                    </div>
                  </div>

                  {/* Countdown Timer */}
                  <div className="flex items-center justify-center gap-2 w-36">
                    {/* Stopwatch Icon */}
                    <IoMdStopwatch className="w-6 h-6 text-gray-400 flex-shrink-0" />
                    <div className="text-2xl font-mono text-white">
                      <CountdownTimer endsAt={proposal.endsAt} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* TradingView Chart */}
            <div>
              <TradingViewChart 
                proposalId={proposal.id} 
              />
            </div>

            {/* Trading History Table */}
            <div className="bg-[#0F0F0F] border-b border-l border-r border-[#3D3D3D]">
              {/* Table Header */}
              <div className="grid grid-cols-6 gap-4 px-4 py-3 text-xs text-[#9C9D9E] font-medium border-b border-[#2A2A2A]">
                <div>Trader</div>
                <div>Position</div>
                <div>Type</div>
                <div>Market</div>
                <div>Amount</div>
                <div className="flex justify-between">
                  <span>Price</span>
                  <span>Age</span>
                </div>
              </div>
              
              {/* Table Body - Scrollable */}
              <div className="max-h-[400px] overflow-y-auto scrollbar-hide">
                {/* Sample trade rows - 10 entries */}
                <div className="grid grid-cols-6 gap-4 px-4 py-3 text-xs hover:bg-[#272A2D]/30 transition-colors">
                  <div className="text-white">0xAb5...3d8</div>
                  <div className="text-white">2.5%</div>
                  <div className="text-green-500">buy</div>
                  <div className="text-white">Pass</div>
                  <div className="text-white">100</div>
                  <div className="flex justify-between">
                    <span className="text-white">$0.701</span>
                    <span className="text-[#9C9D9E]">2m</span>
                  </div>
                </div>
                <div className="grid grid-cols-6 gap-4 px-4 py-3 text-xs hover:bg-[#272A2D]/30 transition-colors">
                  <div className="text-white">0x7F2...9e4</div>
                  <div className="text-white">0.0%</div>
                  <div className="text-red-500">sell</div>
                  <div className="text-white">Fail</div>
                  <div className="text-white">50</div>
                  <div className="flex justify-between">
                    <span className="text-white">$0.299</span>
                    <span className="text-[#9C9D9E]">5m</span>
                  </div>
                </div>
                <div className="grid grid-cols-6 gap-4 px-4 py-3 text-xs hover:bg-[#272A2D]/30 transition-colors">
                  <div className="text-white">0x3C9...1a7</div>
                  <div className="text-white">5.2%</div>
                  <div className="text-green-500">buy</div>
                  <div className="text-white">Pass</div>
                  <div className="text-white">250</div>
                  <div className="flex justify-between">
                    <span className="text-white">$0.698</span>
                    <span className="text-[#9C9D9E]">12m</span>
                  </div>
                </div>
                <div className="grid grid-cols-6 gap-4 px-4 py-3 text-xs hover:bg-[#272A2D]/30 transition-colors">
                  <div className="text-white">0x9D1...8f2</div>
                  <div className="text-white">1.8%</div>
                  <div className="text-green-500">buy</div>
                  <div className="text-white">Fail</div>
                  <div className="text-white">75</div>
                  <div className="flex justify-between">
                    <span className="text-white">$0.301</span>
                    <span className="text-[#9C9D9E]">18m</span>
                  </div>
                </div>
                <div className="grid grid-cols-6 gap-4 px-4 py-3 text-xs hover:bg-[#272A2D]/30 transition-colors">
                  <div className="text-white">0x2E4...5c9</div>
                  <div className="text-white">3.1%</div>
                  <div className="text-red-500">sell</div>
                  <div className="text-white">Pass</div>
                  <div className="text-white">150</div>
                  <div className="flex justify-between">
                    <span className="text-white">$0.695</span>
                    <span className="text-[#9C9D9E]">25m</span>
                  </div>
                </div>
                <div className="grid grid-cols-6 gap-4 px-4 py-3 text-xs hover:bg-[#272A2D]/30 transition-colors">
                  <div className="text-white">0x8F3...2b1</div>
                  <div className="text-white">4.0%</div>
                  <div className="text-green-500">buy</div>
                  <div className="text-white">Pass</div>
                  <div className="text-white">180</div>
                  <div className="flex justify-between">
                    <span className="text-white">$0.703</span>
                    <span className="text-[#9C9D9E]">28m</span>
                  </div>
                </div>
                <div className="grid grid-cols-6 gap-4 px-4 py-3 text-xs hover:bg-[#272A2D]/30 transition-colors">
                  <div className="text-white">0x5A2...7c6</div>
                  <div className="text-white">1.2%</div>
                  <div className="text-red-500">sell</div>
                  <div className="text-white">Fail</div>
                  <div className="text-white">90</div>
                  <div className="flex justify-between">
                    <span className="text-white">$0.297</span>
                    <span className="text-[#9C9D9E]">32m</span>
                  </div>
                </div>
                <div className="grid grid-cols-6 gap-4 px-4 py-3 text-xs hover:bg-[#272A2D]/30 transition-colors">
                  <div className="text-white">0x1B7...4d3</div>
                  <div className="text-white">6.5%</div>
                  <div className="text-green-500">buy</div>
                  <div className="text-white">Pass</div>
                  <div className="text-white">320</div>
                  <div className="flex justify-between">
                    <span className="text-white">$0.705</span>
                    <span className="text-[#9C9D9E]">35m</span>
                  </div>
                </div>
                <div className="grid grid-cols-6 gap-4 px-4 py-3 text-xs hover:bg-[#272A2D]/30 transition-colors">
                  <div className="text-white">0x7C8...9e2</div>
                  <div className="text-white">2.3%</div>
                  <div className="text-green-500">buy</div>
                  <div className="text-white">Fail</div>
                  <div className="text-white">110</div>
                  <div className="flex justify-between">
                    <span className="text-white">$0.302</span>
                    <span className="text-[#9C9D9E]">40m</span>
                  </div>
                </div>
                <div className="grid grid-cols-6 gap-4 px-4 py-3 text-xs hover:bg-[#272A2D]/30 transition-colors">
                  <div className="text-white">0x4D9...1f5</div>
                  <div className="text-white">3.7%</div>
                  <div className="text-red-500">sell</div>
                  <div className="text-white">Pass</div>
                  <div className="text-white">200</div>
                  <div className="flex justify-between">
                    <span className="text-white">$0.694</span>
                    <span className="text-[#9C9D9E]">45m</span>
                  </div>
                </div>
                {/* Additional trades would continue here for scrolling */}
                <div className="grid grid-cols-6 gap-4 px-4 py-3 text-xs hover:bg-[#272A2D]/30 transition-colors">
                  <div className="text-white">0x9A3...7b4</div>
                  <div className="text-white">1.5%</div>
                  <div className="text-red-500">sell</div>
                  <div className="text-white">Fail</div>
                  <div className="text-white">65</div>
                  <div className="flex justify-between">
                    <span className="text-white">$0.296</span>
                    <span className="text-[#9C9D9E]">52m</span>
                  </div>
                </div>
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
                passPrice={proposal.passPrice}
                failPrice={proposal.failPrice}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
