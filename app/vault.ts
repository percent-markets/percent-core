import { PublicKey, Keypair, Transaction } from '@solana/web3.js';
import * as crypto from 'crypto';
import {
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction
} from '@solana/spl-token';
import {
  IVault,
  IVaultConfig,
  ITokenBalance,
  VaultType,
  VaultState,
  IVaultSerializedData,
  IVaultDeserializeConfig
} from './types/vault.interface';
import { ProposalStatus } from './types/moderator.interface';
import { SPLTokenService, NATIVE_MINT } from './services/spl-token.service';
import { ISPLTokenService } from './types/spl-token.interface';
import { IExecutionService } from './types/execution.interface';
import { createMemoIx } from './utils/memo';
import { getNetworkFromConnection, Network } from './utils/network';
import { LoggerService } from '@app/services/logger.service';

/**
 * Vault implementation for managing conditional tokens in prediction markets
 * 
 * Each vault manages BOTH pass and fail conditional tokens for a single token type:
 * 1. Split: 1 regular token → 1 pass token + 1 fail token
 * 2. Merge: 1 pass token + 1 fail token → 1 regular token
 * 3. Finalize: Determines which conditional tokens can be redeemed
 * 4. Redeem: Exchange winning conditional tokens → regular tokens (1:1)
 * 
 * Security features:
 * - Escrow accounts hold regular tokens during active trading
 * - After finalization, only winning tokens can be redeemed
 * - All operations require proper signatures (user + authority)
 */
export class Vault implements IVault {
  public readonly proposalId: number;
  public readonly vaultType: VaultType;
  public readonly regularMint: PublicKey;
  public readonly decimals: number;
  private _passConditionalMint!: PublicKey;
  private _failConditionalMint!: PublicKey;
  private _escrow!: PublicKey;
  private _state: VaultState = VaultState.Uninitialized;
  private _proposalStatus: ProposalStatus = ProposalStatus.Pending;

  // Public readonly getters
  get passConditionalMint(): PublicKey { return this._passConditionalMint; }
  get failConditionalMint(): PublicKey { return this._failConditionalMint; }
  get escrow(): PublicKey { return this._escrow; }
  get state(): VaultState { return this._state; }

  private authority: Keypair;
  private escrowKeypair: Keypair;
  private tokenService: ISPLTokenService;
  private executionService: IExecutionService;
  private passMintKeypair: Keypair | null = null;
  private failMintKeypair: Keypair | null = null;
  private logger: LoggerService;

  constructor(config: IVaultConfig) {
    this.proposalId = config.proposalId;
    this.vaultType = config.vaultType;
    this.regularMint = config.regularMint;
    this.decimals = config.decimals;
    this.authority = config.authority;
    this.executionService = config.executionService;

    // Generate deterministic escrow keypair based on proposal ID and vault type
    // This ensures the same keypair is generated when reconstructing from database
    this.escrowKeypair = this.generateDeterministicEscrowKeypair();

    // Generate mint keypairs upfront
    // Used only for initializing the vault
    this.passMintKeypair = Keypair.generate();
    this.failMintKeypair = Keypair.generate();
    
    // Store public keys
    this._passConditionalMint = this.passMintKeypair.publicKey;
    this._failConditionalMint = this.failMintKeypair.publicKey;

    // Initialize services with ExecutionService
    this.tokenService = new SPLTokenService(
      this.executionService,
      config.logger.createChild('spl-token')
    );

    this.logger = config.logger;
  }


  /**
   * Checks if we should handle wrapped SOL (mainnet + quote vault with NATIVE_MINT)
   */
  private shouldHandleWrappedSOL(): boolean {
    const isMainnet = getNetworkFromConnection(this.executionService.connection) === Network.MAINNET;
    const isQuoteWrappedSol = this.vaultType === VaultType.Quote && this.regularMint.equals(NATIVE_MINT);
    return isMainnet && isQuoteWrappedSol;
  }

