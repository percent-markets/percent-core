import { Router } from 'express';
import { requireModeratorId, requireProposalId, getModerator } from '../middleware/validation';
import { PublicKey, Transaction } from '@solana/web3.js';
import { LoggerService } from '@app/services/logger.service';

const router = Router();
const logger = new LoggerService('api').createChild('vaults');

// Apply requireModeratorId to all vault routes - no fallback allowed
router.use(requireModeratorId);

// Helper function to get vault from proposal
async function getVault(moderatorId: number, proposalId: number, vaultType: string) {
  const moderator = getModerator(moderatorId);
  
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
router.post('/:id/:type/buildSplitTx', requireProposalId, async (req, res, next) => {
  try {
    const moderatorId = req.moderatorId;
    const proposalId = req.proposalId!; // Non-null assertion since middleware guarantees it
    const vaultType = req.params.type;

    // Validate request body
    const { user, amount } = req.body;
    if (!user || amount === undefined) {
      logger.warn('Missing required fields for buildSplitTx', { proposalId, user, amount });
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['user', 'amount']
      });
    }

    const vault = await getVault(moderatorId, proposalId, vaultType);
    const userPubkey = new PublicKey(user);
    const amountBigInt = BigInt(amount);

    // Vault handles SOL wrapping internally for mainnet quote vaults
    const transaction = await vault.buildSplitTx(userPubkey, amountBigInt);

    logger.info('Split transaction built', { proposalId, vaultType, user, amount: amount.toString() });

    res.json({
      transaction: transaction.serialize({ requireAllSignatures: false }).toString('base64'),
      message: 'Transaction built successfully. User must sign before execution.'
    });
  } catch (error) {
    logger.error('Failed to build split transaction', { error: error.message, proposalId, vaultType: req.params.type });
    next(error);
  }
});

// Execute split transaction
router.post('/:id/:type/executeSplitTx', requireProposalId, async (req, res, next) => {
  try {
    const moderatorId = req.moderatorId;
    const proposalId = req.proposalId!;
    const vaultType = req.params.type;

    // Validate request body
    const { transaction } = req.body;
    if (!transaction) {
      logger.warn('Missing transaction for executeSplitTx', { proposalId });
      return res.status(400).json({
        error: 'Missing required field: transaction'
      });
    }

    const vault = await getVault(moderatorId, proposalId, vaultType);
    const tx = Transaction.from(Buffer.from(transaction, 'base64'));

    const signature = await vault.executeSplitTx(tx);

    // Save the updated proposal state to database after the split
    const moderator = getModerator(moderatorId);
    const updatedProposal = await moderator.getProposal(proposalId);
    if (updatedProposal) {
      await moderator.saveProposal(updatedProposal);
      logger.info('Split executed and saved', { proposalId, vaultType, signature });
    }

    res.json({
      signature,
      status: 'success'
    });
  } catch (error) {
    logger.error('Failed to execute split transaction', { error: error.message, proposalId });
    next(error);
  }
});

// Build merge transaction
router.post('/:id/:type/buildMergeTx', requireProposalId, async (req, res, next) => {
  try {
    const moderatorId = req.moderatorId;
    const proposalId = req.proposalId!;
    const vaultType = req.params.type;

    // Validate request body
    const { user, amount } = req.body;
    if (!user || amount === undefined) {
      logger.warn('Missing required fields for buildMergeTx', { proposalId, user, amount });
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['user', 'amount']
      });
    }

    const vault = await getVault(moderatorId, proposalId, vaultType);
    const userPubkey = new PublicKey(user);
    const amountBigInt = BigInt(amount);

    // Vault handles SOL unwrapping internally for mainnet quote vaults
    const transaction = await vault.buildMergeTx(userPubkey, amountBigInt);

    logger.info('Merge transaction built', { proposalId, vaultType, user, amount: amount.toString() });

    res.json({
      transaction: transaction.serialize({ requireAllSignatures: false }).toString('base64'),
      message: 'Transaction built successfully. User must sign before execution.'
    });
  } catch (error) {
    logger.error('Failed to build merge transaction', { error: error.message, proposalId, vaultType: req.params.type });
    next(error);
  }
});

