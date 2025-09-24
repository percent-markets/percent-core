import { Keypair } from '@solana/web3.js';
import { IModerator, IModeratorConfig, ProposalStatus, ICreateProposalParams } from './types/moderator.interface';
import { IExecutionConfig, IExecutionResult } from './types/execution.interface';
import { IProposal, IProposalConfig } from './types/proposal.interface';
import { Proposal } from './proposal';
import { SchedulerService } from './services/scheduler.service';
import { PersistenceService } from './services/persistence.service';
import { getNetworkFromConnection, Network } from './utils/network';
import { BlockEngineUrl, JitoService } from '@slateos/jito';
import { ExecutionService } from './services/execution.service';

/**
 * Moderator class that manages governance proposals for the protocol
 * Handles creation, finalization, and execution of proposals
 */
export class Moderator implements IModerator {
  public config: IModeratorConfig;                         // Configuration parameters for the moderator
  private _proposalIdCounter: number = 0;                  // Auto-incrementing ID counter for proposals
  private scheduler: SchedulerService;                     // Scheduler for automatic tasks
  private persistenceService: PersistenceService;          // Database persistence service
  private jitoService?: JitoService;

  /**
   * Creates a new Moderator instance
   * @param config - Configuration object containing all necessary parameters
   */
  constructor(config: IModeratorConfig) {
    this.config = config;
    this.scheduler = SchedulerService.getInstance();
    this.scheduler.setModerator(this);
    this.persistenceService = PersistenceService.getInstance();
    if (this.config.jitoUuid) {
      this.jitoService = new JitoService(BlockEngineUrl.MAINNET, this.config.jitoUuid);
    }
  }
  
  /**
   * Getter for the current proposal ID counter
   */
  get proposalIdCounter(): number {
    return this._proposalIdCounter;
  }
  
  /**
   * Setter for proposal ID counter (for loading from database)
   */
  set proposalIdCounter(value: number) {
    this._proposalIdCounter = value;
  }
  
  /**
   * Get a proposal by ID from database (always fresh data)
   * @param id - Proposal ID
   * @returns Promise resolving to proposal or null if not found
   */
  async getProposal(id: number): Promise<IProposal | null> {
    return await this.persistenceService.loadProposal(id);
  }
  
  /**
   * Save a proposal to the database
   * @param proposal - The proposal to save
   */
  async saveProposal(proposal: IProposal): Promise<void> {
    await this.persistenceService.saveProposal(proposal);
  }

  /**
   * Creates a new governance proposal
   * @param params - Parameters for creating the proposal including AMM configuration
   * @returns The newly created proposal object
   * @throws Error if proposal creation fails
   */
  async createProposal(params: ICreateProposalParams): Promise<IProposal> {
    try {
      console.log(`Creating proposal #${this._proposalIdCounter} ...`);
      // Create proposal config from moderator config and params
      const proposalConfig: IProposalConfig = {
        id: this._proposalIdCounter,
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
        ammConfig: params.amm,
      };

      // Create new proposal with config object
      const proposal = new Proposal(proposalConfig);

      // Initialize the proposal (use Jito bundles on mainnet if UUID provided)
      const network = getNetworkFromConnection(this.config.connection);
      if (network === Network.MAINNET && this.config.jitoUuid) {
        console.log(`Initializing proposal on ${network} using Jito ...`);
        await proposal.initializeViaBundle(this.jitoService!);
      } else {
        console.log(`Initializing proposal on ${network} ...`);
        await proposal.initialize();
      }
      
      // Save to database FIRST (database is source of truth)
      await this.saveProposal(proposal);
      this._proposalIdCounter++;  // Increment counter for next proposal
      await this.persistenceService.saveModeratorState(this._proposalIdCounter, this.config);
      
      
      console.log(`Proposal #${proposal.id} created and saved to database`);
      
      // Schedule automatic TWAP cranking (every minute)
      this.scheduler.scheduleTWAPCranking(proposal.id, params.twap.minUpdateInterval);

      // Also schedule price recording for this proposal
      this.scheduler.schedulePriceRecording(proposal.id, 5000); // 5 seconds
      
      // Schedule automatic finalization 1 second after the proposal's end time
      // This buffer ensures all TWAP data is collected and avoids race conditions
      this.scheduler.scheduleProposalFinalization(proposal.id, proposal.finalizedAt + 1000);
      
      return proposal;
    } catch (error) {
      console.error(`Failed to create proposal #${this._proposalIdCounter}:`, error);
      throw error;
    }
  }

  /**
   * Finalizes a proposal after the voting period has ended
   * Determines if proposal passed or failed based on votes
   * Uses Jito bundles on mainnet if UUID is configured
   * @param id - The ID of the proposal to finalize
   * @returns The status of the proposal after finalization
   * @throws Error if proposal with given ID doesn't exist
   */
  async finalizeProposal(id: number): Promise<ProposalStatus> {
    // Get proposal from cache or database
    const proposal = await this.getProposal(id);
    if (!proposal) {
      throw new Error(`Proposal with ID ${id} does not exist`);
    }

    if (proposal.status === ProposalStatus.Uninitialized) {
      throw new Error(`Proposal #${id} is not initialized - cannot finalize`);
    }

    if (proposal.status === ProposalStatus.Failed || proposal.status === ProposalStatus.Executed) {
      return proposal.status;
    }

    // Finalize using Jito bundles on mainnet if UUID provided, otherwise use regular finalization
    const network = getNetworkFromConnection(this.config.connection);
    let status: ProposalStatus;

    if (network === Network.MAINNET && this.config.jitoUuid) {
      console.log(`Finalizing proposal #${id} on mainnet using Jito bundles (UUID: ${this.config.jitoUuid})`);
      status = await proposal.finalizeViaBundle(this.jitoService!);
    } else {
      console.log(`Finalizing proposal #${id} on ${network} using regular transactions`);
      status = await proposal.finalize();
    }

    // Save updated state to database (database is source of truth)
    await this.persistenceService.saveProposal(proposal);

    console.log(`Proposal #${id} finalized with status ${status}, saved to database`);

    return status;
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
    // Get proposal from cache or database
    console.log(`Executing proposal #${id} ...`);
    const proposal = await this.getProposal(id);
    if (!proposal) {
      throw new Error(`Proposal with ID ${id} does not exist`);
    }
    
    switch (proposal.status) {
      case ProposalStatus.Uninitialized:
        throw new Error(`Proposal ${id} is not initialized - cannot execute`);
      
      case ProposalStatus.Pending:
        throw new Error(`Proposal ${id} is still pending`);
      
      case ProposalStatus.Failed:
        throw new Error(`Proposal ${id} has failed`);
      
      case ProposalStatus.Executed:
        throw new Error(`Proposal ${id} has already been executed`);
      
      case ProposalStatus.Passed:
        // Log proposal being executed
        console.log(`Executing proposal #${id}: "${proposal.description}"`);
        const result = await proposal.execute(signer, executionConfig);
        
        // Save updated state to database (database is source of truth)
        await this.saveProposal(proposal);
        
        
        console.log(`Proposal #${id} executed`);
        
        return result;
      
      default:
        throw new Error(`Unknown proposal status: ${proposal.status} for proposal ${id}`);
    }
  }
}