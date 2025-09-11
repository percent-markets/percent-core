'use client';

import { useState, useMemo, useCallback, useEffect, memo } from 'react';
import dynamic from 'next/dynamic';
import { useWallet } from '@solana/wallet-adapter-react';
import Sidebar from '@/components/Sidebar';
import TradingInterface from '@/components/TradingInterface';
import SettingsModal from '@/components/SettingsModal';
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
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  // Wallet info
  const walletAddress = useMemo(() => publicKey?.toBase58() || '', [publicKey]);
  const shortAddress = useMemo(() => 
    walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : 'CONNECT WALLET',
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
                href="https://axiom.trade/meme/2FCqTyvFcE4uXgRL1yh56riZ9vdjVgoP6yknZW3f8afX" 
                target="_blank" 
                rel="noopener noreferrer"
                className="px-2 h-7 bg-[#272727] hover:bg-[#303030] rounded-md transition-colors mb-0.5 flex items-center justify-center"
              >
                <span className="text-xs text-[#AFAFAF] font-bold">$oogway</span>
              </a>
            </div>
          </div>
          
          {/* Wallet Info */}
          <div className="flex items-center gap-2.5">
            {/* SOL Balance */}
            <div className="flex items-center gap-1.5">
              <span className="text-sm text-[#AFAFAF]">5</span>
              <svg className="h-3 w-3" viewBox="0 0 101 88" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M100.48 69.3817L83.8068 86.8015C83.4444 87.1799 83.0058 87.4816 82.5185 87.6878C82.0312 87.894 81.5055 88.0003 80.9743 88H1.93563C1.55849 88 1.18957 87.8926 0.874202 87.6912C0.558829 87.4897 0.31074 87.2029 0.160416 86.8659C0.0100923 86.529 -0.0359181 86.1566 0.0280382 85.7945C0.0919944 85.4324 0.263131 85.0964 0.520422 84.8278L17.2061 67.408C17.5676 67.0306 18.0047 66.7295 18.4904 66.5234C18.9762 66.3172 19.5002 66.2104 20.0301 66.2095H99.0644C99.4415 66.2095 99.8104 66.3169 100.126 66.5183C100.441 66.7198 100.689 67.0065 100.84 67.3435C100.99 67.6804 101.036 68.0529 100.972 68.415C100.908 68.7771 100.737 69.1131 100.48 69.3817ZM83.8068 36.3032C83.4444 35.9248 83.0058 35.6231 82.5185 35.4169C82.0312 35.2108 81.5055 35.1045 80.9743 35.1048H1.93563C1.55849 35.1048 1.18957 35.2121 0.874202 35.4136C0.558829 35.6151 0.31074 35.9019 0.160416 36.2388C0.0100923 36.5758 -0.0359181 36.9482 0.0280382 37.3103C0.0919944 37.6723 0.263131 38.0083 0.520422 38.277L17.2061 55.6968C17.5676 56.0742 18.0047 56.3752 18.4904 56.5814C18.9762 56.7875 19.5002 56.8944 20.0301 56.8952H99.0644C99.4415 56.8952 99.8104 56.7879 100.126 56.5864C100.441 56.3849 100.689 56.0981 100.84 55.7612C100.99 55.4242 101.036 55.0518 100.972 54.6897C100.908 54.3277 100.737 53.9917 100.48 53.723L83.8068 36.3032ZM1.93563 21.7905H80.9743C81.5055 21.7898 82.0312 21.6835 82.5185 21.4773C83.0058 21.2712 83.4444 20.9695 83.8068 20.5911L100.48 3.17133C100.737 2.90265 100.908 2.56667 100.972 2.2046C101.036 1.84253 100.99 1.47008 100.84 1.13314C100.689 0.796193 100.441 0.509443 100.126 0.307961C99.8104 0.106479 99.4415 -0.000854492 99.0644 -0.000854492H20.0301C19.5002 -0.00013126 18.9762 0.106791 18.4904 0.312929C18.0047 0.519068 17.5676 0.820087 17.2061 1.19754L0.524723 18.6173C0.267481 18.8859 0.0963642 19.2219 0.0323936 19.584C-0.0315771 19.946 0.0144792 20.3184 0.164862 20.6554C0.315245 20.9923 0.563347 21.2791 0.878727 21.4806C1.19411 21.682 1.56303 21.7894 1.94013 21.7896L1.93563 21.7905Z" fill="#AFAFAF"/>
              </svg>
            </div>
            
            {/* Divider */}
            <div className="w-px h-4 bg-[#3D3D3D]"></div>
            
            {/* $oogway Balance */}
            <div className="flex items-center gap-1.5">
              <span className="text-sm text-[#AFAFAF]">5</span>
              <span className="text-sm text-[#AFAFAF]">$oogway</span>
            </div>
            
            {/* Divider */}
            <div className="w-px h-4 bg-[#3D3D3D]"></div>
            
            {/* Wallet Button */}
            <button 
              onClick={() => setIsSettingsOpen(true)}
              className="group flex items-center gap-2 transition cursor-pointer"
            >
              <span className="text-sm text-[#AFAFAF] group-hover:text-orange-500 transition-colors">{shortAddress}</span>
              <div className="w-8 h-8 bg-[#272727] group-hover:bg-[#303030] rounded-full flex items-center justify-center transition-colors">
                <span className="text-xs font-medium text-[#AFAFAF] group-hover:text-orange-500 transition-colors">{avatarText}</span>
              </div>
            </button>
          </div>
        </div>
        
        {/* Content Area */}
        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 p-8 pr-10 overflow-y-auto border-r border-[#2A2A2A]">
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-2">
                <span className={`text-xs px-2 py-1 rounded-full inline-flex items-center gap-1 ${
                  proposal.status === 'Pending'
                    ? 'bg-orange-400/20 text-orange-400 animate-pulse'
                    : proposal.status === 'Passed'
                    ? 'bg-emerald-400/20 text-emerald-400'
                    : 'bg-rose-400/20 text-rose-400'
                }`}>
                  {proposal.status === 'Pending' ? 'Live' : proposal.status}
                  {proposal.status === 'Pending' && (
                    <span className="relative w-3 h-3 flex items-center justify-center">
                      <span className="absolute w-3 h-3 bg-orange-400 rounded-full animate-ping opacity-75"></span>
                      <span className="relative w-2 h-2 bg-orange-400 rounded-full"></span>
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
                            ? 'bg-emerald-500'
                            : proposal.status === 'Failed'
                            ? 'bg-rose-500'
                            : 'bg-emerald-500'
                        }`}
                        style={{ width: `${proposal.status === 'Passed' ? 100 : Math.max(proposal.passPrice * 100, 8)}%` }}
                      >
                        {/* Percentage Text inside progress - hidden for Passed status */}
                        {proposal.status !== 'Passed' && (
                          <span className="text-base font-bold text-white">
                            {(proposal.passPrice * 100).toFixed(0)}%
                          </span>
                        )}
                      </div>
                      {/* Pass/Failed/Passed text at the end */}
                      <span 
                        className={`absolute right-4 text-sm font-medium ${
                          proposal.status === 'Failed' 
                            ? 'text-rose-400'
                            : proposal.status === 'Passed'
                            ? 'text-white'
                            : 'text-gray-500'
                        }`}
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
                  <div className="text-emerald-400">buy</div>
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
                  <div className="text-rose-400">sell</div>
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
                  <div className="text-emerald-400">buy</div>
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
                  <div className="text-emerald-400">buy</div>
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
                  <div className="text-rose-400">sell</div>
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
                  <div className="text-emerald-400">buy</div>
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
                  <div className="text-rose-400">sell</div>
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
                  <div className="text-emerald-400">buy</div>
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
                  <div className="text-emerald-400">buy</div>
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
                  <div className="text-rose-400">sell</div>
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
                  <div className="text-rose-400">sell</div>
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
      
      {/* Settings Modal */}
      <SettingsModal 
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
}
