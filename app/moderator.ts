import { Keypair } from '@solana/web3.js';
import { IModerator, IModeratorConfig, ProposalStatus, ICreateProposalParams } from './types/moderator.interface';
import { IExecutionConfig, IExecutionResult } from './types/execution.interface';
import { IProposal, IProposalConfig } from './types/proposal.interface';
import { Proposal } from './proposal';
import { SchedulerService } from './services/scheduler.service';

/**
 * Moderator class that manages governance proposals for the protocol
 * Handles creation, finalization, and execution of proposals
 */
export class Moderator implements IModerator {
  public config: IModeratorConfig;                         // Configuration parameters for the moderator
  public proposals: IProposal[] = [];                     // Array storing all proposals
  private proposalIdCounter: number = 0;                   // Auto-incrementing ID counter for proposals
  private scheduler: SchedulerService;                     // Scheduler for automatic tasks

  /**
   * Creates a new Moderator instance
   * @param config - Configuration object containing all necessary parameters
   */
  constructor(config: IModeratorConfig) {
    this.config = config;
    this.scheduler = SchedulerService.getInstance();
    this.scheduler.setModerator(this);
  }

  /**
   * Creates a new governance proposal
   * @param params - Parameters for creating the proposal including AMM configuration
   * @returns The newly created proposal object
   * @throws Error if proposal creation fails
   */
  async createProposal(params: ICreateProposalParams): Promise<IProposal> {
    try {
      // Create proposal config from moderator config and params
      const proposalConfig: IProposalConfig = {
        id: this.proposalIdCounter,
        description: params.description,
        transaction: params.transaction,
        createdAt: Date.now(),
        proposalLength: params.proposalLength,
        baseMint: this.config.baseMint,
        quoteMint: this.config.quoteMint,
        baseDecimals: this.config.baseDecimals,
        quoteDecimals: this.config.quoteDecimals,
        authority: this.config.authority,
        connection: this.config.connection,
        twap: params.twap,
        ammConfig: params.amm
      };
      
      // Create new proposal with config object
      const proposal = new Proposal(proposalConfig);
      
      // Initialize the proposal (blockchain interactions)
      await proposal.initialize();
      
      // Store proposal at index matching its ID
      this.proposals[this.proposalIdCounter] = proposal;
      this.proposalIdCounter++;  // Increment counter for next proposal
      
      // Schedule automatic TWAP cranking (every minute)
      this.scheduler.scheduleTWAPCranking(proposal.id, 60000);
      
      // Schedule automatic finalization 1 second after the proposal's end time
      // This buffer ensures all TWAP data is collected and avoids race conditions
      this.scheduler.scheduleProposalFinalization(proposal.id, proposal.finalizedAt + 1000);
      
      return proposal;
    } catch (error) {
      console.error(`Failed to create proposal #${this.proposalIdCounter}:`, error);
      throw error;
    }
  }

  /**
   * Finalizes a proposal after the voting period has ended
   * Determines if proposal passed or failed based on votes
   * @param id - The ID of the proposal to finalize
   * @returns The status of the proposal after finalization
   * @throws Error if proposal with given ID doesn't exist
   */
  async finalizeProposal(id: number): Promise<ProposalStatus> {
    if (id >= this.proposalIdCounter || !this.proposals[id]) {
      throw new Error(`Proposal with ID ${id} does not exist`);
    }

    const proposal = this.proposals[id];
    
    if (proposal.status === ProposalStatus.Uninitialized) {
      throw new Error(`Proposal #${id} is not initialized - cannot finalize`);
    }
    
    if (proposal.status === ProposalStatus.Failed || proposal.status === ProposalStatus.Executed) {
      return proposal.status;
    }
    
    return await proposal.finalize();
  }

  /**
   * Executes the transaction of a passed proposal
   * Only callable for proposals with Passed status
   * @param id - The ID of the proposal to execute
   * @param signer - Keypair to sign the transaction
   * @param executionConfig - Configuration for execution
   * @returns Execution result with signature and status
   * @throws Error if proposal doesn't exist, is pending, already executed, or failed
   */
  async executeProposal(
    id: number,
    signer: Keypair,
    executionConfig: IExecutionConfig
  ): Promise<IExecutionResult> {
    if (id >= this.proposalIdCounter || !this.proposals[id]) {
      throw new Error(`Proposal with ID ${id} does not exist`);
    }

    const proposal = this.proposals[id];
    
    switch (proposal.status) {
      case ProposalStatus.Uninitialized:
        throw new Error(`Proposal #${id} is not initialized - cannot execute`);
      
      case ProposalStatus.Pending:
        throw new Error('Proposal is still pending');
      
      case ProposalStatus.Failed:
        throw new Error('Proposal has failed');
      
      case ProposalStatus.Executed:
        throw new Error('Proposal has already been executed');
      
      case ProposalStatus.Passed:
        // Log proposal being executed
        console.log(`Executing proposal #${id}: "${proposal.description}"`);
        return await proposal.execute(signer, executionConfig);
      
      default:
        throw new Error(`Unknown proposal status: ${proposal.status}`);
    }
  }
}