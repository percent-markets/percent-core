import { Keypair, Connection } from '@solana/web3.js';
// Remove dotenv.config() here - it should be loaded in server.test.ts before imports

export interface TestWallets {
  authority: Keypair;
  alice: Keypair;
  bob: Keypair;
  charlie: Keypair;
}

export interface TestModeConfig {
  rpcUrl: string;
  wallets: TestWallets;
  connection: Connection;
}

/**
 * Load or generate a test wallet (reused from tests/setup/devnet.ts)
 */
function loadOrGenerateWallet(name: string): Keypair {
  // Generate deterministic wallet from seed
  const seed = new Uint8Array(32);
  const encoder = new TextEncoder();
  const nameBytes = encoder.encode(name + '-test-wallet');
  for (let i = 0; i < Math.min(nameBytes.length, 32); i++) {
    seed[i] = nameBytes[i];
  }
  return Keypair.fromSeed(seed);
}

/**
 * Get test mode configuration
 */
export function getTestModeConfig(): TestModeConfig {
  // Always use devnet RPC from .env.test for test server
  const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
  
  // Load test wallets (same as in tests/setup/devnet.ts)
  const wallets: TestWallets = {
    authority: loadOrGenerateWallet('authority'),
    alice: loadOrGenerateWallet('alice'),
    bob: loadOrGenerateWallet('bob'),
    charlie: loadOrGenerateWallet('charlie')
  };

  // Create connection with confirmed commitment
  const connection = new Connection(rpcUrl, {
    commitment: 'confirmed',
    confirmTransactionInitialTimeout: 30000
  });

  return {
    rpcUrl,
    wallets,
    connection
  };
}

/**
 * Log test mode configuration
 */
export function logTestModeInfo(config: TestModeConfig): void {
  console.log('\n🧪 TEST MODE ACTIVE');
  console.log('═══════════════════════════════════════════');
  console.log(`📡 RPC URL: ${config.rpcUrl}`);
  console.log('\n📝 Test Wallets:');
  console.log(`   Authority: ${config.wallets.authority.publicKey.toBase58()}`);
  console.log(`   Alice:     ${config.wallets.alice.publicKey.toBase58()}`);
  console.log(`   Bob:       ${config.wallets.bob.publicKey.toBase58()}`);
  console.log(`   Charlie:   ${config.wallets.charlie.publicKey.toBase58()}`);
  console.log('═══════════════════════════════════════════\n');
}