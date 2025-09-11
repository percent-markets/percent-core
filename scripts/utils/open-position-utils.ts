import { Keypair, Transaction } from '@solana/web3.js';

/**
 * Shared utilities for opening positions (pass or fail)
 * Used by both test and mainnet scripts
 */

export interface OpenPositionConfig {
  API_URL: string;
  API_KEY: string;
  proposalId: string;
  userKeypair: Keypair;
  positionType: 'pass' | 'fail';
  baseAmountToSplit: string;  // Amount in smallest units
  quoteAmountToSplit: string; // Amount in smallest units
}

/**
 * Execute vault splits and market swaps to open a position
 * This function handles everything after the initial 50/50 swap
 */
export async function executePositionOpening(config: OpenPositionConfig): Promise<void> {
  const { API_URL, API_KEY, proposalId, userKeypair, positionType, baseAmountToSplit, quoteAmountToSplit } = config;
  const userPublicKey = userKeypair.publicKey.toBase58();

  // Step 1: Split base tokens via vault
  console.log('\n=== Splitting base tokens ===');
  await splitTokens(
    API_URL,
    API_KEY,
    proposalId,
    'base',
    userKeypair,
    baseAmountToSplit
  );

  // Step 2: Split quote tokens via vault
  console.log('\n=== Splitting quote tokens ===');
  await splitTokens(
    API_URL,
    API_KEY,
    proposalId,
    'quote',
    userKeypair,
    quoteAmountToSplit
  );

  // Step 3: Check balances after splits
  console.log('\n=== Checking balances after splits ===');
  const balancesAfterSplit = await checkBalances(API_URL, API_KEY, proposalId, userPublicKey);
  if (balancesAfterSplit) {
    console.log('User balances after splits:', JSON.stringify(balancesAfterSplit, null, 2));
  }

  // Step 4: Execute swaps on markets based on position type
  console.log(`\n=== Opening ${positionType.toUpperCase()} position ===`);
  
  // Pass market swap
  console.log('\n--- Swap on pass market ---');
  await executeMarketSwap(
    API_URL,
    API_KEY,
    proposalId,
    'pass',
    userKeypair,
    positionType === 'fail', // isBaseToQuote: fail position sells pBase, pass position buys pBase
    positionType === 'pass' ? quoteAmountToSplit : baseAmountToSplit
  );

  // Fail market swap
  console.log('\n--- Swap on fail market ---');
  await executeMarketSwap(
    API_URL,
    API_KEY,
    proposalId,
    'fail',
    userKeypair,
    positionType === 'pass', // isBaseToQuote: pass position sells fBase, fail position buys fBase
    positionType === 'pass' ? baseAmountToSplit : quoteAmountToSplit
  );

  // Step 5: Check final balances
  console.log('\n=== Final balances ===');
  const finalBalances = await checkBalances(API_URL, API_KEY, proposalId, userPublicKey);
  if (finalBalances) {
    console.log('Final user balances:', JSON.stringify(finalBalances, null, 2));
    
    if (positionType === 'pass') {
      console.log('\n✅ PASS POSITION OPENED SUCCESSFULLY!');
      console.log('User now holds primarily pBase and fQuote tokens');
      console.log('This position profits if the proposal passes');
    } else {
      console.log('\n✅ FAIL POSITION OPENED SUCCESSFULLY!');
      console.log('User now holds primarily fBase and pQuote tokens');
      console.log('This position profits if the proposal fails');
    }
  }
}

/**
 * Split tokens via vault (base or quote)
 */
