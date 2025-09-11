import { Router } from 'express';
import { requireApiKey } from '../middleware/auth';
import { getModerator } from '../services/moderator.service';
import { PublicKey, Transaction } from '@solana/web3.js';
import { VaultType } from '../../app/types/vault.interface';

const router = Router();

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
router.post('/:id/:type/buildSplitTx', requireApiKey, async (req, res, next) => {
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
    
    const transaction = await vault.buildSplitTx(userPubkey, amountBigInt);
    
    res.json({
      transaction: transaction.serialize({ requireAllSignatures: false }).toString('base64'),
      message: 'Transaction built successfully. User must sign before execution.'
    });
  } catch (error) {
    next(error);
  }
});

// Execute split transaction
router.post('/:id/:type/executeSplitTx', requireApiKey, async (req, res, next) => {
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
router.post('/:id/:type/buildMergeTx', requireApiKey, async (req, res, next) => {
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
    
    const transaction = await vault.buildMergeTx(userPubkey, amountBigInt);
    
    res.json({
      transaction: transaction.serialize({ requireAllSignatures: false }).toString('base64'),
      message: 'Transaction built successfully. User must sign before execution.'
    });
  } catch (error) {
    next(error);
  }
});

// Execute merge transaction
router.post('/:id/:type/executeMergeTx', requireApiKey, async (req, res, next) => {
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
router.post('/:id/:type/buildRedeemWinningTokensTx', requireApiKey, async (req, res, next) => {
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
    
    const transaction = await vault.buildRedeemWinningTokensTx(userPubkey);
    
    res.json({
      transaction: transaction.serialize({ requireAllSignatures: false }).toString('base64'),
      message: 'Transaction built successfully. User must sign before execution.'
    });
  } catch (error) {
    next(error);
  }
});

// Execute redeem winning tokens transaction
router.post('/:id/:type/executeRedeemWinningTokensTx', requireApiKey, async (req, res, next) => {
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