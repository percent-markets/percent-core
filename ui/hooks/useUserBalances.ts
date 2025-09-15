import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import type { UserBalancesResponse } from '../../src/types/api';

interface UserBalances {
  data: UserBalancesResponse | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useUserBalances(proposalId: number | null, walletAddress: string | null): UserBalances {
  const [balances, setBalances] = useState<Omit<UserBalances, 'refetch'>>({
    data: null,
    loading: false,
    error: null,
  });

  const fetchBalances = useCallback(async (id: number, address: string) => {
    setBalances(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const data = await api.getUserBalances(id, address);
      
      if (data) {
        setBalances({
          data,
          loading: false,
          error: null,
        });
      } else {
        setBalances({
          data: null,
          loading: false,
          error: 'Failed to fetch user balances',
        });
      }
    } catch (error) {
      console.error('Error fetching user balances:', error);
      setBalances({
        data: null,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch user balances',
      });
    }
  }, []);

  useEffect(() => {
    // Only fetch if both proposalId and walletAddress are available
    if (proposalId === null || !walletAddress) {
      setBalances({
        data: null,
        loading: false,
        error: null,
      });
      return;
    }

    // Initial fetch
    fetchBalances(proposalId, walletAddress);

    // Refresh every 30 seconds
    const interval = setInterval(() => {
      fetchBalances(proposalId, walletAddress);
    }, 30000);

    // Cleanup
    return () => {
      clearInterval(interval);
    };
  }, [proposalId, walletAddress, fetchBalances]);

  const refetch = useCallback(() => {
    if (proposalId !== null && walletAddress) {
      fetchBalances(proposalId, walletAddress);
    }
  }, [proposalId, walletAddress, fetchBalances]);

  return {
    ...balances,
    refetch,
  };
}