import { Transaction, PublicKey, Keypair } from '@solana/web3.js';
import { IModerator, IModeratorConfig, ProposalStatus, ICreateProposalParams } from './types/moderator.interface';
import { IExecutionConfig, IExecutionResult } from './types/execution.interface';
import { IProposal, IProposalConfig } from './types/proposal.interface';
import { Proposal } from './proposal';

/**
 * Moderator class that manages governance proposals for the protocol
 * Handles creation, finalization, and execution of proposals
 */
export class Moderator implements IModerator {
  public config: IModeratorConfig;                         // Configuration parameters for the moderator
  public proposals: IProposal[] = [];                     // Array storing all proposals
  private proposalIdCounter: number = 0;                   // Auto-incrementing ID counter for proposals

  /**
   * Creates a new Moderator instance
   * @param config - Configuration object containing all necessary parameters
   */
  constructor(config: IModeratorConfig) {
    this.config = config;
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
        twapMaxObservationChangePerUpdate: this.config.twapMaxObservationChangePerUpdate,
        twapStartDelay: this.config.twapStartDelay,
        passThresholdBps: params.passThresholdBps,
        ammConfig: params.amm
      };
      
      // Create new proposal with config object
      const proposal = new Proposal(proposalConfig);
      
      // Initialize the proposal (blockchain interactions)
      //await proposal.initialize();
      
      // Store proposal at index matching its ID
      this.proposals[this.proposalIdCounter] = proposal;
      this.proposalIdCounter++;  // Increment counter for next proposal
      
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
    
    if (proposal.status === ProposalStatus.Pending) {
      throw new Error('Proposal has not passed');
    }
    
    if (proposal.status === ProposalStatus.Executed) {
      throw new Error('Proposal has already been executed');
    }
    
    if (proposal.status === ProposalStatus.Failed) {
      throw new Error('Proposal has not passed');
    }

    // Log proposal being executed
    console.log(`Executing proposal #${id}: "${proposal.description}"`);
    
    return await proposal.execute(signer, executionConfig);
  }
}