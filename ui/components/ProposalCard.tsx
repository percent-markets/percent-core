'use client';

import Link from 'next/link';
import { Clock, TrendingUp, TrendingDown } from 'lucide-react';

interface ProposalCardProps {
  proposal: {
    id: number;
    title: string;
    description: string;
    status: string;
    passPrice: number;
    failPrice: number;
    volume24h: number;
    endsAt: Date;
  };
}

export default function ProposalCard({ proposal }: ProposalCardProps) {
  const timeRemaining = Math.floor((proposal.endsAt.getTime() - Date.now()) / (1000 * 60 * 60));
  const isActive = proposal.status === 'Pending';

  return (
    <Link href={`/proposal/${proposal.id}`}>
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 hover:border-gray-700 transition cursor-pointer">
        <div className="flex items-start justify-between mb-4">
          <h3 className="text-lg font-semibold line-clamp-2">{proposal.title}</h3>
          <span className={`px-2 py-1 rounded text-xs font-medium ${
            isActive 
              ? 'bg-emerald-400/20 text-emerald-400' 
              : 'bg-gray-800 text-gray-400'
          }`}>
            {proposal.status}
          </span>
        </div>

        <p className="text-gray-400 text-sm mb-4 line-clamp-2">
          {proposal.description}
        </p>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="bg-gray-800/50 rounded p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-500">PASS</span>
              <TrendingUp className="h-3 w-3 text-emerald-400" />
            </div>
            <p className="text-lg font-bold text-emerald-400">${proposal.passPrice.toFixed(3)}</p>
          </div>
          <div className="bg-gray-800/50 rounded p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-500">FAIL</span>
              <TrendingDown className="h-3 w-3 text-rose-400" />
            </div>
            <p className="text-lg font-bold text-rose-400">${proposal.failPrice.toFixed(3)}</p>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {isActive ? (
              <span>{timeRemaining}h remaining</span>
            ) : (
              <span>Ended</span>
            )}
          </div>
          <span>Vol: ${(proposal.volume24h / 1000).toFixed(1)}k</span>
        </div>
      </div>
    </Link>
  );
}