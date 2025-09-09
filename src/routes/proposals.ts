import { Router } from 'express';
import { requireApiKey } from '../middleware/auth';
import { getModerator } from '../services/moderator.service';
import { CreateProposalRequest, CreateProposalResponse } from '../types/api';
import { Transaction, PublicKey } from '@solana/web3.js';
import BN from 'bn.js';
import { ExecutionStatus } from '../../app/types/execution.interface';

const router = Router();

router.get('/', (_req, res) => {
  const moderator = getModerator();
  const proposals = moderator.proposals;
  
  const publicProposals = proposals.map((p, index) => ({
    id: index,
    description: p.description,
    status: p.status,
    createdAt: p.createdAt,
    finalizedAt: p.finalizedAt,
  }));
  
  res.json({
    proposals: publicProposals,
  });
});

router.get('/:id', (req, res) => {
  const moderator = getModerator();
  const id = parseInt(req.params.id);
  
  if (isNaN(id) || id < 0 || id >= moderator.proposals.length) {
    return res.status(404).json({ error: 'Proposal not found' });
  }
  
  const proposal = moderator.proposals[id];
  
  const response = {
    id,
    description: proposal.description,
    status: proposal.status,
    createdAt: proposal.createdAt,
    finalizedAt: proposal.finalizedAt,
    proposalStatus: proposal.status,
    proposalLength: proposal.proposalLength,
  };
  
  res.json(response);
});


router.post('/', requireApiKey, async (req, res, next) => {
  try {
    const moderator = getModerator();
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
        data: Buffer.from(`Proposal #${moderator.proposals.length}: ${body.description}`)
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
        passThresholdBps: body.twap.passThresholdBps
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

router.post('/:id/execute', requireApiKey, async (req, res, next) => {
  try {
    const moderator = getModerator();
    const id = parseInt(req.params.id);
    
    if (isNaN(id) || id < 0 || id >= moderator.proposals.length) {
      return res.status(404).json({ error: 'Proposal not found' });
    }
    
    const proposal = moderator.proposals[id];

    
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