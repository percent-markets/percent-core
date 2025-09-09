#!/usr/bin/env ts-node

import { CreateProposalRequest } from '../src/types/api';
import dotenv from 'dotenv';

dotenv.config();

async function createProposal() {
  const API_URL = process.env.API_URL || 'http://localhost:3000';
  const API_KEY = process.env.API_KEY;
  
  if (!API_KEY) {
    console.error('API_KEY environment variable is required');
    process.exit(1);
  }
  
  const request: CreateProposalRequest = {
    description: 'Test Proposal',
    proposalLength: 300,
    twap: {
      initialTwapValue: 5000,
      twapMaxObservationChangePerUpdate: 100,
      twapStartDelay: 5000,
      passThresholdBps: 300
    },
    amm: {
      initialBaseAmount: '1000000000',
      initialQuoteAmount: '100000000'
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