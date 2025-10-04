import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import type { ProposalListItem, ProposalDetailResponse } from '@/types/api';

export function useProposals() {
  const [proposals, setProposals] = useState<ProposalListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProposals = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getProposals();
      // Filter out proposals 6 and 7
      const filteredData = data.filter(p => p.id !== 6 && p.id !== 7);
      setProposals(filteredData);
      setError(null);
    } catch (err) {
      console.error('Error fetching proposals:', err);
      setError('Failed to fetch proposals');
      setProposals([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProposals();
  }, [fetchProposals]);

  return { proposals, loading, error, refetch: fetchProposals };
}

export function useProposal(id: number) {
  const [proposal, setProposal] = useState<ProposalDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProposal() {
      try {
        setLoading(true);
        const data = await api.getProposal(id);
        setProposal(data);
      } catch (err) {
        console.error('Error fetching proposal:', err);
        setError('Failed to fetch proposal');
        setProposal(null);
      } finally {
        setLoading(false);
      }
    }

    fetchProposal();
  }, [id]);

  return { proposal, loading, error };
}