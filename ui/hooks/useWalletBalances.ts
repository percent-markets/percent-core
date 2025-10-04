import { useState, useEffect, useCallback } from 'react';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { getAccount, getAssociatedTokenAddress } from '@solana/spl-token';

// $oogway token mint address
const OOGWAY_MINT = 'GVvPZpC6ymCoiHzYJ7CWZ8LhVn9tL2AUpRjSAsLh6jZC';

interface WalletBalances {
  sol: number;
  oogway: number;
  loading: boolean;
  error: string | null;
}

export function useWalletBalances(walletAddress: string | null): WalletBalances {
  const [balances, setBalances] = useState<WalletBalances>({
    sol: 0,
    oogway: 0,
    loading: false,
    error: null,
  });

  const fetchBalances = useCallback(async (address: string) => {
    setBalances(prev => ({ ...prev, loading: true, error: null }));

    try {
      // Use Helius RPC for better reliability
      const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || 'https://api.mainnet-beta.solana.com';
      const connection = new Connection(rpcUrl, 'confirmed');
      const pubKey = new PublicKey(address);

        // Fetch SOL balance
        const solBalance = await connection.getBalance(pubKey);
        const solAmount = solBalance / LAMPORTS_PER_SOL;

        // Fetch $oogway token balance
        let oogwayAmount = 0;
        try {
            const oogwayMint = new PublicKey(OOGWAY_MINT);
            const oogwayATA = await getAssociatedTokenAddress(
              oogwayMint,
              pubKey
            );

            const oogwayAccount = await getAccount(connection, oogwayATA);
            // Assuming $oogway has 9 decimals like most SPL tokens
            oogwayAmount = Number(oogwayAccount.amount) / 1e6;
        } catch (error) {
          // Token account might not exist if user has 0 balance - this is normal
        }

      setBalances({
        sol: solAmount,
        oogway: oogwayAmount,
        loading: false,
        error: null,
      });
    } catch (error) {
      setBalances({
        sol: 0,
        oogway: 0,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch balances',
      });
    }
  }, []);

  useEffect(() => {
    if (!walletAddress) {
      setBalances({
        sol: 0,
        oogway: 0,
        loading: false,
        error: null,
      });
      return;
    }

    // Initial fetch
    fetchBalances(walletAddress);

    // Set up WebSocket subscriptions for real-time updates
    const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || 'https://api.mainnet-beta.solana.com';
    const connection = new Connection(rpcUrl, 'confirmed');
    const pubKey = new PublicKey(walletAddress);
    
    // Subscribe to account changes for SOL balance
    const solSubscriptionId = connection.onAccountChange(
      pubKey,
      () => {
        // Refetch balances when account changes
        fetchBalances(walletAddress);
      },
      'confirmed'
    );

    // Subscribe to $oogway token account changes
    let oogwaySubscriptionId: number | null = null;
    (async () => {
      try {
        const oogwayMint = new PublicKey(OOGWAY_MINT);
        const oogwayATA = await getAssociatedTokenAddress(oogwayMint, pubKey);
        
        oogwaySubscriptionId = connection.onAccountChange(
          oogwayATA,
          () => {
            // Refetch balances when token account changes
            fetchBalances(walletAddress);
          },
          'confirmed'
        );
      } catch (error) {
        // Could not subscribe to $oogway account changes - this is normal if account doesn't exist
      }
    })();
    
    // Also refresh every 30 seconds as fallback
    const interval = setInterval(() => fetchBalances(walletAddress), 30000);
    
    // Cleanup
    return () => {
      connection.removeAccountChangeListener(solSubscriptionId);
      if (oogwaySubscriptionId !== null) {
        connection.removeAccountChangeListener(oogwaySubscriptionId);
      }
      clearInterval(interval);
    };
  }, [walletAddress, fetchBalances]);

  return balances;
}