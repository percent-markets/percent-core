'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { TokenPriceBox } from './TokenPriceBox';
import { getPriceStreamService, PriceUpdate } from '../services/price-stream.service';
import { api } from '../lib/api';

interface LivePriceDisplayProps {
  proposalId: number;
  onPricesUpdate?: (prices: { pass: number | null; fail: number | null }) => void;
  onTwapUpdate?: (twap: { passTwap: number | null; failTwap: number | null }) => void;
}

interface TokenPrices {
  oogway: number | null;
  pass: number | null;
  fail: number | null;
  oogwayUsd?: number | null;
  passUsd?: number | null;
  failUsd?: number | null;
}

interface TwapData {
  passTwap: number | null;
  failTwap: number | null;
}

// OOGWAY token configuration
const OOGWAY_CONFIG = {
  address: 'GVvPZpC6ymCoiHzYJ7CWZ8LhVn9tL2AUpRjSAsLh6jZC',
  poolAddress: '2FCqTyvFcE4uXgRL1yh56riZ9vdjVgoP6yknZW3f8afX',
  name: '$oogway',
  symbol: '$oogway'
};

export const LivePriceDisplay: React.FC<LivePriceDisplayProps> = ({ proposalId, onPricesUpdate, onTwapUpdate }) => {
  const [prices, setPrices] = useState<TokenPrices>({
    oogway: null,
    pass: null,
    fail: null,
    oogwayUsd: null,
    passUsd: null,
    failUsd: null
  });
  
  const [twapData, setTwapData] = useState<TwapData>({
    passTwap: null,
    failTwap: null
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

  // Fetch proposal details and TWAP data
  useEffect(() => {
    const fetchProposalDetails = async () => {
      try {
        const proposal = await api.getProposal(proposalId);
        if (!proposal) {
          throw new Error('Failed to fetch proposal details');
        }

        // Extract pass and fail token addresses from vaults
        const passAddress = proposal.baseVaultState?.passConditionalMint || null;
        const failAddress = proposal.baseVaultState?.failConditionalMint || null;
        
        // Extract pool addresses from AMM states
        const passPoolAddress = proposal.passAmmState?.pool || null;
        const failPoolAddress = proposal.failAmmState?.pool || null;

        setTokenAddresses({
          pass: passAddress,
          fail: failAddress,
          passPool: passPoolAddress,
          failPool: failPoolAddress
        });

      } catch (error) {
        console.error('Error fetching proposal details:', error);
        setError('Failed to fetch proposal details');
      } finally {
        setIsLoading(false);
      }
    };

    fetchProposalDetails();
    
    // Fetch TWAP data for governance decision
    const fetchTwap = async () => {
      try {
        const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const response = await fetch(`${API_BASE_URL}/api/history/${proposalId}/twap`);
        console.log(response);
        if (response.ok) {
          const data = await response.json();
          if (data.data && data.data.length > 0) {
            const latest = data.data[0];
            const twap = {
              passTwap: parseFloat(latest.passTwap),
              failTwap: parseFloat(latest.failTwap)
            };
            setTwapData(twap);
            // Notify parent component of TWAP update
            if (onTwapUpdate) {
              onTwapUpdate(twap);
            }
          }
        }
      } catch (error) {
        // Silently fail - TWAP data not available yet
      }
    };
    
    fetchTwap();
    
    // Poll for TWAP updates every 30 seconds
    const interval = setInterval(fetchTwap, 10000);
    
    return () => clearInterval(interval);
  }, [proposalId]);

  // Handle price updates from WebSocket - stable reference
  const handlePriceUpdate = useCallback((tokenType: 'oogway' | 'pass' | 'fail') => {
    return (update: PriceUpdate) => {
      setPrices(prev => ({
        ...prev,
        [tokenType]: update.price,
        [`${tokenType}Usd`]: update.priceUsd || null
      }));
    };
  }, []); // Empty dependency array for stable reference

  // Set up OOGWAY subscription immediately
  useEffect(() => {
    const priceService = getPriceStreamService();
    const oogwayCallback = handlePriceUpdate('oogway');
    
    priceService.subscribeToToken(OOGWAY_CONFIG.address, oogwayCallback);
    
    return () => {
      priceService.unsubscribeFromToken(OOGWAY_CONFIG.address, oogwayCallback);
    };
  }, []); // Removed handlePriceUpdate - it's stable now

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
        priceService.subscribeToToken(tokenAddresses.pass!, passCallback, tokenAddresses.passPool || undefined),
        priceService.subscribeToToken(tokenAddresses.fail!, failCallback, tokenAddresses.failPool || undefined)
      ]);
    };

    setupSubscriptions().catch(() => {});

    // Cleanup on unmount
    return () => {
      mounted = false;
      if (tokenAddresses.pass) {
        priceService.unsubscribeFromToken(tokenAddresses.pass, passCallback);
      }
      if (tokenAddresses.fail) {
        priceService.unsubscribeFromToken(tokenAddresses.fail, failCallback);
      }
    };
  }, [tokenAddresses.pass, tokenAddresses.fail, tokenAddresses.passPool, tokenAddresses.failPool]); // Removed handlePriceUpdate

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
        price={prices.passUsd || prices.pass}
        isLoading={prices.pass === null}
        tokenType="pass"
      />
      
      <TokenPriceBox
        tokenName="Fail"
        tokenSymbol={`FAIL-${proposalId}`}
        tokenAddress={tokenAddresses.fail || ''}
        price={prices.failUsd || prices.fail}
        isLoading={prices.fail === null}
        tokenType="fail"
      />
      
      <TokenPriceBox
        tokenName="Pass-Fail Gap (PFG)"
        tokenSymbol="TWAP"
        price={
          // Match backend calculation: (passTwap - failTwap) / failTwap * 100
          // Backend uses this to compare against passThresholdBps/100
          twapData.passTwap !== null && twapData.failTwap !== null && twapData.failTwap > 0
            ? ((twapData.passTwap - twapData.failTwap) / twapData.failTwap) * 100
            : null
        }
        isLoading={false}
        tokenType="gap"
      />
    </div>
  );
};