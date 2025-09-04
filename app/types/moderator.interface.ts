import { Transaction, PublicKey, Keypair } from '@solana/web3.js';
import { IExecutionConfig, IExecutionResult } from './execution.interface';
import { IProposal } from './proposal.interface';

/**
 * Enum representing the possible states of a proposal
 */
export enum ProposalStatus {
  Pending = 'Pending',   // Proposal is active and voting is ongoing
  Passed = 'Passed',     // Proposal passed the threshold
  Failed = 'Failed',     // Proposal failed to pass the threshold
  Executed = 'Executed'  // Proposal has been executed
}

/**
 * Configuration for the Moderator contract
 */
export interface IModeratorConfig {
  proposalLength: number;                       // Duration of voting period in seconds
  baseMint: PublicKey;                         // Public key of the base token mint
  quoteMint: PublicKey;                        // Public key of the quote token mint
  twapMaxObservationChangePerUpdate: bigint;   // Maximum TWAP observation change allowed per update
  twapStartDelay: number;                      // Delay before TWAP starts recording in seconds
  passThresholdBps: number;                    // Basis points threshold for proposal to pass (e.g., 5000 = 50%)
}

/**
 * Interface for the Moderator contract that manages proposals
 */
export interface IModerator {
  config: IModeratorConfig;                    // Configuration parameters
  proposals: IProposal[];                      // Array of proposals
  
  /**
   * Creates a new proposal
   * @param description - Description of what the proposal does
   * @param transaction - Solana transaction to execute if proposal passes
   * @returns The created proposal
   */
  createProposal(description: string, transaction: Transaction): Promise<IProposal>;
  
  /**
   * Finalizes a proposal after voting period ends
   * @param id - The ID of the proposal to finalize
   * @returns The status of the proposal after finalization
   */
  finalizeProposal(id: number): Promise<ProposalStatus>;
  
  /**
   * Executes a passed proposal's transaction
   * @param id - The ID of the proposal to execute
   * @param signer - Keypair to sign the transaction
   * @param executionConfig - Configuration for execution
   * @returns Execution result with signature and status
   * @throws Error if proposal cannot be executed
   */
  executeProposal(id: number, signer: Keypair, executionConfig: IExecutionConfig): Promise<IExecutionResult>;
}