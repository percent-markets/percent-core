#!/usr/bin/env ts-node

/**
 * Open a position (pass or fail) on mainnet
 * Uses real Jupiter swaps and wallet.json keypair
 */

import dotenv from 'dotenv';
import { Keypair, Connection, PublicKey } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import { readFileSync } from 'fs';
import { getSwapService } from '../src/services/swap.service';
import { executePositionOpening } from './utils/open-position-utils';

dotenv.config();

// Position type: 'pass' or 'fail'
const POSITION_TYPE: 'pass' | 'fail' = 'pass';

// Load keypair from wallet.json
function loadKeypair(path: string): Keypair {
  try {
    const keypairData = JSON.parse(readFileSync(path, 'utf-8'));
    return Keypair.fromSecretKey(new Uint8Array(keypairData));
  } catch (error) {
    console.error(`Failed to load keypair from ${path}:`, error);
    process.exit(1);
  }
}

async function openPosition() {
  const API_URL = process.env.API_URL || 'http://localhost:3000';
  const RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
  
  // Get proposal ID from command line or use default
  const proposalId = process.argv[2] || '0';
  
  // Load user keypair from wallet.json
  const walletPath = process.env.WALLET_PATH || './wallet.json';
  const userKeypair = loadKeypair(walletPath);
  const userPublicKey = userKeypair.publicKey.toBase58();
  
  console.log(`Opening ${POSITION_TYPE} position for proposal ${proposalId}`);
  console.log(`Wallet: ${userPublicKey}`);
  console.log(`RPC: ${RPC_URL}`);
  
  try {
    // Step 1: Get proposal info to determine token mints
    console.log('\n=== Getting proposal info ===');
    const proposalResponse = await fetch(`${API_URL}/api/proposals/${proposalId}`);
    
    if (!proposalResponse.ok) {
      throw new Error('Failed to get proposal info');
    }
    
    const proposal = await proposalResponse.json() as {
      baseMint: string;
      quoteMint: string;
      baseDecimals: number;
      quoteDecimals: number;
    };
    const baseMint = new PublicKey(proposal.baseMint);
    const quoteMint = new PublicKey(proposal.quoteMint);
    
    console.log(`Base mint: ${baseMint.toString()}`);
    console.log(`Quote mint: ${quoteMint.toString()}`);
    
    // Step 2: Initialize swap service and connection
    console.log('\n=== Initializing Jupiter swap ===');
    const connection = new Connection(RPC_URL, 'confirmed');
    const swapService = getSwapService({
      rpcEndpoint: RPC_URL,
      commitment: 'confirmed'
    });
    
    // Step 3: Define swap amount - 1 base token
    // We'll swap 1 base token for quote tokens to get a 50/50 split
    const baseDecimals = proposal.baseDecimals || 6; // Default to 6 if not provided
    const swapAmount = new BN(10).pow(new BN(baseDecimals)); // 1 token in smallest units
    
    console.log(`Will swap 1 base token (${swapAmount.toString()} smallest units) for quote tokens`);
    
    // Step 4: Build and execute Jupiter swap (base -> quote for 50/50 split)
    console.log('\n=== Executing Jupiter swap for 50/50 split ===');
    const swapTx = await swapService.buildSwapTx(
      parseInt(proposalId),
      userKeypair.publicKey,
      baseMint,
      quoteMint,
      swapAmount,
      50 // 0.5% slippage
    );
    
    // Sign and execute swap
    swapTx.sign(userKeypair);
    const swapSig = await swapService.executeSwapTx(swapTx);
    console.log('Jupiter swap executed:', swapSig);
    
    // Wait for confirmation
    const latestBlockhash = await connection.getLatestBlockhash();
    await connection.confirmTransaction({
      signature: swapSig,
      blockhash: latestBlockhash.blockhash,
      lastValidBlockHeight: latestBlockhash.lastValidBlockHeight
    }, 'confirmed');
    
    // Step 5: Define amounts to split - 1 token each
    console.log('\n=== Preparing to split tokens ===');
    
    const quoteDecimals = proposal.quoteDecimals || 9; // Default to 9 if not provided
    const baseAmountToSplit = new BN(10).pow(new BN(baseDecimals)).toString(); // 1 base token
    const quoteAmountToSplit = new BN(10).pow(new BN(quoteDecimals)).toString(); // 1 quote token
    
    console.log(`Will split 1 base token (${baseAmountToSplit} smallest units)`);
    console.log(`Will split 1 quote token (${quoteAmountToSplit} smallest units)`);
    
    // Step 6: Execute position opening with 1 token each
    await executePositionOpening({
      API_URL,
      proposalId,
      userKeypair,
      positionType: POSITION_TYPE,
      baseAmountToSplit,
      quoteAmountToSplit
    });
    
  } catch (error: any) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  openPosition();
}

export { openPosition };