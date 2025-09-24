import { Transaction, Keypair, Connection } from '@solana/web3.js';

/**
 * Interface for Execution Service
 * Defines methods for handling Solana transaction execution
 */
export interface IExecutionService {
  readonly connection: Connection; // Connection to the Solana cluster

  /**
   * Executes a transaction on Solana
   * @param transaction - Transaction to execute
   * @param signer - Optional keypair to sign the transaction (if not already signed)
   * @param additionalSigners - Additional keypairs that need to sign the transaction
   * @returns Execution result with signature and status
   */
  executeTx(
    transaction: Transaction,
    signer?: Keypair,
    additionalSigners?: Keypair[]
  ): Promise<IExecutionResult>;
}

/**
 * Status of transaction execution
 */
export enum ExecutionStatus {
  Success = 'success',
  Failed = 'failed',
  Pending = 'pending'
}

/**
 * Result of a transaction execution attempt
 */
export interface IExecutionResult {
  signature: string;          // Transaction signature on chain
  status: ExecutionStatus;    // Execution status
  timestamp: number;          // Execution timestamp (ms)
  proposalId?: number;        // Optional proposal ID for context
  error?: string;             // Error message if failed
}

/**
 * Configuration for transaction execution
 */
export interface IExecutionConfig {
  rpcEndpoint: string;        // Solana RPC endpoint URL
  commitment?: 'processed' | 'confirmed' | 'finalized';  // Commitment level
  maxRetries?: number;        // Max retry attempts on failure
  skipPreflight?: boolean;    // Skip preflight simulation
}

/**
 * Structured log output for execution events
 */
export interface IExecutionLog {
  signature: string;
  status: 'success' | 'failed';
  timestamp: number;
  error?: string;
}