import { Router } from 'express';
import { getModerator } from '../services/moderator.service';
import { PublicKey, Transaction } from '@solana/web3.js';
import { SPLTokenService, NATIVE_MINT } from '../../app/services/spl-token.service';
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';

const router = Router();

// Helper function to check if we're on mainnet
function isMainnet(): boolean {
  const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
  return !rpcUrl.includes('devnet');
}

// Helper function to get vault from proposal
async function getVault(proposalId: number, vaultType: string) {
  const moderator = await getModerator();
  
  const proposal = await moderator.getProposal(proposalId);
  if (!proposal) {
    throw new Error('Proposal not found');
  }
  
  // Use the proposal's getVaults() method which handles initialization checks
  const [baseVault, quoteVault] = proposal.getVaults();
  
  if (vaultType === 'base') {
    return baseVault;
  } else if (vaultType === 'quote') {
    return quoteVault;
  } else {
    throw new Error('Invalid vault type. Must be "base" or "quote"');
  }
}


// Build split transaction
router.post('/:id/:type/buildSplitTx', async (req, res, next) => {
  try {
    const proposalId = parseInt(req.params.id);
    const vaultType = req.params.type;
    
    // Validate request body
    const { user, amount } = req.body;
    if (!user || amount === undefined) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['user', 'amount']
      });
    }
    
    const vault = await getVault(proposalId, vaultType);
    const userPubkey = new PublicKey(user);
    const amountBigInt = BigInt(amount);
    
    let transaction;
    // Check if we need to wrap SOL (mainnet + quote vault)
    if (isMainnet() && vaultType === 'quote') {
      // Get the moderator to access the connection
      const moderator = await getModerator();
      const connection = moderator.config.connection;
      
      // Check native SOL balance
      const solBalance = await connection.getBalance(userPubkey);
      const solBalanceBigInt = BigInt(solBalance);
      
      if (solBalanceBigInt < amountBigInt) {
        return res.status(400).json({
          error: `Insufficient SOL balance: ${solBalance / 1e9} SOL available, ${Number(amountBigInt) / 1e9} SOL required`
        });
      }
      
      // Build split transaction with balance check skipped (we already checked SOL)
      transaction = await vault.buildSplitTx(userPubkey, amountBigInt, true);
      
      // Create SPL Token Service instance
      const tokenService = new SPLTokenService(connection);
      
      // Build wrap SOL instructions
      const wrapInstructions = await tokenService.buildWrapSolIxs(userPubkey, amountBigInt);
      
      // Prepend wrap instructions to the transaction
      // We need to deserialize, modify, and reserialize the transaction
      const txBuffer = transaction.serialize({ requireAllSignatures: false });
      const deserializedTx = Transaction.from(txBuffer);
      
      // Create a new transaction with wrap instructions first
      const newTransaction = new Transaction();
      
      // Add wrap instructions first
      wrapInstructions.forEach(ix => newTransaction.add(ix));
      
      // Then add all original instructions
      deserializedTx.instructions.forEach(ix => newTransaction.add(ix));
      
      // Copy over other transaction properties
      newTransaction.recentBlockhash = deserializedTx.recentBlockhash;
      newTransaction.feePayer = deserializedTx.feePayer;
      
      transaction = newTransaction;
    } else {
      // Normal flow - vault will check token balance
      transaction = await vault.buildSplitTx(userPubkey, amountBigInt);
    }
    
    res.json({
      transaction: transaction.serialize({ requireAllSignatures: false }).toString('base64'),
      message: 'Transaction built successfully. User must sign before execution.'
    });
  } catch (error) {
    next(error);
  }
});

// Execute split transaction
router.post('/:id/:type/executeSplitTx', async (req, res, next) => {
  try {
    const proposalId = parseInt(req.params.id);
    const vaultType = req.params.type;
    
    // Validate request body
    const { transaction } = req.body;
    if (!transaction) {
      return res.status(400).json({ 
        error: 'Missing required field: transaction'
      });
    }
    
    const vault = await getVault(proposalId, vaultType);
    const tx = Transaction.from(Buffer.from(transaction, 'base64'));
    
    const signature = await vault.executeSplitTx(tx);
    
    // Save the updated proposal state to database after the split
    const moderator = await getModerator();
    const updatedProposal = await moderator.getProposal(proposalId);
    if (updatedProposal) {
      await moderator.saveProposal(updatedProposal);
      console.log(`Proposal #${proposalId} state saved after split execution`);
    }
    
    res.json({
      signature,
      status: 'success'
    });
  } catch (error) {
    next(error);
  }
});

