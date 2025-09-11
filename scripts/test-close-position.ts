#!/usr/bin/env ts-node

// ONLY WORKS FOR DEVNET

import dotenv from 'dotenv';
import { Keypair } from '@solana/web3.js';
import { executePositionClosing } from './utils/close-position-utils';

dotenv.config();

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

async function testClosePosition() {
  const API_URL = process.env.API_URL || 'http://localhost:3000';
  
  // Get command line arguments
  const proposalId = process.argv[2] || '0';
  const positionType = (process.argv[3] || 'pass') as 'pass' | 'fail';
  const percentageToClose = parseFloat(process.argv[4] || '50'); // Default to 50%
  
  // Validate position type
  if (positionType !== 'pass' && positionType !== 'fail') {
    console.error('Position type must be "pass" or "fail"');
    console.error('Usage: npx tsx scripts/test-close-position.ts [proposalId] [pass|fail] [percentageToClose]');
    console.error('Example: npx tsx scripts/test-close-position.ts 0 pass 50');
    process.exit(1);
  }

  // Validate percentage
  if (percentageToClose <= 0 || percentageToClose > 100) {
    console.error('Percentage to close must be between 1 and 100');
    process.exit(1);
  }
  
  // Get test wallet based on position type
  const testWallet = loadTestWallet(positionType);
  const walletPublicKey = testWallet.publicKey.toBase58();
  
  console.log(`Testing close ${percentageToClose}% of ${positionType} position for proposal ${proposalId} with wallet: ${walletPublicKey}`);
  
  try {
    // Execute the position closing using shared utils
    await executePositionClosing({
      API_URL,
      proposalId,
      userKeypair: testWallet,
      positionType,
      percentageToClose
    });
    
  } catch (error: any) {
    console.error(error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  testClosePosition();
}

export { testClosePosition };