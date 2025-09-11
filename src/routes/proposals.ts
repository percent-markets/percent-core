import { Router } from 'express';
import { requireApiKey } from '../middleware/auth';
import { getModerator } from '../services/moderator.service';
import { CreateProposalRequest, CreateProposalResponse } from '../types/api';
import { Transaction, PublicKey } from '@solana/web3.js';
import BN from 'bn.js';
import { ExecutionStatus } from '../../app/types/execution.interface';
import { PersistenceService } from '../../app/services/persistence.service';

const router = Router();

router.get('/', async (_req, res, next) => {
  try {
    const persistenceService = PersistenceService.getInstance();
    const proposals = await persistenceService.getProposalsForFrontend();
    
    const publicProposals = proposals.map(p => ({
      id: p.id,
      description: p.description,
      status: p.status,
      createdAt: new Date(p.created_at).getTime(),
      finalizedAt: new Date(p.finalized_at).getTime(),
    }));
    
    res.json({
      proposals: publicProposals,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    
    if (isNaN(id) || id < 0) {
      return res.status(400).json({ error: 'Invalid proposal ID' });
    }
    
    const persistenceService = PersistenceService.getInstance();
    const proposal = await persistenceService.getProposalForFrontend(id);
    
    if (!proposal) {
      return res.status(404).json({ error: 'Proposal not found' });
    }
    
    const response = {
      id: proposal.id,
      description: proposal.description,
      status: proposal.status,
      createdAt: new Date(proposal.created_at).getTime(),
      finalizedAt: new Date(proposal.finalized_at).getTime(),
      proposalStatus: proposal.status,
      proposalLength: parseInt(proposal.proposal_length),
      baseMint: proposal.base_mint,
      quoteMint: proposal.quote_mint,
      authority: proposal.authority,
      ammConfig: proposal.amm_config,
      passAmmState: proposal.pass_amm_state,
      failAmmState: proposal.fail_amm_state,
      baseVaultState: proposal.base_vault_state,
      quoteVaultState: proposal.quote_vault_state,
      twapOracleState: proposal.twap_oracle_state,
    };
    
    res.json(response);
  } catch (error) {
    next(error);
  }
});


router.post('/', requireApiKey, async (req, res, next) => {
  try {
    const moderator = await getModerator();
    const body = req.body as CreateProposalRequest;
    
    // Validate required fields
    if (!body.description || !body.proposalLength || !body.twap || !body.amm) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['description', 'proposalLength', 'twap', 'amm']
      });
    }
    
    // Create the transaction - use memo program if no transaction provided
    let transaction: Transaction;
    if (body.transaction) {
      // Deserialize base64-encoded transaction
      transaction = Transaction.from(Buffer.from(body.transaction, 'base64'));
    } else {
      // Create default memo transaction
      const MEMO_PROGRAM_ID = 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr';
      transaction = new Transaction().add({
        programId: new PublicKey(MEMO_PROGRAM_ID),
        keys: [],
        data: Buffer.from(`Proposal #${moderator.proposalIdCounter}: ${body.description}`)
      });
    }
    
    // Create the proposal
    const proposal = await moderator.createProposal({
      description: body.description,
      transaction,
      proposalLength: body.proposalLength,
      twap: {
        initialTwapValue: body.twap.initialTwapValue,
        twapMaxObservationChangePerUpdate: body.twap.twapMaxObservationChangePerUpdate,
        twapStartDelay: body.twap.twapStartDelay,
        passThresholdBps: body.twap.passThresholdBps,
        minUpdateInterval: body.twap.minUpdateInterval
      },
      amm: {
        initialBaseAmount: new BN(body.amm.initialBaseAmount),
        initialQuoteAmount: new BN(body.amm.initialQuoteAmount)
      }
    });
    
    const response: CreateProposalResponse = {
      id: proposal.id,
      description: proposal.description,
      status: proposal.status,
      createdAt: proposal.createdAt,
      finalizedAt: proposal.finalizedAt
    };
    
    res.status(201).json(response);
  } catch (error) {
    next(error);
  }
});

router.post('/:id/execute', async (req, res, next) => {
  try {
    const moderator = await getModerator();
    const id = parseInt(req.params.id);
    
    if (isNaN(id) || id < 0) {
      return res.status(400).json({ error: 'Invalid proposal ID' });
    }
    
    // Get proposal from database (always fresh data)
    const proposal = await moderator.getProposal(id);
    
    if (!proposal) {
      return res.status(404).json({ error: 'Proposal not found' });
    }

    
    // Execute the proposal using the moderator's authority
    const result = await moderator.executeProposal(id, moderator.config.authority, {
      rpcEndpoint: process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
      maxRetries: 3,
      commitment: 'confirmed'
    });
    
    res.json({
      id,
      status: proposal.status,
      executed: result.status === ExecutionStatus.Success,
      signature: result.signature,
      error: result.error
    });
  } catch (error) {
    next(error);
  }
});

export default router;