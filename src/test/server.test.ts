// IMPORTANT: Load test environment variables BEFORE any other imports
// that might call dotenv.config() themselves
import dotenv from 'dotenv';
dotenv.config({ path: '.env.test', override: true });

import express from 'express';
import cors from 'cors';
import routes from '../routes';
import { errorHandler } from '../middleware/errorHandler';
import TestModeratorService from './test-moderator.service';
import { getTestModeConfig, logTestModeInfo } from './config';
import { TestTokenSetupService } from './test-tokens.service';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Use same routes as production
app.use('/api', routes);

app.use(errorHandler);

/**
 * Initialize test environment
 */
const initializeTestEnvironment = async () => {
  console.log('\n🧪 INITIALIZING TEST SERVER');
  console.log('═══════════════════════════════════════════\n');

  // Get test configuration
  const testConfig = getTestModeConfig();
  
  // Log test mode information
  logTestModeInfo(testConfig);

  // Initialize test token service
  const testTokenService = new TestTokenSetupService(
    testConfig.connection,
    testConfig.wallets
  );

  try {
    // Check connection first
    const version = await testConfig.connection.getVersion();
    console.log(`✅ Connected to Solana ${version['solana-core']} (Devnet)\n`);

    // Setup test tokens and distribute to wallets
    const testMints = await testTokenService.setupTestTokens();
    
    // Check and display all balances
    await testTokenService.checkBalances(testMints.baseMint, testMints.quoteMint);
    
    // Show total supply
    await testTokenService.checkTotalSupply(testMints.baseMint, testMints.quoteMint);
    
    // Initialize test moderator service with test tokens
    TestModeratorService.initialize(testConfig, testMints);
    
    return testMints;
  } catch (error) {
    console.error('❌ Failed to initialize test environment:', error);
    throw error;
  }
};

/**
 * Start the test server
 */
const startTestServer = async () => {
  try {
    // Initialize test environment
    const testMints = await initializeTestEnvironment();
    
    // Get test moderator instance
    const moderator = await TestModeratorService.getInstance();
    
    console.log('\n✅ Test Moderator Service Initialized');
    console.log('═══════════════════════════════════════════');
    console.log(`Authority: ${moderator.config.authority.publicKey.toBase58()}`);
    console.log(`Base Mint: ${testMints.baseMint.toBase58()} (TEST-USDC)`);
    console.log(`Quote Mint: ${testMints.quoteMint.toBase58()} (TEST-SOL)`);
    console.log('═══════════════════════════════════════════\n');
    
    app.listen(PORT, () => {
      console.log(`🚀 TEST SERVER RUNNING`);
      console.log(`📡 Port: ${PORT}`);
      console.log(`🧪 Network: Solana Devnet`);
      console.log(`🔐 API Key required for protected endpoints`);
    });
  } catch (error) {
    console.error('Failed to start test server:', error);
    process.exit(1);
  }
};

// Start the test server
startTestServer();