  /**
   * Generates a deterministic escrow keypair based on proposal ID, vault type, and authority
   * This ensures the same keypair is recreated when deserializing from database
   */
  private generateDeterministicEscrowKeypair(): Keypair {
    // Create a deterministic seed based on proposal ID, vault type, and authority secret key
    // Using authority's secret key ensures only the authority can recreate the escrow keypair
    const seedData = Buffer.concat([
      Buffer.from(`proposal-${this.proposalId}`),
      Buffer.from(`vault-${this.vaultType}`),
      this.authority.secretKey.slice(0, 32) // Use first 32 bytes of authority's secret key
    ]);
    
    // Hash to get a 32-byte seed
    const seed = crypto.createHash('sha256').update(seedData).digest();
    
    // Create keypair from seed
    return Keypair.fromSeed(seed);
  }

  /**
   * Builds a transaction for initializing the vault
   * Creates both pass and fail conditional token mints and escrow account
   * Transaction is always pre-signed with authority and mint keypairs
   * @returns Pre-signed transaction ready for execution
   * @throws Error if vault is already initialized
   */
  async buildInitializeTx(): Promise<Transaction> {
    if (this._state !== VaultState.Uninitialized) {
      throw new Error('Vault already initialized');
    }

    if (!this.passMintKeypair || !this.failMintKeypair) {
      this.passMintKeypair = Keypair.generate();
      this.failMintKeypair = Keypair.generate();
      this._passConditionalMint = this.passMintKeypair.publicKey;
      this._failConditionalMint = this.failMintKeypair.publicKey;
    }

    // Build single transaction with all instructions
    const transaction = new Transaction();

    // Create and initialize pass conditional mint using token service
    const passMinIxs = await this.tokenService.buildCreateMintIxs(
      this.passMintKeypair,
      this.decimals,
      this.authority.publicKey,
      this.authority.publicKey
    );
    transaction.add(...passMinIxs);

    // Create and initialize fail conditional mint using token service
    const failMintIxs = await this.tokenService.buildCreateMintIxs(
      this.failMintKeypair,
      this.decimals,
      this.authority.publicKey,
      this.authority.publicKey
    );
    transaction.add(...failMintIxs);

    // Get escrow token account address
    this._escrow = await getAssociatedTokenAddress(
      this.regularMint,
      this.escrowKeypair.publicKey
    );

    // Create escrow account if needed (idempotent)
    transaction.add(
      createAssociatedTokenAccountIdempotentInstruction(
        this.authority.publicKey, // payer
        this.escrow,
        this.escrowKeypair.publicKey, // owner
        this.regularMint,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      )
    )

    // Add memo for transaction identification
    const memoMessage = `%[Vault/${this.vaultType}] Init Proposal #${this.proposalId}`;
    transaction.add(createMemoIx(memoMessage));

    // Add blockhash and fee payer
    const { blockhash } = await this.executionService.connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = this.authority.publicKey;

    // Add compute budget instructions before signing
    await this.executionService.addComputeBudgetInstructions(transaction);

    // Pre-sign the transaction with all required signers
    transaction.partialSign(this.authority, this.passMintKeypair, this.failMintKeypair);

    return transaction;
  }

  /**
   * Initializes the vault by creating both pass and fail conditional token mints and escrow account
   * Must be called before any split/merge operations
   * Creates two conditional mints (pass/fail) with decimals specified in constructor
   * All operations are atomic in a single transaction
   */
  async initialize(): Promise<void> {
    // Build the pre-signed initialization transaction
    const transaction = await this.buildInitializeTx();

    // Execute the transaction (already has all signatures)
    this.logger.info(`Initializing ${this.vaultType} vault for proposal #${this.proposalId}`);
    const result = await this.executionService.executeTx(transaction);

    if (result.status === 'failed') {
      throw new Error(`${this.vaultType} vault initialization failed: ${result.error}`);
    }

    this.logger.info(`${this.vaultType} vault initialized successfully. Tx: ${result.signature}`);

    // Update state to Active
    this._state = VaultState.Active;
  }

