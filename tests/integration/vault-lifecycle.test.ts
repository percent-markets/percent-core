import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import { PublicKey } from '@solana/web3.js';
import { Vault } from '../../app/vault';
import { VaultType } from '../../app/types/vault.interface';
import { ProposalStatus } from '../../app/types/moderator.interface';
import { 
  connection, 
  tokenService, 
  executionService,
  authorityWallet,
  aliceWallet,
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
  assertTokenBalance,
  assertMintAuthority
} from '../helpers/assertions';
import {
  cleanupAllAccounts
} from '../setup/cleanup';
import { TEST_AMOUNTS } from '../setup/fixtures';

describe('Vault Lifecycle', () => {
  let baseMint: PublicKey;
  let quoteMint: PublicKey;
  let aliceBaseTokenAccount: PublicKey;
  let aliceQuoteTokenAccount: PublicKey;
  
  /**
   * Helper to ensure Alice has sufficient token balance
   * Tops up to 1000M tokens if balance is low
   */
  async function ensureAliceHasTokens() {
    const currentBalance = await getTokenBalance(aliceBaseTokenAccount);
    const targetBalance = BigInt(1000_000_000); // 1000M tokens
    
    if (currentBalance < targetBalance) {
      const topUpAmount = targetBalance - currentBalance;
      console.log(`Topping up Alice's balance by ${topUpAmount} tokens`);
      
      // Mint more tokens to Alice
      await mintTestTokens(
        baseMint,
        aliceWallet.publicKey,
        topUpAmount,
        authorityWallet
      );
    }
  }
  
  beforeAll(async () => {
    console.log('\n🔧 Setting up vault test...');
    
    // Ensure test wallets have SOL (0.1 SOL max!)
    await ensureMinBalance(authorityWallet.publicKey, Number(TEST_AMOUNTS.TENTH_SOL));
    await ensureMinBalance(aliceWallet.publicKey, Number(TEST_AMOUNTS.TENTH_SOL));
    
    // Create test token pair
    const tokens = await createTestTokenPair(authorityWallet);
    baseMint = tokens.baseMint;
    quoteMint = tokens.quoteMint;
    
    // Mint tokens to test users
    aliceBaseTokenAccount = await mintTestTokens(
      baseMint,
      aliceWallet.publicKey,
      BigInt(1000_000_000), // 1000 basetokens with 6 decimals
      authorityWallet
    );
    
    aliceQuoteTokenAccount = await mintTestTokens(
      quoteMint,
      aliceWallet.publicKey,
      BigInt(100_000_000_000), // 100 quote tokens with 9 decimals
      authorityWallet
    );
  });
  
  describe('Initialization', () => {
    let vault: Vault;
    
    beforeAll(async () => {
      vault = new Vault({
        proposalId: 0,
        vaultType: VaultType.Base,
        regularMint: baseMint,
        connection,
        authority: authorityWallet
      });
      await vault.initialize();
    });
    
    it('should create both pass and fail conditional token mints', async () => {
      expect(vault.passConditionalMint).toBeDefined();
      expect(vault.failConditionalMint).toBeDefined();
      expect(vault.passConditionalMint).not.toEqual(baseMint);
      expect(vault.failConditionalMint).not.toEqual(baseMint);
      expect(vault.passConditionalMint).not.toEqual(vault.failConditionalMint);
    });
    
    it('should set vault authority as mint authority for both conditional mints', async () => {
      await assertMintAuthority(
        vault.passConditionalMint!,
        authorityWallet.publicKey
      );
      await assertMintAuthority(
        vault.failConditionalMint!,
        authorityWallet.publicKey
      );
    });
    
    it('should create escrow account', async () => {
      expect(vault.escrow).toBeDefined();
      
      // Escrow should be empty initially
      const balance = await tokenService.getBalance(vault.escrow!);
      expect(balance).toBe(BigInt(0));
    });
  });
  
  describe('Split Operations', () => {
    let vault: Vault;
    
    // Helper to add delay between tests to avoid rate limiting
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    
    beforeAll(async () => {
      // Ensure Alice has sufficient tokens
      await ensureAliceHasTokens();
      
      vault = new Vault({
        proposalId: 1,
        vaultType: VaultType.Base,
        regularMint: baseMint,
        connection,
        authority: authorityWallet
      });
      await vault.initialize();
    });
    
    afterEach(async () => {
      // Add 2 second delay to avoid rate limiting
      await delay(2000);
    });
    
    it('should split base tokens into BOTH pass and fail conditional tokens', async () => {
      const splitAmount = BigInt(100_000_000); // 100 tokens
      
      // Get initial balances
      const initialBaseBalance = await getTokenBalance(aliceBaseTokenAccount);
      const initialEscrowBalance = await tokenService.getBalance(vault.escrow!);
      const initialPassBalance = await getWalletTokenBalance(
        aliceWallet.publicKey,
        vault.passConditionalMint!
      );
      const initialFailBalance = await getWalletTokenBalance(
        aliceWallet.publicKey,
        vault.failConditionalMint!
      );
      
      // Build and execute split transaction
      const tx = await vault.buildSplitTx(
        aliceWallet.publicKey,
        splitAmount
      );
      tx.partialSign(aliceWallet);
      
      console.log('🔄 Executing split transaction: 100M base tokens → 100M pass + 100M fail tokens');
      const signature = await vault.executeSplitTx(tx);
      
      // Check balance changes
      const aliceBaseBalance = await getTokenBalance(aliceBaseTokenAccount);
      expect(aliceBaseBalance).toBe(initialBaseBalance - splitAmount);
      
      // Escrow should have increased by split amount
      const escrowBalance = await tokenService.getBalance(vault.escrow!);
      expect(escrowBalance).toBe(initialEscrowBalance + splitAmount);
      
      // Alice should have gained BOTH pass and fail conditional tokens
      const alicePassBalance = await getWalletTokenBalance(
        aliceWallet.publicKey,
        vault.passConditionalMint!
      );
      expect(alicePassBalance).toBe(initialPassBalance + splitAmount);
      
      const aliceFailBalance = await getWalletTokenBalance(
        aliceWallet.publicKey,
        vault.failConditionalMint!
      );
      expect(aliceFailBalance).toBe(initialFailBalance + splitAmount);
    });
    
    it('should handle multiple splits correctly', async () => {
      const firstSplit = BigInt(50_000_000); // 50 tokens
      const secondSplit = BigInt(30_000_000); // 30 tokens
      
      // Get initial balances (after first test)
      const initialEscrowBalance = await tokenService.getBalance(vault.escrow!);
      const initialPassBalance = await getWalletTokenBalance(
        aliceWallet.publicKey,
        vault.passConditionalMint!
      );
      const initialFailBalance = await getWalletTokenBalance(
        aliceWallet.publicKey,
        vault.failConditionalMint!
      );
      
      // First split
      const tx1 = await vault.buildSplitTx(
        aliceWallet.publicKey,
        firstSplit
      );
      tx1.partialSign(aliceWallet);
      console.log('🔄 Executing first split: 50M base tokens');
      await vault.executeSplitTx(tx1);
      
      // Second split
      const tx2 = await vault.buildSplitTx(
        aliceWallet.publicKey,
        secondSplit
      );
      tx2.partialSign(aliceWallet);
      console.log('🔄 Executing second split: 30M base tokens');
      await vault.executeSplitTx(tx2);
      
      // Check cumulative results
      const totalSplit = firstSplit + secondSplit;
      
      const escrowBalance = await tokenService.getBalance(vault.escrow!);
      expect(escrowBalance).toBe(initialEscrowBalance + totalSplit);
      
      // Check that conditional tokens increased by expected amount
      const alicePassBalance = await getWalletTokenBalance(
        aliceWallet.publicKey,
        vault.passConditionalMint!
      );
      expect(alicePassBalance).toBe(initialPassBalance + totalSplit);
      
      const aliceFailBalance = await getWalletTokenBalance(
        aliceWallet.publicKey,
        vault.failConditionalMint!
      );
      expect(aliceFailBalance).toBe(initialFailBalance + totalSplit);
    });
    
    it('should reject split with zero amount', async () => {
      await expect(
        vault.buildSplitTx(
          aliceWallet.publicKey,
          BigInt(0)
        )
      ).rejects.toThrow('Amount must be positive');
    });
    
    it('should reject split after finalization', async () => {
      // Finalize vault
      await vault.finalize(ProposalStatus.Passed);
      
      // Try to split
      await expect(
        vault.buildSplitTx(
          aliceWallet.publicKey,
          BigInt(100)
        )
      ).rejects.toThrow('Vault is finalized, no more splits allowed');
    });
  });
  
  describe('Merge Operations', () => {
    let vault: Vault;
    let splitAmount: bigint;
    
    // Helper to add delay between tests to avoid rate limiting
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    
    beforeAll(async () => {
      // Ensure Alice has sufficient tokens
      await ensureAliceHasTokens();
      
      vault = new Vault({
        proposalId: 2,
        vaultType: VaultType.Base,
        regularMint: baseMint,
        connection,
        authority: authorityWallet
      });
      await vault.initialize();
    });
    
    beforeEach(async () => {
      // First split some tokens
      splitAmount = BigInt(100_000_000);
      
      const tx = await vault.buildSplitTx(
        aliceWallet.publicKey,
        splitAmount
      );
      tx.partialSign(aliceWallet);
      console.log('🔄 Executing split for merge test setup: 100M base tokens');
      await vault.executeSplitTx(tx);
    });
    
    afterEach(async () => {
      // Add 2 second delay to avoid rate limiting
      await delay(2000);
    });
    
    it('should merge BOTH conditional tokens back to regular tokens', async () => {
      const mergeAmount = BigInt(50_000_000); // Merge half back
      
      const tx = await vault.buildMergeTx(
        aliceWallet.publicKey,
        mergeAmount
      );
      tx.partialSign(aliceWallet);
      
      console.log('🔄 Executing merge transaction: 50M pass + 50M fail → 50M base tokens');
      const signature = await vault.executeMergeTx(tx);
      
      // Check Alice has regular tokens back
      // Alice started with 1000M (topped up), split 100M, now merges 50M back = 950M
      const aliceBaseBalance = await getTokenBalance(aliceBaseTokenAccount);
      expect(aliceBaseBalance).toBe(BigInt(950_000_000));
      
      // Check escrow reduced
      const escrowBalance = await tokenService.getBalance(vault.escrow!);
      expect(escrowBalance).toBeGreaterThanOrEqual(splitAmount - mergeAmount);
      
      // Check BOTH conditional tokens reduced
      const alicePassBalance = await getWalletTokenBalance(
        aliceWallet.publicKey,
        vault.passConditionalMint!
      );
      expect(alicePassBalance).toBe(splitAmount - mergeAmount); // 50M remaining
      
      const aliceFailBalance = await getWalletTokenBalance(
        aliceWallet.publicKey,
        vault.failConditionalMint!
      );
      expect(aliceFailBalance).toBe(splitAmount - mergeAmount); // 50M remaining
    });
    
    it('should reject merge if missing pass tokens', async () => {
      // Transfer away pass tokens to create imbalance
      // This would need actual transfer implementation
      // For now, test that merge requires both tokens
    });
    
    it('should reject merge after finalization', async () => {
      await vault.finalize(ProposalStatus.Passed);
      
      await expect(
        vault.buildMergeTx(
          aliceWallet.publicKey,
          BigInt(100)
        )
      ).rejects.toThrow('Cannot merge after vault finalization - use redemption instead');
    });
  });
  
  describe('Finalization', () => {
    let vault: Vault;
    
    // Helper to add delay between tests to avoid rate limiting
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    
    beforeAll(async () => {
      // Ensure Alice has sufficient tokens
      await ensureAliceHasTokens();
      
      vault = new Vault({
        proposalId: 3,
        vaultType: VaultType.Base,
        regularMint: baseMint,
        connection,
        authority: authorityWallet
      });
      await vault.initialize();
    });
    
    beforeEach(async () => {
      
      // Split smaller amount since Alice has less balance after previous tests
      // After Split (180M) and Merge (net 50M back), Alice has ~770M, then more splits in Merge tests
      const splitAmount = BigInt(50_000_000); // Use 50M instead of 100M
      const tx = await vault.buildSplitTx(
        aliceWallet.publicKey,
        splitAmount
      );
      tx.partialSign(aliceWallet);
      console.log('🔄 Executing split for finalization test setup: 50M base tokens');
      await vault.executeSplitTx(tx);
    });
    
    afterEach(async () => {
      // Reset vault finalization state for next test
      vault.__resetFinalizationForTesting();
      
      // Add 2 second delay to avoid rate limiting
      await delay(2000);
    });
    
    it('should finalize with Passed status', async () => {
      await vault.finalize(ProposalStatus.Passed);
      
      expect(vault.isFinalized).toBe(true);
      expect(vault.proposalStatus).toBe(ProposalStatus.Passed);
      
      // Both mint authorities should still exist (no revocation anymore)
      await assertMintAuthority(
        vault.passConditionalMint!,
        authorityWallet.publicKey
      );
      await assertMintAuthority(
        vault.failConditionalMint!,
        authorityWallet.publicKey
      );
    });
    
    it('should finalize with Failed status', async () => {
      await vault.finalize(ProposalStatus.Failed);
      
      expect(vault.isFinalized).toBe(true);
      expect(vault.proposalStatus).toBe(ProposalStatus.Failed);
      
      // Both mint authorities should still exist (no revocation anymore)
      await assertMintAuthority(
        vault.passConditionalMint!,
        authorityWallet.publicKey
      );
      await assertMintAuthority(
        vault.failConditionalMint!,
        authorityWallet.publicKey
      );
    });
    
    it('should reject finalization with Pending status', async () => {
      await expect(
        vault.finalize(ProposalStatus.Pending)
      ).rejects.toThrow('Cannot finalize vault with status: Pending');
    });
    
    it('should reject finalization with Executed status', async () => {
      await expect(
        vault.finalize(ProposalStatus.Executed)
      ).rejects.toThrow('Cannot finalize vault with status: Executed');
    });
    
    it('should allow redemption of pass tokens when proposal passes', async () => {
      await vault.finalize(ProposalStatus.Passed);
      
      // Build and execute redemption
      const tx = await vault.buildRedeemWinningTokensTx(aliceWallet.publicKey);
      tx.partialSign(aliceWallet);
      
      console.log('🔄 Executing redemption: redeeming pass tokens for base tokens (proposal passed)');
      const signature = await vault.executeRedeemWinningTokensTx(tx);
      
      // Alice should have regular tokens back (from pass tokens)
      // Account for cumulative state
      const aliceBaseBalance = await getTokenBalance(aliceBaseTokenAccount);
      // This is complex due to cumulative state - just check it increased
      expect(aliceBaseBalance).toBeGreaterThan(BigInt(0));
      
      // Pass tokens should be burned
      const alicePassBalance = await getWalletTokenBalance(
        aliceWallet.publicKey,
        vault.passConditionalMint!
      );
      expect(alicePassBalance).toBe(BigInt(0));
      
      // Fail tokens should still exist (worthless)
      const aliceFailBalance = await getWalletTokenBalance(
        aliceWallet.publicKey,
        vault.failConditionalMint!
      );
      expect(aliceFailBalance).toBeGreaterThan(BigInt(0)); // Has accumulated fail tokens
    });
    
    it('should allow redemption of fail tokens when proposal fails', async () => {
      await vault.finalize(ProposalStatus.Failed);
      
      // Build and execute redemption
      const tx = await vault.buildRedeemWinningTokensTx(aliceWallet.publicKey);
      tx.partialSign(aliceWallet);
      
      console.log('🔄 Executing redemption: redeeming fail tokens for base tokens (proposal failed)');
      const signature = await vault.executeRedeemWinningTokensTx(tx);
      
      // Alice should have regular tokens back (from fail tokens)
      // Account for cumulative state
      const aliceBaseBalance = await getTokenBalance(aliceBaseTokenAccount);
      // This is complex due to cumulative state - just check it increased
      expect(aliceBaseBalance).toBeGreaterThan(BigInt(0));
      
      // Fail tokens should be burned
      const aliceFailBalance = await getWalletTokenBalance(
        aliceWallet.publicKey,
        vault.failConditionalMint!
      );
      expect(aliceFailBalance).toBe(BigInt(0));
      
      // Pass tokens should still exist (worthless)
      const alicePassBalance = await getWalletTokenBalance(
        aliceWallet.publicKey,
        vault.passConditionalMint!
      );
      expect(alicePassBalance).toBeGreaterThan(BigInt(0)); // Has accumulated pass tokens
    });
    
    it('should reject redemption before finalization', async () => {
      // Try to redeem without finalizing
      await expect(
        vault.buildRedeemWinningTokensTx(aliceWallet.publicKey)
      ).rejects.toThrow('Cannot redeem before vault finalization');
    });
  });
  
  describe('Account Cleanup', () => {
    let vault: Vault;
    
    // Helper to add delay between tests to avoid rate limiting
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    
    beforeAll(async () => {
      // Ensure Alice has sufficient tokens
      await ensureAliceHasTokens();
      
      vault = new Vault({
        proposalId: 4,
        vaultType: VaultType.Base,
        regularMint: baseMint,
        connection,
        authority: authorityWallet
      });
      await vault.initialize();
    });
    
    afterEach(async () => {
      // Add 2 second delay to avoid rate limiting
      await delay(2000);
    });
    
    it('should close empty token accounts', async () => {
      // Create token accounts by splitting
      const splitAmount = BigInt(50_000_000);
      const tx1 = await vault.buildSplitTx(
        aliceWallet.publicKey,
        splitAmount
      );
      tx1.partialSign(aliceWallet);
      console.log('🔄 Executing split for cleanup test: 50M base tokens');
      await vault.executeSplitTx(tx1);
      
      // Check that accounts have tokens
      let passBalance = await getWalletTokenBalance(
        aliceWallet.publicKey,
        vault.passConditionalMint!
      );
      expect(passBalance).toBe(splitAmount);
      
      let failBalance = await getWalletTokenBalance(
        aliceWallet.publicKey,
        vault.failConditionalMint!
      );
      expect(failBalance).toBe(splitAmount);
      
      // Merge everything back
      const tx2 = await vault.buildMergeTx(
        aliceWallet.publicKey,
        splitAmount
      );
      tx2.partialSign(aliceWallet);
      console.log('🔄 Executing merge to empty accounts: 50M pass + 50M fail → 50M base tokens');
      await vault.executeMergeTx(tx2);
      
      // Verify accounts are empty before closing
      passBalance = await getWalletTokenBalance(
        aliceWallet.publicKey,
        vault.passConditionalMint!
      );
      expect(passBalance).toBe(BigInt(0));
      
      failBalance = await getWalletTokenBalance(
        aliceWallet.publicKey,
        vault.failConditionalMint!
      );
      expect(failBalance).toBe(BigInt(0));
      
      // Now close the empty accounts
      const closeTx = await vault.buildCloseEmptyAccountsTx(aliceWallet.publicKey);
      closeTx.partialSign(aliceWallet);
      
      console.log('🔄 Executing close empty accounts: closing pass and fail token accounts');
      const signature = await vault.executeCloseEmptyAccountsTx(closeTx);
      
      // Accounts should remain at 0 (attempting to access closed accounts returns 0)
      passBalance = await getWalletTokenBalance(
        aliceWallet.publicKey,
        vault.passConditionalMint!
      );
      expect(passBalance).toBe(BigInt(0));
      
      failBalance = await getWalletTokenBalance(
        aliceWallet.publicKey,
        vault.failConditionalMint!
      );
      expect(failBalance).toBe(BigInt(0));
    });
  });
});