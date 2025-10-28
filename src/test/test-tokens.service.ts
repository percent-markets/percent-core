import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { SPLTokenService } from '../../app/services/spl-token.service';
import { ExecutionService } from '../../app/services/execution.service';
import { LoggerService } from '../../app/services/logger.service';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import { TestWallets } from './config';
import { Commitment } from '../../app/types/execution.interface';

export interface TestTokenMints {
  baseMint: PublicKey;
  quoteMint: PublicKey;
  baseDecimals: number;
  quoteDecimals: number;
}

export class TestTokenSetupService {
  private tokenService: SPLTokenService;
  private executionService: ExecutionService;
  private logger: LoggerService;

  constructor(
    private connection: Connection,
    private wallets: TestWallets
  ) {
    // Create logger for test token setup
    this.logger = LoggerService.getInstance('test-tokens');

    // Create execution service
    this.executionService = new ExecutionService(
      {
        rpcEndpoint: this.connection.rpcEndpoint,
        commitment: Commitment.Confirmed,
        skipPreflight: true
      },
      this.logger.createChild('execution')
    );

    // Create token service with proper dependencies
    this.tokenService = new SPLTokenService(
      this.executionService,
      this.logger.createChild('spl-token')
    );
  }

  /**
   * Create test token mints and distribute tokens
   */
  async setupTestTokens(): Promise<TestTokenMints> {
    console.log('\n🪙 Setting up test tokens...');
    
    // Create base token mint (similar to USDC with 6 decimals)
    console.log('  Creating base token mint (TEST-USDC)...');
    const baseMint = await this.tokenService.createMint(
      6, // 6 decimals like USDC
      this.wallets.authority.publicKey,
      this.wallets.authority
    );
    console.log(`  ✅ Base mint created: ${baseMint.toBase58()}`);

    // Create quote token mint (similar to SOL with 9 decimals)
    console.log('  Creating quote token mint (TEST-SOL)...');
    const quoteMint = await this.tokenService.createMint(
      9, // 9 decimals like SOL
      this.wallets.authority.publicKey,
      this.wallets.authority
    );
    console.log(`  ✅ Quote mint created: ${quoteMint.toBase58()}`);

    // Mint tokens to test wallets
    await this.distributeTokens(baseMint, quoteMint);

    return {
      baseMint,
      quoteMint,
      baseDecimals: 6,
      quoteDecimals: 9
    };
  }

  /**
   * Distribute tokens to test wallets
   */
  private async distributeTokens(baseMint: PublicKey, quoteMint: PublicKey): Promise<void> {
    console.log('\n💰 Distributing test tokens...');

    const walletList = [
      { name: 'Authority', keypair: this.wallets.authority, baseAmount: 1000000n, quoteAmount: 1000n },
      { name: 'Alice', keypair: this.wallets.alice, baseAmount: 500000n, quoteAmount: 500n },
      { name: 'Bob', keypair: this.wallets.bob, baseAmount: 500000n, quoteAmount: 500n },
      { name: 'Aelix', keypair: this.wallets.aelix, baseAmount: 500000n, quoteAmount: 500n },
      { name: 'Dylan', keypair: this.wallets.dylan, baseAmount: 500000n, quoteAmount: 500n }
    ];

    for (const wallet of walletList) {
      console.log(`  Minting to ${wallet.name}...`);
      
      // Get or create associated token accounts
      const baseATA = await this.tokenService.getOrCreateAssociatedTokenAccount(
        baseMint,
        wallet.keypair.publicKey,
        this.wallets.authority
      );

      const quoteATA = await this.tokenService.getOrCreateAssociatedTokenAccount(
        quoteMint,
        wallet.keypair.publicKey,
        this.wallets.authority
      );

      // Mint base tokens (in smallest units - 6 decimals)
      const baseAmountSmallest = wallet.baseAmount * 1000000n; // Convert to 6 decimal places
      await this.tokenService.mintTo(
        baseMint,
        baseATA,
        baseAmountSmallest,
        this.wallets.authority
      );

      // Mint quote tokens (in smallest units - 9 decimals)
      const quoteAmountSmallest = wallet.quoteAmount * 1000000000n; // Convert to 9 decimal places
      await this.tokenService.mintTo(
        quoteMint,
        quoteATA,
        quoteAmountSmallest,
        this.wallets.authority
      );

      console.log(`  ✅ ${wallet.name}: ${wallet.baseAmount.toString()} TEST-USDC, ${wallet.quoteAmount.toString()} TEST-SOL`);
    }
  }

  /**
   * Check and display balances for all test wallets
   */
  async checkBalances(baseMint: PublicKey, quoteMint: PublicKey): Promise<void> {
    console.log('\n📊 Wallet Balances:');
    console.log('═══════════════════════════════════════════');

    const walletList = [
      { name: 'Authority', keypair: this.wallets.authority },
      { name: 'Alice', keypair: this.wallets.alice },
      { name: 'Bob', keypair: this.wallets.bob },
      { name: 'Aelix', keypair: this.wallets.aelix },
      { name: 'Dylan', keypair: this.wallets.dylan }
    ];

    for (const wallet of walletList) {
      // Get SOL balance
      const solBalance = await this.connection.getBalance(wallet.keypair.publicKey);
      const solAmount = solBalance / LAMPORTS_PER_SOL;

      // Get base token balance
      let baseBalance = 0n;
      try {
        const baseATA = await getAssociatedTokenAddress(baseMint, wallet.keypair.publicKey);
        baseBalance = await this.tokenService.getBalance(baseATA);
      } catch {
        // Account doesn't exist
      }
      const baseAmount = Number(baseBalance) / 1000000; // 6 decimals

      // Get quote token balance  
      let quoteBalance = 0n;
      try {
        const quoteATA = await getAssociatedTokenAddress(quoteMint, wallet.keypair.publicKey);
        quoteBalance = await this.tokenService.getBalance(quoteATA);
      } catch {
        // Account doesn't exist
      }
      const quoteAmount = Number(quoteBalance) / 1000000000; // 9 decimals

      console.log(`\n${wallet.name}:`);
      console.log(`  Address:    ${wallet.keypair.publicKey.toBase58()}`);
      console.log(`  SOL:        ${solAmount.toFixed(4)} SOL`);
      console.log(`  TEST-USDC:  ${baseAmount.toFixed(2)} tokens`);
      console.log(`  TEST-SOL:   ${quoteAmount.toFixed(4)} tokens`);
    }
    
    console.log('\n═══════════════════════════════════════════');
  }

  /**
   * Get total supply for test tokens
   */
  async checkTotalSupply(baseMint: PublicKey, quoteMint: PublicKey): Promise<void> {
    console.log('\n📈 Token Supply:');
    
    const baseSupply = await this.tokenService.getTotalSupply(baseMint);
    const quoteSupply = await this.tokenService.getTotalSupply(quoteMint);
    
    console.log(`  TEST-USDC Total Supply: ${Number(baseSupply) / 1000000} tokens`);
    console.log(`  TEST-SOL Total Supply:  ${Number(quoteSupply) / 1000000000} tokens`);
  }
}