  /**
   * Builds a transaction for splitting regular tokens into BOTH pass and fail conditional tokens
   * User receives equal amounts of both conditional tokens for each regular token
   * Automatically handles SOL wrapping if needed (mainnet + quote vault)
   * @param user - User's public key who is splitting tokens
   * @param amount - Amount to split in smallest units
   * @param presign - Whether to pre-sign with authority (default: false)
   * @returns Transaction with blockhash and fee payer set, ready for user signature
   * @throws Error if vault is finalized, amount is invalid, or insufficient balance
   */
  async buildSplitTx(
    user: PublicKey,
    amount: bigint,
    presign: boolean = false
  ): Promise<Transaction> {
    if (this._state === VaultState.Uninitialized) {
      throw new Error('Vault not initialized');
    }

    if (this._state === VaultState.Finalized) {
      throw new Error('Vault is finalized, no more splits allowed');
    }

    if (amount <= 0n) {
      throw new Error('Amount must be positive');
    }

    // Check if we need to handle wrapped SOL
    const shouldHandleSol = this.shouldHandleWrappedSOL();

    // Check balance - for wrapped SOL, check native SOL balance instead
    if (shouldHandleSol) {
      const solBalance = await this.executionService.connection.getBalance(user);
      const solBalanceBigInt = BigInt(solBalance);
      if (solBalanceBigInt < amount) {
        throw new Error(
          `Insufficient SOL balance: ${solBalance / 1e9} SOL available, ${Number(amount) / 1e9} SOL required`
        );
      }
    } else {
      const userBalance = await this.getBalance(user);
      if (amount > userBalance) {
        throw new Error(
          `Insufficient ${this.vaultType} token balance: requested ${amount}, available ${userBalance}`
        );
      }
    }

    const tx = new Transaction();

    // If handling wrapped SOL, add wrap instructions first
    if (shouldHandleSol) {
      const wrapInstructions = await this.tokenService.buildWrapSolIxs(user, amount);
      wrapInstructions.forEach(ix => tx.add(ix));
    }

    // Get user's token accounts
    const userRegularAccount = await getAssociatedTokenAddress(this.regularMint, user);
    const userPassAccount = await getAssociatedTokenAddress(this.passConditionalMint, user);
    const userFailAccount = await getAssociatedTokenAddress(this.failConditionalMint, user);

    // Create pass conditional account if needed (idempotent)
    tx.add(
      createAssociatedTokenAccountIdempotentInstruction(
        user, // payer
        userPassAccount,
        user, // owner
        this.passConditionalMint,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      )
    );

    // Create fail conditional account if needed (idempotent)
    tx.add(
      createAssociatedTokenAccountIdempotentInstruction(
        user, // payer
        userFailAccount,
        user, // owner
        this.failConditionalMint,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      )
    )
    
    // Transfer regular tokens from user to escrow (user signs)
    const transferIx = this.tokenService.buildTransferIx(
      userRegularAccount,
      this.escrow,
      amount,
      user // user must sign
    );
    tx.add(transferIx);
    
    // Mint pass conditional tokens to user (authority signs)
    const mintPassIx = this.tokenService.buildMintToIx(
      this.passConditionalMint,
      userPassAccount,
      amount,
      this.authority.publicKey // authority must sign
    );
    tx.add(mintPassIx);
    
    // Mint fail conditional tokens to user (authority signs)
    const mintFailIx = this.tokenService.buildMintToIx(
      this.failConditionalMint,
      userFailAccount,
      amount,
      this.authority.publicKey // authority must sign
    );
    tx.add(mintFailIx);

    // Add memo for transaction identification on Solscan
    const memoMessage = `%[Vault/${this.vaultType}] Split ${amount} | Proposal #${this.proposalId} | ${user.toBase58()}`;
    tx.add(createMemoIx(memoMessage));

    // Add blockhash and fee payer so transaction can be signed
    const { blockhash } = await this.executionService.connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.feePayer = user;

    // Add compute budget instructions before any signing
    await this.executionService.addComputeBudgetInstructions(tx);

    // Pre-sign with authority for minting operations if requested
    if (presign) {
      tx.partialSign(this.authority);
    }

    return tx;
  }

