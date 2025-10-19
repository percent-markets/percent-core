import { useState, useEffect, useCallback } from 'react';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { getAccount, getAssociatedTokenAddress } from '@solana/spl-token';

// $ZC token mint address
const ZC_MINT = 'GVvPZpC6ymCoiHzYJ7CWZ8LhVn9tL2AUpRjSAsLh6jZC';

interface WalletBalances {
  sol: number;
  zc: number;
  loading: boolean;
  error: string | null;
}

export function useWalletBalances(walletAddress: string | null): WalletBalances {
  const [balances, setBalances] = useState<WalletBalances>({
    sol: 0,
    zc: 0,
    loading: false,
    error: null,
  });

  const fetchBalances = useCallback(async (address: string) => {
    setBalances(prev => ({ ...prev, loading: true, error: null }));

    try {
      // Use Helius RPC with API key if available, otherwise fall back to other options
      const heliusApiKey = process.env.NEXT_PUBLIC_HELIUS_API_KEY;
      const rpcUrl = heliusApiKey
        ? `https://mainnet.helius-rpc.com/?api-key=${heliusApiKey}`
        : process.env.NEXT_PUBLIC_RPC_URL || 'https://api.mainnet-beta.solana.com';
      const connection = new Connection(rpcUrl, 'confirmed');
      const pubKey = new PublicKey(address);

        // Fetch SOL balance
        const solBalance = await connection.getBalance(pubKey);
        const solAmount = solBalance / LAMPORTS_PER_SOL;

        // Fetch $ZC token balance
        let zcAmount = 0;
        try {
            const zcMint = new PublicKey(ZC_MINT);
            const zcATA = await getAssociatedTokenAddress(
              zcMint,
              pubKey
            );

            const zcAccount = await getAccount(connection, zcATA);
            // $ZC has 6 decimals
            zcAmount = Number(zcAccount.amount) / 1e6;
        } catch (error) {
          // Token account might not exist if user has 0 balance - this is normal
        }

      setBalances({
        sol: solAmount,
        zc: zcAmount,
        loading: false,
        error: null,
      });
    } catch (error) {
      setBalances({
        sol: 0,
        zc: 0,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch balances',
      });
    }
  }, []);

  useEffect(() => {
    if (!walletAddress) {
      setBalances({
        sol: 0,
        zc: 0,
        loading: false,
        error: null,
      });
      return;
    }

    // Initial fetch
    fetchBalances(walletAddress);

    // Set up WebSocket subscriptions for real-time updates
    const heliusApiKey = process.env.NEXT_PUBLIC_HELIUS_API_KEY;
    const rpcUrl = heliusApiKey
      ? `https://mainnet.helius-rpc.com/?api-key=${heliusApiKey}`
      : process.env.NEXT_PUBLIC_RPC_URL || 'https://api.mainnet-beta.solana.com';
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

    // Subscribe to $ZC token account changes
    let zcSubscriptionId: number | null = null;
    (async () => {
      try {
        const zcMint = new PublicKey(ZC_MINT);
        const zcATA = await getAssociatedTokenAddress(zcMint, pubKey);

        zcSubscriptionId = connection.onAccountChange(
          zcATA,
          () => {
            // Refetch balances when token account changes
            fetchBalances(walletAddress);
          },
          'confirmed'
        );
      } catch (error) {
        // Could not subscribe to $ZC account changes - this is normal if account doesn't exist
      }
    })();
    
    // Also refresh every 30 seconds as fallback
    const interval = setInterval(() => fetchBalances(walletAddress), 30000);
    
    // Cleanup
    return () => {
      connection.removeAccountChangeListener(solSubscriptionId);
      if (zcSubscriptionId !== null) {
        connection.removeAccountChangeListener(zcSubscriptionId);
      }
      clearInterval(interval);
    };
  }, [walletAddress, fetchBalances]);

  return balances;
}