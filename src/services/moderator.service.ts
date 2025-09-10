import { Moderator } from '../../app/moderator';
import { IModeratorConfig } from '../../app/types/moderator.interface';
import { PublicKey, Keypair, Connection } from '@solana/web3.js';
import fs from 'fs';
import TestModeratorService from '../test/test-moderator.service';
import { PersistenceService } from '../../app/services/persistence.service';

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
      // Run migrations first
      await persistenceService.runMigrations();
      
      // Try to load state from database
      const savedState = await persistenceService.loadModeratorState();
      
      if (savedState) {
        console.log('Loading moderator state from database...');
        ModeratorService.instance = new Moderator(savedState.config);
        
        // Load all proposals from database
        const proposals = await persistenceService.loadAllProposals();
        ModeratorService.instance.proposals = proposals;
        (ModeratorService.instance as any).proposalIdCounter = savedState.proposalCounter;
        
        console.log(`Loaded ${proposals.length} proposals from database`);
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
      
      ModeratorService.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize moderator service:', error);
      throw error;
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

export default ModeratorService;