// Execute merge transaction
router.post('/:id/:type/executeMergeTx', requireProposalId, async (req, res, next) => {
  try {
    const moderatorId = req.moderatorId;
    const proposalId = req.proposalId!;
    const vaultType = req.params.type;

    // Validate request body
    const { transaction } = req.body;
    if (!transaction) {
      logger.warn('Missing transaction for executeMergeTx', { proposalId });
      return res.status(400).json({
        error: 'Missing required field: transaction'
      });
    }

    const vault = await getVault(moderatorId, proposalId, vaultType);
    const tx = Transaction.from(Buffer.from(transaction, 'base64'));

    const signature = await vault.executeMergeTx(tx);

    // Save the updated proposal state to database after the merge
    const moderator = getModerator(moderatorId);
    const updatedProposal = await moderator.getProposal(proposalId);
    if (updatedProposal) {
      await moderator.saveProposal(updatedProposal);
      logger.info('Merge executed and saved', { proposalId, vaultType, signature });
    }

    res.json({
      signature,
      status: 'success'
    });
  } catch (error) {
    logger.error('Failed to execute merge transaction', { error: error.message, proposalId });
    next(error);
  }
});

// Build redeem winning tokens transaction
router.post('/:id/:type/buildRedeemWinningTokensTx', requireProposalId, async (req, res, next) => {
  try {
    const moderatorId = req.moderatorId;
    const proposalId = req.proposalId!;
    const vaultType = req.params.type;

    // Validate request body
    const { user } = req.body;
    if (!user) {
      logger.warn('Missing user for buildRedeemWinningTokensTx', { proposalId });
      return res.status(400).json({
        error: 'Missing required field: user'
      });
    }

    const vault = await getVault(moderatorId, proposalId, vaultType);
    const userPubkey = new PublicKey(user);

    // Vault handles SOL unwrapping internally for mainnet quote vaults
    const transaction = await vault.buildRedeemWinningTokensTx(userPubkey);

    logger.info('Redeem transaction built', { proposalId, vaultType, user });

    res.json({
      transaction: transaction.serialize({ requireAllSignatures: false }).toString('base64'),
      message: 'Transaction built successfully. User must sign before execution.'
    });
  } catch (error) {
    logger.error('Failed to build redeem transaction', { error: error.message, proposalId, vaultType: req.params.type });
    next(error);
  }
});

// Execute redeem winning tokens transaction
router.post('/:id/:type/executeRedeemWinningTokensTx', requireProposalId, async (req, res, next) => {
  try {
    const moderatorId = req.moderatorId;
    const proposalId = req.proposalId!;
    const vaultType = req.params.type;

    // Validate request body
    const { transaction } = req.body;
    if (!transaction) {
      logger.warn('Missing transaction for executeRedeemWinningTokensTx', { proposalId });
      return res.status(400).json({
        error: 'Missing required field: transaction'
      });
    }

    const vault = await getVault(moderatorId, proposalId, vaultType);
    const tx = Transaction.from(Buffer.from(transaction, 'base64'));

    const signature = await vault.executeRedeemWinningTokensTx(tx);

    // Save the updated proposal state to database after the redeem
    const moderator = getModerator(moderatorId);
    const updatedProposal = await moderator.getProposal(proposalId);
    if (updatedProposal) {
      await moderator.saveProposal(updatedProposal);
      logger.info('Redeem executed and saved', { proposalId, vaultType, signature });
    }

    res.json({
      signature,
      status: 'success'
    });
  } catch (error) {
    logger.error('Failed to execute redeem transaction', { error: error.message, proposalId });
    next(error);
  }
});

// Get user balances for both vaults
router.get('/:id/getUserBalances', requireProposalId, async (req, res, next) => {
  try {
    const moderatorId = req.moderatorId;
    const proposalId = req.proposalId!;
    const { user } = req.query;

    if (!user) {
      logger.warn('Missing user parameter for getUserBalances', { proposalId });
      return res.status(400).json({
        error: 'Missing required query parameter: user'
      });
    }

    const moderator = getModerator(moderatorId);

    const proposal = await moderator.getProposal(proposalId);
    if (!proposal) {
      logger.warn('Proposal not found for getUserBalances', { proposalId });
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

    logger.info('User balances retrieved', { proposalId, user: user as string });

    res.json(balances);
  } catch (error) {
    logger.error('Failed to get user balances', { error: error.message, proposalId, user: req.query.user });
    next(error);
  }
});

export default router;