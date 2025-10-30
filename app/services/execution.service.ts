import {
  Connection,
  Keypair,
  Transaction,
  ComputeBudgetProgram,
  TransactionInstruction,
  PublicKey
} from '@solana/web3.js';
import * as fs from 'fs';
import bs58 from 'bs58';
import {
  IExecutionService,
  IExecutionResult,
  IExecutionConfig,
  IExecutionResult,
  IExecutionConfig,
  ExecutionStatus,
  IExecutionLog,
  PriorityFeeMode,
  Commitment
} from '../types/execution.interface';
import { LoggerService } from './logger.service';

/**
 * Service for handling Solana transaction execution
 * Manages keypair loading, transaction signing, and sending
 */
export class ExecutionService implements IExecutionService {
  readonly connection: Connection;
  public config: IExecutionConfig;
  private logger: LoggerService;

  constructor(config: IExecutionConfig, logger: LoggerService) {
    this.config = {
      ...config,
      commitment: config.commitment || Commitment.Confirmed,
      maxRetries: config.maxRetries ?? 3,
      skipPreflight: config.skipPreflight ?? false,
      priorityFeeMode: config.priorityFeeMode || PriorityFeeMode.Medium,
      maxPriorityFeeLamports: config.maxPriorityFeeLamports ?? 25000
    };
    // Use provided connection or create a new one
    this.connection = new Connection(
      this.config.rpcEndpoint,
      this.config.commitment
    );
    this.logger = logger;
  }

  /**
   * Load keypair from JSON file or private key string
   * @param input - Path to JSON keypair file or base58 private key string
   * @returns Keypair instance
   */
  static loadKeypair(input: string): Keypair {
    // Check if the input is a file path that exists
    if (fs.existsSync(input)) {
      // It's a file path
      try {
        const secretKey = JSON.parse(fs.readFileSync(input, 'utf-8'));
        return Keypair.fromSecretKey(Uint8Array.from(secretKey));
      } catch (error) {
        throw new Error(`Failed to load keypair from file: ${error}`);
      }
    } else {
      // Assume it's a base58 encoded private key
      try {
        const secretKey = bs58.decode(input);
        return Keypair.fromSecretKey(secretKey);
      } catch (error) {
        throw new Error(`Failed to decode private key from base58 string: ${error}`);
      }
    }
  }

  /**
   * Get priority fee based on mode and network conditions
   * @param mode - Priority fee mode
   * @param accountKeys - Account keys involved in transaction (for dynamic mode)
   * @returns Priority fee in microlamports per compute unit
   */
  private async getPriorityFee(mode: PriorityFeeMode, accountKeys: PublicKey[]): Promise<number> {
    // Static modes
    if (mode === PriorityFeeMode.None) {
      return 0;
    }

    // For dynamic mode, always fetch from network
    if (mode === PriorityFeeMode.Dynamic) {
      try {
        // Get recent prioritization fees for the accounts
        const recentFees = await this.connection.getRecentPrioritizationFees({
          lockedWritableAccounts: accountKeys
        });

        if (!recentFees || recentFees.length === 0) {
          // Fallback to medium if no data available
          return 5000;
        }

        // Sort fees and get 75th percentile
        const fees = recentFees
          .map((f: any) => f.prioritizationFee)
          .filter((f: number) => f > 0)
          .sort((a: number, b: number) => a - b);

        if (fees.length === 0) {
          return 5000; // Default to medium
        }

        const percentileIndex = Math.floor(fees.length * 0.75);
        const suggestedFee = fees[percentileIndex];

        // Cap at max configured fee
        return Math.min(suggestedFee, this.config.maxPriorityFeeLamports || 25000);
      } catch (error) {
        this.logger.warn('Failed to get dynamic priority fee, using medium', { error });
        return 5000; // Default to medium
      }
    }

    // Static preset modes
    switch (mode) {
      case PriorityFeeMode.Low:
        return 1000;  // 0.001 lamports per CU
      case PriorityFeeMode.Medium:
        return 5000;  // 0.005 lamports per CU
      case PriorityFeeMode.High:
        return 15000; // 0.015 lamports per CU
      default:
        return 5000;  // Default to medium
    }
  }

  /**
   * Simulate transaction to get compute units used
   * @param transaction - Transaction to simulate
   * @returns Estimated compute units needed
   */
  private async estimateComputeUnits(transaction: Transaction): Promise<number> {
    try {
      // Create a copy for simulation
      const simulationTx = Transaction.from(transaction.serialize({
        requireAllSignatures: false,
        verifySignatures: false
      }));

      // Add a high compute unit limit for simulation
      simulationTx.instructions.unshift(
        ComputeBudgetProgram.setComputeUnitLimit({ units: 1400000 })
      );

      const simulation = await this.connection.simulateTransaction(simulationTx);

      if (simulation.value.err) {
        this.logger.warn('Simulation failed, using default compute units', { error: simulation.value.err });
        return 200000;
      }

      const unitsConsumed = simulation.value.unitsConsumed || 200000;
      // Add 20% buffer for safety
      return Math.min(Math.ceil(unitsConsumed * 1.2), 1400000);
    } catch (error) {
      this.logger.warn('Failed to estimate compute units, using default', { error });
      return 200000;
    }
  }

  /**
   * Add compute budget instructions to the beginning of a transaction
   * MUST be called before signing the transaction
   * @param transaction - Transaction to add compute budget to
   * @returns Promise that resolves when instructions are added
   */
  async addComputeBudgetInstructions(
    transaction: Transaction
  ): Promise<void> {
    if (this.config.priorityFeeMode === PriorityFeeMode.None) {
      return;
    }

    // Get account keys that will be written to
    const accountKeys = transaction.instructions
      .flatMap(ix => ix.keys)
      .filter(key => key.isWritable)
      .map(key => key.pubkey);

    // Get priority fee based on mode
    const priorityFee = await this.getPriorityFee(
      this.config.priorityFeeMode || PriorityFeeMode.Medium,
      accountKeys
    );

    // Get compute units needed
    const computeUnits = this.config.computeUnitLimit ||
      await this.estimateComputeUnits(transaction);

    // Create compute budget instructions
    const computeBudgetInstructions: TransactionInstruction[] = [];

    // Set compute unit limit
    computeBudgetInstructions.push(
      ComputeBudgetProgram.setComputeUnitLimit({
        units: computeUnits
      })
    );

    // Set priority fee if not zero
    if (priorityFee > 0) {
      computeBudgetInstructions.push(
        ComputeBudgetProgram.setComputeUnitPrice({
          microLamports: priorityFee
        })
      );
    }

    // Add compute budget instructions to the beginning of the transaction
    transaction.instructions.unshift(...computeBudgetInstructions);

    // Log the compute budget settings
    this.logger.debug('Compute budget settings', {
      computeUnits,
      priorityFee,
      mode: this.config.priorityFeeMode,
      totalFeeLamports: Math.ceil((computeUnits * priorityFee) / 1000000)
    });
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
        status: ExecutionStatus.Success,
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
        status: ExecutionStatus.Failed,
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
    const metadata = {
      ...log,
      ...(log.signature && { solscan: ExecutionService.getSolscanLink(log.signature) })
    };

    if (log.status === ExecutionStatus.Success) {
      this.logger.info('Transaction executed successfully', metadata);
    } else if (log.status === ExecutionStatus.Failed) {
      this.logger.error('Transaction execution failed', metadata);
    } else {
      this.logger.info('Transaction status update', metadata);
    }
  }
}