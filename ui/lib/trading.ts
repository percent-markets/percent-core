import { Transaction } from '@solana/web3.js';
import toast from 'react-hot-toast';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// SOL and OOGWAY mint addresses
const SOL_MINT = 'So11111111111111111111111111111111111111112';
const OOGWAY_MINT = 'GVvPZpC6ymCoiHzYJ7CWZ8LhVn9tL2AUpRjSAsLh6jZC';

export interface OpenPositionConfig {
  proposalId: number;
  market: 'pass' | 'fail';  // Which AMM market to trade on
  inputToken: 'sol' | 'oogway';  // Which conditional token we're selling
  inputAmount: string;  // Amount of conditional tokens to sell
  userAddress: string;
  signTransaction: (transaction: Transaction) => Promise<Transaction>;
}

export interface ClosePositionConfig {
  proposalId: number;
  positionType: 'pass' | 'fail';
  percentageToClose: number; // 1-100
  userAddress: string;
  signTransaction: (transaction: Transaction) => Promise<Transaction>;
}

/**
 * Execute a swap on a specific market (Pass or Fail AMM)
 * Swaps conditional tokens: e.g., Pass-OOGWAY → Pass-SOL or Fail-SOL → Fail-OOGWAY
 */
export async function openPosition(config: OpenPositionConfig): Promise<void> {
  const { proposalId, market, inputToken, inputAmount, userAddress, signTransaction } = config;

  // Determine swap direction based on inputToken
  // inputToken 'oogway' means we're selling base (oogway conditional) for quote (SOL conditional)
  // inputToken 'sol' means we're selling quote (SOL conditional) for base (oogway conditional)
  const isBaseToQuote = inputToken === 'oogway';

  const toastId = toast.loading(`Swapping ${market}-${inputToken.toUpperCase()}...`);

  try {
    // Convert decimal amount to smallest units
    const OOGWAY_DECIMALS = 6;
    const SOL_DECIMALS = 9;
    const decimals = inputToken === 'oogway' ? OOGWAY_DECIMALS : SOL_DECIMALS;
    const amountInSmallestUnits = Math.floor(parseFloat(inputAmount) * Math.pow(10, decimals)).toString();

    // Execute the swap on the selected market
    await executeMarketSwap(
      proposalId,
      market,
      isBaseToQuote,
      amountInSmallestUnits,
      userAddress,
      signTransaction
    );

    // Success message
    const outputToken = inputToken === 'oogway' ? 'SOL' : 'OOGWAY';
    toast.success(
      `Successfully swapped ${market}-${inputToken.toUpperCase()} → ${market}-${outputToken}!`,
      { id: toastId, duration: 5000 }
    );

  } catch (error) {
    console.error('Error executing swap:', error);
    toast.error(
      `Failed to execute swap: ${error instanceof Error ? error.message : 'Unknown error'}`,
      { id: toastId }
    );
    throw error;
  }
}

/**
 * Close a position (pass or fail) by a certain percentage
 */
export async function closePosition(config: ClosePositionConfig): Promise<void> {
  const { proposalId, positionType, percentageToClose, userAddress, signTransaction } = config;
  
  if (percentageToClose <= 0 || percentageToClose > 100) {
    throw new Error('Percentage to close must be between 1 and 100');
  }
  
  const toastId = toast.loading(`Closing ${percentageToClose}% of position...`);
  
  try {
    // Step 1: Get current balances to determine amounts to close
    const currentBalances = await getUserBalances(proposalId, userAddress);
    if (!currentBalances) {
      throw new Error('Failed to get current balances');
    }
    
    // Step 2: Calculate amounts to close based on position type and percentage
    const amountsToClose = calculateCloseAmounts(currentBalances, positionType, percentageToClose);
    
    // Step 3: Execute reverse swaps to prepare for merging
    await executeReverseSwaps(
      proposalId,
      positionType,
      amountsToClose,
      userAddress,
      signTransaction
    );
    
    // Step 4: Get updated balances after swaps
    const balancesAfterSwaps = await getUserBalances(proposalId, userAddress);
    if (!balancesAfterSwaps) {
      throw new Error('Failed to get balances after swaps');
    }
    
    // Step 5: Merge conditional tokens back to regular tokens
    await mergeConditionalTokens(
      proposalId,
      balancesAfterSwaps,
      userAddress,
      signTransaction
    );
    
    toast.success(
      `Successfully closed ${percentageToClose}% of position!`,
      { id: toastId, duration: 5000 }
    );
    
  } catch (error) {
    console.error('Error closing position:', error);
    toast.error(
      `Failed to close position: ${error instanceof Error ? error.message : 'Unknown error'}`,
      { id: toastId }
    );
    throw error;
  }
}

