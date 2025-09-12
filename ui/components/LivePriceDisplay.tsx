'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { TokenPriceBox } from './TokenPriceBox';
import { getPriceStreamService, PriceUpdate } from '../services/price-stream.service';
import { api } from '../lib/api';

interface LivePriceDisplayProps {
  proposalId: number;
  onPricesUpdate?: (prices: { pass: number | null; fail: number | null }) => void;
}

interface TokenPrices {
  oogway: number | null;
  pass: number | null;
  fail: number | null;
}

// OOGWAY token configuration
const OOGWAY_CONFIG = {
  address: 'C7MGcMnN8cXUkj8JQuMhkJZh6WqY2r8QnT3AUfKTkrix',
  poolAddress: '2FCqTyvFcE4uXgRL1yh56riZ9vdjVgoP6yknZW3f8afX',
  name: '$oogway',
  symbol: '$oogway'
};

export const LivePriceDisplay: React.FC<LivePriceDisplayProps> = ({ proposalId, onPricesUpdate }) => {
  const [prices, setPrices] = useState<TokenPrices>({
    oogway: null,
    pass: null,
    fail: null
  });
  
  const [tokenAddresses, setTokenAddresses] = useState<{
    pass: string | null;
    fail: string | null;
    passPool: string | null;
    failPool: string | null;
  }>({
    pass: null,
    fail: null,
    passPool: null,
    failPool: null
  });
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch proposal details to get token addresses
  useEffect(() => {
    const fetchProposalDetails = async () => {
      try {
        const proposal = await api.getProposal(proposalId);
        if (!proposal) {
          throw new Error('Failed to fetch proposal details');
        }

        // Extract pass and fail token addresses from vaults
        // Log the proposal structure to debug
        console.log('Proposal structure:', proposal);
        
        const passAddress = proposal.baseVaultState?.passConditionalMint || 
                           proposal.vaults?.base?.passConditionalMint || null;
        const failAddress = proposal.baseVaultState?.failConditionalMint || 
                           proposal.vaults?.base?.failConditionalMint || null;
        
        // Extract pool addresses from AMM states
        const passPoolAddress = proposal.passAmmState?.pool || null;
        const failPoolAddress = proposal.failAmmState?.pool || null;

        console.log('Found pool addresses:', {
          passPool: passPoolAddress,
          failPool: failPoolAddress
        });

        setTokenAddresses({
          pass: passAddress,
          fail: failAddress,
          passPool: passPoolAddress,
          failPool: failPoolAddress
        });

        if (!passAddress || !failAddress) {
          console.warn('Token addresses not found in proposal', {
            passAddress,
            failAddress,
            passPoolAddress,
            failPoolAddress,
            proposal
          });
        }
      } catch (error) {
        console.error('Error fetching proposal details:', error);
        setError('Failed to fetch proposal details');
      } finally {
        setIsLoading(false);
      }
    };

    fetchProposalDetails();
  }, [proposalId]);

  // Handle price updates from WebSocket
  const handlePriceUpdate = useCallback((tokenType: 'oogway' | 'pass' | 'fail') => {
    return (update: PriceUpdate) => {
      setPrices(prev => ({
        ...prev,
        [tokenType]: update.price
      }));
    };
  }, []);

  // Set up OOGWAY subscription immediately
  useEffect(() => {
    const priceService = getPriceStreamService();
    const oogwayCallback = handlePriceUpdate('oogway');
    
    priceService.subscribeToToken(OOGWAY_CONFIG.address, oogwayCallback);
    
    return () => {
      priceService.unsubscribeFromToken(OOGWAY_CONFIG.address, oogwayCallback);
    };
  }, [handlePriceUpdate]);

  // Set up pass/fail subscriptions when BOTH addresses AND pools are available
  useEffect(() => {
    // Need token addresses AND pool addresses for devnet tokens
    if (!tokenAddresses.pass || !tokenAddresses.fail || !tokenAddresses.passPool || !tokenAddresses.failPool) {
      return;
    }

    const priceService = getPriceStreamService();
    const passCallback = handlePriceUpdate('pass');
    const failCallback = handlePriceUpdate('fail');
    let mounted = true;

    const setupSubscriptions = async () => {
      if (!mounted) return;
      
      // Subscribe with pool addresses (required for devnet tokens)
      await Promise.all([
        priceService.subscribeToToken(tokenAddresses.pass, passCallback, tokenAddresses.passPool),
        priceService.subscribeToToken(tokenAddresses.fail, failCallback, tokenAddresses.failPool)
      ]);
    };

    setupSubscriptions().catch(console.error);

    // Cleanup on unmount
    return () => {
      mounted = false;
      priceService.unsubscribeFromToken(tokenAddresses.pass, passCallback);
      priceService.unsubscribeFromToken(tokenAddresses.fail, failCallback);
    };
  }, [tokenAddresses.pass, tokenAddresses.fail, tokenAddresses.passPool, tokenAddresses.failPool, handlePriceUpdate]);

  // Call the callback when prices update
  useEffect(() => {
    if (onPricesUpdate) {
      onPricesUpdate({ pass: prices.pass, fail: prices.fail });
    }
  }, [prices.pass, prices.fail, onPricesUpdate]);


  if (error) {
    return (
      <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4">
        <p className="text-red-500">Error: {error}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-4">
      <TokenPriceBox
        tokenName={OOGWAY_CONFIG.name}
        tokenSymbol={OOGWAY_CONFIG.symbol}
        tokenAddress={OOGWAY_CONFIG.address}
        price={prices.oogway}
        isLoading={isLoading && prices.oogway === null}
        tokenType="governance"
      />
      
      <TokenPriceBox
        tokenName="Pass"
        tokenSymbol={`PASS-${proposalId}`}
        tokenAddress={tokenAddresses.pass || ''}
        price={prices.pass}
        isLoading={prices.pass === null}
        tokenType="pass"
      />
      
      <TokenPriceBox
        tokenName="Fail"
        tokenSymbol={`FAIL-${proposalId}`}
        tokenAddress={tokenAddresses.fail || ''}
        price={prices.fail}
        isLoading={prices.fail === null}
        tokenType="fail"
      />
      
      <TokenPriceBox
        tokenName="Pass-Fail Gap (PFG)"
        tokenSymbol=""
        price={prices.pass !== null && prices.fail !== null && prices.fail > 0 
          ? ((prices.pass - prices.fail) / prices.fail) * 100 
          : null}
        isLoading={prices.pass === null || prices.fail === null}
        tokenType="gap"
      />
    </div>
  );
};