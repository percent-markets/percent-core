import { 
  Connection, 
  Keypair, 
  Transaction, 
  Commitment
} from '@solana/web3.js';
import * as fs from 'fs';
import { 
  IExecutionService,
  IExecutionResult, 
  IExecutionConfig, 
  ExecutionStatus,
  IExecutionLog 
} from '../types/execution.interface';

/**
 * Service for handling Solana transaction execution
 * Manages keypair loading, transaction signing, and sending
 */
export class ExecutionService implements IExecutionService {
  readonly connection: Connection;
  private config: IExecutionConfig;

  constructor(config: IExecutionConfig, connection?: Connection) {
    this.config = {
      ...config,
      commitment: config.commitment || 'confirmed',
      maxRetries: config.maxRetries ?? 1,
      skipPreflight: config.skipPreflight ?? false
    };
    // Use provided connection or create a new one
    this.connection = connection || new Connection(
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
   * @param signer - Optional keypair to sign the transaction (if not already signed)
   * @param additionalSigners - Additional keypairs that need to sign the transaction
   * @returns Execution result with signature and status
   */
  async executeTx(
    transaction: Transaction,
    signer?: Keypair,
    additionalSigners: Keypair[] = []
  ): Promise<IExecutionResult> {
    try {
      // Only set blockhash if not already set (for pre-signed transactions)
      if (!transaction.recentBlockhash) {
        const { blockhash } = 
          await this.connection.getLatestBlockhash(this.config.commitment);
        transaction.recentBlockhash = blockhash;
      }
      
      // Only set fee payer if not already set and signer is provided
      if (!transaction.feePayer && signer) {
        transaction.feePayer = signer.publicKey;
      }

      // Only sign if signer is provided
      if (signer) {
        transaction.partialSign(signer);
      }
      
      // Sign with additional signers if provided
      for (const additionalSigner of additionalSigners) {
        transaction.partialSign(additionalSigner);
      }

      // Send the fully signed transaction
      const signature = await this.connection.sendRawTransaction(
        transaction.serialize(),
        {
          skipPreflight: this.config.skipPreflight ?? false,
          maxRetries: this.config.maxRetries ?? 3
        }
      );

      // Wait for confirmation
      await this.connection.confirmTransaction(signature, this.config.commitment as Commitment);

      const result: IExecutionResult = {
        signature,
        status: ExecutionStatus.Success,
        timestamp: Date.now()
      };

      // Log success
      this.logExecution({
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
        error: errorMessage
      };

      // Log failure
      this.logExecution({
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