// Build merge transaction
router.post('/:id/:type/buildMergeTx', async (req, res, next) => {
  try {
    const proposalId = parseInt(req.params.id);
    const vaultType = req.params.type;
    
    // Validate request body
    const { user, amount } = req.body;
    if (!user || amount === undefined) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['user', 'amount']
      });
    }
    
    const vault = await getVault(proposalId, vaultType);
    const userPubkey = new PublicKey(user);
    const amountBigInt = BigInt(amount);
    
    let transaction = await vault.buildMergeTx(userPubkey, amountBigInt);
    // Check if we need to unwrap SOL (mainnet + quote vault)
    if (isMainnet() && vaultType === 'quote') {
      // Get the user's wrapped SOL account
      const wrappedSolAccount = await getAssociatedTokenAddress(
        NATIVE_MINT,
        userPubkey,
        false,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );
      
      // Get the moderator to access the connection
      const moderator = await getModerator();
      const connection = moderator.config.connection;
      
      // Create SPL Token Service instance
      const tokenService = new SPLTokenService(connection);
      
      // Build unwrap SOL instruction (close the wrapped SOL account)
      const unwrapInstruction = tokenService.buildUnwrapSolIx(
        wrappedSolAccount,
        userPubkey, // Send unwrapped SOL back to user
        userPubkey  // Owner of the wrapped SOL account
      );
      
      // Append unwrap instruction to the transaction
      // We need to deserialize, modify, and reserialize the transaction
      const txBuffer = transaction.serialize({ requireAllSignatures: false });
      const deserializedTx = Transaction.from(txBuffer);
      
      // Create a new transaction with original instructions plus unwrap
      const newTransaction = new Transaction();
      
      // Add all original instructions first
      deserializedTx.instructions.forEach(ix => newTransaction.add(ix));
      
      // Then add unwrap instruction at the end
      newTransaction.add(unwrapInstruction);
      
      // Copy over other transaction properties
      newTransaction.recentBlockhash = deserializedTx.recentBlockhash;
      newTransaction.feePayer = deserializedTx.feePayer;
      
      transaction = newTransaction;
    }
    
    res.json({
      transaction: transaction.serialize({ requireAllSignatures: false }).toString('base64'),
      message: 'Transaction built successfully. User must sign before execution.'
    });
  } catch (error) {
    next(error);
  }
});

// Execute merge transaction
router.post('/:id/:type/executeMergeTx', async (req, res, next) => {
  try {
    const proposalId = parseInt(req.params.id);
    const vaultType = req.params.type;
    
    // Validate request body
    const { transaction } = req.body;
    if (!transaction) {
      return res.status(400).json({ 
        error: 'Missing required field: transaction'
      });
    }
    
    const vault = await getVault(proposalId, vaultType);
    const tx = Transaction.from(Buffer.from(transaction, 'base64'));
    
    const signature = await vault.executeMergeTx(tx);
    
    // Save the updated proposal state to database after the merge
    const moderator = await getModerator();
    const updatedProposal = await moderator.getProposal(proposalId);
    if (updatedProposal) {
      await moderator.saveProposal(updatedProposal);
      console.log(`Proposal #${proposalId} state saved after merge execution`);
    }
    
    res.json({
      signature,
      status: 'success'
    });
  } catch (error) {
    next(error);
  }
});

