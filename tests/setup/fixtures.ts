import { PublicKey, Transaction, Keypair, Connection } from '@solana/web3.js';
import { createMemoInstruction } from '@solana/spl-memo';
import { IModeratorConfig } from '../../app/types/moderator.interface';

/**
 * Standard test token configurations
 */
export const TEST_TOKENS = {
  // SOL-like token with 9 decimals
  SOL: {
    decimals: 9,
    symbol: 'tSOL',
    name: 'Test SOL'
  },
  // Custom token for testing
  TEST_TOKEN: {
    decimals: 6,
    symbol: 'TEST',
    name: 'Test Token'
  }
};

/**
 * Standard test amounts in base units
 */
export const TEST_AMOUNTS = {
  // Token amounts (accounting for decimals)
  SMALL: BigInt(100),
  MEDIUM: BigInt(1000),
  LARGE: BigInt(10000),
  
  // Lamports for SOL (REDUCED for devnet limits)
  ONE_SOL: BigInt(1_000_000_000),
  TENTH_SOL: BigInt(100_000_000),  // 0.1 SOL - USE THIS!
  MIN_SOL: BigInt(10_000_000),     // 0.01 SOL 
  MIN_RENT: BigInt(2_039_280),     // Minimum rent for token account
};

/**
 * Test time periods (in seconds)
 */
export const TEST_PERIODS = {
  INSTANT: 1,        // 1 second for quick tests
  SHORT: 5,          // 5 seconds
  MEDIUM: 30,        // 30 seconds
  LONG: 60,          // 1 minute
  VOTING_PERIOD: 10, // 10 seconds for proposal voting
};

/**
 * Create a standard test moderator configuration
 * NOTE: Caller must provide authority and connection through overrides
 */
export function createTestModeratorConfig(
  baseMint: PublicKey,
  quoteMint: PublicKey,
  authority: Keypair,
  connection: Connection,
  overrides?: Partial<IModeratorConfig>
): IModeratorConfig {
  return {
    baseMint,
    quoteMint,
    baseDecimals: 6,  // Standard for base tokens (memecoins/USDC)
    quoteDecimals: 9, // Standard for quote tokens (SOL)
    authority,
    connection,
    proposalLength: TEST_PERIODS.VOTING_PERIOD,
    twapMaxObservationChangePerUpdate: BigInt(100),
    twapStartDelay: 0,
    passThresholdBps: 5000, // 50%
    ...overrides
  };
}

/**
 * Create a simple test transaction with memo
 */
export function createTestTransaction(message: string = 'Test transaction'): Transaction {
  const tx = new Transaction();
  tx.add(createMemoInstruction(message, []));
  return tx;
}

/**
 * Generate test proposal data
 */
export function generateProposalData(index: number = 0) {
  return {
    description: `Test Proposal #${index}`,
    transaction: createTestTransaction(`Proposal #${index} execution`),
    votingPeriod: TEST_PERIODS.VOTING_PERIOD
  };
}

/**
 * Test wallet configurations
 */
export const TEST_WALLETS = {
  alice: {
    name: 'Alice',
    initialBalance: TEST_AMOUNTS.ONE_SOL * BigInt(10), // 10 SOL
    tokenBalance: BigInt(1000_000_000) // 1000 tokens with 6 decimals
  },
  bob: {
    name: 'Bob', 
    initialBalance: TEST_AMOUNTS.ONE_SOL * BigInt(10), // 10 SOL
    tokenBalance: BigInt(1000_000_000) // 1000 tokens with 6 decimals
  },
  charlie: {
    name: 'Charlie',
    initialBalance: TEST_AMOUNTS.ONE_SOL * BigInt(5), // 5 SOL
    tokenBalance: BigInt(500_000_000) // 500 tokens with 6 decimals
  }
};

/**
 * Vault test configurations
 */
export const VAULT_TEST_CONFIG = {
  splitAmounts: [
    TEST_AMOUNTS.SMALL,
    TEST_AMOUNTS.MEDIUM,
    TEST_AMOUNTS.LARGE
  ],
  mergeAmounts: [
    TEST_AMOUNTS.SMALL,
    TEST_AMOUNTS.MEDIUM
  ]
};

/**
 * Expected error messages for negative testing
 */
export const EXPECTED_ERRORS = {
  INSUFFICIENT_BALANCE: 'Insufficient balance',
  VAULT_NOT_INITIALIZED: 'Vault is not initialized',
  VAULT_ALREADY_FINALIZED: 'Vault is already finalized',
  INVALID_AMOUNT: 'Amount must be positive',
  PROPOSAL_NOT_FINALIZED: 'Proposal is not finalized',
  WRONG_VAULT_TYPE: 'Cannot redeem from losing vault'
};

/**
 * Helper to create deterministic keypairs for testing
 */
export function createTestKeypair(seed: string): Keypair {
  const encoder = new TextEncoder();
  const seedBytes = encoder.encode(seed);
  const paddedSeed = new Uint8Array(32);
  for (let i = 0; i < Math.min(seedBytes.length, 32); i++) {
    paddedSeed[i] = seedBytes[i];
  }
  return Keypair.fromSeed(paddedSeed);
}