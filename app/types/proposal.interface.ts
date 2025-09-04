import { Transaction, PublicKey, Keypair } from '@solana/web3.js';
import { IAMM } from './amm.interface';
import { IVault } from './vault.interface';
import { ITWAPOracle } from './twap-oracle.interface';
import { ProposalStatus } from './moderator.interface';
import { IExecutionResult, IExecutionConfig } from './execution.interface';

/**
 * Interface for governance proposals in the protocol
 * Manages AMMs, vaults, and TWAP oracle for price discovery
 */
export interface IProposal {
  id: number;                          // Unique proposal identifier
  description: string;                 // Human-readable description of the proposal
  transaction: Transaction;            // Solana transaction to execute if passed
  __pAMM: IAMM | null;                // Pass AMM (initialized during proposal setup)
  __fAMM: IAMM | null;                // Fail AMM (initialized during proposal setup)
  __pVault: IVault | null;            // Pass vault for token management
  __fVault: IVault | null;            // Fail vault for token management
  twapOracle: ITWAPOracle;            // Time-weighted average price oracle
  createdAt: number;                  // Timestamp when proposal was created (ms)
  finalizedAt: number;                // Timestamp when voting ends (ms)
  baseMint: PublicKey;                // Public key of base token mint
  quoteMint: PublicKey;               // Public key of quote token mint
  readonly status: ProposalStatus;    // Current status (Pending, Passed, Failed, Executed)
  
  /**
   * Initializes the proposal's blockchain components
   * Sets up AMMs, vaults, and begins TWAP recording
   */
  initialize(): Promise<void>;
  
  /**
   * Returns the time-to-live in seconds until proposal finalizes
   * @returns Remaining seconds (0 if expired)
   */
  fetchTTL(): number;
  
  /**
   * Gets both AMMs for the proposal
   * @returns Tuple of [pAMM, fAMM]
   * @throws Error if AMMs are uninitialized
   */
  getAMMs(): [IAMM, IAMM];
  
  /**
   * Gets both vaults for the proposal
   * @returns Tuple of [pVault, fVault]
   * @throws Error if vaults are uninitialized
   */
  getVaults(): [IVault, IVault];
  
  /**
   * Finalizes the proposal based on voting results
   * @returns The final status after checking time and votes
   */
  finalize(): ProposalStatus;
  
  /**
   * Executes the proposal's transaction
   * @param signer - Keypair to sign and execute the transaction
   * @param executionConfig - Configuration for transaction execution
   * @returns Execution result with signature and status
   * @throws Error if proposal hasn't passed or already executed
   */
  execute(signer: Keypair, executionConfig: IExecutionConfig): Promise<IExecutionResult>;
}