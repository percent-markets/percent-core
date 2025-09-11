import { Keypair, Transaction } from '@solana/web3.js';

/**
 * Shared utilities for closing positions (pass or fail)
 * Used by both test and mainnet scripts
 */

export interface ClosePositionConfig {
  API_URL: string;
  API_KEY: string;
  proposalId: string;
  userKeypair: Keypair;
  positionType: 'pass' | 'fail';
  percentageToClose: number; // 0-100, percentage of position to close
}

/**
 * Execute position closing by reversing swaps and merging conditional tokens
 * This function handles the complete process of closing a position
 */
export async function executePositionClosing(config: ClosePositionConfig): Promise<void> {
  const { API_URL, API_KEY, proposalId, userKeypair, positionType, percentageToClose } = config;
  const userPublicKey = userKeypair.publicKey.toBase58();

  if (percentageToClose <= 0 || percentageToClose > 100) {
    throw new Error('Percentage to close must be between 1 and 100');
  }

  console.log(`\n=== Closing ${percentageToClose}% of ${positionType.toUpperCase()} position ===`);

  // Step 1: Get current balances to determine amounts to close
  console.log('\n=== Getting current balances ===');
  const currentBalances = await checkBalances(API_URL, API_KEY, proposalId, userPublicKey);
  if (!currentBalances) {
    throw new Error('Failed to get current balances');
  }

  console.log('Current balances:', JSON.stringify(currentBalances, null, 2));

  // Step 2: Calculate amounts to close based on position type and percentage
  const amountsToClose = calculateCloseAmounts(currentBalances, positionType, percentageToClose);
  console.log('Amounts to close:', amountsToClose);

  // Step 3: Execute reverse swaps to prepare for merging
  console.log(`\n=== Executing reverse swaps for ${positionType} position ===`);
  await executeReverseSwaps(
    API_URL,
    API_KEY,
    proposalId,
    userKeypair,
    positionType,
    amountsToClose
  );

  // Step 4: Check balances after swaps
  console.log('\n=== Checking balances after reverse swaps ===');
  const balancesAfterSwaps = await checkBalances(API_URL, API_KEY, proposalId, userPublicKey);
  if (balancesAfterSwaps) {
    console.log('Balances after swaps:', JSON.stringify(balancesAfterSwaps, null, 2));
  }

  // Step 5: Merge conditional tokens back to regular tokens
  console.log('\n=== Merging conditional tokens ===');
  await mergeConditionalTokens(
    API_URL,
    API_KEY,
    proposalId,
    userKeypair,
    balancesAfterSwaps
  );

  // Step 6: Check final balances
  console.log('\n=== Final balances after closing position ===');
  const finalBalances = await checkBalances(API_URL, API_KEY, proposalId, userPublicKey);
  if (finalBalances) {
    console.log('Final balances:', JSON.stringify(finalBalances, null, 2));
    console.log(`\n✅ ${positionType.toUpperCase()} POSITION CLOSED SUCCESSFULLY!`);
    console.log(`Closed ${percentageToClose}% of position and merged conditional tokens back to regular tokens`);
  }
}

/**
 * Calculate amounts to close based on current balances, position type, and percentage
 */
function calculateCloseAmounts(balances: any, positionType: 'pass' | 'fail', percentage: number): any {
  const factor = percentage / 100;

  if (positionType === 'pass') {
    // Pass position has pBase + fQuote, we want to swap back
    const pBaseAmount = BigInt(balances.base.passConditional || '0');
    const fQuoteAmount = BigInt(balances.quote.failConditional || '0');

    return {
      pBaseToSwap: Math.floor(Number(pBaseAmount) * factor).toString(),
      fQuoteToSwap: Math.floor(Number(fQuoteAmount) * factor).toString()
    };
  } else {
    // Fail position has fBase + pQuote, we want to swap back
    const fBaseAmount = BigInt(balances.base.failConditional || '0');
    const pQuoteAmount = BigInt(balances.quote.passConditional || '0');

    return {
      fBaseToSwap: Math.floor(Number(fBaseAmount) * factor).toString(),
      pQuoteToSwap: Math.floor(Number(pQuoteAmount) * factor).toString()
    };
  }
}

/**
 * Execute reverse swaps to prepare conditional tokens for merging
 */