/**
 * Calculate amounts to close based on current balances, position type, and percentage
 */
function calculateCloseAmounts(balances: any, positionType: 'pass' | 'fail', percentage: number): any {
  const factor = percentage / 100;
  
  if (positionType === 'pass') {
    // Pass position has pBase + fQuote, we want to swap back
    const fQuoteAmount = parseFloat(balances.quote.failConditional || '0');
    
    return {
      pBaseToSwap: "0",
      fQuoteToSwap: Math.floor(fQuoteAmount * factor).toString()
    };
  } else {
    // Fail position has fBase + pQuote, we want to swap back
    const pQuoteAmount = parseFloat(balances.quote.passConditional || '0');
    
    return {
      fBaseToSwap: "0",
      pQuoteToSwap: Math.floor(pQuoteAmount * factor).toString()
    };
  }
}

/**
 * Execute reverse swaps to prepare conditional tokens for merging
 */
async function executeReverseSwaps(
  proposalId: number,
  positionType: 'pass' | 'fail',
  amountsToClose: any,
  userAddress: string,
  signTransaction: (transaction: Transaction) => Promise<Transaction>
): Promise<void> {
  
  if (positionType === 'pass') {
    // Reverse pass position: pBase + fQuote → pQuote + fBase
    
    // Swap pBase → pQuote on pass market
    if (amountsToClose.pBaseToSwap && amountsToClose.pBaseToSwap !== '0') {
      await executeMarketSwap(
        proposalId,
        'pass',
        true, // base to quote
        amountsToClose.pBaseToSwap,
        userAddress,
        signTransaction
      );
    }
    
    // Swap fQuote → fBase on fail market
    if (amountsToClose.fQuoteToSwap && amountsToClose.fQuoteToSwap !== '0') {
      await executeMarketSwap(
        proposalId,
        'fail',
        false, // quote to base
        amountsToClose.fQuoteToSwap,
        userAddress,
        signTransaction
      );
    }
    
  } else {
    // Reverse fail position: fBase + pQuote → fQuote + pBase
    
    // Swap fBase → fQuote on fail market
    if (amountsToClose.fBaseToSwap && amountsToClose.fBaseToSwap !== '0') {
      await executeMarketSwap(
        proposalId,
        'fail',
        true, // base to quote
        amountsToClose.fBaseToSwap,
        userAddress,
        signTransaction
      );
    }
    
    // Swap pQuote → pBase on pass market
    if (amountsToClose.pQuoteToSwap && amountsToClose.pQuoteToSwap !== '0') {
      await executeMarketSwap(
        proposalId,
        'pass',
        false, // quote to base
        amountsToClose.pQuoteToSwap,
        userAddress,
        signTransaction
      );
    }
  }
}

/**
 * Merge conditional tokens back to regular tokens where possible
 */