  /**
   * Builds a transaction for merging BOTH pass and fail conditional tokens back to regular tokens
   * Requires equal amounts of both conditional tokens to receive regular tokens
   * Automatically handles SOL unwrapping if needed (mainnet + quote vault)
   * @param user - User's public key who is merging tokens
   * @param amount - Amount to merge in smallest units (of each conditional token)
   * @param presign - Whether to pre-sign with escrow (default: false)
   * @returns Transaction with blockhash and fee payer set, ready for user signature
   * @throws Error if insufficient balance of either conditional token or vault is finalized
   */
  async buildMergeTx(
    user: PublicKey,
    amount: bigint,
    presign: boolean = false
  ): Promise<Transaction> {
    if (this._state === VaultState.Uninitialized) {
      throw new Error('Vault not initialized');
    }

    if (this._state === VaultState.Finalized) {
      throw new Error('Cannot merge after vault finalization - use redemption instead');
    }

    if (amount <= 0n) {
      throw new Error('Amount must be positive');
    }

    // Check if we need to handle wrapped SOL
    const shouldHandleSol = this.shouldHandleWrappedSOL();
    
    // Check user has sufficient balance of BOTH conditional tokens
    const passBalance = await this.getPassConditionalBalance(user);
    const failBalance = await this.getFailConditionalBalance(user);
    
    if (amount > passBalance) {
      throw new Error(
        `Insufficient pass conditional ${this.vaultType} balance: requested ${amount}, available ${passBalance}`
      );
    }
    
    if (amount > failBalance) {
      throw new Error(
        `Insufficient fail conditional ${this.vaultType} balance: requested ${amount}, available ${failBalance}`
      );
    }
    
    const tx = new Transaction();

    // Get user's token accounts
    const userRegularAccount = await getAssociatedTokenAddress(this.regularMint, user);
    const userPassAccount = await getAssociatedTokenAddress(this.passConditionalMint, user);
    const userFailAccount = await getAssociatedTokenAddress(this.failConditionalMint, user);

    // Ensure user's regular token account exists (create if needed)
    // This is especially important for wrapped SOL which might not exist
    tx.add(
      createAssociatedTokenAccountIdempotentInstruction(
        user, // payer
        userRegularAccount,
        user, // owner
        this.regularMint,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      )
    )

    // Burn pass conditional tokens from user (user signs)
    const burnPassIx = this.tokenService.buildBurnIx(
      this.passConditionalMint,
      userPassAccount,
      amount,
      user // user must sign
    );
    tx.add(burnPassIx);
    
    // Burn fail conditional tokens from user (user signs)
    const burnFailIx = this.tokenService.buildBurnIx(
      this.failConditionalMint,
      userFailAccount,
      amount,
      user // user must sign
    );
    tx.add(burnFailIx);
    
    // Transfer regular tokens from escrow to user (escrow signs)
    const transferIx = this.tokenService.buildTransferIx(
      this.escrow,
      userRegularAccount,
      amount,
      this.escrowKeypair.publicKey // escrow must sign
    );
    tx.add(transferIx);
    
    // Optionally close accounts if balances are 0
    if (passBalance === amount) {
      const closePassIx = this.tokenService.buildCloseAccountIx(
        userPassAccount,
        user, // rent goes back to user
        user // user must sign
      );
      tx.add(closePassIx);
    }
    
    if (failBalance === amount) {
      const closeFailIx = this.tokenService.buildCloseAccountIx(
        userFailAccount,
        user, // rent goes back to user
        user // user must sign
      );
      tx.add(closeFailIx);
    }

    // Add memo for transaction identification on Solscan
    const memoMessage = `%[Vault/${this.vaultType}] Merge ${amount} | Proposal #${this.proposalId} | ${user.toBase58()}`;
    tx.add(createMemoIx(memoMessage));

    // If handling wrapped SOL, add unwrap instructions at the end
    if (shouldHandleSol) {
      const wrappedSolAccount = await getAssociatedTokenAddress(
        NATIVE_MINT,
        user,
        false,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );

      const unwrapInstruction = this.tokenService.buildUnwrapSolIx(
        wrappedSolAccount,
        user, // Send unwrapped SOL back to user
        user  // Owner of the wrapped SOL account
      );

      tx.add(unwrapInstruction);
    }

    // Add blockhash and fee payer so transaction can be signed
    const { blockhash } = await this.executionService.connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.feePayer = user;

    // Add compute budget instructions before any signing
    await this.executionService.addComputeBudgetInstructions(tx);

    // Pre-sign with escrow for transferring regular tokens back to user if requested
    if (presign) {
      tx.partialSign(this.escrowKeypair);
    }

    return tx;
  }

