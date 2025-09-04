import { PublicKey, Keypair } from '@solana/web3.js';
import { 
  IVault, 
  IVaultConfig, 
  ISplitRequest, 
  IMergeRequest, 
  ITokenBalance, 
  VaultType, 
  TokenType 
} from './types/vault.interface';
import * as crypto from 'crypto';

/**
 * Vault class for managing 1:1 exchange between regular and conditional tokens
 * Maintains in-memory balance tracking for off-chain simulation
 */
export class Vault implements IVault {
  public readonly proposalId: number;
  public readonly vaultType: VaultType;
  public readonly baseMint: PublicKey;
  public readonly quoteMint: PublicKey;
  public readonly conditionalBaseMint: PublicKey;
  public readonly conditionalQuoteMint: PublicKey;

  private baseBalances: Map<string, bigint> = new Map();
  private quoteBalances: Map<string, bigint> = new Map();
  private conditionalBaseBalances: Map<string, bigint> = new Map();
  private conditionalQuoteBalances: Map<string, bigint> = new Map();

  constructor(config: IVaultConfig) {
    this.proposalId = config.proposalId;
    this.vaultType = config.vaultType;
    this.baseMint = config.baseMint;
    this.quoteMint = config.quoteMint;
    
    this.conditionalBaseMint = this.generateConditionalMint(
      config.baseMint, 
      config.proposalId, 
      config.vaultType
    );
    this.conditionalQuoteMint = this.generateConditionalMint(
      config.quoteMint, 
      config.proposalId, 
      config.vaultType
    );
  }

  /**
   * Generates a deterministic PublicKey for conditional tokens
   * Based on original mint, proposal ID, and vault type
   */
  private generateConditionalMint(
    originalMint: PublicKey, 
    proposalId: number, 
    vaultType: VaultType
  ): PublicKey {
    const seed = `${originalMint.toBase58()}_${proposalId}_${vaultType}`;
    const hash = crypto.createHash('sha256').update(seed).digest();
    const keypair = Keypair.fromSeed(hash.subarray(0, 32));
    return keypair.publicKey;
  }

  /**
   * Splits regular tokens into conditional tokens (1:1 exchange)
   * User deposits regular tokens and receives conditional tokens
   */
  async splitTokens(request: ISplitRequest): Promise<void> {
    const userKey = request.user.toBase58();
    const amount = request.amount;
    
    if (amount <= 0n) {
      throw new Error('Amount must be positive');
    }
    
    const regularBalance = this.getRegularBalance(userKey, request.tokenType);
    
    if (regularBalance < amount) {
      throw new Error(`Insufficient balance. Available: ${regularBalance}, Requested: ${amount}`);
    }
    
    if (request.tokenType === TokenType.Base) {
      this.baseBalances.set(userKey, regularBalance - amount);
      
      const currentConditionalBalance = this.conditionalBaseBalances.get(userKey) || 0n;
      this.conditionalBaseBalances.set(userKey, currentConditionalBalance + amount);
    } else {
      this.quoteBalances.set(userKey, regularBalance - amount);
      
      const currentConditionalBalance = this.conditionalQuoteBalances.get(userKey) || 0n;
      this.conditionalQuoteBalances.set(userKey, currentConditionalBalance + amount);
    }
  }

  /**
   * Merges conditional tokens back into regular tokens (1:1 redemption)
   * User deposits conditional tokens and receives regular tokens
   */
  async mergeTokens(request: IMergeRequest): Promise<void> {
    const userKey = request.user.toBase58();
    const amount = request.amount;
    
    if (amount <= 0n) {
      throw new Error('Amount must be positive');
    }
    
    const conditionalBalance = this.getConditionalBalanceInternal(userKey, request.tokenType);
    
    if (conditionalBalance < amount) {
      throw new Error(`Insufficient conditional balance. Available: ${conditionalBalance}, Requested: ${amount}`);
    }
    
    if (request.tokenType === TokenType.Base) {
      this.conditionalBaseBalances.set(userKey, conditionalBalance - amount);
      
      const currentRegularBalance = this.baseBalances.get(userKey) || 0n;
      this.baseBalances.set(userKey, currentRegularBalance + amount);
    } else {
      this.conditionalQuoteBalances.set(userKey, conditionalBalance - amount);
      
      const currentRegularBalance = this.quoteBalances.get(userKey) || 0n;
      this.quoteBalances.set(userKey, currentRegularBalance + amount);
    }
  }

  /**
   * Gets regular token balance for a user
   */
  getBalance(user: PublicKey, tokenType: TokenType): bigint {
    const userKey = user.toBase58();
    return this.getRegularBalance(userKey, tokenType);
  }

  /**
   * Gets conditional token balance for a user
   */
  getConditionalBalance(user: PublicKey, tokenType: TokenType): bigint {
    const userKey = user.toBase58();
    return this.getConditionalBalanceInternal(userKey, tokenType);
  }

  /**
   * Gets all token balances for a user
   */
  getUserBalances(user: PublicKey): ITokenBalance {
    const userKey = user.toBase58();
    return {
      base: this.baseBalances.get(userKey) || 0n,
      quote: this.quoteBalances.get(userKey) || 0n,
      conditionalBase: this.conditionalBaseBalances.get(userKey) || 0n,
      conditionalQuote: this.conditionalQuoteBalances.get(userKey) || 0n
    };
  }

  /**
   * Gets total supply of regular tokens in the vault
   */
  getTotalSupply(tokenType: TokenType): bigint {
    const balanceMap = tokenType === TokenType.Base 
      ? this.baseBalances 
      : this.quoteBalances;
    
    let total = 0n;
    for (const balance of balanceMap.values()) {
      total += balance;
    }
    return total;
  }

  /**
   * Gets total supply of conditional tokens issued
   */
  getConditionalTotalSupply(tokenType: TokenType): bigint {
    const balanceMap = tokenType === TokenType.Base 
      ? this.conditionalBaseBalances 
      : this.conditionalQuoteBalances;
    
    let total = 0n;
    for (const balance of balanceMap.values()) {
      total += balance;
    }
    return total;
  }

  /**
   * Helper method to deposit regular tokens (for testing/initialization)
   * In production, this would be replaced by actual token transfers
   */
  depositTokens(user: PublicKey, tokenType: TokenType, amount: bigint): void {
    if (amount <= 0n) {
      throw new Error('Amount must be positive');
    }
    
    const userKey = user.toBase58();
    
    if (tokenType === TokenType.Base) {
      const current = this.baseBalances.get(userKey) || 0n;
      this.baseBalances.set(userKey, current + amount);
    } else {
      const current = this.quoteBalances.get(userKey) || 0n;
      this.quoteBalances.set(userKey, current + amount);
    }
  }

  /**
   * Helper method to get regular balance
   */
  private getRegularBalance(userKey: string, tokenType: TokenType): bigint {
    if (tokenType === TokenType.Base) {
      return this.baseBalances.get(userKey) || 0n;
    } else {
      return this.quoteBalances.get(userKey) || 0n;
    }
  }

  /**
   * Helper method to get conditional balance
   */
  private getConditionalBalanceInternal(userKey: string, tokenType: TokenType): bigint {
    if (tokenType === TokenType.Base) {
      return this.conditionalBaseBalances.get(userKey) || 0n;
    } else {
      return this.conditionalQuoteBalances.get(userKey) || 0n;
    }
  }
}