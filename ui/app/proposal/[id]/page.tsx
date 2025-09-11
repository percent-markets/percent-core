'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import TradingInterface from '@/components/TradingInterface';
import { Clock, Info, TrendingUp, TrendingDown } from 'lucide-react';
import { mockProposals } from '@/lib/mock-data';

export default function ProposalDetailPage() {
  const params = useParams();
  const proposalId = parseInt(params.id as string);
  const proposal = mockProposals.find(p => p.id === proposalId) || mockProposals[0];
  
  const [selectedMarket, setSelectedMarket] = useState<'pass' | 'fail'>('pass');

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 mb-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h1 className="text-2xl font-bold mb-2">{proposal.title}</h1>
                <div className="flex items-center gap-4 text-sm text-gray-400">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    proposal.status === 'Pending' 
                      ? 'bg-emerald-400/20 text-emerald-400' 
                      : 'bg-gray-800 text-gray-400'
                  }`}>
                    {proposal.status}
                  </span>
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    <span>Ends {proposal.endsAt.toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            </div>
            
            <p className="text-gray-300 mb-6">{proposal.description}</p>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-800/50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-400">Pass Market</span>
                  <TrendingUp className="h-4 w-4 text-emerald-400" />
                </div>
                <p className="text-2xl font-bold text-emerald-400">${proposal.passPrice.toFixed(3)}</p>
                <p className="text-xs text-gray-500 mt-1">Implied probability: {(proposal.passPrice * 100).toFixed(1)}%</p>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-400">Fail Market</span>
                  <TrendingDown className="h-4 w-4 text-rose-400" />
                </div>
                <p className="text-2xl font-bold text-rose-400">${proposal.failPrice.toFixed(3)}</p>
                <p className="text-xs text-gray-500 mt-1">Implied probability: {(proposal.failPrice * 100).toFixed(1)}%</p>
              </div>
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Info className="h-5 w-5" />
              Market Statistics
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-gray-500 mb-1">24h Volume</p>
                <p className="font-semibold">${(proposal.volume24h / 1000).toFixed(1)}k</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Total Liquidity</p>
                <p className="font-semibold">$125.4k</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Unique Traders</p>
                <p className="font-semibold">342</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Pass Threshold</p>
                <p className="font-semibold">60%</p>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-1">
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
  );
}