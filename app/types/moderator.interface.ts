import { Transaction, PublicKey, Keypair, Connection } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import { IExecutionConfig, IExecutionResult } from './execution.interface';
import { IProposal } from './proposal.interface';
import { ITWAPConfig } from './twap-oracle.interface';

/**
 * Enum representing the possible states of a proposal
 */
export enum ProposalStatus {
  Uninitialized = 'Uninitialized', // Proposal created but not yet initialized on-chain
  Pending = 'Pending',              // Proposal is active and voting is ongoing
  Passed = 'Passed',                // Proposal passed the threshold
  Failed = 'Failed',                // Proposal failed to pass the threshold
  Executed = 'Executed'             // Proposal has been executed
}

/**
 * Parameters for creating a new proposal
 */
export interface ICreateProposalParams {
  description: string;                          // Human-readable description of the proposal
  transaction: Transaction;                     // Solana transaction to execute if passed
  proposalLength: number;                       // Duration of voting period in seconds
  twap: ITWAPConfig;                           // TWAP oracle configuration
  amm: {
    initialBaseAmount: BN;                      // Initial base token liquidity (same for both pass and fail AMMs)
    initialQuoteAmount: BN;                     // Initial quote token liquidity (same for both pass and fail AMMs)
  };
}

/**
 * Configuration for the Moderator contract
 */
export interface IModeratorConfig {
  baseMint: PublicKey;                         // Public key of the base token mint
  quoteMint: PublicKey;                        // Public key of the quote token mint
  baseDecimals: number;                        // Number of decimals for base token conditional mints
  quoteDecimals: number;                       // Number of decimals for quote token conditional mints
  authority: Keypair;                          // Authority keypair for managing vaults and mints
  connection: Connection;                      // Solana connection for blockchain interactions
}

/**
 * Interface for the Moderator contract that manages proposals
 */
export interface IModerator {
  config: IModeratorConfig;                    // Configuration parameters
  proposals: IProposal[];                      // Array of proposals
  
  /**
   * Creates a new proposal
   * @param params - Parameters for creating the proposal including AMM configuration
   * @returns The created proposal
   */
  createProposal(params: ICreateProposalParams): Promise<IProposal>;
  
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
  
  /**
   * Gets a proposal by ID from cache (for internal operations like scheduling)
   * @param id - Proposal ID
   * @returns Promise resolving to proposal or null if not found
   */
  getProposal(id: number): Promise<IProposal | null>;
  
  /**
   * Gets a proposal by ID directly from database (for API routes - always fresh)
   * @param id - Proposal ID  
   * @returns Promise resolving to proposal or null if not found
   */
  getProposalFresh(id: number): Promise<IProposal | null>;
  
  /**
   * Invalidate cached proposal (call after external state changes)
   * @param id - Proposal ID to invalidate
   */
  invalidateCache(id: number): void;
}