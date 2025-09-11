import { Moderator } from '../../app/moderator';
import { IModeratorConfig, ProposalStatus } from '../../app/types/moderator.interface';
import { PublicKey, Keypair, Connection } from '@solana/web3.js';
import fs from 'fs';
import TestModeratorService from '../test/test-moderator.service';
import { PersistenceService } from '../../app/services/persistence.service';
import { SchedulerService } from '../../app/services/scheduler.service';

class ModeratorService {
  private static instance: Moderator | null = null;
  private static isInitialized: boolean = false;

  private constructor() {}

  public static async getInstance(): Promise<Moderator> {
    if (!ModeratorService.instance) {
      await ModeratorService.initialize();
    }
    
    return ModeratorService.instance!;
  }

  private static async initialize(): Promise<void> {
    if (ModeratorService.isInitialized) {
      return;
    }

    const persistenceService = PersistenceService.getInstance();
    
    try {      
      // Try to load state from database
      const savedState = await persistenceService.loadModeratorState();
      
      if (savedState) {
        console.log('Loading moderator state from database...');
        ModeratorService.instance = new Moderator(savedState.config);
        
        // Load proposal counter from database
        ModeratorService.instance.proposalIdCounter = savedState.proposalCounter;
        
        console.log(`Loaded moderator state with proposal counter ${savedState.proposalCounter}`);
      } else {
        console.log('No saved state found, initializing new moderator...');
        
        // Create new moderator with default config
        const keypairPath = process.env.SOLANA_KEYPAIR_PATH || './wallet.json';
        const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
        
        if (!fs.existsSync(keypairPath)) {
          throw new Error(`Keypair file not found at ${keypairPath}`);
        }
        
        const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf-8'));
        const authority = Keypair.fromSecretKey(new Uint8Array(keypairData));
        
        const config: IModeratorConfig = {
          baseMint: new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'), // USDC
          quoteMint: new PublicKey('So11111111111111111111111111111111111111112'), // Wrapped SOL
          baseDecimals: 6,
          quoteDecimals: 9,
          authority,
          connection: new Connection(rpcUrl, 'confirmed'),
        };
        
        ModeratorService.instance = new Moderator(config);
        
        // Save initial state to database
        await persistenceService.saveModeratorState(0, config);
      }
      
      // Recover any pending proposals after initialization
      await ModeratorService.recoverPendingProposals(ModeratorService.instance!);
      
      ModeratorService.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize moderator service:', error);
      throw error;
    }
  }

  /**
   * Recovers pending proposals after server restart
   * Finalizes overdue proposals and reschedules tasks for active ones
   * @param moderator - The moderator instance to recover proposals for
   */
  public static async recoverPendingProposals(moderator: Moderator): Promise<void> {
    const persistenceService = PersistenceService.getInstance();
    const scheduler = SchedulerService.getInstance();
    
    try {
      console.log('Recovering pending proposals...');
      
      // Load all proposals from database
      const proposals = await persistenceService.loadAllProposals();
      
      let recoveredCount = 0;
      let finalizedCount = 0;
      let rescheduledCount = 0;
      
      for (const proposal of proposals) {
        const now = Date.now();
        
        if (proposal.status === ProposalStatus.Pending) {
          if (now >= proposal.finalizedAt) {
            // Proposal should have been finalized
            console.log(`Finalizing overdue proposal #${proposal.id}`);
            try {
              await moderator.finalizeProposal(proposal.id);
              finalizedCount++;
            } catch (error) {
              console.error(`Failed to finalize overdue proposal #${proposal.id}:`, error);
            }
          } else {
            // Proposal is still active, reschedule tasks
            console.log(`Rescheduling tasks for active proposal #${proposal.id}`);
            
            // Schedule TWAP cranking (default 1 minute interval)
            scheduler.scheduleTWAPCranking(proposal.id, 60000);
            
            // Schedule finalization 1 second after the proposal's end time
            scheduler.scheduleProposalFinalization(proposal.id, proposal.finalizedAt + 1000);
            
            rescheduledCount++;
          }
          recoveredCount++;
        }
      }
      
      if (recoveredCount > 0) {
        console.log(`Recovery complete: ${recoveredCount} pending proposals processed`);
        console.log(`  - ${finalizedCount} overdue proposals finalized`);
        console.log(`  - ${rescheduledCount} active proposals rescheduled`);
      } else {
        console.log('No pending proposals found to recover');
      }
    } catch (error) {
      console.error('Failed to recover pending proposals:', error);
      // Don't throw - allow server to continue even if recovery fails
    }
  }

  public static reset(): void {
    ModeratorService.instance = null;
  }
}

/**
 * Provides the appropriate moderator instance based on environment
 */
export async function getModerator(): Promise<Moderator> {
  // Check if test moderator is initialized (happens in test server)
  try {
    return await TestModeratorService.getInstance();
  } catch {
    // Fall back to production moderator
    return await ModeratorService.getInstance();
  }
}

// Export recovery function for external use
export { ModeratorService };
export default ModeratorService;