async function mergeConditionalTokens(
  proposalId: number,
  balances: any,
  userAddress: string,
  signTransaction: (transaction: Transaction) => Promise<Transaction>
): Promise<void> {
  
  const pBase = parseFloat(balances.base.passConditional || '0');
  const fBase = parseFloat(balances.base.failConditional || '0');
  const pQuote = parseFloat(balances.quote.passConditional || '0');
  const fQuote = parseFloat(balances.quote.failConditional || '0');
  
  // Merge base tokens if user has both pBase and fBase
  const baseMergeAmount = Math.min(pBase, fBase);
  console.log("base merge amount:", baseMergeAmount);
  if (baseMergeAmount > 0) {
    await mergeTokens(
      proposalId,
      'base',
      Math.floor(baseMergeAmount).toString(),
      userAddress,
      signTransaction
    );
  }
  
  // Merge quote tokens if user has both pQuote and fQuote
  const quoteMergeAmount = Math.min(pQuote, fQuote);
  if (quoteMergeAmount > 0) {
    await mergeTokens(
      proposalId,
      'quote',
      Math.floor(quoteMergeAmount).toString(),
      userAddress,
      signTransaction
    );
  }
}

/**
 * Merge tokens via vault (base or quote)
 */
async function mergeTokens(
  proposalId: number,
  vaultType: 'base' | 'quote',
  amount: string,
  userAddress: string,
  signTransaction: (transaction: Transaction) => Promise<Transaction>
): Promise<void> {
  
  // Build merge transaction
  const mergeRequest = {
    user: userAddress,
    amount: amount
  };
  
  const mergeResponse = await fetch(`${API_BASE_URL}/api/vaults/${proposalId}/${vaultType}/buildMergeTx`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(mergeRequest)
  });
  
  if (!mergeResponse.ok) {
    const error = await mergeResponse.json();
    throw new Error(`${vaultType} merge failed: ${error.message || JSON.stringify(error)}`);
  }
  
  const mergeData = await mergeResponse.json();
  
  // Sign the transaction
  const mergeTx = Transaction.from(Buffer.from(mergeData.transaction, 'base64'));
  const signedMergeTx = await signTransaction(mergeTx);
  
  // Execute the signed merge transaction
  const executeMergeResponse = await fetch(`${API_BASE_URL}/api/vaults/${proposalId}/${vaultType}/executeMergeTx`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      transaction: Buffer.from(signedMergeTx.serialize({ requireAllSignatures: false })).toString('base64')
    })
  });
  
  if (!executeMergeResponse.ok) {
    const error = await executeMergeResponse.json();
    throw new Error(`${vaultType} merge execution failed: ${error.message || JSON.stringify(error)}`);
  }
}

/**
 * Get user balances for a proposal
 */
async function getUserBalances(proposalId: number, userAddress: string): Promise<any> {
  const balancesResponse = await fetch(
    `${API_BASE_URL}/api/vaults/${proposalId}/getUserBalances?user=${userAddress}`
  );
  
  if (balancesResponse.ok) {
    return await balancesResponse.json();
  }
  
  return null;
}

/**
 * Get the current network (devnet or mainnet)
 */
