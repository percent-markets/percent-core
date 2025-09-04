#!/usr/bin/env tsx
/**
 * Execute a test proposal with memo instruction through the Moderator
 * Run with: tsx tests/execute-proposal.ts
 */

import { Keypair, PublicKey, Transaction } from '@solana/web3.js';
import { createMemoInstruction } from '@solana/spl-memo';
import { Moderator } from '../app/moderator';
import { ProposalStatus } from '../app/types/moderator.interface';
import { ExecutionService } from '../app/services/execution.service';
import * as dotenv from 'dotenv';

// Load test environment
dotenv.config({ path: '.env' });

async function runTest() {
  console.log('Testing Proposal Execution with Moderator...\n');

  // Create moderator
  const moderator = new Moderator({
    baseMint: new PublicKey('So11111111111111111111111111111111111111112'),
    quoteMint: new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'),
    proposalLength: 1, // 1 second for testing
    twapMaxObservationChangePerUpdate: BigInt(100),
    twapStartDelay: 0,
    passThresholdBps: 5000
  });

  // Create a test transaction with memo
  const testTx = new Transaction();
  testTx.add(
    createMemoInstruction(
      `Test Proposal via Moderator - ${new Date().toISOString()}`,
      []
    )
  );

  // Create proposal through moderator
  const proposal = await moderator.createProposal(
    'Test proposal with memo instruction',
    testTx
  );

  console.log(`Created proposal #${proposal.id}, status: ${proposal.status}`);
  
  // Wait for voting period
  console.log('Waiting for voting period to end...');
  await new Promise(resolve => setTimeout(resolve, 1500));

  // Finalize proposal
  const status = await moderator.finalizeProposal(proposal.id);
  console.log(`Proposal finalized with status: ${status}`);

  // Load wallet and prepare for execution
  const KEYPAIR_PATH = process.env.SOLANA_KEYPAIR_PATH;
  const RPC_ENDPOINT = process.env.SOLANA_RPC_URL;
  
  if (!KEYPAIR_PATH) {
    throw new Error('SOLANA_KEYPAIR_PATH not set in .env.test');
  }
  
  if (!RPC_ENDPOINT) {
    throw new Error('SOLANA_RPC_URL not set in .env.test');
  }
  
  console.log('\nLoading wallet...');
  const signer = ExecutionService.loadKeypair(KEYPAIR_PATH);
  console.log(`Loaded signer: ${signer.publicKey.toBase58()}`);
  
  const executionConfig = {
    rpcEndpoint: RPC_ENDPOINT,
    commitment: 'confirmed' as const
  };
  
  console.log(`\nReady to execute proposal #${proposal.id}`);
  console.log(`RPC Endpoint: ${RPC_ENDPOINT}`);
  console.log('Status:', proposal.status);
  
  const result = await moderator.executeProposal(proposal.id, signer, executionConfig);
  console.log('Execution result:', result);
  console.log('Proposal status:', proposal.status);
}

runTest().catch(console.error);