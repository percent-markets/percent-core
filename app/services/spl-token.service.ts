import {
  Connection,
  PublicKey,
  Keypair,
  Transaction,
  TransactionInstruction,
  SystemProgram
} from '@solana/web3.js';
import {
  createInitializeMintInstruction,
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
  createBurnInstruction,
  createTransferInstruction,
  createCloseAccountInstruction,
  createSetAuthorityInstruction,
  createSyncNativeInstruction,
  createInitializeAccountInstruction,
  getAssociatedTokenAddress,
  getMint,
  getAccount,
  AuthorityType,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  NATIVE_MINT,
  MINT_SIZE,
  ACCOUNT_SIZE,
  getMinimumBalanceForRentExemptMint,
  getMinimumBalanceForRentExemptAccount
} from '@solana/spl-token';
import { ExecutionService } from './execution.service';
import { IExecutionConfig } from '../types/execution.interface';
import { ISPLTokenService, ITokenAccountInfo } from '../types/spl-token.interface';

// Re-export AuthorityType and NATIVE_MINT for external use
export { AuthorityType, NATIVE_MINT } from '@solana/spl-token';

/**
 * SPL Token Service
 * Provides both transaction building and execution methods
 */
export class SPLTokenService implements ISPLTokenService {
  private connection: Connection;
  private executionService: ExecutionService;

  constructor(connection: Connection, rpcEndpoint?: string) {
    this.connection = connection;
    const executionConfig: IExecutionConfig = {
      rpcEndpoint: rpcEndpoint || connection.rpcEndpoint,
      commitment: 'confirmed',
      maxRetries: 3,
      skipPreflight: false
    };
    // Pass the same connection to ExecutionService to ensure consistency
    this.executionService = new ExecutionService(executionConfig, connection);
  }

