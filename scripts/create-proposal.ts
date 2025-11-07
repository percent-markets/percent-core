#!/usr/bin/env ts-node

import { CreateProposalRequest } from '@src/routes/proposals';
import * as dotenv from 'dotenv';

dotenv.config();

// Global configuration
const MODERATOR_ID = 2; // Change this to target different moderators

async function createProposal() {
  const API_URL = process.env.API_URL || 'http://localhost:3001';
  const API_KEY = process.env.API_KEY;

  if (!API_KEY) {
    console.error('API_KEY environment variable is required');
    process.exit(1);
  }
  
  // Token decimals
  const BASE_DECIMALS = 6;
  const QUOTE_DECIMALS = 9;
  
  // Raw token amounts (smallest units)
  // Current_spot = ~0.010 SOL per ZC
  const initialBaseAmount = '8538038000000';  // ZC (6 decimals)
  const initialQuoteAmount = '19875600000'; // (9 decimals)
  
  // Calculate decimal-adjusted price (same as AMM will return)
  // Convert to actual token amounts: raw / 10^decimals
  const baseTokens = parseInt(initialBaseAmount) / Math.pow(10, BASE_DECIMALS); // 10,000 tokens
  const quoteTokens = parseInt(initialQuoteAmount) / Math.pow(10, QUOTE_DECIMALS); // 1,000 tokens
  const ammPrice = quoteTokens / baseTokens; // 1,000 / 10,000 = 0.1
  console.log(ammPrice);
  
  const request: CreateProposalRequest = {
    title: 'Decision Market Gated Creator Fees by BORD',
    description: 'Should ZC execute on PR #35? https://github.com/zcombinatorio/zcombinator/pull/35',
    proposalLength: 64800, // 24 hours
    spotPoolAddress: 'CCZdbVvDqPN8DmMLVELfnt9G1Q9pQNt3bTGifSpUY9Ad', // ZC/SOL spot pool
    totalSupply: 1125365478, // 1 billion tokens for market cap calculation
    twap: {
      initialTwapValue: ammPrice, // Decimal-adjusted price (0.1)
      twapMaxObservationChangePerUpdate: null,
      twapStartDelay: 0, // Changed from 5000
      passThresholdBps: 10,
      minUpdateInterval: 6000 // 1 minute in milliseconds
    },
    amm: {
      initialBaseAmount,
      initialQuoteAmount
    }
  };
  
  try {
    const response = await fetch(`${API_URL}/api/proposals?moderatorId=${MODERATOR_ID}`, {
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