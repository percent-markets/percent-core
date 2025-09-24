import { Transaction, PublicKey, Keypair, Connection } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import { IAMM } from './amm.interface';
import { IVault } from './vault.interface';
import { ITWAPOracle, ITWAPConfig } from './twap-oracle.interface';
import { ProposalStatus } from './moderator.interface';
import { IExecutionResult, IExecutionConfig } from './execution.interface';

/**
 * Configuration for creating a new proposal
 */
export interface IProposalConfig {
  id: number;                                   // Unique proposal identifier
  description: string;                          // Human-readable description
  transaction: Transaction;                     // Solana transaction to execute if passed
  createdAt: number;                           // Creation timestamp in milliseconds
  proposalLength: number;                      // Duration of voting period in seconds
  baseMint: PublicKey;                         // Public key of base token mint
  quoteMint: PublicKey;                        // Public key of quote token mint
  baseDecimals: number;                        // Number of decimals for base token conditional mints
  quoteDecimals: number;                       // Number of decimals for quote token conditional mints
  authority: Keypair;                          // Authority keypair (payer and mint authority)
  connection: Connection;                      // Solana connection for blockchain interactions
  twap: ITWAPConfig;                           // TWAP oracle configuration
  ammConfig: {
    initialBaseAmount: BN;                      // Initial base token liquidity (same for both AMMs)
    initialQuoteAmount: BN;                     // Initial quote token liquidity (same for both AMMs)
  };
}

/**
 * Interface for governance proposals in the protocol
 * Manages AMMs, vaults, and TWAP oracle for price discovery
 */
export interface IProposal {
  readonly id: number;                 // Unique proposal identifier (immutable)
  description: string;                 // Human-readable description of the proposal
  transaction: Transaction;            // Solana transaction to execute if passed
  __pAMM: IAMM | null;                // Pass AMM (initialized during proposal setup)
  __fAMM: IAMM | null;                // Fail AMM (initialized during proposal setup)
  __baseVault: IVault | null;         // Base vault managing both pBase and fBase tokens
  __quoteVault: IVault | null;        // Quote vault managing both pQuote and fQuote tokens
  readonly twapOracle: ITWAPOracle;   // Time-weighted average price oracle (immutable)
  readonly createdAt: number;         // Timestamp when proposal was created (ms, immutable)
  readonly finalizedAt: number;       // Timestamp when voting ends (ms, immutable)
  readonly baseMint: PublicKey;       // Public key of base token mint (immutable)
  readonly quoteMint: PublicKey;      // Public key of quote token mint (immutable)
  readonly proposalLength: number;    // Duration of voting period in seconds (immutable)
  readonly ammConfig: IProposalConfig['ammConfig']; // AMM configuration (immutable)
  readonly status: ProposalStatus;    // Current status (Pending, Passed, Failed, Executed)
  
  /**
   * Initializes the proposal's blockchain components
   * Sets up AMMs, vaults, and begins TWAP recording
   * Uses connection, authority, and decimals from constructor config
   */
  initialize(): Promise<void>;

  /**
   * Initializes the proposal using Jito bundles for atomic execution
   * Batches all initialization transactions into a single bundle
   * Ensures all components are created atomically with MEV protection
   * Only works on mainnet where Jito is available
   */
  initializeViaBundle?(): Promise<void>;

  /**
   * Gets both AMMs for the proposal
   * @returns Tuple of [pAMM, fAMM]
   * @throws Error if AMMs are uninitialized
   */
  getAMMs(): [IAMM, IAMM];
  
  /**
   * Gets both vaults for the proposal
   * @returns Tuple of [baseVault, quoteVault]
   * @throws Error if vaults are uninitialized
   */
  getVaults(): [IVault, IVault];
  
  /**
   * Finalizes the proposal based on voting results
   * Currently assumes all proposals pass (TWAP logic TODO)
   * @returns The final status after checking time and votes
   */
  finalize(): Promise<ProposalStatus>;

  /**
   * Finalizes the proposal using Jito bundles for atomic execution
   * Removes liquidity from AMMs and redeems authority's winning tokens
   * All operations execute atomically in a single bundle
   * Only works on mainnet where Jito is available
   * @returns The final status after checking time and votes
   */
  finalizeViaBundle(): Promise<ProposalStatus>;

  /**
   * Executes the proposal's transaction
   * @param signer - Keypair to sign and execute the transaction
   * @param executionConfig - Configuration for transaction execution
   * @returns Execution result with signature and status
   * @throws Error if proposal hasn't passed or already executed
   */
  execute(signer: Keypair, executionConfig: IExecutionConfig): Promise<IExecutionResult>;
}