  /**
   * Creates a new SPL token mint
   * @param decimals - Number of decimals for the token
   * @param mintAuthority - Authority that can mint new tokens
   * @param payer - Keypair that pays for the mint creation
   * @returns PublicKey of the created mint
   */
  async createMint(
    decimals: number,
    mintAuthority: PublicKey,
    payer: Keypair
  ): Promise<PublicKey> {
    const mintKeypair = Keypair.generate();
    const lamports = await getMinimumBalanceForRentExemptMint(this.connection);
    
    // Log rent cost for transparency
    console.log(`Creating SPL token mint - Rent cost: ${lamports} lamports (${lamports / 1e9} SOL)`);

    const transaction = new Transaction().add(
      SystemProgram.createAccount({
        fromPubkey: payer.publicKey,
        newAccountPubkey: mintKeypair.publicKey,
        space: MINT_SIZE,
        lamports,
        programId: TOKEN_PROGRAM_ID,
      }),
      createInitializeMintInstruction(
        mintKeypair.publicKey,
        decimals,
        mintAuthority,
        null, // Freeze authority always null - we don't freeze accounts in prediction markets
        TOKEN_PROGRAM_ID
      )
    );
    console.log('Executing transaction to create mint');
    const result = await this.executionService.executeTx(
      transaction,
      payer,
      [mintKeypair]  // Pass mint keypair as additional signer
    );

    if (result.status === 'failed') {
      throw new Error(`Failed to create mint: ${result.error}`);
    }

    return mintKeypair.publicKey;
  }

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
  ): TransactionInstruction {
    return createMintToInstruction(
      mint,
      destination,
      mintAuthority,
      amount,
      [],
      TOKEN_PROGRAM_ID
    );
  }

  /**
   * Mints new tokens to a destination account
   * @param mint - The token mint to create tokens from
   * @param destination - The token account to receive minted tokens
   * @param amount - Amount to mint in smallest units
   * @param mintAuthority - Keypair with mint authority
   * @returns Transaction signature
   */
  async mintTo(
    mint: PublicKey,
    destination: PublicKey,
    amount: bigint,
    mintAuthority: Keypair
  ): Promise<string> {
    const ix = this.buildMintToIx(
      mint,
      destination,
      amount,
      mintAuthority.publicKey
    );
    const transaction = new Transaction().add(ix);
    console.log('Executing transaction to mint tokens');
    const result = await this.executionService.executeTx(
      transaction,
      mintAuthority
    );

    if (result.status === 'failed') {
      throw new Error(`Mint failed: ${result.error}`);
    }

    return result.signature;
  }

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
  ): TransactionInstruction {
    return createBurnInstruction(
      account,
      mint,
      owner,
      amount,
      [],
      TOKEN_PROGRAM_ID
    );
  }

  /**
   * Burns tokens from an account, permanently removing them from circulation
   * @param mint - The token mint of tokens being burned
   * @param account - The token account to burn from
   * @param amount - Amount to burn in smallest units
   * @param owner - Keypair that owns the token account
   * @returns Transaction signature
   */
  async burn(
    mint: PublicKey,
    account: PublicKey,
    amount: bigint,
    owner: Keypair
  ): Promise<string> {
    const ix = this.buildBurnIx(
      mint,
      account,
      amount,
      owner.publicKey
    );
    const transaction = new Transaction().add(ix);
    console.log('Executing transaction to burn tokens');
    const result = await this.executionService.executeTx(
      transaction,
      owner
    );

    if (result.status === 'failed') {
      throw new Error(`Burn failed: ${result.error}`);
    }

    return result.signature;
  }

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
  ): TransactionInstruction {
    return createTransferInstruction(
      source,
      destination,
      owner,
      amount,
      [],
      TOKEN_PROGRAM_ID
    );
  }

  /**
   * Transfers tokens between accounts
   * @param source - The token account to transfer from
   * @param destination - The token account to transfer to
   * @param amount - Amount to transfer in smallest units
   * @param owner - Keypair that owns the source account
   * @returns Transaction signature
   */
  async transfer(
    source: PublicKey,
    destination: PublicKey,
    amount: bigint,
    owner: Keypair
  ): Promise<string> {
    const ix = this.buildTransferIx(
      source,
      destination,
      amount,
      owner.publicKey
    );
    const transaction = new Transaction().add(ix);
    console.log('Executing transaction to transfer tokens');
    const result = await this.executionService.executeTx(
      transaction,
      owner
    );

    if (result.status === 'failed') {
      throw new Error(`Transfer failed: ${result.error}`);
    }

    return result.signature;
  }

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
  ): TransactionInstruction {
    return createCloseAccountInstruction(
      account,
      destination,
      owner,
      [],
      TOKEN_PROGRAM_ID
    );
  }

  /**
   * Closes a token account and recovers the rent SOL
   * @param account - The token account to close
   * @param destination - Account to receive remaining SOL
   * @param owner - Keypair that owns the token account
   * @returns Transaction signature
   */
  async closeAccount(
    account: PublicKey,
    destination: PublicKey,
    owner: Keypair
  ): Promise<string> {
    const ix = this.buildCloseAccountIx(
      account,
      destination,
      owner.publicKey
    );
    const transaction = new Transaction().add(ix);
    console.log('Executing transaction to close account');
    const result = await this.executionService.executeTx(
      transaction,
      owner
    );

    if (result.status === 'failed') {
      throw new Error(`Close account failed: ${result.error}`);
    }

    return result.signature;
  }

  /**
   * Builds a create associated token account instruction if needed
   * @param mint - The token mint
   * @param owner - The owner of the token account
   * @param payer - The account paying for creation if needed
   * @returns Instruction to create account or null if it already exists
   */
  async buildCreateAssociatedTokenAccountIxIfNeeded(
    mint: PublicKey,
    owner: PublicKey,
    payer: PublicKey
  ): Promise<TransactionInstruction | null> {
    const associatedToken = await getAssociatedTokenAddress(
      mint,
      owner,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    try {
      await getAccount(this.connection, associatedToken);
      // Account exists, no instruction needed
      return null;
    } catch {
      // Account doesn't exist, return create instruction
      return createAssociatedTokenAccountInstruction(
        payer,
        associatedToken,
        owner,
        mint,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );
    }
  }

  /**
   * Gets or creates an associated token account
   * @param mint - The token mint
   * @param owner - The owner of the token account
   * @param payer - The account paying for creation if needed
   * @returns PublicKey of the associated token account
   */
  async getOrCreateAssociatedTokenAccount(
    mint: PublicKey,
    owner: PublicKey,
    payer: Keypair
  ): Promise<PublicKey> {
    const associatedToken = await getAssociatedTokenAddress(
      mint,
      owner,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    try {
      await getAccount(this.connection, associatedToken);
      return associatedToken;
    } catch {
      // Account doesn't exist, create it
      const transaction = new Transaction().add(
        createAssociatedTokenAccountInstruction(
          payer.publicKey,
          associatedToken,
          owner,
          mint,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        )
      );
      console.log('Executing transaction to create associated token account');
      const result = await this.executionService.executeTx(
        transaction,
        payer
      );

      if (result.status === 'failed') {
        throw new Error(`Failed to create associated token account: ${result.error}`);
      }

      return associatedToken;
    }
  }

  /**
   * Gets detailed information about a token account
   * @param address - The token account address
   * @returns Token account info or null if account doesn't exist
   */
  async getTokenAccountInfo(address: PublicKey): Promise<ITokenAccountInfo | null> {
    try {
      const account = await getAccount(this.connection, address);
      return {
        address,
        mint: account.mint,
        owner: account.owner,
        amount: BigInt(account.amount.toString()),
        isInitialized: account.isInitialized
      };
    } catch {
      return null;
    }
  }

  /**
   * Gets the token balance of an account
   * @param account - The token account address
   * @returns Balance in smallest units (based on token decimals)
   */
  async getBalance(account: PublicKey): Promise<bigint> {
    const info = await this.getTokenAccountInfo(account);
    return info ? info.amount : 0n;
  }

  /**
   * Gets the total supply of tokens for a mint
   * @param mint - The token mint address
   * @returns Total supply in smallest units (based on token decimals)
   */
  async getTotalSupply(mint: PublicKey): Promise<bigint> {
    try {
      const mintInfo = await getMint(this.connection, mint);
      return BigInt(mintInfo.supply.toString());
    } catch {
      return 0n;
    }
  }

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
  ): TransactionInstruction {
    return createSetAuthorityInstruction(
      mint,
      currentAuthority,
      authorityType,
      newAuthority,
      [],
      TOKEN_PROGRAM_ID
    );
  }

  /**
   * Sets or revokes an authority on a mint
   * @param mint - The token mint to update authority
   * @param newAuthority - The new authority (or null to revoke)
   * @param authorityType - Type of authority to set
   * @param currentAuthority - Current authority keypair
   * @returns Transaction signature
   */
  async setAuthority(
    mint: PublicKey,
    newAuthority: PublicKey | null,
    authorityType: AuthorityType,
    currentAuthority: Keypair
  ): Promise<string> {
    const ix = this.buildSetAuthorityIx(
      mint,
      newAuthority,
      authorityType,
      currentAuthority.publicKey
    );
    const transaction = new Transaction().add(ix);
    console.log('Executing transaction to set authority');
    const result = await this.executionService.executeTx(
      transaction,
      currentAuthority
    );

    if (result.status === 'failed') {
      throw new Error(`Failed to set authority: ${result.error}`);
    }

    return result.signature;
  }

  /**
   * Builds instructions to wrap SOL into wrapped SOL tokens
   * @param owner - The owner of the wrapped SOL account
   * @param amount - Amount of SOL to wrap in lamports
   * @returns Array of instructions to wrap SOL
   */
  async buildWrapSolIxs(
    owner: PublicKey,
    amount: bigint
  ): Promise<TransactionInstruction[]> {
    const instructions: TransactionInstruction[] = [];
    
    // Get the associated token account for wrapped SOL
    const wrappedSolAccount = await getAssociatedTokenAddress(
      NATIVE_MINT,
      owner,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    
    // Check if the account already exists
    const accountInfo = await this.connection.getAccountInfo(wrappedSolAccount);
    
    if (!accountInfo) {
      // Create associated token account for wrapped SOL if it doesn't exist
      instructions.push(
        createAssociatedTokenAccountInstruction(
          owner, // payer
          wrappedSolAccount,
          owner, // owner
          NATIVE_MINT,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        )
      );
    }
    
    // Transfer SOL to the wrapped SOL account
    instructions.push(
      SystemProgram.transfer({
        fromPubkey: owner,
        toPubkey: wrappedSolAccount,
        lamports: Number(amount),
      })
    );
    
    // Sync native to update the token balance
    instructions.push(
      createSyncNativeInstruction(
        wrappedSolAccount,
        TOKEN_PROGRAM_ID
      )
    );
    
    return instructions;
  }

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
  ): TransactionInstruction {
    // Closing a wrapped SOL account automatically unwraps the SOL
    return this.buildCloseAccountIx(
      wrappedSolAccount,
      destination,
      owner
    );
  }

  /**
   * Gets the wrapped SOL (NATIVE_MINT) address
   * @returns The NATIVE_MINT public key
   */
  static getNativeMint(): PublicKey {
    return NATIVE_MINT;
  }
}