async function executeReverseSwaps(
  API_URL: string,
  API_KEY: string,
  proposalId: string,
  userKeypair: Keypair,
  positionType: 'pass' | 'fail',
  amountsToClose: any
): Promise<void> {

  if (positionType === 'pass') {
    // Reverse pass position: pBase + fQuote → pQuote + fBase
    
    // Swap pBase → pQuote on pass market
    if (amountsToClose.pBaseToSwap && amountsToClose.pBaseToSwap !== '0') {
      console.log('\n--- Reverse swap on pass market (pBase→pQuote) ---');
      await executeMarketSwap(
        API_URL,
        API_KEY,
        proposalId,
        'pass',
        userKeypair,
        true, // base to quote
        amountsToClose.pBaseToSwap
      );
    }

    // Swap fQuote → fBase on fail market  
    if (amountsToClose.fQuoteToSwap && amountsToClose.fQuoteToSwap !== '0') {
      console.log('\n--- Reverse swap on fail market (fQuote→fBase) ---');
      await executeMarketSwap(
        API_URL,
        API_KEY,
        proposalId,
        'fail',
        userKeypair,
        false, // quote to base
        amountsToClose.fQuoteToSwap
      );
    }

  } else {
    // Reverse fail position: fBase + pQuote → fQuote + pBase
    
    // Swap fBase → fQuote on fail market
    if (amountsToClose.fBaseToSwap && amountsToClose.fBaseToSwap !== '0') {
      console.log('\n--- Reverse swap on fail market (fBase→fQuote) ---');
      await executeMarketSwap(
        API_URL,
        API_KEY,
        proposalId,
        'fail',
        userKeypair,
        true, // base to quote
        amountsToClose.fBaseToSwap
      );
    }

    // Swap pQuote → pBase on pass market
    if (amountsToClose.pQuoteToSwap && amountsToClose.pQuoteToSwap !== '0') {
      console.log('\n--- Reverse swap on pass market (pQuote→pBase) ---');
      await executeMarketSwap(
        API_URL,
        API_KEY,
        proposalId,
        'pass',
        userKeypair,
        false, // quote to base
        amountsToClose.pQuoteToSwap
      );
    }
  }
}

/**
 * Merge conditional tokens back to regular tokens where possible
 */
async function mergeConditionalTokens(
  API_URL: string,
  API_KEY: string,
  proposalId: string,
  userKeypair: Keypair,
  balances: any
): Promise<void> {

  const pBase = BigInt(balances.base.passConditional || '0');
  const fBase = BigInt(balances.base.failConditional || '0');
  const pQuote = BigInt(balances.quote.passConditional || '0');
  const fQuote = BigInt(balances.quote.failConditional || '0');

  // Merge base tokens if user has both pBase and fBase
  const baseMergeAmount = pBase < fBase ? pBase : fBase;
  if (baseMergeAmount > 0n) {
    console.log(`Merging ${baseMergeAmount.toString()} base conditional tokens...`);
    await mergeTokens(
      API_URL,
      API_KEY,
      proposalId,
      'base',
      userKeypair,
      baseMergeAmount.toString()
    );
  }

  // Merge quote tokens if user has both pQuote and fQuote
  const quoteMergeAmount = pQuote < fQuote ? pQuote : fQuote;
  if (quoteMergeAmount > 0n) {
    console.log(`Merging ${quoteMergeAmount.toString()} quote conditional tokens...`);
    await mergeTokens(
      API_URL,
      API_KEY,
      proposalId,
      'quote',
      userKeypair,
      quoteMergeAmount.toString()
    );
  }

  if (baseMergeAmount === 0n && quoteMergeAmount === 0n) {
    console.log('No matching conditional tokens to merge');
  }
}

/**
 * Merge tokens via vault (base or quote)
 */
async function mergeTokens(
  API_URL: string,
  API_KEY: string,
  proposalId: string,
  vaultType: 'base' | 'quote',
  userKeypair: Keypair,
  amount: string
): Promise<void> {
  const userPublicKey = userKeypair.publicKey.toBase58();
  
  console.log(`Merging ${amount} ${vaultType} tokens...`);
  
  // Build merge transaction
  const mergeRequest = {
    user: userPublicKey,
    amount: amount
  };
  
  const mergeResponse = await fetch(`${API_URL}/api/vaults/${proposalId}/${vaultType}/buildMergeTx`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-KEY': API_KEY
    },
    body: JSON.stringify(mergeRequest)
  });
  
  if (!mergeResponse.ok) {
    const error = await mergeResponse.json();
    throw new Error(`${vaultType} merge failed: ${JSON.stringify(error, null, 2)}`);
  }
  
  const mergeData = await mergeResponse.json();
  console.log(`${vaultType} merge transaction built successfully`);
  
  // Sign the transaction
  const mergeTx = Transaction.from(Buffer.from(mergeData.transaction, 'base64'));
  mergeTx.partialSign(userKeypair);
  
  // Execute the signed merge transaction
  const executeMergeResponse = await fetch(`${API_URL}/api/vaults/${proposalId}/${vaultType}/executeMergeTx`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-KEY': API_KEY
    },
    body: JSON.stringify({
      transaction: Buffer.from(mergeTx.serialize({ requireAllSignatures: false })).toString('base64')
    })
  });
  
  if (!executeMergeResponse.ok) {
    const error = await executeMergeResponse.json();
    throw new Error(`${vaultType} merge execution failed: ${JSON.stringify(error, null, 2)}`);
  }
  
  const executeMergeResult = await executeMergeResponse.json();
  console.log(`${vaultType} merge executed: ${executeMergeResult.signature}`);
}

/**
 * Execute a swap on pass or fail market (reused from open-position-utils.ts)
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
 * Check user balances for both vaults (reused from open-position-utils.ts)
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