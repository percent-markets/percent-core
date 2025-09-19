#!/usr/bin/env ts-node

// MAINNET SWAP SCRIPT

import * as dotenv from 'dotenv';
import { Keypair, Transaction } from '@solana/web3.js';
import bs58 from 'bs58';

dotenv.config();

// Type definitions
interface UserBalances {
  passTokens?: string;
  failTokens?: string;
  baseTokens?: string;
  quoteTokens?: string;
}

// ============================================
// CONFIGURATION - MODIFY THESE VALUES
// ============================================

// Wallet private key (base58 encoded)
const PRIVATE_KEY = 'YOUR_PRIVATE_KEY_HERE'; // Replace with actual private key

// Trading parameters
const AMOUNT_IN = '1000000000'; // 1 SOL (9 decimals) - amount to swap. If using oogway, use 1000000 (1 OOGWAY, 6 decimals)
const MARKET: 'pass' | 'fail' = 'pass'; // Which market to trade on
const INPUT_TOKEN = 'sol' as 'sol' | 'oogway'; // Which token to use as input
const SLIPPAGE_BPS = 500; // 5% slippage

// Automatically determine swap direction based on input token
// SOL (quote) -> swap quote to base (buying conditional tokens)
// OOGWAY (base) -> swap base to quote (selling conditional tokens)
const IS_BASE_TO_QUOTE = INPUT_TOKEN === 'oogway';

// ============================================

function loadWallet(): Keypair {
  try {
    const privateKeyBytes = bs58.decode(PRIVATE_KEY);
    return Keypair.fromSecretKey(privateKeyBytes);
  } catch (error) {
    console.error('Failed to load wallet from private key:', error);
    console.error('Make sure PRIVATE_KEY is a valid base58 encoded private key');
    process.exit(1);
  }
}

async function swap() {
  const API_URL = process.env.API_URL || 'https://api.percent.gg';
  
  // Get proposal ID from command line or use default
  const proposalId = process.argv[2];
  if (!proposalId) {
    console.error('Please provide a proposal ID as argument');
    console.error('Usage: pnpm tsx scripts/swap.ts <proposalId>');
    process.exit(1);
  }
  
  // Load wallet
  const wallet = loadWallet();
  const walletPublicKey = wallet.publicKey.toBase58();
  
  console.log(`\nSwap Configuration:`);
  console.log(`==================`);
  console.log(`Proposal ID: ${proposalId}`);
  console.log(`Wallet: ${walletPublicKey}`);
  console.log(`Market: ${MARKET}`);
  console.log(`Input Token: ${INPUT_TOKEN.toUpperCase()}`);
  console.log(`Amount In: ${AMOUNT_IN} (${parseFloat(AMOUNT_IN) / 1e9} ${INPUT_TOKEN.toUpperCase()})`);
  console.log(`Swap Direction: ${IS_BASE_TO_QUOTE ? 'Base → Quote (selling)' : 'Quote → Base (buying)'}`);
  console.log(`Slippage: ${SLIPPAGE_BPS / 100}%`);
  console.log(`API URL: ${API_URL}`);
  console.log();
  
  try {
    // Step 1: Split tokens if buying conditional tokens (not base to quote)
    if (!IS_BASE_TO_QUOTE) {
      console.log('Step 1: Splitting tokens to get conditional tokens...');
      
      // Determine which vault to use based on input token
      const vaultType = INPUT_TOKEN === 'sol' ? 'quote' : 'base';
      
      const splitRequest = {
        user: walletPublicKey,
        amount: AMOUNT_IN
      };
      
      console.log(`Building split transaction for ${vaultType} vault...`);
      const splitResponse = await fetch(`${API_URL}/api/vaults/${proposalId}/${vaultType}/buildSplitTx`, {
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
      
      // Sign the transaction
      const splitTx = Transaction.from(Buffer.from(splitData.transaction, 'base64'));
      splitTx.partialSign(wallet);
      
      // Execute the signed split transaction
      console.log('Executing split transaction...');
      const executeSplitResponse = await fetch(`${API_URL}/api/vaults/${proposalId}/${vaultType}/executeSplitTx`, {
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
      console.log(`Split executed: https://solscan.io/tx/${executeSplitResult.signature}`);
      console.log();
    }
    
    // Step 2: Build and execute swap
    console.log(`Step 2: Building swap transaction for ${MARKET} market...`);
    
    const swapRequest = {
      user: walletPublicKey,
      market: MARKET,
      isBaseToQuote: IS_BASE_TO_QUOTE,
      amountIn: AMOUNT_IN,
      slippageBps: SLIPPAGE_BPS
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
    
    // Sign the swap transaction
    const swapTx = Transaction.from(Buffer.from(swapTxData.transaction, 'base64'));
    swapTx.partialSign(wallet);
    
    // Execute the signed swap transaction
    console.log('Executing swap transaction...');
    const executeSwapResponse = await fetch(`${API_URL}/api/swap/${proposalId}/executeSwapTx`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        transaction: Buffer.from(swapTx.serialize({ requireAllSignatures: false })).toString('base64'),
        market: MARKET,
        user: walletPublicKey,
        isBaseToQuote: IS_BASE_TO_QUOTE,
        amountIn: AMOUNT_IN
      })
    });
    
    if (!executeSwapResponse.ok) {
      const error = await executeSwapResponse.json();
      console.error('Swap execution failed:', JSON.stringify(error, null, 2));
      process.exit(1);
    }
    
    const executeSwapResult = await executeSwapResponse.json() as { signature: string };
    console.log(`Swap executed: https://solscan.io/tx/${executeSwapResult.signature}`);
    console.log();
    
    // Step 3: Check user balances
    console.log('Step 3: Checking final balances...');
    const balancesResponse = await fetch(`${API_URL}/api/vaults/${proposalId}/getUserBalances?user=${walletPublicKey}`);

    if (balancesResponse.ok) {
      const balances = await balancesResponse.json() as UserBalances;
      console.log('\nFinal balances:');
      console.log('===============');
      if (balances.passTokens) console.log(`Pass tokens: ${balances.passTokens}`);
      if (balances.failTokens) console.log(`Fail tokens: ${balances.failTokens}`);
      if (balances.baseTokens) console.log(`Base tokens (OOGWAY): ${balances.baseTokens}`);
      if (balances.quoteTokens) console.log(`Quote tokens (SOL): ${balances.quoteTokens}`);
    }
    
    console.log('\n✅ Swap completed successfully!');
    
  } catch (error: any) {
    console.error('\n❌ Swap failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  swap();
}

export { swap };