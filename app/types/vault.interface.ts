import { PublicKey } from '@solana/web3.js';

export enum VaultType {
  Pass = 'pass',
  Fail = 'fail'
}

export enum TokenType {
  Base = 'base',
  Quote = 'quote'
}

export interface ITokenBalance {
  base: bigint;
  quote: bigint;
  conditionalBase: bigint;
  conditionalQuote: bigint;
}

export interface ISplitRequest {
  user: PublicKey;
  tokenType: TokenType;
  amount: bigint;
}

export interface IMergeRequest {
  user: PublicKey;
  tokenType: TokenType;
  amount: bigint;
}

export interface IVaultConfig {
  proposalId: number;
  vaultType: VaultType;
  baseMint: PublicKey;
  quoteMint: PublicKey;
}

export interface IVault {
  readonly proposalId: number;
  readonly vaultType: VaultType;
  readonly baseMint: PublicKey;
  readonly quoteMint: PublicKey;
  readonly conditionalBaseMint: PublicKey;
  readonly conditionalQuoteMint: PublicKey;
  
  splitTokens(request: ISplitRequest): Promise<void>;
  mergeTokens(request: IMergeRequest): Promise<void>;
  
  getBalance(user: PublicKey, tokenType: TokenType): bigint;
  getConditionalBalance(user: PublicKey, tokenType: TokenType): bigint;
  getUserBalances(user: PublicKey): ITokenBalance;
  
  getTotalSupply(tokenType: TokenType): bigint;
  getConditionalTotalSupply(tokenType: TokenType): bigint;
}