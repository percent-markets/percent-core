import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import { PublicKey, Keypair } from '@solana/web3.js';
import { AMM } from '../../app/amm';
import { AMMState } from '../../app/types/amm.interface';
import { 
  connection, 
  tokenService, 
  executionService,
  authorityWallet,
  aliceWallet,
  bobWallet
} from '../setup/devnet';
import {
  createTestTokenPair,
  mintTestTokens,
  getTokenBalance,
  getWalletTokenBalance
} from '../helpers/tokens';
import {
  ensureMinBalance
} from '../helpers/airdrop';
import {
  assertTokenBalance
} from '../helpers/assertions';
import {
  cleanupAllAccounts
} from '../setup/cleanup';
import { TEST_AMOUNTS } from '../setup/fixtures';
import { BN } from '@coral-xyz/anchor';
import { Decimal } from 'decimal.js';

describe('AMM Lifecycle', () => {
  let baseMint: PublicKey;
  let quoteMint: PublicKey;
  let aliceBaseTokenAccount: PublicKey;
  let aliceQuoteTokenAccount: PublicKey;
  let bobBaseTokenAccount: PublicKey;
  let bobQuoteTokenAccount: PublicKey;
  let amm: AMM;
  
  /**
   * Helper to ensure users have sufficient token balance
   */
  async function ensureUserHasTokens(
    userBaseAccount: PublicKey, 
    userQuoteAccount: PublicKey,
    baseAmount: bigint = BigInt(1000_000_000), // 1000 tokens with 6 decimals
    quoteAmount: bigint = BigInt(1000_000_000_000) // 1000 tokens with 9 decimals
  ) {
    // Check and top up base tokens
    const currentBaseBalance = await getTokenBalance(userBaseAccount);
    if (currentBaseBalance < baseAmount) {
      const topUpAmount = baseAmount - currentBaseBalance;
      console.log(`Topping up base tokens by ${topUpAmount}`);
      await mintTestTokens(baseMint, userBaseAccount, topUpAmount, authorityWallet);
    }
    
    // Check and top up quote tokens
    const currentQuoteBalance = await getTokenBalance(userQuoteAccount);
    if (currentQuoteBalance < quoteAmount) {
      const topUpAmount = quoteAmount - currentQuoteBalance;
      console.log(`Topping up quote tokens by ${topUpAmount}`);
      await mintTestTokens(quoteMint, userQuoteAccount, topUpAmount, authorityWallet);
    }
  }

  beforeAll(async () => {
    console.log('\n🏗️  Setting up AMM test environment...\n');
    
    // Ensure wallets have SOL for fees
    await ensureMinBalance(authorityWallet.publicKey, Number(TEST_AMOUNTS.ONE_SOL * BigInt(2)));
    await ensureMinBalance(aliceWallet.publicKey, Number(TEST_AMOUNTS.ONE_SOL));
    await ensureMinBalance(bobWallet.publicKey, Number(TEST_AMOUNTS.ONE_SOL));
    
    // Create token pair once for all tests
    const { baseMint: base, quoteMint: quote } = await createTestTokenPair(
      authorityWallet
    );
    baseMint = base;
    quoteMint = quote;
    
    // Setup token accounts for users
    aliceBaseTokenAccount = await mintTestTokens(
      baseMint,
      aliceWallet.publicKey,
      BigInt(10_000_000_000), // 10,000 tokens
      authorityWallet
    );
    
    aliceQuoteTokenAccount = await mintTestTokens(
      quoteMint,
      aliceWallet.publicKey,
      BigInt(10_000_000_000_000), // 10,000 tokens
      authorityWallet
    );
    
    bobBaseTokenAccount = await mintTestTokens(
      baseMint,
      bobWallet.publicKey,
      BigInt(5_000_000_000), // 5,000 tokens
      authorityWallet
    );
    
    bobQuoteTokenAccount = await mintTestTokens(
      quoteMint,
      bobWallet.publicKey,
      BigInt(5_000_000_000_000), // 5,000 tokens
      authorityWallet
    );
    
    console.log('✅ Test environment ready\n');
  }, 30000); // 30 second timeout for setup

  beforeEach(async () => {
    // Create fresh AMM instance for each test
    const executionConfig = {
      rpcEndpoint: connection.rpcEndpoint,
      commitment: 'confirmed' as const,
      maxRetries: 3
    };
    
    amm = new AMM(
      baseMint,
      quoteMint,
      6, // base decimals
      9, // quote decimals
      authorityWallet,
      executionConfig
    );
  });

  afterEach(async () => {
    // Cleanup is handled by the global cleanup in afterAll
  });

  describe('Sequential AMM Operations', () => {
    let initialPrice: Decimal;
    
    // Helper to add delay between tests
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    
    it('should initialize AMM with pool creation', async () => {
      console.log('\n📊 Test: Initialize AMM with pool creation\n');
      
      // Initial liquidity amounts
      const initialBase = new BN(1000_000_000); // 1000 base tokens
      const initialQuote = new BN(500_000_000_000); // 500 quote tokens
      
      // Initialize AMM pool
      await amm.initialize(initialBase, initialQuote);
      
      // Verify pool was created
      expect(amm.pool).toBeDefined();
      expect(amm.position).toBeDefined();
      expect(amm.positionNft).toBeDefined();
      expect(amm.isFinalized).toBe(false);
      
      console.log(`✅ Pool created: ${amm.pool!.toBase58()}`);
      console.log(`✅ Position: ${amm.position!.toBase58()}`);
      console.log(`✅ Position NFT: ${amm.positionNft!.toBase58()}`);
      
      // Wait for transactions to settle
      await delay(2000);
    }, 60000); // 60 second timeout for pool creation

    it('should fetch initial price from the pool', async () => {
      console.log('\n💰 Test: Fetch initial price\n');
      
      // Re-initialize for this test (since we have a new AMM instance)
      const initialBase = new BN(1000_000_000); // 1000 base tokens
      const initialQuote = new BN(500_000_000_000); // 500 quote tokens
      await amm.initialize(initialBase, initialQuote);
      
      // Fetch price
      initialPrice = await amm.fetchPrice();
      
      expect(initialPrice).toBeDefined();
      expect(initialPrice.toNumber()).toBeGreaterThan(0);
      
      // Expected price should be roughly quote/base = 500/1000 = 0.5
      // But adjusted for decimal differences (9-6 = 3 decimal places)
      const expectedPrice = 0.5 * Math.pow(10, 3); // 500
      const tolerance = expectedPrice * 0.1; // 10% tolerance
      
      expect(initialPrice.toNumber()).toBeCloseTo(expectedPrice, 0);
      console.log(`✅ Initial price: ${initialPrice.toString()}`);
      
      // Wait before next test
      await delay(2000);
    }, 30000);

    it('should execute base to quote swap', async () => {
      console.log('\n🔄 Test: Swap base tokens to quote tokens\n');
      
      // Re-initialize
      const initialBase = new BN(1000_000_000);
      const initialQuote = new BN(500_000_000_000);
      await amm.initialize(initialBase, initialQuote);
      
      // Ensure Alice has tokens
      await ensureUserHasTokens(aliceBaseTokenAccount, aliceQuoteTokenAccount);
      
      // Get initial balances
      const aliceBaseBalanceBefore = await getTokenBalance(aliceBaseTokenAccount);
      const aliceQuoteBalanceBefore = await getTokenBalance(aliceQuoteTokenAccount);
      
      console.log(`Alice base balance before: ${aliceBaseBalanceBefore}`);
      console.log(`Alice quote balance before: ${aliceQuoteBalanceBefore}`);
      
      // Swap 100 base tokens for quote tokens
      const swapAmount = new BN(100_000_000); // 100 base tokens
      await amm.swap(
        true, // base to quote
        swapAmount,
        50, // 0.5% slippage
        aliceWallet.publicKey
      );
      
      // Check balances after swap
      const aliceBaseBalanceAfter = await getTokenBalance(aliceBaseTokenAccount);
      const aliceQuoteBalanceAfter = await getTokenBalance(aliceQuoteTokenAccount);
      
      console.log(`Alice base balance after: ${aliceBaseBalanceAfter}`);
      console.log(`Alice quote balance after: ${aliceQuoteBalanceAfter}`);
      
      // Verify base tokens decreased
      expect(aliceBaseBalanceAfter).toBeLessThan(aliceBaseBalanceBefore);
      const baseDecrease = aliceBaseBalanceBefore - aliceBaseBalanceAfter;
      expect(baseDecrease).toBe(BigInt(swapAmount.toString()));
      
      // Verify quote tokens increased (should get approximately 50 quote tokens minus fees)
      expect(aliceQuoteBalanceAfter).toBeGreaterThan(aliceQuoteBalanceBefore);
      const quoteIncrease = aliceQuoteBalanceAfter - aliceQuoteBalanceBefore;
      console.log(`✅ Swapped ${baseDecrease} base for ${quoteIncrease} quote tokens`);
      
      // Wait before next test
      await delay(2000);
    }, 30000);

    it('should execute quote to base swap', async () => {
      console.log('\n🔄 Test: Swap quote tokens to base tokens\n');
      
      // Re-initialize
      const initialBase = new BN(1000_000_000);
      const initialQuote = new BN(500_000_000_000);
      await amm.initialize(initialBase, initialQuote);
      
      // Ensure Bob has tokens
      await ensureUserHasTokens(bobBaseTokenAccount, bobQuoteTokenAccount);
      
      // Get initial balances
      const bobBaseBalanceBefore = await getTokenBalance(bobBaseTokenAccount);
      const bobQuoteBalanceBefore = await getTokenBalance(bobQuoteTokenAccount);
      
      console.log(`Bob base balance before: ${bobBaseBalanceBefore}`);
      console.log(`Bob quote balance before: ${bobQuoteBalanceBefore}`);
      
      // Swap 50 quote tokens for base tokens
      const swapAmount = new BN(50_000_000_000); // 50 quote tokens
      await amm.swap(
        false, // quote to base
        swapAmount,
        50, // 0.5% slippage
        bobWallet.publicKey
      );
      
      // Check balances after swap
      const bobBaseBalanceAfter = await getTokenBalance(bobBaseTokenAccount);
      const bobQuoteBalanceAfter = await getTokenBalance(bobQuoteTokenAccount);
      
      console.log(`Bob base balance after: ${bobBaseBalanceAfter}`);
      console.log(`Bob quote balance after: ${bobQuoteBalanceAfter}`);
      
      // Verify quote tokens decreased
      expect(bobQuoteBalanceAfter).toBeLessThan(bobQuoteBalanceBefore);
      const quoteDecrease = bobQuoteBalanceBefore - bobQuoteBalanceAfter;
      expect(quoteDecrease).toBe(BigInt(swapAmount.toString()));
      
      // Verify base tokens increased
      expect(bobBaseBalanceAfter).toBeGreaterThan(bobBaseBalanceBefore);
      const baseIncrease = bobBaseBalanceAfter - bobBaseBalanceBefore;
      console.log(`✅ Swapped ${quoteDecrease} quote for ${baseIncrease} base tokens`);
      
      // Wait before next test
      await delay(2000);
    }, 30000);

    it('should track price changes after swaps', async () => {
      console.log('\n📈 Test: Price changes after multiple swaps\n');
      
      // Re-initialize
      const initialBase = new BN(1000_000_000);
      const initialQuote = new BN(500_000_000_000);
      await amm.initialize(initialBase, initialQuote);
      
      // Get initial price
      const priceBefore = await amm.fetchPrice();
      console.log(`Initial price: ${priceBefore.toString()}`);
      
      // Execute multiple swaps to move the price
      // Buy base tokens (should increase price)
      const buyAmount = new BN(100_000_000_000); // 100 quote tokens
      await amm.swap(false, buyAmount, 100, aliceWallet.publicKey);
      
      const priceAfterBuy = await amm.fetchPrice();
      console.log(`Price after buying base: ${priceAfterBuy.toString()}`);
      
      // Price should have increased (base became more expensive)
      expect(priceAfterBuy.greaterThan(priceBefore)).toBe(true);
      
      // Sell base tokens (should decrease price)
      const sellAmount = new BN(150_000_000); // 150 base tokens
      await amm.swap(true, sellAmount, 100, bobWallet.publicKey);
      
      const priceAfterSell = await amm.fetchPrice();
      console.log(`Price after selling base: ${priceAfterSell.toString()}`);
      
      // Price should have decreased from the buy price
      expect(priceAfterSell.lessThan(priceAfterBuy)).toBe(true);
      
      console.log(`✅ Price moved from ${priceBefore} -> ${priceAfterBuy} -> ${priceAfterSell}`);
      
      // Wait before next test
      await delay(2000);
    }, 45000);

    it('should handle slippage protection', async () => {
      console.log('\n🛡️ Test: Slippage protection\n');
      
      // Re-initialize
      const initialBase = new BN(1000_000_000);
      const initialQuote = new BN(500_000_000_000);
      await amm.initialize(initialBase, initialQuote);
      
      // Try swap with very tight slippage (should still work for small amounts)
      const smallSwap = new BN(10_000_000); // 10 base tokens
      
      await expect(
        amm.swap(true, smallSwap, 10, aliceWallet.publicKey) // 0.1% slippage
      ).resolves.not.toThrow();
      
      console.log(`✅ Small swap with tight slippage succeeded`);
      
      // Large swap with reasonable slippage
      const largeSwap = new BN(200_000_000); // 200 base tokens
      
      await expect(
        amm.swap(true, largeSwap, 200, aliceWallet.publicKey) // 2% slippage
      ).resolves.not.toThrow();
      
      console.log(`✅ Large swap with reasonable slippage succeeded`);
      
      // Wait before next test
      await delay(2000);
    }, 30000);

    it('should remove liquidity and finalize AMM', async () => {
      console.log('\n🏁 Test: Remove liquidity and finalize\n');
      
      // Re-initialize
      const initialBase = new BN(1000_000_000);
      const initialQuote = new BN(500_000_000_000);
      await amm.initialize(initialBase, initialQuote);
      
      // Verify AMM is not finalized
      expect(amm.isFinalized).toBe(false);
      
      // Remove all liquidity
      await amm.removeLiquidity();
      
      // Verify AMM is now finalized
      expect(amm.isFinalized).toBe(true);
      expect(amm.position).toBeUndefined();
      expect(amm.positionNft).toBeUndefined();
      
      console.log(`✅ AMM finalized successfully`);
      
      // Wait before next test
      await delay(2000);
    }, 30000);

    it('should reject operations after finalization', async () => {
      console.log('\n🚫 Test: Operations fail after finalization\n');
      
      // Re-initialize and immediately finalize
      const initialBase = new BN(1000_000_000);
      const initialQuote = new BN(500_000_000_000);
      await amm.initialize(initialBase, initialQuote);
      await amm.removeLiquidity();
      
      // Verify AMM is finalized
      expect(amm.isFinalized).toBe(true);
      
      // Try to fetch price - should fail
      await expect(amm.fetchPrice()).rejects.toThrow('AMM is finalized');
      
      // Try to swap - should fail
      const swapAmount = new BN(100_000_000);
      await expect(
        amm.swap(true, swapAmount, 50, aliceWallet.publicKey)
      ).rejects.toThrow('AMM is finalized');
      
      // Try to remove liquidity again - should fail
      await expect(amm.removeLiquidity()).rejects.toThrow('AMM is already finalized');
      
      console.log(`✅ All operations correctly rejected after finalization`);
      
      // Wait before next test suite
      await delay(2000);
    }, 30000);
  });

  describe('Edge Cases', () => {
    it('should handle uninitialized pool operations', async () => {
      console.log('\n⚠️ Test: Uninitialized pool operations\n');
      
      // Try operations without initializing
      await expect(amm.fetchPrice()).rejects.toThrow('AMM pool is uninitialized');
      
      const swapAmount = new BN(100_000_000);
      await expect(
        amm.swap(true, swapAmount, 50, aliceWallet.publicKey)
      ).rejects.toThrow('AMM pool is uninitialized');
      
      await expect(amm.removeLiquidity()).rejects.toThrow('AMM pool is uninitialized');
      
      console.log(`✅ Uninitialized operations correctly rejected`);
    }, 15000);
  });
});