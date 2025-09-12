#!/usr/bin/env ts-node

// ONLY WORKS FOR DEVNET

import * as dotenv from 'dotenv';
import { Keypair, Transaction } from '@solana/web3.js';

dotenv.config();

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

async function testSwap() {
  const API_URL = process.env.API_URL || 'http://localhost:3000';
  
  // Get proposal ID from command line or use default
  const proposalId = process.argv[2] || '0';
  
  // Get test wallet (Alice)
  const alice = loadTestWallet();
  const alicePublicKey = alice.publicKey.toBase58();
  
  console.log(`Testing swap for proposal ${proposalId} with wallet: ${alicePublicKey}`);
  
  try {
    // Step 1: Split quote tokens to get conditional tokens
    console.log('\n1. Splitting quote tokens...');
    const splitRequest = {
      user: alicePublicKey,
      amount: '10000000000' // 10 quote tokens (9 decimals) - smaller amount
    };
    
    const splitResponse = await fetch(`${API_URL}/api/vaults/${proposalId}/quote/buildSplitTx`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(splitRequest)
    });
    
    if (!splitResponse.ok) {
      const error = await splitResponse.json();
      console.error('Split failed:', JSON.stringify(error, null, 2));
      process.exit(1);
    }
    
    const splitData = await splitResponse.json() as { transaction: string };
    console.log('Split transaction built successfully');
    
    // Sign the transaction with Alice's keypair
    const splitTx = Transaction.from(Buffer.from(splitData.transaction, 'base64'));
    splitTx.partialSign(alice); // Alice signs the transaction
    
    // Execute the signed split transaction
    const executeSplitResponse = await fetch(`${API_URL}/api/vaults/${proposalId}/quote/executeSplitTx`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        transaction: Buffer.from(splitTx.serialize({ requireAllSignatures: false })).toString('base64')
      })
    });
    
    if (!executeSplitResponse.ok) {
      const error = await executeSplitResponse.json();
      console.error('Split execution failed:', JSON.stringify(error, null, 2));
      process.exit(1);
    }
    
    const executeSplitResult = await executeSplitResponse.json() as { signature: string };
    console.log('Split executed:', executeSplitResult.signature);
    
    // Step 2: Build and execute swap on pass market
    console.log('\n2. Building swap transaction for pass market...');
    const swapRequest = {
      user: alicePublicKey,
      market: 'pass',        // Market to swap in
      isBaseToQuote: false,  // quote -> base (buying pass tokens)
      amountIn: '500000000000', // 500 quote tokens (9 decimals) - 50% of pool liquidity
      slippageBps: 2000       // 20% slippage (needed for large swap)
    };
    
    const buildSwapResponse = await fetch(`${API_URL}/api/swap/${proposalId}/buildSwapTx`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(swapRequest)
    });
    
    if (!buildSwapResponse.ok) {
      const error = await buildSwapResponse.json();
      console.error('Build swap failed:', JSON.stringify(error, null, 2));
      process.exit(1);
    }
    
    const swapTxData = await buildSwapResponse.json() as { transaction: string };
    console.log('Swap transaction built successfully');
    
    // Sign the swap transaction with Alice's keypair
    const swapTx = Transaction.from(Buffer.from(swapTxData.transaction, 'base64'));
    swapTx.partialSign(alice); // Alice signs the transaction
    
    // Execute the signed swap transaction
    console.log('Executing swap transaction...');
    const executeSwapResponse = await fetch(`${API_URL}/api/swap/${proposalId}/executeSwapTx`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        transaction: Buffer.from(swapTx.serialize({ requireAllSignatures: false })).toString('base64'),
        market: 'pass',  // Market to execute swap in
        user: alicePublicKey,  // User public key for trade logging
        isBaseToQuote: false,  // Direction of swap for trade logging
        amountIn: '500000000000'  // Amount in for trade logging
      })
    });
    
    if (!executeSwapResponse.ok) {
      const error = await executeSwapResponse.json();
      console.error('Swap execution failed:', JSON.stringify(error, null, 2));
      process.exit(1);
    }
    
    const executeSwapResult = await executeSwapResponse.json() as { signature: string };
    console.log('Swap executed:', executeSwapResult.signature);
    
    // Step 3: Check user balances
    console.log('\n3. Checking user balances...');
    const balancesResponse = await fetch(`${API_URL}/api/vaults/${proposalId}/getUserBalances?user=${alicePublicKey}`);
    
    if (balancesResponse.ok) {
      const balances = await balancesResponse.json();
      console.log('User balances:', JSON.stringify(balances, null, 2));
    }
    
  } catch (error: any) {
    console.error(error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  testSwap();
}

export { testSwap };