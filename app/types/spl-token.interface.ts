import { PublicKey, Keypair, TransactionInstruction } from '@solana/web3.js';
import { AuthorityType } from '@solana/spl-token';

/**
 * Interface for SPL Token Service
 * Provides both transaction building and execution methods
 */
export interface ISPLTokenService {
  /**
   * Creates a new SPL token mint
   * @param decimals - Number of decimals for the token
   * @param mintAuthority - Authority that can mint new tokens
   * @param payer - Keypair that pays for the mint creation
   * @returns PublicKey of the created mint
   */
  createMint(
    decimals: number,
    mintAuthority: PublicKey,
    payer: Keypair
  ): Promise<PublicKey>;

  /**
   * Builds instructions to create a new SPL token mint
   * @param mintKeypair - Keypair for the new mint account
   * @param decimals - Number of decimals for the token
   * @param mintAuthority - Authority that can mint new tokens
   * @param payer - Public key that pays for the mint creation
   * @returns Array of instructions to create and initialize the mint
   */
  buildCreateMintIxs(
    mintKeypair: Keypair,
    decimals: number,
    mintAuthority: PublicKey,
    payer: PublicKey
  ): Promise<TransactionInstruction[]>;

  /**
   * Builds a mint instruction
   * @param mint - The token mint to create tokens from
   * @param destination - The token account to receive minted tokens
   * @param amount - Amount to mint in smallest units
   * @param mintAuthority - Public key of mint authority
   * @returns Mint instruction
   */
  buildMintToIx(
    mint: PublicKey,
    destination: PublicKey,
    amount: bigint,
    mintAuthority: PublicKey
  ): TransactionInstruction;

  /**
   * Mints new tokens to a destination account
   * @param mint - The token mint to create tokens from
   * @param destination - The token account to receive minted tokens
   * @param amount - Amount to mint in smallest units
   * @param mintAuthority - Keypair with mint authority
   * @returns Transaction signature
   */
  mintTo(
    mint: PublicKey,
    destination: PublicKey,
    amount: bigint,
    mintAuthority: Keypair
  ): Promise<string>;

  /**
   * Builds a burn instruction
   * @param mint - The token mint of tokens being burned
   * @param account - The token account to burn from
   * @param amount - Amount to burn in smallest units
   * @param owner - Public key of account owner
   * @returns Burn instruction
   */
  buildBurnIx(
    mint: PublicKey,
    account: PublicKey,
    amount: bigint,
    owner: PublicKey
  ): TransactionInstruction;

  /**
   * Burns tokens from an account
   * @param mint - The token mint of tokens being burned
   * @param account - The token account to burn from
   * @param amount - Amount to burn in smallest units
   * @param owner - Keypair that owns the token account
   * @returns Transaction signature
   */
  burn(
    mint: PublicKey,
    account: PublicKey,
    amount: bigint,
    owner: Keypair
  ): Promise<string>;

  /**
   * Builds a transfer instruction
   * @param source - The token account to transfer from
   * @param destination - The token account to transfer to
   * @param amount - Amount to transfer in smallest units
   * @param owner - Public key of source account owner
   * @returns Transfer instruction
   */
  buildTransferIx(
    source: PublicKey,
    destination: PublicKey,
    amount: bigint,
    owner: PublicKey
  ): TransactionInstruction;

  /**
   * Transfers tokens between accounts
   * @param source - The token account to transfer from
   * @param destination - The token account to transfer to
   * @param amount - Amount to transfer in smallest units
   * @param owner - Keypair that owns the source account
   * @returns Transaction signature
   */
  transfer(
    source: PublicKey,
    destination: PublicKey,
    amount: bigint,
    owner: Keypair
  ): Promise<string>;

  /**
   * Builds a close account instruction
   * @param account - The token account to close
   * @param destination - Account to receive remaining SOL
   * @param owner - Public key of account owner
   * @returns Close account instruction
   */
  buildCloseAccountIx(
    account: PublicKey,
    destination: PublicKey,
    owner: PublicKey
  ): TransactionInstruction;

  /**
   * Closes a token account and recovers the rent SOL
   * @param account - The token account to close
   * @param destination - Account to receive remaining SOL
   * @param owner - Keypair that owns the token account
   * @returns Transaction signature
   */
  closeAccount(
    account: PublicKey,
    destination: PublicKey,
    owner: Keypair
  ): Promise<string>;

  /**
   * Gets or creates an associated token account
   * @param mint - The token mint
   * @param owner - The owner of the token account
   * @param payer - The account paying for creation if needed
   * @returns PublicKey of the associated token account
   */
  getOrCreateAssociatedTokenAccount(
    mint: PublicKey,
    owner: PublicKey,
    payer: Keypair
  ): Promise<PublicKey>;

  /**
   * Gets detailed information about a token account
   * @param address - The token account address
   * @returns Token account info or null if account doesn't exist
   */
  getTokenAccountInfo(address: PublicKey): Promise<ITokenAccountInfo | null>;

  /**
   * Gets the token balance of an account
   * @param account - The token account address
   * @returns Balance in smallest units
   */
  getBalance(account: PublicKey): Promise<bigint>;

  /**
   * Gets the total supply of tokens for a mint
   * @param mint - The token mint address
   * @returns Total supply in smallest units
   */
  getTotalSupply(mint: PublicKey): Promise<bigint>;

  /**
   * Builds a set authority instruction
   * @param mint - The token mint to update authority
   * @param newAuthority - The new authority (or null to revoke)
   * @param authorityType - Type of authority to set (MintTokens, FreezeAccount, etc)
   * @param currentAuthority - Current authority public key
   * @returns Set authority instruction
   */
  buildSetAuthorityIx(
    mint: PublicKey,
    newAuthority: PublicKey | null,
    authorityType: AuthorityType,
    currentAuthority: PublicKey
  ): TransactionInstruction;

  /**
   * Sets or revokes an authority on a mint
   * @param mint - The token mint to update authority
   * @param newAuthority - The new authority (or null to revoke)
   * @param authorityType - Type of authority to set
   * @param currentAuthority - Current authority keypair
   * @returns Transaction signature
   */
  setAuthority(
    mint: PublicKey,
    newAuthority: PublicKey | null,
    authorityType: AuthorityType,
    currentAuthority: Keypair
  ): Promise<string>;

  /**
   * Builds instructions to wrap SOL into wrapped SOL tokens
   * @param owner - The owner of the wrapped SOL account
   * @param amount - Amount of SOL to wrap in lamports
   * @returns Array of instructions to wrap SOL
   */
  buildWrapSolIxs(
    owner: PublicKey,
    amount: bigint
  ): Promise<TransactionInstruction[]>;

  /**
   * Builds instruction to unwrap SOL by closing the wrapped SOL account
   * @param wrappedSolAccount - The wrapped SOL token account to close
   * @param destination - Account to receive the unwrapped SOL
   * @param owner - The owner of the wrapped SOL account
   * @returns Close account instruction to unwrap SOL
   */
  buildUnwrapSolIx(
    wrappedSolAccount: PublicKey,
    destination: PublicKey,
    owner: PublicKey
  ): TransactionInstruction;
}

/**
 * Token account information
 */
export interface ITokenAccountInfo {
  address: PublicKey;
  mint: PublicKey;
  owner: PublicKey;
  amount: bigint;
  isInitialized: boolean;
}