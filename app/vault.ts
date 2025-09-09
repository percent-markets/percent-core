import { PublicKey, Keypair, Connection, Transaction } from '@solana/web3.js';
import { 
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID
} from '@solana/spl-token';
import { 
  IVault, 
  IVaultConfig, 
  ITokenBalance, 
  VaultType,
  VaultState,
  IEscrowInfo
} from './types/vault.interface';
import { ProposalStatus } from './types/moderator.interface';
import { SPLTokenService, AuthorityType } from './services/spl-token.service';
import { ISPLTokenService } from './types/spl-token.interface';
import { ExecutionService } from './services/execution.service';
import { IExecutionService, IExecutionConfig } from './types/execution.interface';

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
  private _isFinalized: boolean = false;
  private _proposalStatus: ProposalStatus = ProposalStatus.Pending;

  // Public readonly getters
  get passConditionalMint(): PublicKey { return this._passConditionalMint; }
  get failConditionalMint(): PublicKey { return this._failConditionalMint; }
  get escrow(): PublicKey { return this._escrow; }
  get state(): VaultState { return this._state; }
  get isFinalized(): boolean { return this._isFinalized; }
  get proposalStatus(): ProposalStatus { return this._proposalStatus; }

  private connection: Connection;
  private authority: Keypair;
  private tokenService: ISPLTokenService;
  private executionService: IExecutionService;

  constructor(config: IVaultConfig) {
    this.proposalId = config.proposalId;
    this.vaultType = config.vaultType;
    this.regularMint = config.regularMint;
    this.decimals = config.decimals;
    this.connection = config.connection;
    this.authority = config.authority;
    
    // Initialize services with ExecutionService
    this.tokenService = new SPLTokenService(
      config.connection,
      config.connection.rpcEndpoint
    );
    
    const executionConfig: IExecutionConfig = {
      rpcEndpoint: config.connection.rpcEndpoint,
      commitment: 'confirmed',
      maxRetries: 3,
      skipPreflight: false
    };
    
    this.executionService = new ExecutionService(executionConfig);
  }

  /**
   * Initializes the vault by creating both pass and fail conditional token mints and escrow account
   * Must be called before any split/merge operations
   * Creates two conditional mints (pass/fail) with decimals specified in constructor
   */
  async initialize(): Promise<void> {
    if (this._state !== VaultState.Uninitialized) {
      throw new Error('Vault already initialized');
    }
    
    // Create both pass and fail conditional token mints with specified decimals
    this._passConditionalMint = await this.tokenService.createMint(
      this.decimals,
      this.authority.publicKey,
      this.authority
    );
    
    this._failConditionalMint = await this.tokenService.createMint(
      this.decimals,
      this.authority.publicKey,
      this.authority
    );
    
    // Create escrow account for regular tokens
    this._escrow = await this.tokenService.getOrCreateAssociatedTokenAccount(
      this.regularMint,
      this.authority.publicKey,
      this.authority
    );
    
    // Update state to Active
    this._state = VaultState.Active;
  }

  /**
   * Builds a transaction for splitting regular tokens into BOTH pass and fail conditional tokens
   * User receives equal amounts of both conditional tokens for each regular token
   * @param user - User's public key who is splitting tokens
   * @param amount - Amount to split in smallest units
   * @returns Transaction with blockhash and fee payer set, ready for user signature
   * @throws Error if vault is finalized, amount is invalid, or insufficient balance
   */
  async buildSplitTx(
    user: PublicKey,
    amount: bigint
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
    
    // Check user has sufficient regular token balance
    const userBalance = await this.getBalance(user);
    if (amount > userBalance) {
      throw new Error(
        `Insufficient ${this.vaultType} token balance: requested ${amount}, available ${userBalance}`
      );
    }
    
    const tx = new Transaction();
    
    // Get user's token accounts
    const userRegularAccount = await getAssociatedTokenAddress(this.regularMint, user);
    const userPassAccount = await getAssociatedTokenAddress(this.passConditionalMint, user);
    const userFailAccount = await getAssociatedTokenAddress(this.failConditionalMint, user);
    
    // Check if pass conditional account needs to be created
    const passAccountInfo = await this.tokenService.getTokenAccountInfo(userPassAccount);
    if (!passAccountInfo) {
      tx.add(
        createAssociatedTokenAccountInstruction(
          user, // payer
          userPassAccount,
          user, // owner
          this.passConditionalMint,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        )
      );
    }
    
    // Check if fail conditional account needs to be created
    const failAccountInfo = await this.tokenService.getTokenAccountInfo(userFailAccount);
    if (!failAccountInfo) {
      tx.add(
        createAssociatedTokenAccountInstruction(
          user, // payer
          userFailAccount,
          user, // owner
          this.failConditionalMint,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        )
      );
    }
    
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
    
    // Add blockhash and fee payer so transaction can be signed
    const { blockhash } = await this.connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.feePayer = user;
    
    return tx;
  }

  /**
   * Builds a transaction for merging BOTH pass and fail conditional tokens back to regular tokens
   * Requires equal amounts of both conditional tokens to receive regular tokens
   * @param user - User's public key who is merging tokens
   * @param amount - Amount to merge in smallest units (of each conditional token)
   * @returns Transaction with blockhash and fee payer set, ready for user signature
   * @throws Error if insufficient balance of either conditional token or vault is finalized
   */
  async buildMergeTx(
    user: PublicKey,
    amount: bigint
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
    
    // Transfer regular tokens from escrow to user (authority signs)
    const transferIx = this.tokenService.buildTransferIx(
      this.escrow,
      userRegularAccount,
      amount,
      this.authority.publicKey // authority must sign
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
    
    // Add blockhash and fee payer so transaction can be signed
    const { blockhash } = await this.connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.feePayer = user;
    
    return tx;
  }

  /**
   * Executes a pre-signed split transaction
   * @param tx - Transaction already signed by user
   * @returns Transaction signature
   * @throws Error if transaction execution fails
   * 
   * Note: In production, user signs first, then this method adds authority signature
   */
  async executeSplitTx(tx: Transaction): Promise<string> {
    if (this._state === VaultState.Uninitialized) {
      throw new Error('Vault not initialized - cannot execute split');
    }
    
    if (this._state === VaultState.Finalized) {
      throw new Error('Vault is finalized - no splits allowed');
    }
    
    // Add authority signature to the user-signed transaction
    console.log('Executing transaction to split tokens');
    const result = await this.executionService.executeTx(
      tx,
      this.authority
    );
    
    if (result.status === 'failed') {
      throw new Error(`Split transaction failed: ${result.error}`);
    }
    
    return result.signature;
  }

  /**
   * Executes a pre-signed merge transaction
   * @param tx - Transaction already signed by user
   * @returns Transaction signature
   * @throws Error if transaction execution fails
   * 
   * Note: In production, user signs first, then this method adds authority signature
   */
  async executeMergeTx(tx: Transaction): Promise<string> {
    if (this._state === VaultState.Uninitialized) {
      throw new Error('Vault not initialized - cannot execute merge');
    }
    
    if (this._state === VaultState.Finalized) {
      throw new Error('Vault is finalized - no merges allowed, use redemption instead');
    }
    
    // Add authority signature to the user-signed transaction
    console.log('Executing transaction to merge tokens');
    const result = await this.executionService.executeTx(
      tx,
      this.authority
    );
    
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
    this._isFinalized = true;
    this._proposalStatus = proposalStatus;
  }

  /**
   * Builds a transaction to redeem winning conditional tokens for regular tokens
   * Only the winning conditional tokens (pass if passed, fail if failed) can be redeemed
   * @param user - User's public key
   * @returns Transaction with blockhash and fee payer set, ready for user signature
   * @throws Error if vault not finalized or no winning tokens to redeem
   */
  async buildRedeemWinningTokensTx(user: PublicKey): Promise<Transaction> {
    if (this._state !== VaultState.Finalized) {
      throw new Error('Cannot redeem before vault finalization');
    }
    
    if (this._proposalStatus === ProposalStatus.Pending) {
      throw new Error(`Cannot redeem from pending proposal`);
    }
    
    // Determine which conditional token is the winning token
    const isPassWinning = this._proposalStatus === ProposalStatus.Passed;
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
      this.authority.publicKey
    );
    tx.add(transferIx);
    
    // Close the empty conditional account to recover rent
    const closeIx = this.tokenService.buildCloseAccountIx(
      userWinningAccount,
      user,
      user
    );
    tx.add(closeIx);
    
    // Add blockhash and fee payer so transaction can be signed
    const { blockhash } = await this.connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.feePayer = user;
    
    return tx;
  }

  /**
   * Executes a pre-signed redeem winning tokens transaction
   * @param tx - Transaction already signed by user
   * @returns Transaction signature
   * @throws Error if transaction execution fails
   */
  async executeRedeemWinningTokensTx(tx: Transaction): Promise<string> {
    // Add authority signature to the user-signed transaction
    console.log('Executing transaction to redeem winning tokens');
    const result = await this.executionService.executeTx(
      tx,
      this.authority
    );
    
    if (result.status === 'failed') {
      throw new Error(`Redeem winning tokens transaction failed: ${result.error}`);
    }
    
    return result.signature;
  }

  /**
   * Builds transaction to close empty token accounts and recover SOL rent
   * @param user - User's public key
   * @returns Transaction with blockhash and fee payer set, ready for user signature
   * 
   * Note: Only includes instructions for accounts with zero balance
   */
  async buildCloseEmptyAccountsTx(user: PublicKey): Promise<Transaction> {
    const transaction = new Transaction();
    
    // Check both conditional token accounts
    const passAccount = await getAssociatedTokenAddress(this.passConditionalMint, user);
    const failAccount = await getAssociatedTokenAddress(this.failConditionalMint, user);
    
    const passBalance = await this.tokenService.getBalance(passAccount);
    if (passBalance === 0n) {
      const closeTx = this.tokenService.buildCloseAccountIx(
        passAccount,
        user,  // rent destination
        user   // owner who must sign
      );
      transaction.add(closeTx);
    }
    
    const failBalance = await this.tokenService.getBalance(failAccount);
    if (failBalance === 0n) {
      const closeTx = this.tokenService.buildCloseAccountIx(
        failAccount,
        user,  // rent destination  
        user   // owner who must sign
      );
      transaction.add(closeTx);
    }
    
    // Add blockhash and fee payer so transaction can be signed
    const { blockhash } = await this.connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = user;
    
    return transaction;
  }

  /**
   * Executes a pre-signed close empty accounts transaction
   * @param transaction - Transaction already signed by user
   * @returns Transaction signature
   * @throws Error if transaction execution fails
   * 
   * Note: User must sign the transaction as they own the token accounts
   */
  async executeCloseEmptyAccountsTx(transaction: Transaction): Promise<string> {
    // Transaction is already signed by user (they own the accounts)
    // No authority signature needed - just send the transaction
    try {
      const signature = await this.connection.sendRawTransaction(
        transaction.serialize(),
        { skipPreflight: false }
      );
      
      // Wait for confirmation
      await this.connection.confirmTransaction(signature, 'confirmed');
      
      return signature;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Close accounts transaction failed: ${errorMessage}`);
    }
  }

  /**
   * Gets escrow and conditional mint information
   * @returns Escrow accounts and conditional token mints
   */
  getEscrowInfo(): IEscrowInfo {
    return {
      escrow: this.escrow,
      passConditionalMint: this.passConditionalMint,
      failConditionalMint: this.failConditionalMint
    };
  }

  /**
   * TEST ONLY: Resets vault finalization state for testing
   * WARNING: This method bypasses normal blockchain immutability for testing purposes
   * @throws Error if not in test environment
   */
  __resetFinalizationForTesting(): void {
    // Safety check - only allow in test environment
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('__resetFinalizationForTesting() is only available in test environment');
    }
    
    // Reset finalization state to allow testing different scenarios
    this._isFinalized = false;
    this._proposalStatus = ProposalStatus.Pending;
    
    // Note: We don't reset the mints or escrow as those are on-chain
    // This is purely for testing finalization logic
  }
}