  /**
   * Executes a split transaction
   * @param tx - Transaction signed by user
   * @param presigned - Whether the transaction is already pre-signed with authority (default: false)
   * @returns Transaction signature
   * @throws Error if transaction execution fails
   */
  async executeSplitTx(tx: Transaction, presigned: boolean = false): Promise<string> {
    if (this._state === VaultState.Uninitialized) {
      throw new Error('Vault not initialized - cannot execute split');
    }

    if (this._state === VaultState.Finalized) {
      throw new Error('Vault is finalized - no splits allowed');
    }

    // Execute transaction - sign with authority if not pre-signed
    this.logger.info('Executing transaction to split tokens');
    const result = presigned
      ? await this.executionService.executeTx(tx)
      : await this.executionService.executeTx(tx, this.authority);

    if (result.status === 'failed') {
      throw new Error(`Split transaction failed: ${result.error}`);
    }

    return result.signature;
  }

  /**
   * Executes a merge transaction
   * @param tx - Transaction signed by user
   * @param presigned - Whether the transaction is already pre-signed with escrow (default: false)
   * @returns Transaction signature
   * @throws Error if transaction execution fails
   */
  async executeMergeTx(tx: Transaction, presigned: boolean = false): Promise<string> {
    if (this._state === VaultState.Uninitialized) {
      throw new Error('Vault not initialized - cannot execute merge');
    }

    if (this._state === VaultState.Finalized) {
      throw new Error('Vault is finalized - no merges allowed, use redemption instead');
    }

    // Execute transaction - sign with escrow if not pre-signed
    this.logger.info('Executing transaction to merge tokens');
    const result = presigned
      ? await this.executionService.executeTx(tx)
      : await this.executionService.executeTx(tx, this.escrowKeypair);

    if (result.status === 'failed') {
      throw new Error(`Merge transaction failed: ${result.error}`);
    }

    return result.signature;
  }

  /**
   * Gets regular token balance for a user
   * @param user - User's public key
   * @returns Balance in smallest units
   */
  async getBalance(user: PublicKey): Promise<bigint> {
    const userAccount = await getAssociatedTokenAddress(this.regularMint, user);
    return this.tokenService.getBalance(userAccount);
  }

  /**
   * Gets pass conditional token balance for a user
   * @param user - User's public key
   * @returns Balance in smallest units
   */
  async getPassConditionalBalance(user: PublicKey): Promise<bigint> {
    const userAccount = await getAssociatedTokenAddress(this.passConditionalMint, user);
    return this.tokenService.getBalance(userAccount);
  }

  /**
   * Gets fail conditional token balance for a user
   * @param user - User's public key
   * @returns Balance in smallest units
   */
  async getFailConditionalBalance(user: PublicKey): Promise<bigint> {
    const userAccount = await getAssociatedTokenAddress(this.failConditionalMint, user);
    return this.tokenService.getBalance(userAccount);
  }

  /**
   * Gets all token balances for a user in a single call
   * @param user - User's public key
   * @returns Complete balance snapshot for all token types
   */
  async getUserBalances(user: PublicKey): Promise<ITokenBalance> {
    const [regular, passConditional, failConditional] = await Promise.all([
      this.getBalance(user),
      this.getPassConditionalBalance(user),
      this.getFailConditionalBalance(user)
    ]);
    
    return {
      regular,
      passConditional,
      failConditional
    };
  }

  /**
   * Gets total supply of regular tokens held in escrow
   * @returns Total supply in smallest units
   */
  async getTotalSupply(): Promise<bigint> {
    return this.tokenService.getBalance(this.escrow);
  }

  /**
   * Gets total supply of pass conditional tokens issued
   * @returns Total supply in smallest units
   */
  async getPassConditionalTotalSupply(): Promise<bigint> {
    return this.tokenService.getTotalSupply(this.passConditionalMint);
  }

  /**
   * Gets total supply of fail conditional tokens issued
   * @returns Total supply in smallest units
   */
  async getFailConditionalTotalSupply(): Promise<bigint> {
    return this.tokenService.getTotalSupply(this.failConditionalMint);
  }

