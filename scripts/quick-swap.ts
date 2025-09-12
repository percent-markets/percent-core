#!/usr/bin/env tsx

import * as dotenv from 'dotenv';
import { Keypair, Connection, PublicKey } from '@solana/web3.js';
import { CpAmm } from '@meteora-ag/cp-amm-sdk';
import * as fs from 'fs';

dotenv.config();

async function quickSwap() {
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  
  // Load authority wallet (moderator)
  const walletPath = process.env.SOLANA_KEYPAIR_PATH || './wallet.json';
  const walletData = JSON.parse(fs.readFileSync(walletPath, 'utf8'));
  const authority = Keypair.fromSecretKey(new Uint8Array(walletData));
  
  console.log('Authority wallet:', authority.publicKey.toBase58());
  
  // Proposal 4 pass pool
  const poolAddress = '2XYXQKfk4hMR2GkriQxUua7tpeWJhkv5T3xpHCvnU8r4';
  const poolPubkey = new PublicKey(poolAddress);
  
  // Pass token mint
  const passTokenMint = new PublicKey('AHyme8H8XLhyh5ZA1cpzyivu43j8ZqsyurboUQaMKs1a');
  
  console.log('Pool address:', poolAddress);
  console.log('Pass token:', passTokenMint.toBase58());
  
  try {
    const cpAmm = new CpAmm(connection);
    
    // Buy pass tokens (swap quote for pass)
    // This will increase pass price
    const swapAmount = 100_000_000_000; // 100 quote tokens (9 decimals)
    
    console.log('Executing swap: 100 quote tokens for pass tokens...');
    
    // Get pool state first
    const poolState = await cpAmm.fetchPoolState(poolPubkey);
    console.log('Current pool state:');
    console.log('- Token A:', poolState.tokenAMint.toBase58());
    console.log('- Token B:', poolState.tokenBMint.toBase58());
    
    // Execute swap
    const swapTx = await cpAmm.swap({
      poolAddress: poolPubkey,
      user: authority.publicKey,
      inputAmount: swapAmount,
      inputMint: poolState.tokenBMint, // Quote token (tokenB)
      outputMint: poolState.tokenAMint, // Pass token (tokenA)
      slippage: 5000, // 5%
    });
    
    swapTx.sign(authority);
    
    const sig = await connection.sendTransaction(swapTx, [authority], {
      skipPreflight: true,
      preflightCommitment: 'confirmed'
    });
    
    console.log('Swap transaction sent:', sig);
    
    // Wait for confirmation
    const confirmation = await connection.confirmTransaction(sig, 'confirmed');
    console.log('Swap confirmed!');
    
    // Fetch new pool state
    const newPoolState = await cpAmm.fetchPoolState(poolPubkey);
    console.log('New pool state after swap:');
    console.log('- Token A amount:', newPoolState.tokenAAmount?.toString());
    console.log('- Token B amount:', newPoolState.tokenBAmount?.toString());
    
  } catch (error) {
    console.error('Swap failed:', error);
  }
}

quickSwap().catch(console.error);