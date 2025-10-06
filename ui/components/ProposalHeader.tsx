import { StatusBadge } from './StatusBadge';
import { CountdownTimer } from './CountdownTimer';
import { getProposalContent } from '@/lib/proposalContent';
import { IoMdStopwatch } from 'react-icons/io';

type ProposalStatus = 'Pending' | 'Passed' | 'Failed' | 'Executed';
type TabType = 'trade' | 'description';

interface ProposalHeaderProps {
  proposalId: number;
  status: ProposalStatus;
  finalizedAt: number;
  description: string;
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  onTimerEnd?: () => void;
  pfgPercentage: number | null;
}

export function ProposalHeader({
  proposalId,
  status,
  finalizedAt,
  description,
  activeTab,
  onTabChange,
  onTimerEnd,
  pfgPercentage
}: ProposalHeaderProps) {
  const { title, content } = getProposalContent(proposalId, description);

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <StatusBadge status={status} />
          <span className="w-px h-4 bg-[#282828]"></span>
          <span className="text-xs text-gray-500">
            {new Date(finalizedAt).toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric'
            })} at {new Date(finalizedAt).toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit'
            })}
          </span>
          <span className="w-px h-4 bg-[#282828]"></span>
          <div className="flex items-center gap-2">
            <IoMdStopwatch className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-mono font-bold text-white">
              <CountdownTimer
                endsAt={finalizedAt}
                onTimerEnd={onTimerEnd}
                isPending={status === 'Pending'}
              />
            </span>
          </div>
        </div>

        {/* PFG Display */}
        <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-4 py-2">
          <div className="flex flex-col items-end">
            <span className="text-xs text-gray-400 mb-1">TWAP Pass-Fail Gap (PFG)</span>
            <span className="text-lg font-bold text-white">
              {pfgPercentage !== null ? `${pfgPercentage.toFixed(2)}%` : 'Loading...'}
            </span>
          </div>
        </div>
      </div>
      <div className="mb-4">
        <h1 className="text-3xl font-semibold mb-4">
          {title}
        </h1>

        {/* Trade/Description Toggle */}
        <div className="inline-flex border-b border-[#2A2A2A] mb-6">
          <button
            onClick={() => onTabChange('trade')}
            className={`px-6 py-2 text-sm font-medium transition-colors relative ${
              activeTab === 'trade'
                ? 'text-white'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            Trade
            {activeTab === 'trade' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white"></div>
            )}
          </button>
          <button
            onClick={() => onTabChange('description')}
            className={`px-6 py-2 text-sm font-medium transition-colors relative ${
              activeTab === 'description'
                ? 'text-white'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            Description
            {activeTab === 'description' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white"></div>
            )}
          </button>
        </div>

        {/* Description Tab Content */}
        {activeTab === 'description' && (
          <div className="bg-[#1A1A1A] rounded-lg p-6">
            {content ? (
              content
            ) : (
              <p className="text-sm text-gray-500">Proposal #{proposalId}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
