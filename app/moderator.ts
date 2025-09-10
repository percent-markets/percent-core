import { Keypair } from '@solana/web3.js';
import { IModerator, IModeratorConfig, ProposalStatus, ICreateProposalParams } from './types/moderator.interface';
import { IExecutionConfig, IExecutionResult } from './types/execution.interface';
import { IProposal, IProposalConfig } from './types/proposal.interface';
import { Proposal } from './proposal';
import { SchedulerService } from './services/scheduler.service';
import { PersistenceService } from './services/persistence.service';

/**
 * Moderator class that manages governance proposals for the protocol
 * Handles creation, finalization, and execution of proposals
 */
export class Moderator implements IModerator {
  public config: IModeratorConfig;                         // Configuration parameters for the moderator
  private proposalCache: Map<number, IProposal> = new Map(); // In-memory cache for active proposals
  private proposalIdCounter: number = 0;                   // Auto-incrementing ID counter for proposals
  private scheduler: SchedulerService;                     // Scheduler for automatic tasks
  private persistenceService: PersistenceService;          // Database persistence service

  /**
   * Creates a new Moderator instance
   * @param config - Configuration object containing all necessary parameters
   */
  constructor(config: IModeratorConfig) {
    this.config = config;
    this.scheduler = SchedulerService.getInstance();
    this.scheduler.setModerator(this);
    this.persistenceService = PersistenceService.getInstance();
  }
  
  /**
   * Getter for proposals array (for backwards compatibility)
   * @deprecated Use getProposal() or database queries instead
   */
  get proposals(): IProposal[] {
    return Array.from(this.proposalCache.values());
  }
  
  /**
   * Setter for proposals array (for backwards compatibility with startup loading)
   * @deprecated Use cacheProposal() instead
   */
  set proposals(proposals: IProposal[]) {
    this.proposalCache.clear();
    proposals.forEach(proposal => {
      this.proposalCache.set(proposal.id, proposal);
    });
  }
  
  /**
   * Get a proposal by ID from cache (for internal operations like scheduling)
   * @param id - Proposal ID
   * @returns Promise resolving to proposal or null if not found
   */
  async getProposal(id: number): Promise<IProposal | null> {
    // Check cache first
    if (this.proposalCache.has(id)) {
      return this.proposalCache.get(id)!;
    }
    
    // Load from database and cache it for future internal operations
    const proposal = await this.persistenceService.loadProposal(id);
    if (proposal) {
      this.proposalCache.set(id, proposal);
    }
    
    return proposal;
  }
  
  /**
   * Get a proposal by ID directly from database (for API routes - always fresh)
   * @param id - Proposal ID  
   * @returns Promise resolving to proposal or null if not found
   */
  async getProposalFresh(id: number): Promise<IProposal | null> {
    return await this.persistenceService.loadProposal(id);
  }
  
  /**
   * Invalidate cached proposal (call after state changes)
   * @param id - Proposal ID to invalidate
   */
  private invalidateProposalCache(id: number): void {
    this.proposalCache.delete(id);
  }
  
  /**
   * Public method to invalidate cache (for external services like scheduler)
   * @param id - Proposal ID to invalidate
   */
  public invalidateCache(id: number): void {
    this.invalidateProposalCache(id);
  }
  
  /**
   * Cache a proposal in memory (for active operations)
   * @param proposal - Proposal to cache
   */
  private cacheProposal(proposal: IProposal): void {
    this.proposalCache.set(proposal.id, proposal);
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
      
      // Save to database FIRST (database is source of truth)
      await this.persistenceService.saveProposal(proposal);
      this.proposalIdCounter++;  // Increment counter for next proposal
      await this.persistenceService.saveModeratorState(this.proposalIdCounter, this.config);
      
      // Cache proposal for active operations
      this.cacheProposal(proposal);
      
      console.log(`Proposal #${proposal.id} created and saved to database`);
      
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
    
    const status = await proposal.finalize();
    
    // Save updated state to database (database is source of truth)
    await this.persistenceService.saveProposal(proposal);
    
    // Invalidate cache so next access gets fresh data
    this.invalidateProposalCache(id);
    
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
    const proposal = await this.getProposal(id);
    if (!proposal) {
      throw new Error(`Proposal with ID ${id} does not exist`);
    }
    
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
        const result = await proposal.execute(signer, executionConfig);
        
        // Save updated state to database (database is source of truth)
        await this.persistenceService.saveProposal(proposal);
        
        // Invalidate cache so next access gets fresh data
        this.invalidateProposalCache(id);
        
        console.log(`Proposal #${id} executed, saved to database`);
        
        return result;
      
      default:
        throw new Error(`Unknown proposal status: ${proposal.status}`);
    }
  }
}