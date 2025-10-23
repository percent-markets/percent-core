import { Keypair } from '@solana/web3.js';
import { IModerator, IModeratorConfig, IModeratorInfo, ProposalStatus, ICreateProposalParams } from './types/moderator.interface';
import { IExecutionConfig, IExecutionResult, PriorityFeeMode, Commitment, ExecutionStatus } from './types/execution.interface';
import { IProposal, IProposalConfig } from './types/proposal.interface';
import { Proposal } from './proposal';
import { SchedulerService } from './services/scheduler.service';
import { PersistenceService } from './services/persistence.service';
import { ExecutionService } from './services/execution.service';
import { LoggerService } from '../src/services/logger.service';
import { getNetworkFromConnection} from './utils/network';
//import { BlockEngineUrl, JitoService } from '@slateos/jito';

/**
 * Moderator class that manages governance proposals for the protocol
 * Handles creation, finalization, and execution of proposals
 */
export class Moderator implements IModerator {
  public id: number;                                       // Moderator ID
  public protocolName?: string;                            // Protocol name (optional)
  public config: IModeratorConfig;                         // Configuration parameters for the moderator
  public scheduler: SchedulerService;                     // Scheduler for automatic tasks
  private persistenceService: PersistenceService;          // Database persistence service
  private executionService: ExecutionService;              // Execution service for transactions
  private logger: LoggerService;                           // Logger service for this moderator
  //private jitoService?: JitoService;                       // Jito service @deprecated

  /**
   * Creates a new Moderator instance
   * @param id - Moderator ID
   * @param protocolName - Name of the protocol (optional)
   * @param config - Configuration object containing all necessary parameters
   */
  constructor(id: number, protocolName: string | undefined, config: IModeratorConfig) {
    this.id = id;
    this.protocolName = protocolName;
    this.config = config;

    // Create connection from config
    const commitment: Commitment = config.commitment || Commitment.Confirmed;

    this.scheduler = SchedulerService.getInstance();
    this.scheduler.setModerator(this);
    this.persistenceService = PersistenceService.getInstance();

    // Initialize execution service with default config
    const executionConfig: IExecutionConfig = {
      rpcEndpoint: this.config.rpcEndpoint,
      commitment: commitment,
      maxRetries: 3,
      skipPreflight: false,
      priorityFeeMode: PriorityFeeMode.Dynamic
    };

    // Initialize logger with a category based on protocol name and moderator ID
    this.logger = LoggerService.getInstance(`moderator-${protocolName || id}`);
    this.logger.info('Moderator initialized', {
      moderatorId: id,
      protocolName: protocolName,
    });

    this.executionService = new ExecutionService(executionConfig, this.logger);

    /** @deprecated */
    // if (this.config.jitoUuid) {
    //   this.jitoService = new JitoService(BlockEngineUrl.MAINNET, this.config.jitoUuid);
    // }
  }

  /**
   * Returns a JSON object with all moderator configuration and state information
   * @returns Object containing moderator info
   */
  async info(): Promise<IModeratorInfo> {
    const info: IModeratorInfo = {
      id: this.id,
      protocolName: this.protocolName,
      proposalIdCounter: await this.persistenceService.getProposalIdCounter(),
      baseToken: {
        mint: this.config.baseMint.toBase58(),
        decimals: this.config.baseDecimals
      },
      quoteToken: {
        mint: this.config.quoteMint.toBase58(),
        decimals: this.config.quoteDecimals
      },
      authority: this.config.authority.publicKey.toBase58(),
      network: {
        rpcEndpoint: this.config.rpcEndpoint,
        type: getNetworkFromConnection(this.executionService.connection)
      }
    };

    return info;
  }

