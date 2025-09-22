import { PublicKey, Connection, Keypair, Transaction } from '@solana/web3.js';
import { ProposalStatus } from './moderator.interface';

/**
 * Vault type indicating whether this vault manages base or quote tokens
 */
export enum VaultType {
  Base = 'base',
  Quote = 'quote'
}

/**
 * Vault state indicating the operational status
 */
export enum VaultState {
  Uninitialized = 'Uninitialized', // Vault not yet initialized
  Active = 'Active',                // Vault is active and can perform splits/merges
  Finalized = 'Finalized'           // Vault is finalized, only redemptions allowed
}

/**
 * Token type for distinguishing between base and quote tokens
 */
export enum TokenType {
  Base = 'base',   // Primary token (e.g., USDC)
  Quote = 'quote'  // Secondary token (e.g., SOL)
}

/**
 * Complete token balance snapshot for a user
 */
export interface ITokenBalance {
  regular: bigint;        // Regular token balance (base or quote)
  passConditional: bigint;   // Pass conditional token balance
  failConditional: bigint;   // Fail conditional token balance
}

/**
 * Configuration for creating a new vault
 */
export interface IVaultConfig {
  proposalId: number;        // Associated proposal ID
  vaultType: VaultType;      // Base or Quote vault
  regularMint: PublicKey;    // SPL token mint for regular token (base or quote)
  decimals: number;          // Number of decimals for conditional tokens
  connection: Connection;    // Solana RPC connection
  authority: Keypair;        // Vault authority keypair (payer and mint authority)
}

/**
 * Interface for vault managing 1:1 token exchange in prediction markets
 * Each vault manages both pass and fail conditional tokens for a single regular token type
 */
export interface IVault {
  // Immutable properties
  readonly proposalId: number;              // Associated proposal ID
  readonly vaultType: VaultType;            // Base or Quote vault type
  readonly regularMint: PublicKey;          // Regular token mint (base or quote)
  readonly passConditionalMint: PublicKey;  // Pass conditional token mint (created on init)
  readonly failConditionalMint: PublicKey;  // Fail conditional token mint (created on init)
  readonly escrow: PublicKey;               // Escrow holding regular tokens
  readonly state: VaultState;               // Current operational state of the vault
  readonly proposalStatus: ProposalStatus;  // Status of the proposal (determines winning tokens)
  
  /**
   * Initializes vault by creating conditional token mints and escrow accounts
   * Must be called before any other operations
   */
  initialize(): Promise<void>;
  
  /**
   * Builds transaction for splitting regular tokens into BOTH pass and fail conditional tokens
   * User receives equal amounts of both conditional tokens for each regular token
   * @param user - User's public key who is splitting tokens
   * @param amount - Amount to split in smallest units
   * @param skipBalanceCheck - Skip balance validation (used for wrapped SOL on mainnet)
   * @returns Unsigned transaction requiring user and authority signatures
   * @throws Error if insufficient balance or vault is finalized
   */
  buildSplitTx(
    user: PublicKey,
    amount: bigint,
    skipBalanceCheck?: boolean
  ): Promise<Transaction>;
  
  /**
   * Builds transaction for merging BOTH pass and fail conditional tokens back to regular tokens
   * Requires equal amounts of both conditional tokens to receive regular tokens
   * @param user - User's public key who is merging tokens
   * @param amount - Amount to merge in smallest units (of each conditional token)
   * @returns Unsigned transaction requiring user and authority signatures
   * @throws Error if insufficient balance of either conditional token or vault is finalized
   */
  buildMergeTx(
    user: PublicKey,
    amount: bigint
  ): Promise<Transaction>;
  
  /**
   * Executes a pre-signed split transaction
   * @param transaction - Transaction already signed by user
   * @returns Transaction signature
   */
  executeSplitTx(transaction: Transaction): Promise<string>;
  
  /**
   * Executes a pre-signed merge transaction
   * @param transaction - Transaction already signed by user
   * @returns Transaction signature
   */
  executeMergeTx(transaction: Transaction): Promise<string>;
  
  /**
   * Gets regular token balance for a user
   * @param user - User's public key
   * @returns Balance in smallest units
   */
  getBalance(user: PublicKey): Promise<bigint>;
  
  /**
   * Gets pass conditional token balance for a user
   * @param user - User's public key
   * @returns Balance in smallest units
   */
  getPassConditionalBalance(user: PublicKey): Promise<bigint>;
  
  /**
   * Gets fail conditional token balance for a user
   * @param user - User's public key
   * @returns Balance in smallest units
   */
  getFailConditionalBalance(user: PublicKey): Promise<bigint>;
  
  /**
   * Gets all token balances for a user
   * @param user - User's public key
   * @returns Complete balance snapshot
   */
  getUserBalances(user: PublicKey): Promise<ITokenBalance>;
  
  /**
   * Gets total supply of regular tokens held in escrow
   * @returns Total supply in smallest units
   */
  getTotalSupply(): Promise<bigint>;
  
  /**
   * Gets total supply of pass conditional tokens issued
   * @returns Total supply in smallest units
   */
  getPassConditionalTotalSupply(): Promise<bigint>;
  
  /**
   * Gets total supply of fail conditional tokens issued
   * @returns Total supply in smallest units
   */
  getFailConditionalTotalSupply(): Promise<bigint>;
  
  /**
   * Finalizes vault when proposal ends, storing the proposal status
   * After finalization, split/merge are blocked and only redemption is allowed
   * @param proposalStatus - The final status of the proposal (Passed or Failed)
   */
  finalize(proposalStatus: ProposalStatus): Promise<void>;
  
  /**
   * Builds a transaction to redeem winning conditional tokens for regular tokens
   * Only the winning conditional tokens (pass if passed, fail if failed) can be redeemed
   * @param user - User's public key
   * @returns Unsigned transaction requiring user and authority signatures
   * @throws Error if vault not finalized or no winning tokens to redeem
   */
  buildRedeemWinningTokensTx(user: PublicKey): Promise<Transaction>;
  
  /**
   * Executes a pre-signed redeem winning tokens transaction
   * @param transaction - Transaction already signed by user
   * @returns Transaction signature
   */
  executeRedeemWinningTokensTx(transaction: Transaction): Promise<string>;
}