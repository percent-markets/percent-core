#!/usr/bin/env ts-node

// ONLY WORKS FOR DEVNET

import dotenv from 'dotenv';
import { Keypair } from '@solana/web3.js';
import { executePositionOpening } from './utils/open-position-utils';

dotenv.config();

// Position type: 'pass' or 'fail'
const POSITION_TYPE: 'pass' | 'fail' = 'fail';

// Test wallet (Alice)
function loadTestWallet(): Keypair {
  const seed = new Uint8Array(32);
  const encoder = new TextEncoder();
  const nameBytes = encoder.encode('alice-test-wallet');
  for (let i = 0; i < Math.min(nameBytes.length, 32); i++) {
    seed[i] = nameBytes[i];
  }
  return Keypair.fromSeed(seed);
}

async function testOpenPosition() {
  const API_URL = process.env.API_URL || 'http://localhost:3000';
  const API_KEY = process.env.API_KEY;
  
  if (!API_KEY) {
    console.error('API_KEY environment variable is required');
    process.exit(1);
  }
  
  // Get proposal ID from command line or use default
  const proposalId = process.argv[2] || '0';
  
  // Get test wallet (Alice)
  const alice = loadTestWallet();
  const alicePublicKey = alice.publicKey.toBase58();
  
  console.log(`Testing open ${POSITION_TYPE} position for proposal ${proposalId} with wallet: ${alicePublicKey}`);
  
  try {
    // For devnet testing, we simulate a 50/50 split
    // In production, this would be a real Jupiter swap
    console.log('\n=== Mock 50/50 split for devnet ===');
    console.log('Using pre-existing base and quote token balances...');
    
    // Define amounts to split (typical test amounts)
    const baseAmountToSplit = '250000000000';  // 250 base tokens (9 decimals)
    const quoteAmountToSplit = '250000000000'; // 250 quote tokens (9 decimals)
    
    console.log(`Will split ${baseAmountToSplit} base tokens`);
    console.log(`Will split ${quoteAmountToSplit} quote tokens`);
    
    // Execute the position opening using shared utils
    await executePositionOpening({
      API_URL,
      API_KEY,
      proposalId,
      userKeypair: alice,
      positionType: POSITION_TYPE,
      baseAmountToSplit,
      quoteAmountToSplit
    });
    
  } catch (error: any) {
    console.error(error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  testOpenPosition();
}

export { testOpenPosition };