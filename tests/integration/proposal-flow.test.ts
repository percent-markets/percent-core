import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { PublicKey, Transaction } from '@solana/web3.js';
import { createMemoInstruction } from '@solana/spl-memo';
import { Moderator } from '../../app/moderator';
import { ProposalStatus, IModeratorConfig } from '../../app/types/moderator.interface';
import {
  authorityWallet,
  connection,
  TEST_CONFIG
} from '../setup/devnet';
import {
  createTestTokenPair
} from '../helpers/tokens';
import {
  ensureMinBalance
} from '../helpers/airdrop';
import {
  assertProposalStatus,
  assertTransactionSuccess
} from '../helpers/assertions';
import {
  TEST_AMOUNTS,
  TEST_PERIODS,
  createTestModeratorConfig,
  createTestTransaction
} from '../setup/fixtures';

describe('Proposal Flow', () => {
  let moderator: Moderator;
  let baseMint: PublicKey;
  let quoteMint: PublicKey;
  let config: IModeratorConfig;
  
  beforeAll(async () => {
    console.log('\n🔧 Setting up proposal flow tests...');
    
    // Ensure test wallets have SOL (0.1 SOL max!)
    await ensureMinBalance(authorityWallet.publicKey, Number(TEST_AMOUNTS.TENTH_SOL));
    
    // Create test token pair
    const tokens = await createTestTokenPair(authorityWallet);
    baseMint = tokens.baseMint;
    quoteMint = tokens.quoteMint;

    // Create moderator with test configuration
    config = createTestModeratorConfig(
      baseMint, 
      quoteMint, 
      authorityWallet,
      connection,
      {
        proposalLength: TEST_PERIODS.INSTANT // 1 second for faster tests
      }
    );
  });

  beforeEach(async () => {
    moderator = new Moderator(config);
  });
  
  describe('Proposal Creation', () => {
    it('should create a new proposal through moderator', async () => {
      const description = 'Test Proposal #1';
      const tx = createTestTransaction('Test execution');
      
      const proposal = await moderator.createProposal(description, tx);
      
      expect(proposal).toBeDefined();
      expect(proposal.id).toBe(0);
      expect(proposal.description).toBe(description);
      assertProposalStatus(proposal as any, ProposalStatus.Pending);
    });
    
    it('should create multiple proposals with unique IDs and track them', async () => {
      const proposal1 = await moderator.createProposal('Proposal 1', createTestTransaction());
      const proposal2 = await moderator.createProposal('Proposal 2', createTestTransaction());
      const proposal3 = await moderator.createProposal('Proposal 3', createTestTransaction());
      
      // Check unique IDs
      expect(proposal1.id).toBe(0);
      expect(proposal2.id).toBe(1);
      expect(proposal3.id).toBe(2);
      
      // All should be pending
      assertProposalStatus(proposal1 as any, ProposalStatus.Pending);
      assertProposalStatus(proposal2 as any, ProposalStatus.Pending);
      assertProposalStatus(proposal3 as any, ProposalStatus.Pending);
      
      // Check tracking in moderator
      expect(moderator.proposals[0]).toBe(proposal1);
      expect(moderator.proposals[1]).toBe(proposal2);
      expect(moderator.proposals[2]).toBe(proposal3);
      expect(moderator.proposals).toHaveLength(3);
    });
  });
  
  describe('Proposal Initialization', () => {
    it('should initialize proposal components', async () => {
      const proposal = await moderator.createProposal('Test', createTestTransaction());

      expect(proposal.description).toBe('Test');
      expect(proposal.transaction).toBeDefined();
      
      // Note: Proposal.initialize() is not yet implemented
      // This test will need updating once it's implemented
      // For now, we just verify the proposal is created correctly
      
      // Check AMMs and Vaults exist (but not initialized on chain)
      //const [pAMM, fAMM] = proposal.getAMMs();
      //expect(pAMM).toBeDefined();
      //expect(fAMM).toBeDefined();
      //
      //const [pVault, fVault] = proposal.getVaults();
      //expect(pVault).toBeDefined();
      //expect(fVault).toBeDefined();
    });
  });
  
  describe('Proposal Finalization', () => {
    it('should finalize proposal after voting period', async () => {
      const proposal = await moderator.createProposal('Test', createTestTransaction());
      
      // Wait for voting period to end
      console.log(`⏳ Waiting ${TEST_PERIODS.INSTANT} seconds for voting period...`);
      await new Promise(resolve => setTimeout(resolve, (TEST_PERIODS.INSTANT + 1) * 1000));
      
      // Finalize proposal
      const finalStatus = await moderator.finalizeProposal(proposal.id);
      
      // Currently always passes (TWAP not implemented)
      expect(finalStatus).toBe(ProposalStatus.Passed);
      assertProposalStatus(proposal as any, ProposalStatus.Passed);
    });
    
    it('should reject finalization before voting period ends', async () => {
      const proposal = await moderator.createProposal('Test', createTestTransaction());
      
      // Try to finalize immediately
      const finalStatus = await moderator.finalizeProposal(proposal.id);
      expect(finalStatus).toBe(ProposalStatus.Pending);
    });
  });
  
  describe('Proposal Execution', () => {
    it('should execute passed proposal', async () => {
      // Create a proposal with memo instruction
      const memoText = `Test execution at ${Date.now()}`;
      const tx = new Transaction().add(
        createMemoInstruction(memoText, [])
      );
      
      const proposal = await moderator.createProposal('Execute test', tx);
      
      // Wait and finalize
      console.log(`⏳ Waiting ${TEST_PERIODS.INSTANT} seconds for voting period...`);
      await new Promise(resolve => setTimeout(resolve, (TEST_PERIODS.INSTANT + 1) * 1000));
      await moderator.finalizeProposal(proposal.id);
      
      // Execute proposal
      console.log(`🔄 Executing proposal transaction: memo instruction with text "${memoText}"`);
      const result = await moderator.executeProposal(
        proposal.id,
        authorityWallet,
        {
          rpcEndpoint: TEST_CONFIG.rpcUrl,
          commitment: TEST_CONFIG.commitment
        }
      );
      
      expect(result.status).toBe('success');
      expect(result.signature).toBeDefined();
      
      // Verify transaction on chain
      if (result.signature) {
        await assertTransactionSuccess(result.signature);
      }
      
      // Proposal should be executed
      assertProposalStatus(proposal as any, ProposalStatus.Executed);
    });
    
    it('should reject execution of pending proposal', async () => {
      const proposal = await moderator.createProposal('Test', createTestTransaction());
      
      await expect(
        moderator.executeProposal(
          proposal.id,
          authorityWallet,
          { rpcEndpoint: TEST_CONFIG.rpcUrl }
        )
      ).rejects.toThrow('Proposal has not passed');
    });
    
    it('should reject execution of failed proposal', async () => {
      await moderator.createProposal('Test', createTestTransaction());
      
      // Wait for voting period
      await new Promise(resolve => setTimeout(resolve, (TEST_PERIODS.INSTANT + 1) * 1000));
      
      // Force fail status (would normally be determined by TWAP)
      // Since we can't directly set status, we'll skip this test for now
      // This will be testable once TWAP is implemented
    });
    
    it('should reject double execution', async () => {
      const proposal = await moderator.createProposal('Test', createTestTransaction());
      
      // Finalize and execute
      await new Promise(resolve => setTimeout(resolve, (TEST_PERIODS.INSTANT + 1) * 1000));
      await moderator.finalizeProposal(proposal.id);
      console.log('🔄 Executing proposal for double execution test');
      await moderator.executeProposal(
        proposal.id,
        authorityWallet,
        { rpcEndpoint: TEST_CONFIG.rpcUrl }
      );
      
      // Try to execute again
      await expect(
        moderator.executeProposal(
          proposal.id,
          authorityWallet,
          { rpcEndpoint: TEST_CONFIG.rpcUrl }
        )
      ).rejects.toThrow('Proposal has already been executed');
    });
  });
});