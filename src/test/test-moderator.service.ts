import { Moderator } from '../../app/moderator';
import { IModeratorConfig } from '../../app/types/moderator.interface';
import { TestModeConfig } from './config';
import { TestTokenMints } from './test-tokens.service';
import { PersistenceService } from '../../app/services/persistence.service';
import { ModeratorService } from '../services/moderator.service';

/**
 * Test implementation of ModeratorService for devnet testing
 */
class TestModeratorService {
  private static instance: Moderator | null = null;
  private static testTokenMints: TestTokenMints | null = null;
  private static testConfig: TestModeConfig | null = null;

  private constructor() {}

  /**
   * Initialize test moderator with test configuration and tokens
   */
  public static initialize(testConfig: TestModeConfig, testTokenMints: TestTokenMints): void {
    TestModeratorService.testConfig = testConfig;
    TestModeratorService.testTokenMints = testTokenMints;
    TestModeratorService.instance = null; // Reset instance to force recreation
  }

  /**
   * Get the test moderator instance
   */
  public static async getInstance(): Promise<Moderator> {
    if (!TestModeratorService.instance) {
      if (!TestModeratorService.testConfig || !TestModeratorService.testTokenMints) {
        throw new Error('TestModeratorService not initialized. Call initialize() first.');
      }

      const config: IModeratorConfig = {
        baseMint: TestModeratorService.testTokenMints.baseMint,
        quoteMint: TestModeratorService.testTokenMints.quoteMint,
        baseDecimals: TestModeratorService.testTokenMints.baseDecimals,
        quoteDecimals: TestModeratorService.testTokenMints.quoteDecimals,
        authority: TestModeratorService.testConfig.wallets.authority,
        connection: TestModeratorService.testConfig.connection,
      };

      TestModeratorService.instance = new Moderator(config);
      
      // Load proposal counter from database
      const persistenceService = PersistenceService.getInstance();
      const savedState = await persistenceService.loadModeratorState();
      if (savedState) {
        TestModeratorService.instance.proposalIdCounter = savedState.proposalCounter;
      }
      
      // Recover any pending proposals after initialization
      await ModeratorService.recoverPendingProposals(TestModeratorService.instance);
    }

    return TestModeratorService.instance;
  }

  /**
   * Reset the test moderator instance
   */
  public static reset(): void {
    TestModeratorService.instance = null;
    TestModeratorService.testTokenMints = null;
    TestModeratorService.testConfig = null;
  }

  /**
   * Get test configuration info
   */
  public static getTestInfo(): { 
    baseMint: string; 
    quoteMint: string; 
    authority: string;
    rpcUrl: string;
  } | null {
    if (!TestModeratorService.testConfig || !TestModeratorService.testTokenMints) {
      return null;
    }

    return {
      baseMint: TestModeratorService.testTokenMints.baseMint.toBase58(),
      quoteMint: TestModeratorService.testTokenMints.quoteMint.toBase58(),
      authority: TestModeratorService.testConfig.wallets.authority.publicKey.toBase58(),
      rpcUrl: TestModeratorService.testConfig.rpcUrl
    };
  }

}

export default TestModeratorService;