#!/usr/bin/env ts-node

import dotenv from 'dotenv';
import { Keypair } from '@solana/web3.js';
import { executePositionClosing } from './utils/close-position-utils';
import { readFileSync } from 'fs';

dotenv.config();

async function closePosition() {
  const API_URL = process.env.API_URL || 'http://localhost:3000';
  const API_KEY = process.env.API_KEY;
  
  if (!API_KEY) {
    console.error('API_KEY environment variable is required');
    process.exit(1);
  }
  
  // Get command line arguments
  const proposalId = process.argv[2];
  const positionType = process.argv[3] as 'pass' | 'fail';
  const percentageToClose = parseFloat(process.argv[4] || '100');
  const keypairPath = process.argv[5];
  
  // Validate required arguments
  if (!proposalId) {
    console.error('Proposal ID is required');
    console.error('Usage: tsx scripts/close-position.ts <proposalId> <pass|fail> [percentageToClose] [keypairPath]');
    console.error('Example: tsx scripts/close-position.ts 0 pass 50 ./my-wallet.json');
    process.exit(1);
  }
  
  if (!positionType || (positionType !== 'pass' && positionType !== 'fail')) {
    console.error('Position type must be "pass" or "fail"');
    console.error('Usage: tsx scripts/close-position.ts <proposalId> <pass|fail> [percentageToClose] [keypairPath]');
    process.exit(1);
  }

  if (percentageToClose <= 0 || percentageToClose > 100) {
    console.error('Percentage to close must be between 1 and 100');
    process.exit(1);
  }
  
  // Load user keypair
  let userKeypair: Keypair;
  
  if (keypairPath) {
    try {
      const keypairData = JSON.parse(readFileSync(keypairPath, 'utf8'));
      userKeypair = Keypair.fromSecretKey(new Uint8Array(keypairData));
    } catch (error) {
      console.error(`Failed to load keypair from ${keypairPath}:`, error);
      process.exit(1);
    }
  } else {
    console.error('Keypair path is required for production use');
    console.error('Usage: tsx scripts/close-position.ts <proposalId> <pass|fail> [percentageToClose] <keypairPath>');
    console.error('Example: tsx scripts/close-position.ts 0 pass 50 ./my-wallet.json');
    process.exit(1);
  }
  
  console.log(`Closing ${percentageToClose}% of ${positionType} position for proposal ${proposalId}`);
  console.log(`User wallet: ${userKeypair.publicKey.toBase58()}`);
  
  try {
    await executePositionClosing({
      API_URL,
      API_KEY,
      proposalId,
      userKeypair,
      positionType,
      percentageToClose
    });
    
    console.log('\n🎉 Position closed successfully!');
    
  } catch (error: any) {
    console.error('Error closing position:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  closePosition();
}

export { closePosition };