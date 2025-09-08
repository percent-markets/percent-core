'use client';

import { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import TradingInterface from '@/components/TradingInterface';
import { Clock, TrendingUp, TrendingDown, Activity, Users, DollarSign } from 'lucide-react';
import { mockProposals } from '@/lib/mock-data';

export default function HomePage() {
  const [selectedProposalId, setSelectedProposalId] = useState(1);
  const [selectedMarket, setSelectedMarket] = useState<'pass' | 'fail'>('pass');
  
  const proposal = mockProposals.find(p => p.id === selectedProposalId) || mockProposals[0];

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
                className="w-7 h-7 bg-[#363636] hover:bg-[#404040] rounded-md transition-colors mb-0.5 flex items-center justify-center"
              >
                <svg className="h-3.5 w-3.5 fill-[#AFAFAF]" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
              </a>
              <a 
                href="https://discord.gg/your-discord" 
                target="_blank" 
                rel="noopener noreferrer"
                className="w-7 h-7 bg-[#363636] hover:bg-[#404040] rounded-md transition-colors mb-0.5 flex items-center justify-center"
              >
                <svg className="h-4 w-4 fill-[#AFAFAF]" viewBox="0 0 24 24">
                  <path d="M19.27 5.33C17.94 4.71 16.5 4.26 15 4a.09.09 0 0 0-.07.03c-.18.33-.39.76-.53 1.09a16.09 16.09 0 0 0-4.8 0c-.14-.34-.35-.76-.54-1.09c-.01-.02-.04-.03-.07-.03c-1.5.26-2.93.71-4.27 1.33c-.01 0-.02.01-.03.02c-2.72 4.07-3.47 8.03-3.1 11.95c0 .02.01.04.03.05c1.8 1.32 3.53 2.12 5.24 2.65c.03.01.06 0 .07-.02c.4-.55.76-1.13 1.07-1.74c.02-.04 0-.08-.04-.09c-.57-.22-1.11-.48-1.64-.78c-.04-.02-.04-.08-.01-.11c.11-.08.22-.17.33-.25c.02-.02.05-.02.07-.01c3.44 1.57 7.15 1.57 10.55 0c.02-.01.05-.01.07.01c.11.09.22.17.33.25c.04.03.04.09-.01.11c-.52.31-1.07.56-1.64.78c-.04.01-.05.06-.04.09c.32.61.68 1.19 1.07 1.74c.02.03.05.03.07.02c1.72-.53 3.45-1.33 5.25-2.65c.02-.01.03-.03.03-.05c.44-4.53-.73-8.46-3.1-11.95c-.01-.01-.02-.02-.04-.02zM8.52 14.91c-1.03 0-1.89-.95-1.89-2.12s.84-2.12 1.89-2.12c1.06 0 1.9.96 1.89 2.12c0 1.17-.84 2.12-1.89 2.12zm6.97 0c-1.03 0-1.89-.95-1.89-2.12s.84-2.12 1.89-2.12c1.06 0 1.9.96 1.89 2.12c0 1.17-.83 2.12-1.89 2.12z"/>
                </svg>
              </a>
              <a 
                href="https://axiom.trade/discover" 
                target="_blank" 
                rel="noopener noreferrer"
                className="w-7 h-7 bg-[#363636] hover:bg-[#404040] rounded-md transition-colors mb-0.5 flex items-center justify-center"
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

            {/* Market Prices */}
            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="bg-gray-900/50 rounded-xl p-6">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-gray-500 uppercase tracking-wide">Pass Market</span>
                  <TrendingUp className="h-4 w-4 text-green-500" />
                </div>
                <p className="text-3xl font-bold text-green-500">${proposal.passPrice.toFixed(3)}</p>
                <p className="text-sm text-gray-500 mt-2">Probability: {(proposal.passPrice * 100).toFixed(1)}%</p>
              </div>
              
              <div className="bg-gray-900/50 rounded-xl p-6">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-gray-500 uppercase tracking-wide">Fail Market</span>
                  <TrendingDown className="h-4 w-4 text-red-500" />
                </div>
                <p className="text-3xl font-bold text-red-500">${proposal.failPrice.toFixed(3)}</p>
                <p className="text-sm text-gray-500 mt-2">Probability: {(proposal.failPrice * 100).toFixed(1)}%</p>
              </div>
            </div>

            {/* Status Bar */}
            <div className="flex items-center gap-6 mb-8 pb-8">
              <div className="flex items-center gap-2">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  proposal.status === 'Pending' 
                    ? 'bg-orange-500/20 text-orange-500' 
                    : 'bg-gray-800 text-gray-400'
                }`}>
                  {proposal.status}
                </span>
              </div>
              <div className="flex items-center gap-2 text-gray-400">
                <Clock className="h-4 w-4" />
                <span className="text-sm">Ends {proposal.endsAt.toLocaleDateString()}</span>
              </div>
            </div>

            {/* Market Statistics */}
            <div>
              <h2 className="text-xl font-semibold mb-6">Market Statistics</h2>
              <div className="grid grid-cols-3 gap-6">
                <div className="bg-gray-900/30 rounded-xl p-5">
                  <div className="flex items-center gap-3 mb-2">
                    <Activity className="h-5 w-5 text-orange-500" />
                    <span className="text-sm text-gray-500">24h Volume</span>
                  </div>
                  <p className="text-2xl font-semibold">${(proposal.volume24h / 1000).toFixed(1)}k</p>
                </div>
                
                <div className="bg-gray-900/30 rounded-xl p-5">
                  <div className="flex items-center gap-3 mb-2">
                    <DollarSign className="h-5 w-5 text-orange-500" />
                    <span className="text-sm text-gray-500">Total Liquidity</span>
                  </div>
                  <p className="text-2xl font-semibold">$125.4k</p>
                </div>
                
                <div className="bg-gray-900/30 rounded-xl p-5">
                  <div className="flex items-center gap-3 mb-2">
                    <Users className="h-5 w-5 text-orange-500" />
                    <span className="text-sm text-gray-500">Traders</span>
                  </div>
                  <p className="text-2xl font-semibold">342</p>
                </div>
              </div>
            </div>
          </div>

          {/* Trading Panel - Persistent Rounded Rectangle */}
          <div className="w-96 p-8">
            <div className="bg-[#212121] rounded-2xl p-6">
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
