#!/usr/bin/env ts-node

import { CreateProposalRequest } from '../src/types/api';
import * as dotenv from 'dotenv';

dotenv.config();

async function createProposal() {
  const API_URL = process.env.API_URL || 'http://localhost:3000';
  const API_KEY = process.env.API_KEY;
  
  if (!API_KEY) {
    console.error('API_KEY environment variable is required');
    process.exit(1);
  }
  
  // Token decimals (from moderator.service.ts)
  const baseDecimals = 6;
  const quoteDecimals = 9;
  
  // Raw token amounts (smallest units)
  // Current_spot = ~0.010 SOL per ZC
  const initialBaseAmount = '7400000000';  // 7.4k ZC (6 decimals)
  const initialQuoteAmount = '100000000'; // 0.1 Sol (9 decimals)
  
  // Calculate decimal-adjusted price (same as AMM will return)
  // Convert to actual token amounts: raw / 10^decimals
  const baseTokens = parseInt(initialBaseAmount) / Math.pow(10, baseDecimals); // 10,000 tokens
  const quoteTokens = parseInt(initialQuoteAmount) / Math.pow(10, quoteDecimals); // 1,000 tokens
  const ammPrice = quoteTokens / baseTokens; // 1,000 / 10,000 = 0.1
  console.log(ammPrice);
  
  const request: CreateProposalRequest = {
    description: 'Update Staking Vault Rewards and Parameters',
    proposalLength: 900, // 15 minutes
    spotPoolAddress: 'CCZdbVvDqPN8DmMLVELfnt9G1Q9pQNt3bTGifSpUY9Ad', // ZC/SOL spot pool
    totalSupply: 1019381155, // 1 billion tokens for market cap calculation
    twap: {
      initialTwapValue: ammPrice, // Decimal-adjusted price (0.1)
      twapMaxObservationChangePerUpdate: null,
      twapStartDelay: 0, // Changed from 5000
      passThresholdBps: 300,
      minUpdateInterval: 6000 // 1 minute in milliseconds
    },
    amm: {
      initialBaseAmount,
      initialQuoteAmount
    }
  };
  
  try {
    const response = await fetch(`${API_URL}/api/proposals`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': API_KEY
      },
      body: JSON.stringify(request)
    });
    
    if (!response.ok) {
      const error = await response.json();
      console.error(JSON.stringify(error, null, 2));
      process.exit(1);
    }
    
    const data = await response.json();
    console.log(JSON.stringify(data, null, 2));
    
  } catch (error: any) {
    console.error(error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  createProposal();
}

export { createProposal };