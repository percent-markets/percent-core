import { Moderator } from '../moderator';
import { IModeratorConfig, ProposalStatus } from '../types/moderator.interface';
import { IRouterService } from '../types/router.interface';
import { PublicKey, Keypair } from '@solana/web3.js';
import fs from 'fs';
import { PersistenceService } from './persistence.service';
import { SchedulerService } from './scheduler.service';
import { LoggerService } from './logger.service';
import { getPool } from '../utils/database';

/**
 * RouterService manages multiple moderators by ID
 * This is the main service that handles all moderator operations
 */
export class RouterService implements IRouterService {
  private static instance: RouterService | null = null;
  public moderators: Map<number, Moderator> = new Map();
  private logger: LoggerService;

  private constructor() {
    this.logger = new LoggerService('ROUTER');
  }

  /**
   * Get singleton instance of RouterService
   */
  public static getInstance(): RouterService {
    if (!RouterService.instance) {
      RouterService.instance = new RouterService();
    }
    return RouterService.instance;
  }

  /**
   * Load all moderators from the database
   */
  public async loadModerators(): Promise<void> {
    const pool = getPool();

    try {
      this.logger.info('Loading moderators from database...');

      // Query for all moderator IDs
      const result = await pool.query<{ id: number }>('SELECT id FROM moderator_state');

      // Load each moderator
      for (const row of result.rows) {
        const moderatorId = row.id;

        try {
          const loaded = await this.loadModeratorFromDB(moderatorId);
          if (loaded) {
            this.logger.info(`Loaded moderator ${moderatorId} successfully`);
          }
        } catch (error) {
          this.logger.error(`Failed to load moderator ${moderatorId}:`, error);
        }
      }

      this.logger.info(`Loaded ${this.moderators.size} moderator(s)`);
    } catch (error) {
      this.logger.error('Failed to load moderators:', error);
      throw error;
    }
  }

  /**
   * Load a specific moderator from the database
   * @param moderatorId - The ID of the moderator to load
   * @returns true if successful, false otherwise
   */
  private async loadModeratorFromDB(moderatorId: number): Promise<boolean> {
    const persistenceService = new PersistenceService(moderatorId);
    const savedState = await persistenceService.loadModeratorState();

    if (savedState) {
      this.logger.info(`Using saved moderator state for moderator ${moderatorId} with proposal counter:`, savedState.proposalCounter);
      const moderator = new Moderator(moderatorId, savedState.protocolName, savedState.config);
      this.moderators.set(moderatorId, moderator);
      return true;
    } else {
      this.logger.error(`No moderator state found for moderator ${moderatorId}`);
      return false;
    }
  }

  /**
   * Create a new moderator
   * @param baseMint - The base token mint address
   * @param quoteMint - The quote token mint address
   * @param baseDecimals - Decimals for base token
   * @param quoteDecimals - Decimals for quote token
   * @param protocolName - Optional protocol name
   * @param authority - Optional authority keypair (will load from env if not provided)
   * @returns The newly created moderator and its ID
   */
  public async createModerator(
    baseMint: PublicKey,
    quoteMint: PublicKey,
    baseDecimals: number,
    quoteDecimals: number,
    protocolName?: string,
    authority?: Keypair
  ): Promise<{ moderator: Moderator; id: number }> {
    const pool = getPool();

    try {
      // Get the next available ID
      const idResult = await pool.query<{ max: number }>(
        'SELECT COALESCE(MAX(id), 0) as max FROM moderator_state'
      );
      const nextId = (idResult.rows[0]?.max || 0) + 1;

      this.logger.info(`Creating new moderator with ID ${nextId}`);

      // Load authority if not provided
      if (!authority) {
        const keypairPath = process.env.SOLANA_KEYPAIR_PATH || './wallet.json';
        if (!fs.existsSync(keypairPath)) {
          throw new Error(`Keypair file not found at ${keypairPath}`);
        }

        const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf-8'));
        authority = Keypair.fromSecretKey(new Uint8Array(keypairData));
      }

      // Create config
      const rpcUrl = process.env.SOLANA_RPC_URL || 'https://bernie-zo3q7f-fast-mainnet.helius-rpc.com';
      const config: IModeratorConfig = {
        baseMint,
        quoteMint,
        baseDecimals,
        quoteDecimals,
        authority,
        rpcEndpoint: rpcUrl,
      };

      // Create moderator instance
      const moderator = new Moderator(nextId, protocolName, config);

      // Save initial state to database (start with proposal counter at 0)
      await moderator.persistenceService.saveModeratorState(0, config, protocolName);

      // Add to our map
      this.moderators.set(nextId, moderator);

      this.logger.info(`Created new moderator with ID ${nextId}`, {
        protocolName,
        baseMint: baseMint.toBase58(),
        quoteMint: quoteMint.toBase58()
      });

      return { moderator, id: nextId };
    } catch (error) {
      this.logger.error('Failed to create moderator:', error);
      throw error;
    }
  }