  /**
   * Finalizes the vault when proposal ends, storing the proposal status
   * After finalization, split/merge are blocked and only redemption is allowed
   * @param proposalStatus - The final status of the proposal (Passed or Failed)
   * @throws Error if vault is already finalized or status is invalid
   * 
   * Effects:
   * - Sets finalized flag preventing new splits/merges
   * - Stores proposal status to determine which tokens can be redeemed
   */
  async finalize(proposalStatus: ProposalStatus): Promise<void> {
    if (this._state === VaultState.Uninitialized) {
      throw new Error('Vault not initialized');
    }
    
    if (this._state === VaultState.Finalized) {
      throw new Error('Vault is already finalized');
    }
    
    if (proposalStatus === ProposalStatus.Uninitialized || 
        proposalStatus === ProposalStatus.Pending) {
      throw new Error(`Cannot finalize vault with status: ${proposalStatus}`);
    }
    
    this._state = VaultState.Finalized;
    this._proposalStatus = proposalStatus;
  }

  /**
   * Builds a transaction to redeem winning conditional tokens for regular tokens
   * Only the winning conditional tokens (pass if passed, fail if failed) can be redeemed
   * Automatically handles SOL unwrapping if needed (mainnet + quote vault)
   * @param user - User's public key
   * @param presign - Whether to pre-sign with escrow (default: false)
   * @returns Transaction with blockhash and fee payer set, ready for user signature
   * @throws Error if vault not finalized or no winning tokens to redeem
   */
  async buildRedeemWinningTokensTx(user: PublicKey, presign: boolean = false): Promise<Transaction> {
    if (this._state !== VaultState.Finalized) {
      throw new Error('Cannot redeem before vault finalization');
    }

    if (this._proposalStatus === ProposalStatus.Pending) {
      throw new Error(`Cannot redeem from pending proposal`);
    }

    // Check if we need to handle wrapped SOL
    const shouldHandleSol = this.shouldHandleWrappedSOL();
    
    // Determine which conditional token is the winning token
    // Executed proposals are passed proposals that have been executed
    const isPassWinning = this._proposalStatus === ProposalStatus.Passed || 
                          this._proposalStatus === ProposalStatus.Executed;
    const winningMint = isPassWinning ? this.passConditionalMint : this.failConditionalMint;
    const winningBalance = isPassWinning 
      ? await this.getPassConditionalBalance(user)
      : await this.getFailConditionalBalance(user);
    
    if (winningBalance === 0n) {
      throw new Error(`No winning ${isPassWinning ? 'pass' : 'fail'} tokens to redeem`);
    }
    
    const tx = new Transaction();

    // Get user's token accounts
    const userRegularAccount = await getAssociatedTokenAddress(this.regularMint, user);
    const userWinningAccount = await getAssociatedTokenAddress(winningMint, user);

    // Ensure user's regular token account exists (create if needed)
    tx.add(
      createAssociatedTokenAccountIdempotentInstruction(
        user, // payer
        userRegularAccount,
        user, // owner
        this.regularMint,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      )
    )

    // Burn all winning conditional tokens
    const burnIx = this.tokenService.buildBurnIx(
      winningMint,
      userWinningAccount,
      winningBalance,
      user
    );
    tx.add(burnIx);

    // Transfer regular tokens from escrow 1:1
    const transferIx = this.tokenService.buildTransferIx(
      this.escrow,
      userRegularAccount,
      winningBalance,
      this.escrowKeypair.publicKey // escrow must sign
    );
    tx.add(transferIx);
    
    // Close the empty conditional account to recover rent
    const closeIx = this.tokenService.buildCloseAccountIx(
      userWinningAccount,
      user,
      user
    );
    tx.add(closeIx);

    // Add memo for transaction identification on Solscan
    const winningType = isPassWinning ? 'pass' : 'fail';
    const memoMessage = `%[Vault/${this.vaultType}] Redeem ${winningBalance} (${winningType}) | Proposal #${this.proposalId} | ${user.toBase58()}`;
    tx.add(createMemoIx(memoMessage));

    // If handling wrapped SOL, add unwrap instructions at the end
    if (shouldHandleSol) {
      const wrappedSolAccount = await getAssociatedTokenAddress(
        NATIVE_MINT,
        user,
        false,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );

      const unwrapInstruction = this.tokenService.buildUnwrapSolIx(
        wrappedSolAccount,
        user, // Send unwrapped SOL back to user
        user  // Owner of the wrapped SOL account
      );

      tx.add(unwrapInstruction);
    }

    // Add blockhash and fee payer so transaction can be signed
    const { blockhash } = await this.executionService.connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.feePayer = user;

    // Add compute budget instructions before any signing
    await this.executionService.addComputeBudgetInstructions(tx);

    // Pre-sign with escrow for transferring regular tokens to winner if requested
    if (presign) {
      tx.partialSign(this.escrowKeypair);
    }

    return tx;
  }

