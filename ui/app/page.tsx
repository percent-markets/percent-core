'use client';

import { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import TradingInterface from '@/components/TradingInterface';
import TradingViewChart from '@/components/TradingViewChart';
import { mockProposals } from '@/lib/mock-data';

export default function HomePage() {
  // Sort proposals by most recent first and select the first one
  const sortedProposals = [...mockProposals].sort((a, b) => b.endsAt.getTime() - a.endsAt.getTime());
  
  const [selectedProposalId, setSelectedProposalId] = useState(sortedProposals[0].id);
  const [selectedMarket, setSelectedMarket] = useState<'pass' | 'fail'>('pass');
  
  const proposal = mockProposals.find(p => p.id === selectedProposalId) || sortedProposals[0];

  return (
    <div className="flex h-screen bg-[#181818]">
      {/* Sidebar */}
      <Sidebar 
        selectedProposal={selectedProposalId}
        onSelectProposal={setSelectedProposalId}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header - Same height as sidebar header */}
        <div className="h-14 flex items-center px-8 bg-[#181818]">
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
        </div>
        
        {/* Content Area */}
        <div className="flex-1 overflow-y-auto flex">
          <div className="flex-1 max-w-4xl p-8">
            <div className="mb-8">
              <h1 className="text-3xl font-semibold mb-4">{proposal.title}</h1>
              <p className="text-gray-400 text-lg leading-relaxed">{proposal.description}</p>
            </div>

            {/* TradingView Chart */}
            <div className="mb-8">
              <TradingViewChart 
                symbol={selectedMarket.toUpperCase()} 
                proposalId={proposal.id} 
              />
            </div>

            {/* Trading History Table */}
            <div className="bg-[#272727]/30 rounded-xl mb-6">
              <div className="p-4">
                <h2 className="text-lg font-semibold mb-4 text-gray-200">Recent Trades</h2>
                
                {/* Table Header */}
                <div className="grid grid-cols-6 gap-4 px-4 py-3 bg-[#1F1F1F]/50 rounded-lg text-xs text-gray-400 font-medium">
                  <div>Trader</div>
                  <div>Type</div>
                  <div>Pass/Fail</div>
                  <div>Amount</div>
                  <div>Price</div>
                  <div>Time</div>
                </div>
                
                {/* Table Body */}
                <div className="mt-2 space-y-1 max-h-[400px] overflow-y-auto">
                  {/* Sample trade rows - replace with actual data */}
                  <div className="grid grid-cols-6 gap-4 px-4 py-3 hover:bg-[#2A2A2A]/30 rounded-lg transition-colors">
                    <div className="text-sm text-gray-300">0xAb5...3d8</div>
                    <div className="text-sm text-green-400">Buy</div>
                    <div className="text-sm text-gray-300">Pass</div>
                    <div className="text-sm text-gray-300">100</div>
                    <div className="text-sm text-gray-300">$0.701</div>
                    <div className="text-sm text-gray-500">2m ago</div>
                  </div>
                  <div className="grid grid-cols-6 gap-4 px-4 py-3 hover:bg-[#2A2A2A]/30 rounded-lg transition-colors">
                    <div className="text-sm text-gray-300">0x7F2...9e4</div>
                    <div className="text-sm text-red-400">Sell</div>
                    <div className="text-sm text-gray-300">Fail</div>
                    <div className="text-sm text-gray-300">50</div>
                    <div className="text-sm text-gray-300">$0.299</div>
                    <div className="text-sm text-gray-500">5m ago</div>
                  </div>
                  <div className="grid grid-cols-6 gap-4 px-4 py-3 hover:bg-[#2A2A2A]/30 rounded-lg transition-colors">
                    <div className="text-sm text-gray-300">0x3C9...1a7</div>
                    <div className="text-sm text-green-400">Buy</div>
                    <div className="text-sm text-gray-300">Pass</div>
                    <div className="text-sm text-gray-300">250</div>
                    <div className="text-sm text-gray-300">$0.698</div>
                    <div className="text-sm text-gray-500">12m ago</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Trading Panel - Sticky Position */}
          <div className="w-96 p-8">
            <div className="bg-[#272727] rounded-3xl p-6 sticky top-8">
              <TradingInterface 
                proposalId={proposal.id}
                selectedMarket={selectedMarket}
                onMarketChange={setSelectedMarket}
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