  /**
   * Recovers pending proposals after server restart for all moderators
   * Finalizes overdue proposals and reschedules tasks for active ones
   */
  public async recoverPendingProposals(): Promise<void> {
    this.logger.info('Starting recovery of pending proposals for all moderators...');

    for (const [moderatorId, moderator] of this.moderators) {
      try {
        await this.recoverModeratorProposals(moderatorId, moderator);
      } catch (error) {
        this.logger.error(`Failed to recover proposals for moderator ${moderatorId}:`, error);
        // Continue with other moderators even if one fails
      }
    }

    this.logger.info('Completed recovery of pending proposals');
  }

  /**
   * Recovers pending proposals for a specific moderator
   * @param moderatorId - The ID of the moderator
   * @param moderator - The moderator instance
   */
  private async recoverModeratorProposals(moderatorId: number, moderator: Moderator): Promise<void> {
    const scheduler = SchedulerService.getInstance();
    const persistenceService = new PersistenceService(moderatorId);

    try {
      this.logger.info(`Recovering pending proposals for moderator ${moderatorId}...`);

      // Load all proposals from database for this moderator
      const proposals = await persistenceService.loadAllProposals();

      let recoveredCount = 0;
      let finalizedCount = 0;
      let rescheduledCount = 0;

      for (const proposal of proposals) {
        const now = Date.now();

        if (proposal.status === ProposalStatus.Pending) {
          if (now >= proposal.finalizedAt) {
            // Proposal should have been finalized
            this.logger.info(`Finalizing overdue proposal #${proposal.config.id} for moderator ${moderatorId}`);
            try {
              await moderator.finalizeProposal(proposal.config.id);
              finalizedCount++;
            } catch (error) {
              this.logger.error(`Failed to finalize overdue proposal #${proposal.config.id}:`, error);
            }
          } else {
            // Proposal is still active, reschedule tasks
            this.logger.info(`Rescheduling tasks for active proposal #${proposal.config.id} for moderator ${moderatorId}`);

            // Schedule price recording (every 5 seconds)
            scheduler.schedulePriceRecording(proposal.config.id, 5000);

            // Schedule TWAP cranking (default 1 minute interval)
            scheduler.scheduleTWAPCranking(proposal.config.id, 60000);

            // Schedule spot price recording if spot pool address exists
            if (proposal.config.spotPoolAddress) {
              scheduler.scheduleSpotPriceRecording(proposal.config.id, proposal.config.spotPoolAddress, 60000);
              this.logger.info(`Scheduled spot price recording for proposal #${proposal.config.id}`);
            }

            // Schedule finalization 1 second after the proposal's end time
            scheduler.scheduleProposalFinalization(proposal.config.id, proposal.finalizedAt + 1000);

            rescheduledCount++;
          }
          recoveredCount++;
        }
      }

      if (recoveredCount > 0) {
        this.logger.info(`Recovery complete for moderator ${moderatorId}: ${recoveredCount} pending proposals processed`, {
          finalizedCount,
          rescheduledCount
        });
      } else {
        this.logger.info(`No pending proposals found to recover for moderator ${moderatorId}`);
      }
    } catch (error) {
      this.logger.error(`Failed to recover pending proposals for moderator ${moderatorId}:`, error);
      // Don't throw - allow server to continue even if recovery fails
    }
  }

  /**
   * Get a moderator by ID
   * @param moderatorId - The ID of the moderator
   * @returns The moderator or null if not found
   */
  public getModerator(moderatorId: number): Moderator | null {
    return this.moderators.get(moderatorId) || null;
  }

  /**
   * Get all loaded moderators
   * @returns Map of all moderators keyed by ID
   */
  public getAllModerators(): Map<number, Moderator> {
    return this.moderators;
  }

  /**
   * Refresh the router service by reloading all moderators from database
   * This will clear the current moderators and reload them fresh
   */
  public async refresh(): Promise<void> {
    this.logger.info('Refreshing router service - reloading all moderators...');

    // Clear current moderators
    this.moderators.clear();

    // Reload all moderators
    await this.loadModerators();

    // Recover pending proposals for all loaded moderators
    await this.recoverPendingProposals();

    this.logger.info('Router service refresh complete');
  }
}

export default RouterService;