  /**
   * Executes a redeem winning tokens transaction
   * @param tx - Transaction signed by user
   * @param presigned - Whether the transaction is already pre-signed with escrow (default: false)
   * @returns Transaction signature
   * @throws Error if transaction execution fails
   */
  async executeRedeemWinningTokensTx(tx: Transaction, presigned: boolean = false): Promise<string> {
    // Execute transaction - sign with escrow if not pre-signed
    this.logger.info('Executing transaction to redeem winning tokens');
    const result = presigned
      ? await this.executionService.executeTx(tx)
      : await this.executionService.executeTx(tx, this.escrowKeypair);

    if (result.status === 'failed') {
      throw new Error(`Redeem winning tokens transaction failed: ${result.error}`);
    }

    return result.signature;
  }

  /**
   * Serializes the vault state for persistence
   * @returns Serialized vault data that can be saved to database
   */
  serialize(): IVaultSerializedData {
    return {
      // Core identifiers
      proposalId: this.proposalId,
      vaultType: this.vaultType,

      // Token mints - handle case where they might not be initialized yet
      regularMint: this.regularMint.toBase58(),
      passConditionalMint: this._passConditionalMint?.toBase58() || '',
      failConditionalMint: this._failConditionalMint?.toBase58() || '',

      // State (escrow is deterministic and doesn't need to be stored)
      state: this._state,
      proposalStatus: this._proposalStatus,

      // Token configuration
      decimals: this.decimals,

      // Note: We don't serialize keypairs, escrow, or services as those are
      // reconstructed during deserialization with proper security context
    };
  }

  /**
   * Deserializes vault data and restores the vault state
   * @param data - Serialized vault data from database
   * @param config - Configuration for reconstructing the vault
   * @returns Restored vault instance
   */
  static async deserialize(data: IVaultSerializedData, config: IVaultDeserializeConfig): Promise<Vault> {
    // Create a new vault instance with the provided config
    const vault = new Vault({
      proposalId: data.proposalId,
      vaultType: data.vaultType,
      regularMint: new PublicKey(data.regularMint),
      decimals: data.decimals,
      authority: config.authority,
      executionService: config.executionService,
      logger: config.logger
    });

    // Restore the internal state
    // These are private fields that need to be restored for a fully functional vault
    vault._state = data.state;
    vault._proposalStatus = data.proposalStatus;

    // Restore the public keys if they exist (not empty strings)
    if (data.passConditionalMint) {
      vault._passConditionalMint = new PublicKey(data.passConditionalMint);
    }
    if (data.failConditionalMint) {
      vault._failConditionalMint = new PublicKey(data.failConditionalMint);
    }

    // Regenerate the escrow public key if the vault has been initialized
    // The escrow keypair is deterministically generated, so we can recreate it
    if (vault._state !== VaultState.Uninitialized && data.regularMint) {
      // The escrowKeypair is already generated in the constructor using
      // generateDeterministicEscrowKeypair(), so we just need to derive
      // the associated token address
      vault._escrow = await getAssociatedTokenAddress(
        new PublicKey(data.regularMint),
        vault.escrowKeypair.publicKey
      );
    }

    // Clear the mint keypairs as they're only needed for initialization
    // and we're loading an already initialized vault
    vault.passMintKeypair = null;
    vault.failMintKeypair = null;

    return vault;
  }

}