// Build redeem winning tokens transaction
router.post('/:id/:type/buildRedeemWinningTokensTx', async (req, res, next) => {
  try {
    const proposalId = parseInt(req.params.id);
    const vaultType = req.params.type;
    
    // Validate request body
    const { user } = req.body;
    if (!user) {
      return res.status(400).json({ 
        error: 'Missing required field: user'
      });
    }
    
    const vault = await getVault(proposalId, vaultType);
    const userPubkey = new PublicKey(user);
    
    let transaction = await vault.buildRedeemWinningTokensTx(userPubkey);
    
    // Check if we need to unwrap SOL (mainnet + quote vault)
    if (isMainnet() && vaultType === 'quote') {
      // Get the user's wrapped SOL account
      const wrappedSolAccount = await getAssociatedTokenAddress(
        NATIVE_MINT,
        userPubkey,
        false,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );
      
      // Get the moderator to access the connection
      const moderator = await getModerator();
      const connection = moderator.config.connection;
      
      // Create SPL Token Service instance
      const tokenService = new SPLTokenService(connection);
      
      // Build unwrap SOL instruction (close the wrapped SOL account)
      const unwrapInstruction = tokenService.buildUnwrapSolIx(
        wrappedSolAccount,
        userPubkey, // Send unwrapped SOL back to user
        userPubkey  // Owner of the wrapped SOL account
      );
      
      // Append unwrap instruction to the transaction
      // We need to deserialize, modify, and reserialize the transaction
      const txBuffer = transaction.serialize({ requireAllSignatures: false });
      const deserializedTx = Transaction.from(txBuffer);
      
      // Create a new transaction with original instructions plus unwrap
      const newTransaction = new Transaction();
      
      // Add all original instructions first
      deserializedTx.instructions.forEach(ix => newTransaction.add(ix));
      
      // Then add unwrap instruction at the end
      newTransaction.add(unwrapInstruction);
      
      // Copy over other transaction properties
      newTransaction.recentBlockhash = deserializedTx.recentBlockhash;
      newTransaction.feePayer = deserializedTx.feePayer;
      
      transaction = newTransaction;
    }
    
    res.json({
      transaction: transaction.serialize({ requireAllSignatures: false }).toString('base64'),
      message: 'Transaction built successfully. User must sign before execution.'
    });
  } catch (error) {
    next(error);
  }
});

// Execute redeem winning tokens transaction
router.post('/:id/:type/executeRedeemWinningTokensTx', async (req, res, next) => {
  try {
    const proposalId = parseInt(req.params.id);
    const vaultType = req.params.type;
    
    // Validate request body
    const { transaction } = req.body;
    if (!transaction) {
      return res.status(400).json({ 
        error: 'Missing required field: transaction'
      });
    }
    
    const vault = await getVault(proposalId, vaultType);
    const tx = Transaction.from(Buffer.from(transaction, 'base64'));
    
    const signature = await vault.executeRedeemWinningTokensTx(tx);
    
    // Save the updated proposal state to database after the redeem
    const moderator = await getModerator();
    const updatedProposal = await moderator.getProposal(proposalId);
    if (updatedProposal) {
      await moderator.saveProposal(updatedProposal);
      console.log(`Proposal #${proposalId} state saved after redeem execution`);
    }
    
    res.json({
      signature,
      status: 'success'
    });
  } catch (error) {
    next(error);
  }
});

// Get user balances for both vaults
router.get('/:id/getUserBalances', async (req, res, next) => {
  try {
    const proposalId = parseInt(req.params.id);
    const { user } = req.query;
    
    if (!user) {
      return res.status(400).json({ 
        error: 'Missing required query parameter: user'
      });
    }
    
    const moderator = await getModerator();
    
    const proposal = await moderator.getProposal(proposalId);
    if (!proposal) {
      return res.status(404).json({ error: 'Proposal not found' });
    }
    const userPubkey = new PublicKey(user as string);
    
    // Use getVaults() to get both vaults with proper initialization checks
    const [baseVault, quoteVault] = proposal.getVaults();
    
    // Get balances from both vaults in parallel
    const [baseBalances, quoteBalances] = await Promise.all([
      baseVault.getUserBalances(userPubkey),
      quoteVault.getUserBalances(userPubkey)
    ]);
    
    const balances = {
      proposalId,
      user: user as string,
      base: {
        regular: baseBalances.regular.toString(),
        passConditional: baseBalances.passConditional.toString(),
        failConditional: baseBalances.failConditional.toString()
      },
      quote: {
        regular: quoteBalances.regular.toString(),
        passConditional: quoteBalances.passConditional.toString(),
        failConditional: quoteBalances.failConditional.toString()
      }
    };
    
    res.json(balances);
  } catch (error) {
    next(error);
  }
});

export default router;