import { PublicKey } from '@solana/web3.js';

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
  proposalId: number;
  signature: string;
  status: 'success' | 'failed';
  timestamp: number;
  error?: string;
}