  /**
   * Getter for the current proposal ID counter
   */
  async getProposalIdCounter(): Promise<number> {
    return await this.persistenceService.getProposalIdCounter();
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
    const proposalIdCounter = await this.getProposalIdCounter();
    try {
      this.logger.info('Creating proposal');
      // Create proposal config from moderator config and params
      const proposalConfig: IProposalConfig = {
        id: proposalIdCounter,
        moderatorId: this.id,
        title: params.title,
        description: params.description,
        transaction: params.transaction,
        createdAt: Date.now(),
        proposalLength: params.proposalLength,
        baseMint: this.config.baseMint,
        quoteMint: this.config.quoteMint,
        baseDecimals: this.config.baseDecimals,
        quoteDecimals: this.config.quoteDecimals,
        authority: this.config.authority,
        executionService: this.executionService,
        spotPoolAddress: params.spotPoolAddress,
        totalSupply: params.totalSupply,
        twap: params.twap,
        ammConfig: params.amm,
        logger: this.logger.createChild(`proposal-${proposalIdCounter}`),
      };

      // Create new proposal with config object
      const proposal = new Proposal(proposalConfig);

      // Initialize the proposal
      await proposal.initialize();
      
      // Save to database FIRST (database is source of truth)
      await this.saveProposal(proposal);
      await this.persistenceService.saveModeratorState(proposalIdCounter + 1, this.config);
      
      this.logger.info('Proposal initialized and saved');
      
      // Schedule automatic TWAP cranking (every minute)
      this.scheduler.scheduleTWAPCranking(proposalIdCounter, params.twap.minUpdateInterval);

      // Also schedule price recording for this proposal
      this.scheduler.schedulePriceRecording(proposalIdCounter, 5000); // 5 seconds

      // Schedule spot price recording if spot pool address is provided
      if (params.spotPoolAddress) {
        this.scheduler.scheduleSpotPriceRecording(proposalIdCounter, params.spotPoolAddress, 60000); // 1 minute
        this.logger.info('Scheduled spot price recording', { spotPoolAddress: params.spotPoolAddress });
      }

      // Schedule automatic finalization 1 second after the proposal's end time
      // This buffer ensures all TWAP data is collected and attempts to avoid race conditions
      this.scheduler.scheduleProposalFinalization(proposalIdCounter, proposal.finalizedAt + 1000);
      this.logger.info('Scheduled proposal finalization', { finalizedAt: proposal.finalizedAt });

      return proposal;
    } catch (error) {
      this.logger.error('Failed to create proposal', {
        error: error instanceof Error ? error.message : String(error)
      });
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
    this.logger.info('Finalizing proposal');
    const proposal = await this.getProposal(id);
    if (!proposal) {
      throw new Error(`Proposal with ID ${id} does not exist`);
    }

    const status = await proposal.finalize();
    await this.saveProposal(proposal);
    if (status === ProposalStatus.Passed) {
      this.logger.info('Proposal finalized and passed');
    } else if (status === ProposalStatus.Failed) {
      this.logger.info('Proposal finalized and failed');
    } else {
      this.logger.warn('Proposal failed to finalize', { status: status });
    }
    return status;
  }

  /**
   * Executes the transaction of a passed proposal
   * Only callable for proposals with Passed status
   * @param id - The ID of the proposal to execute
   * @param signer - Keypair to sign the transaction
   * @returns Execution result with signature and status
   * @throws Error if proposal doesn't exist, is pending, already executed, or failed
   */
  async executeProposal(
    id: number,
    signer: Keypair
  ): Promise<IExecutionResult> {
    this.logger.info('Executing proposal');

    try {
      // Get proposal from cache or database
      const proposal = await this.getProposal(id);
      if (!proposal) {
        throw new Error(`Proposal with ID ${id} does not exist`);
      }

      // Only Passed status can be executed
      if (proposal.status !== ProposalStatus.Passed) {
        throw new Error(`Cannot execute proposal #${id}: status is ${proposal.status}`);
      }

      const result = await proposal.execute(signer);

      // Always save state to database
      await this.saveProposal(proposal);

      if (result.status === ExecutionStatus.Failed) {
        this.logger.error('Proposal execution failed', { result: result });
        throw new Error(`Failed to execute proposal #${id}: ${result.error}`);
      }

      this.logger.info('Proposal executed successfully', { result: result });

      return result;
    } catch (error) {
      this.logger.error('Failed to execute proposal', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
}