'use client';

import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react';
import { mockProposals } from '@/lib/mock-data';

interface ProposalContextType {
  proposals: typeof mockProposals;
  selectedProposalId: number | null;
  selectProposal: (id: number) => void;
  selectedProposal: typeof mockProposals[0] | null;
  sortedProposals: typeof mockProposals;
  refreshProposals: () => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

const ProposalContext = createContext<ProposalContextType | undefined>(undefined);

export const useProposals = () => {
  const context = useContext(ProposalContext);
  if (!context) {
    throw new Error('useProposals must be used within a ProposalProvider');
  }
  return context;
};

interface ProposalProviderProps {
  children: ReactNode;
}

export const ProposalProvider: React.FC<ProposalProviderProps> = ({ children }) => {
  const [proposals, setProposals] = useState(mockProposals);
  const [selectedProposalId, setSelectedProposalId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sortedProposals = useMemo(() => 
    [...proposals].sort((a, b) => b.endsAt.getTime() - a.endsAt.getTime()),
    [proposals]
  );

  const selectedProposal = useMemo(() => 
    selectedProposalId ? proposals.find(p => p.id === selectedProposalId) || null : null,
    [selectedProposalId, proposals]
  );

  const selectProposal = useCallback((id: number) => {
    setSelectedProposalId(id);
  }, []);

  const refreshProposals = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // In production, this would fetch from API
      await new Promise(resolve => setTimeout(resolve, 500));
      setProposals(mockProposals);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch proposals');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const value = useMemo(() => ({
    proposals,
    selectedProposalId,
    selectProposal,
    selectedProposal,
    sortedProposals,
    refreshProposals,
    isLoading,
    error,
  }), [proposals, selectedProposalId, selectProposal, selectedProposal, sortedProposals, refreshProposals, isLoading, error]);

  return <ProposalContext.Provider value={value}>{children}</ProposalContext.Provider>;
};