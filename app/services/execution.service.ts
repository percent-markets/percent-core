import { 
  Connection, 
  Keypair, 
  Transaction, 
  sendAndConfirmTransaction,
  Commitment
} from '@solana/web3.js';
import * as fs from 'fs';
import { 
  IExecutionResult, 
  IExecutionConfig, 
  ExecutionStatus,
  IExecutionLog 
} from '../types/execution.interface';

/**
 * Service for handling Solana transaction execution
 * Manages keypair loading, transaction signing, and sending
 */
export class ExecutionService {
  private connection: Connection;
  private config: IExecutionConfig;

  constructor(config: IExecutionConfig) {
    this.config = {
      ...config,
      commitment: config.commitment || 'confirmed',
      maxRetries: config.maxRetries ?? 1,
      skipPreflight: config.skipPreflight ?? false
    };
    this.connection = new Connection(
      this.config.rpcEndpoint, 
      this.config.commitment
    );
  }

  /**
   * Load keypair from JSON file
   * @param path - Path to JSON keypair file
   * @returns Keypair instance
   */
  static loadKeypair(path: string): Keypair {
    try {
      const secretKey = JSON.parse(fs.readFileSync(path, 'utf-8'));
      return Keypair.fromSecretKey(Uint8Array.from(secretKey));
    } catch (error) {
      throw new Error(`Failed to load keypair from file: ${error}`);
    }
  }

  /**
   * Execute a transaction on Solana
   * @param transaction - Transaction to execute
   * @param signer - Keypair to sign the transaction
   * @param proposalId - Optional proposal ID for logging context
   * @returns Execution result with signature and status
   */
  async executeTransaction(
    transaction: Transaction,
    signer: Keypair,
    proposalId?: number
  ): Promise<IExecutionResult> {
    const startTime = Date.now();
    
    try {
      // Get recent blockhash
      const { blockhash, lastValidBlockHeight } = 
        await this.connection.getLatestBlockhash(this.config.commitment);
      
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = signer.publicKey;

      // Send and confirm transaction
      const signature = await sendAndConfirmTransaction(
        this.connection,
        transaction,
        [signer],
        {
          commitment: this.config.commitment as Commitment,
          skipPreflight: this.config.skipPreflight,
          maxRetries: this.config.maxRetries
        }
      );

      const result: IExecutionResult = {
        signature,
        status: ExecutionStatus.Success,
        timestamp: Date.now(),
        proposalId
      };

      // Log success
      this.logExecution({
        proposalId: proposalId || 0,
        signature,
        status: 'success',
        timestamp: result.timestamp
      });

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ?
       error.message : String(error);
      
      const result: IExecutionResult = {
        signature: '',
        status: ExecutionStatus.Failed,
        timestamp: Date.now(),
        proposalId,
        error: errorMessage
      };

      // Log failure
      this.logExecution({
        proposalId: proposalId || 0,
        signature: '',
        status: 'failed',
        timestamp: result.timestamp,
        error: errorMessage
      });

      return result;
    }
  }

  /**
   * Get Solscan link for a transaction
   * @param signature - Transaction signature
   * @returns Solscan URL for mainnet
   */
  static getSolscanLink(signature: string): string {
    return `https://solscan.io/tx/${signature}`;
  }

  /**
   * Log execution event in structured JSON format
   * @param log - Execution log data
   */
  private logExecution(log: IExecutionLog): void {
    const output = {
      ...log,
      ...(log.signature && { solscan: ExecutionService.getSolscanLink(log.signature) })
    };
    console.log(JSON.stringify(output, null, 2));
  }
}