async function getNetwork(): Promise<'devnet' | 'mainnet'> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/network`);
    if (!response.ok) {
      console.error('Failed to get network info, defaulting to mainnet');
      return 'mainnet';
    }
    const data = await response.json();
    return data.network;
  } catch (error) {
    console.error('Failed to get network info, defaulting to mainnet:', error);
    return 'mainnet';
  }
}

/**
 * Perform the initial 50/50 swap
 * On devnet: simulates the swap
 * On mainnet: executes real swap via Jupiter
 */
async function simulateInitialSwap(
  inputAmount: string,
  inputCurrency: 'sol' | 'oogway',
  proposalId: number,
  userAddress?: string,
  signTransaction?: (transaction: Transaction) => Promise<Transaction>
): Promise<{ baseAmount: string; quoteAmount: string }> {
  
  const amount = parseFloat(inputAmount);
  if (isNaN(amount) || amount <= 0) {
    throw new Error('Invalid input amount');
  }
  
  // OOGWAY has 6 decimals, SOL has 9 decimals
  const OOGWAY_DECIMALS = 6;
  const SOL_DECIMALS = 9;
  
  // Check if we're on devnet
  const network = await getNetwork();
  
  if (network === 'devnet') {
    // For devnet, simulate a 1:1 exchange rate
    if (inputCurrency === 'sol') {
      // User inputs SOL, split 50/50 into base (OOGWAY) and quote (SOL)
      const solAmountInSmallestUnits = Math.floor(amount * Math.pow(10, SOL_DECIMALS));
      const halfSolAmount = Math.floor(solAmountInSmallestUnits / 2);
      const halfInOogway = Math.floor((amount / 2) * Math.pow(10, OOGWAY_DECIMALS));
      
      return {
        baseAmount: halfInOogway.toString(),     // OOGWAY (6 decimals)
        quoteAmount: halfSolAmount.toString()    // SOL (9 decimals)
      };
    } else {
      // User inputs OOGWAY, split 50/50 into base (OOGWAY) and quote (SOL)
      const oogwayAmountInSmallestUnits = Math.floor(amount * Math.pow(10, OOGWAY_DECIMALS));
      const halfOogwayAmount = Math.floor(oogwayAmountInSmallestUnits / 2);
      const halfInSol = Math.floor((amount / 2) * Math.pow(10, SOL_DECIMALS));
      
      return {
        baseAmount: halfOogwayAmount.toString(),  // OOGWAY (6 decimals)
        quoteAmount: halfInSol.toString()         // SOL (9 decimals)
      };
    }
  } else {
    // On mainnet, perform real swap via Jupiter
    if (!userAddress || !signTransaction) {
      throw new Error('User address and signTransaction are required for mainnet swaps');
    }
    
    // Calculate the amount to swap (half of input)
    let inputMint: string;
    let outputMint: string;
    let swapAmount: string;
    
    if (inputCurrency === 'sol') {
      // User has SOL, swap half to OOGWAY
      inputMint = SOL_MINT;
      outputMint = OOGWAY_MINT;
      const solAmountInSmallestUnits = Math.floor(amount * Math.pow(10, SOL_DECIMALS));
      const halfSolAmount = Math.floor(solAmountInSmallestUnits / 2);
      swapAmount = halfSolAmount.toString();
      
      // Build swap transaction
      const buildResponse = await fetch(`${API_BASE_URL}/api/swap/${proposalId}/jupiter/buildSwapTx`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user: userAddress,
          inputMint,
          outputMint,
          amount: swapAmount,
          slippageBps: 100
        })
      });
      
      if (!buildResponse.ok) {
        throw new Error('Failed to build swap transaction');
      }
      
      const buildData = await buildResponse.json();
      
      // Sign the transaction
      const swapTx = Transaction.from(Buffer.from(buildData.transaction, 'base64'));
      const signedTx = await signTransaction(swapTx);
      
      // Execute the swap
      const executeResponse = await fetch(`${API_BASE_URL}/api/swap/${proposalId}/jupiter/executeSwapTx`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transaction: Buffer.from(signedTx.serialize({ requireAllSignatures: false })).toString('base64')
        })
      });
      
      if (!executeResponse.ok) {
        throw new Error('Failed to execute swap');
      }
      
      // Use the actual quote amounts from Jupiter
      return {
        baseAmount: buildData.quote.outAmount,      // OOGWAY received from swap (actual)
        quoteAmount: halfSolAmount.toString()       // Remaining SOL
      };
      
    } else {
      // User has OOGWAY, swap half to SOL
      inputMint = OOGWAY_MINT;
      outputMint = SOL_MINT;
      const oogwayAmountInSmallestUnits = Math.floor(amount * Math.pow(10, OOGWAY_DECIMALS));
      const halfOogwayAmount = Math.floor(oogwayAmountInSmallestUnits / 2);
      swapAmount = halfOogwayAmount.toString();
      
      // Build swap transaction
      const buildResponse = await fetch(`${API_BASE_URL}/api/swap/${proposalId}/jupiter/buildSwapTx`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user: userAddress,
          inputMint,
          outputMint,
          amount: swapAmount,
          slippageBps: 100
        })
      });
      
      if (!buildResponse.ok) {
        throw new Error('Failed to build swap transaction');
      }
      
      const buildData = await buildResponse.json();
      
      // Sign the transaction
      const swapTx = Transaction.from(Buffer.from(buildData.transaction, 'base64'));
      const signedTx = await signTransaction(swapTx);
      
      // Execute the swap
      const executeResponse = await fetch(`${API_BASE_URL}/api/swap/${proposalId}/jupiter/executeSwapTx`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transaction: Buffer.from(signedTx.serialize({ requireAllSignatures: false })).toString('base64')
        })
      });
      
      if (!executeResponse.ok) {
        throw new Error('Failed to execute swap');
      }
      
      // Use the actual quote amounts from Jupiter
      return {
        baseAmount: halfOogwayAmount.toString(),    // Remaining OOGWAY
        quoteAmount: buildData.quote.outAmount      // SOL received from swap (actual)
      };
    }
  }
}

/**
 * Split tokens via vault (base or quote)
 */
async function splitTokens(
  proposalId: number,
  vaultType: 'base' | 'quote',
  amount: string,
  userAddress: string,
  signTransaction: (transaction: Transaction) => Promise<Transaction>
): Promise<void> {
  
  // Build split transaction
  const splitRequest = {
    user: userAddress,
    amount: amount
  };
  
  const splitResponse = await fetch(`${API_BASE_URL}/api/vaults/${proposalId}/${vaultType}/buildSplitTx`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(splitRequest)
  });
  
  if (!splitResponse.ok) {
    const error = await splitResponse.json();
    throw new Error(`${vaultType} split failed: ${error.message || JSON.stringify(error)}`);
  }
  
  const splitData = await splitResponse.json();
  
  // Sign the transaction using the wallet
  const splitTx = Transaction.from(Buffer.from(splitData.transaction, 'base64'));
  const signedTx = await signTransaction(splitTx);
  
  // Execute the signed split transaction
  const executeSplitResponse = await fetch(`${API_BASE_URL}/api/vaults/${proposalId}/${vaultType}/executeSplitTx`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      transaction: Buffer.from(signedTx.serialize({ requireAllSignatures: false })).toString('base64')
    })
  });
  
  if (!executeSplitResponse.ok) {
    const error = await executeSplitResponse.json();
    throw new Error(`${vaultType} split execution failed: ${error.message || JSON.stringify(error)}`);
  }
}

/**
 * Claim winnings from a finished proposal
 * Claims from BOTH vaults (base and quote) for the winning market
 */
export async function claimWinnings(config: {
  proposalId: number;
  proposalStatus: 'Passed' | 'Failed';
  userPosition: { type: 'pass' | 'fail' } | null;
  userAddress: string;
  signTransaction: (transaction: Transaction) => Promise<Transaction>;
}): Promise<void> {
  const { proposalId, proposalStatus, userAddress, signTransaction } = config;

  // Check if user won
  const didUserWin = (proposalStatus === 'Passed' && config.userPosition?.type === 'pass') ||
                     (proposalStatus === 'Failed' && config.userPosition?.type === 'fail');

  if (!didUserWin) {
    throw new Error('Cannot claim - you did not win this market');
  }

  const toastId = toast.loading('Claiming winnings from both vaults...');

  try {
    // Get user balances to determine which vaults have claimable tokens
    const balances = await getUserBalances(proposalId, userAddress);
    if (!balances) {
      throw new Error('Failed to get user balances');
    }

    // Determine which conditional tokens the user has based on outcome
    let hasBaseTokens = false;
    let hasQuoteTokens = false;

    if (proposalStatus === 'Passed') {
      // Proposal passed - user can claim Pass conditional tokens
      hasBaseTokens = parseFloat(balances.base.passConditional || '0') > 0;
      hasQuoteTokens = parseFloat(balances.quote.passConditional || '0') > 0;
    } else {
      // Proposal failed - user can claim Fail conditional tokens
      hasBaseTokens = parseFloat(balances.base.failConditional || '0') > 0;
      hasQuoteTokens = parseFloat(balances.quote.failConditional || '0') > 0;
    }

    const vaultsToRedeem: ('base' | 'quote')[] = [];
    if (hasBaseTokens) vaultsToRedeem.push('base');
    if (hasQuoteTokens) vaultsToRedeem.push('quote');

    if (vaultsToRedeem.length === 0) {
      throw new Error('No winning tokens to claim');
    }

    // Redeem from each vault that has tokens
    for (const vaultType of vaultsToRedeem) {
      // Build redeem transaction
      const redeemResponse = await fetch(
        `${API_BASE_URL}/api/vaults/${proposalId}/${vaultType}/buildRedeemWinningTokensTx`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            user: userAddress
          })
        }
      );

      if (!redeemResponse.ok) {
        const error = await redeemResponse.json();
        throw new Error(`Failed to build ${vaultType} redeem transaction: ${error.message || JSON.stringify(error)}`);
      }

      const redeemData = await redeemResponse.json();

      // Sign the transaction
      const redeemTx = Transaction.from(Buffer.from(redeemData.transaction, 'base64'));
      const signedRedeemTx = await signTransaction(redeemTx);

      // Execute the signed redeem transaction
      const executeRedeemResponse = await fetch(
        `${API_BASE_URL}/api/vaults/${proposalId}/${vaultType}/executeRedeemWinningTokensTx`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            transaction: Buffer.from(signedRedeemTx.serialize({ requireAllSignatures: false })).toString('base64')
          })
        }
      );

      if (!executeRedeemResponse.ok) {
        const error = await executeRedeemResponse.json();
        throw new Error(`Failed to execute ${vaultType} redeem transaction: ${error.message || JSON.stringify(error)}`);
      }
    }

    toast.success(
      `Winnings claimed successfully from ${vaultsToRedeem.length} vault${vaultsToRedeem.length > 1 ? 's' : ''}!`,
      { id: toastId, duration: 5000 }
    );

    return;
    
  } catch (error) {
    console.error('Error claiming winnings:', error);
    toast.error(
      `Failed to claim winnings: ${error instanceof Error ? error.message : 'Unknown error'}`,
      { id: toastId }
    );
    throw error;
  }
}

/**
 * Execute a swap on pass or fail market
 */
async function executeMarketSwap(
  proposalId: number,
  market: 'pass' | 'fail',
  isBaseToQuote: boolean,
  amountIn: string,
  userAddress: string,
  signTransaction: (transaction: Transaction) => Promise<Transaction>
): Promise<void> {
  
  // Build swap request
  const swapRequest = {
    user: userAddress,
    market: market,
    isBaseToQuote: isBaseToQuote,
    amountIn: amountIn,
    slippageBps: 2000 // 20% slippage for large swaps
  };
  
  const buildSwapResponse = await fetch(`${API_BASE_URL}/api/swap/${proposalId}/buildSwapTx`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(swapRequest)
  });
  
  if (!buildSwapResponse.ok) {
    const error = await buildSwapResponse.json();
    throw new Error(`Build ${market} swap failed: ${error.message || JSON.stringify(error)}`);
  }
  
  const swapTxData = await buildSwapResponse.json();

  // Sign the swap transaction
  const swapTx = Transaction.from(Buffer.from(swapTxData.transaction, 'base64'));
  const signedSwapTx = await signTransaction(swapTx);

  // Execute the signed swap transaction
  const executeSwapResponse = await fetch(`${API_BASE_URL}/api/swap/${proposalId}/executeSwapTx`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      transaction: Buffer.from(signedSwapTx.serialize({ requireAllSignatures: false })).toString('base64'),
      market: market,
      user: userAddress,
      isBaseToQuote: isBaseToQuote,
      amountIn: amountIn,
      amountOut: swapTxData.expectedAmountOut
    })
  });
  
  if (!executeSwapResponse.ok) {
    const error = await executeSwapResponse.json();
    throw new Error(`${market} swap execution failed: ${error.message || JSON.stringify(error)}`);
  }
}