async function splitTokens(
  API_URL: string,
  API_KEY: string,
  proposalId: string,
  vaultType: 'base' | 'quote',
  userKeypair: Keypair,
  amount: string
): Promise<void> {
  const userPublicKey = userKeypair.publicKey.toBase58();
  
  console.log(`Splitting ${amount} ${vaultType} tokens...`);
  
  // Build split transaction
  const splitRequest = {
    user: userPublicKey,
    amount: amount
  };
  
  const splitResponse = await fetch(`${API_URL}/api/vaults/${proposalId}/${vaultType}/buildSplitTx`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-KEY': API_KEY
    },
    body: JSON.stringify(splitRequest)
  });
  
  if (!splitResponse.ok) {
    const error = await splitResponse.json();
    throw new Error(`${vaultType} split failed: ${JSON.stringify(error, null, 2)}`);
  }
  
  const splitData = await splitResponse.json();
  console.log(`${vaultType} split transaction built successfully`);
  
  // Sign the transaction
  const splitTx = Transaction.from(Buffer.from(splitData.transaction, 'base64'));
  splitTx.partialSign(userKeypair);
  
  // Execute the signed split transaction
  const executeSplitResponse = await fetch(`${API_URL}/api/vaults/${proposalId}/${vaultType}/executeSplitTx`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-KEY': API_KEY
    },
    body: JSON.stringify({
      transaction: Buffer.from(splitTx.serialize({ requireAllSignatures: false })).toString('base64')
    })
  });
  
  if (!executeSplitResponse.ok) {
    const error = await executeSplitResponse.json();
    throw new Error(`${vaultType} split execution failed: ${JSON.stringify(error, null, 2)}`);
  }
  
  const executeSplitResult = await executeSplitResponse.json();
  console.log(`${vaultType} split executed: ${executeSplitResult.signature}`);
}

/**
 * Execute a swap on pass or fail market
 */
async function executeMarketSwap(
  API_URL: string,
  API_KEY: string,
  proposalId: string,
  market: 'pass' | 'fail',
  userKeypair: Keypair,
  isBaseToQuote: boolean,
  amountIn: string
): Promise<void> {
  const userPublicKey = userKeypair.publicKey.toBase58();
  
  console.log(`Swapping on ${market} market (${isBaseToQuote ? 'base->quote' : 'quote->base'})...`);
  
  // Build swap request
  const swapRequest = {
    user: userPublicKey,
    market: market,
    isBaseToQuote: isBaseToQuote,
    amountIn: amountIn,
    slippageBps: 2000 // 20% slippage for large swaps
  };
  
  const buildSwapResponse = await fetch(`${API_URL}/api/swap/${proposalId}/buildSwapTx`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-KEY': API_KEY
    },
    body: JSON.stringify(swapRequest)
  });
  
  if (!buildSwapResponse.ok) {
    const error = await buildSwapResponse.json();
    throw new Error(`Build ${market} swap failed: ${JSON.stringify(error, null, 2)}`);
  }
  
  const swapTxData = await buildSwapResponse.json();
  console.log(`${market} swap transaction built successfully`);
  
  // Sign the swap transaction
  const swapTx = Transaction.from(Buffer.from(swapTxData.transaction, 'base64'));
  swapTx.partialSign(userKeypair);
  
  // Execute the signed swap transaction
  console.log(`Executing ${market} swap transaction...`);
  const executeSwapResponse = await fetch(`${API_URL}/api/swap/${proposalId}/executeSwapTx`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-KEY': API_KEY
    },
    body: JSON.stringify({
      transaction: Buffer.from(swapTx.serialize({ requireAllSignatures: false })).toString('base64'),
      market: market
    })
  });
  
  if (!executeSwapResponse.ok) {
    const error = await executeSwapResponse.json();
    throw new Error(`${market} swap execution failed: ${JSON.stringify(error, null, 2)}`);
  }
  
  const executeSwapResult = await executeSwapResponse.json();
  console.log(`${market} swap executed: ${executeSwapResult.signature}`);
}

/**
 * Check user balances for both vaults
 */
async function checkBalances(
  API_URL: string,
  API_KEY: string,
  proposalId: string,
  userPublicKey: string
): Promise<any> {
  const balancesResponse = await fetch(`${API_URL}/api/vaults/${proposalId}/getUserBalances?user=${userPublicKey}`, {
    headers: {
      'X-API-KEY': API_KEY
    }
  });
  
  if (balancesResponse.ok) {
    return await balancesResponse.json();
  }
  
  return null;
}