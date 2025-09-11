#!/usr/bin/env ts-node

// ONLY WORKS FOR DEVNET

import dotenv from 'dotenv';
import { Keypair } from '@solana/web3.js';
import { executePositionOpening } from './utils/open-position-utils';

dotenv.config();

// Position type will be set from command line args

// Load test wallet based on position type
function loadTestWallet(positionType: 'pass' | 'fail'): Keypair {
  const seed = new Uint8Array(32);
  const encoder = new TextEncoder();
  // Use Bob for pass positions, Charlie for fail positions
  const walletName = positionType === 'pass' ? 'bob-test-wallet' : 'charlie-test-wallet';
  const nameBytes = encoder.encode(walletName);
  for (let i = 0; i < Math.min(nameBytes.length, 32); i++) {
    seed[i] = nameBytes[i];
  }
  return Keypair.fromSeed(seed);
}

async function testOpenPosition() {
  const API_URL = process.env.API_URL || 'http://localhost:3000';
  
  // Get command line arguments
  const proposalId = process.argv[2] || '0';
  const positionType = (process.argv[3] || 'fail') as 'pass' | 'fail';
  
  // Validate position type
  if (positionType !== 'pass' && positionType !== 'fail') {
    console.error('Position type must be "pass" or "fail"');
    console.error('Usage: npx tsx scripts/test-open-position.ts [proposalId] [pass|fail]');
    process.exit(1);
  }
  
  // Get test wallet based on position type
  const testWallet = loadTestWallet(positionType);
  const walletPublicKey = testWallet.publicKey.toBase58();
  
  console.log(`Testing open ${positionType} position for proposal ${proposalId} with wallet: ${walletPublicKey}`);
  
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
      proposalId,
      userKeypair: testWallet,
      positionType: positionType,
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