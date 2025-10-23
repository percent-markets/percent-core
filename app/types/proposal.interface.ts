import { Transaction, PublicKey, Keypair } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import { IAMM } from './amm.interface';
import { IVault } from './vault.interface';
import { ITWAPOracle, ITWAPConfig } from './twap-oracle.interface';
import { ProposalStatus } from './moderator.interface';
import { IExecutionResult, IExecutionService } from './execution.interface';
import { JitoService } from '@slateos/jito';
import { LoggerService } from '../../src/services/logger.service';

/**
 * Configuration for creating a new proposal
 */
export interface IProposalConfig {
  id: number;                                   // Unique proposal identifier
  moderatorId: number;                          // Moderator ID
  title: string;                                // Proposal title (required)
  description?: string;                         // Human-readable description (optional)
  transaction: Transaction;                     // Solana transaction to execute if passed
  createdAt: number;                           // Creation timestamp in milliseconds
  proposalLength: number;                      // Duration of voting period in seconds
  baseMint: PublicKey;                         // Public key of base token mint
  quoteMint: PublicKey;                        // Public key of quote token mint
  baseDecimals: number;                        // Number of decimals for base token conditional mints
  quoteDecimals: number;                       // Number of decimals for quote token conditional mints
  authority: Keypair;                          // Authority keypair (payer and mint authority)
  executionService: IExecutionService;         // Execution service for transactions
  twap: ITWAPConfig;                           // TWAP oracle configuration
  spotPoolAddress?: string;                    // Optional Meteora pool address for spot market price (for charts)
  totalSupply: number;                         // Total supply of conditional tokens for market cap calculation
  ammConfig: {
    initialBaseAmount: BN;                      // Initial base token liquidity (same for both AMMs)
    initialQuoteAmount: BN;                     // Initial quote token liquidity (same for both AMMs)
  };
  logger: LoggerService;
}

/**
 * Interface for governance proposals in the protocol
 * Manages AMMs, vaults, and TWAP oracle for price discovery
 */
export interface IProposal {
  readonly config: IProposalConfig;    // Configuration object containing all proposal parameters
  pAMM: IAMM;                          // Pass AMM (initialized during proposal setup)
  fAMM: IAMM;                          // Fail AMM (initialized during proposal setup)
  baseVault: IVault;                  // Base vault managing both pBase and fBase tokens
  quoteVault: IVault;                 // Quote vault managing both pQuote and fQuote tokens
  readonly twapOracle: ITWAPOracle;   // Time-weighted average price oracle (immutable)
  readonly finalizedAt: number;       // Timestamp when voting ends (ms, immutable)
  readonly status: ProposalStatus;    // Current status (Pending, Passed, Failed, Executed)
  
  /**
   * Initializes the proposal's blockchain components
   * Sets up AMMs, vaults, and begins TWAP recording
   * Uses connection, authority, and decimals from constructor config
   */
  initialize(): Promise<void>;

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
   * Executes the proposal's transaction
   * @param signer - Keypair to sign and execute the transaction
   * @returns Execution result with signature and status
   * @throws Error if proposal hasn't passed or already executed
   */
  execute(signer: Keypair): Promise<IExecutionResult>;
}