import { Transaction, PublicKey, Keypair, SystemProgram } from '@solana/web3.js';
import { IProposal, IProposalConfig } from './types/proposal.interface';
import { IAMM } from './types/amm.interface';
import { IVault, VaultType, VaultState } from './types/vault.interface';
import { ITWAPOracle, TWAPStatus } from './types/twap-oracle.interface';
import { ProposalStatus } from './types/moderator.interface';
import { TWAPOracle } from './twap-oracle';
import { ExecutionService } from './services/execution.service';
import { IExecutionResult, IExecutionConfig } from './types/execution.interface';
import { Vault } from './vault';
import { AMM } from './amm';
import { JitoService, BlockEngineUrl, TipPercentile } from '@slateos/jito';
import { AMMState } from './types/amm.interface';
import { createMemoIx } from './utils/memo';
import bs58 from 'bs58';

/**
 * Proposal class representing a governance proposal in the protocol
 * Handles initialization, finalization, and execution of proposals
 * Manages prediction markets through AMMs and vaults
 */
export class Proposal implements IProposal {
  public readonly id: number;
  public description: string;
  public transaction: Transaction;
  public __pAMM: IAMM | null = null;
  public __fAMM: IAMM | null = null;
  public __baseVault: IVault | null = null;
  public __quoteVault: IVault | null = null;
  public readonly twapOracle: ITWAPOracle;
  public readonly createdAt: number;
  public readonly finalizedAt: number;
  public readonly baseMint: PublicKey;
  public readonly quoteMint: PublicKey;
  public readonly proposalLength: number;
  public readonly ammConfig: IProposalConfig['ammConfig'];

  private _status: ProposalStatus = ProposalStatus.Uninitialized;
  private readonly config: IProposalConfig;

  /**
   * Getter for proposal status (read-only access)
   */
  get status(): ProposalStatus { 
    return this._status;
  }

  /**
   * Creates a new Proposal instance
   * @param config - Configuration object containing all proposal parameters
   */
  constructor(config: IProposalConfig) {
    this.config = config;
    this.id = config.id;
    this.description = config.description;
    this.transaction = config.transaction;
    this.createdAt = config.createdAt;
    this.finalizedAt = config.createdAt + (config.proposalLength * 1000);
    this.baseMint = config.baseMint;
    this.quoteMint = config.quoteMint;
    this.proposalLength = config.proposalLength;
    this.ammConfig = config.ammConfig;
    
    this.twapOracle = new TWAPOracle(
      config.id,
      config.twap,
      config.createdAt,
      this.finalizedAt
    );
  }


  /**
   * Initializes the proposal's blockchain components
   * Deploys AMMs, vaults, and starts TWAP oracle recording
   * Uses connection, authority, and decimals from constructor config
   */
  async initialize(): Promise<void> {
    // Initialize vaults for base and quote tokens
    this.__baseVault = new Vault({
      proposalId: this.id,
      vaultType: VaultType.Base,
      regularMint: this.baseMint,
      decimals: this.config.baseDecimals,
      connection: this.config.connection,
      authority: this.config.authority
    });

    this.__quoteVault = new Vault({
      proposalId: this.id,
      vaultType: VaultType.Quote,
      regularMint: this.quoteMint,
      decimals: this.config.quoteDecimals,
      connection: this.config.connection,
      authority: this.config.authority
    });
    
    // Initialize vaults (creates conditional token mints and escrow accounts)
    await this.__baseVault.initialize();
    await this.__quoteVault.initialize();
    
    // Create execution config for AMMs
    const executionConfig: IExecutionConfig = {
      rpcEndpoint: this.config.connection.rpcEndpoint,
      commitment: 'confirmed',
      maxRetries: 3,
      skipPreflight: false
    };
    
    // Initialize pass AMM (trades pBase/pQuote tokens)
    this.__pAMM = new AMM(
      this.__baseVault.passConditionalMint,
      this.__quoteVault.passConditionalMint,
      this.config.baseDecimals,
      this.config.quoteDecimals,
      this.config.authority,
      executionConfig
    );

    // Initialize fail AMM (trades fBase/fQuote tokens)
    this.__fAMM = new AMM(
      this.__baseVault.failConditionalMint,
      this.__quoteVault.failConditionalMint,
      this.config.baseDecimals,
      this.config.quoteDecimals,
      this.config.authority,
      executionConfig
    );
    
    // Split regular tokens through vaults to get conditional tokens for AMM seeding
    // The authority needs to have regular tokens to split
    // Splitting gives equal amounts of pass and fail tokens
    
    const baseTokensToSplit = BigInt(this.config.ammConfig.initialBaseAmount.toString());
    const quoteTokensToSplit = BigInt(this.config.ammConfig.initialQuoteAmount.toString());
    
    // Build and execute split transactions for both vaults
    const baseSplitTx = await this.__baseVault.buildSplitTx(
      this.config.authority.publicKey,
      baseTokensToSplit
    );

    const quoteSplitTx = await this.__quoteVault.buildSplitTx(
      this.config.authority.publicKey,
      quoteTokensToSplit
    );
    
    // Execute splits using vault's executeSplitTx method
    await this.__baseVault.executeSplitTx(baseSplitTx);
    await this.__quoteVault.executeSplitTx(quoteSplitTx);
    
    // Initialize AMMs with initial liquidity
    // Both AMMs get the same amounts since splitting gives equal pass and fail tokens
    await this.__pAMM.initialize(
      this.config.ammConfig.initialBaseAmount,
      this.config.ammConfig.initialQuoteAmount
    );
    
    await this.__fAMM.initialize(
      this.config.ammConfig.initialBaseAmount,
      this.config.ammConfig.initialQuoteAmount
    );
    
    // Set AMMs in TWAP oracle so it can track prices
    this.twapOracle.setAMMs(this.__pAMM, this.__fAMM);
    
    // Update status to Pending now that everything is initialized
    this._status = ProposalStatus.Pending;
  }

  /**
   * Initializes the proposal using Jito bundles for atomic execution
   * Uses two sequential bundles: vault setup, then AMM setup with liquidity
   * Ensures all components are created atomically with MEV protection
   * @param jito - Jito service instance
   */
  async initializeViaBundle(jito: JitoService): Promise<void> {
    console.log(`Initializing proposal #${this.id} via Jito bundles`);

    // Initialize vaults for base and quote tokens
    this.__baseVault = new Vault({
      proposalId: this.id,
      vaultType: VaultType.Base,
      regularMint: this.baseMint,
      decimals: this.config.baseDecimals,
      connection: this.config.connection,
      authority: this.config.authority
    });

    this.__quoteVault = new Vault({
      proposalId: this.id,
      vaultType: VaultType.Quote,
      regularMint: this.quoteMint,
      decimals: this.config.quoteDecimals,
      connection: this.config.connection,
      authority: this.config.authority
    });

    try {
      // Get fee recommendations once for both bundles
      const fees = await jito.getRecommendedFeeFromTipFloor(TipPercentile.P75);
      console.log(`Jito tip per bundle: ${fees.jitoTipSol} SOL`);

      // ========================================
      // Bundle 1: Vault Setup (3 transactions)
      // ========================================
      console.log('\n📦 Bundle 1: Vault Setup');
      const bundle1Txs: Transaction[] = [];

      // 1.1 Create Jito tip transaction for bundle 1
      const tipAccount1 = await jito.getRandomTipAccount();
      const tipTx1 = new Transaction();
      const { blockhash: blockhash1 } = await this.config.connection.getLatestBlockhash();
      tipTx1.recentBlockhash = blockhash1;
      tipTx1.feePayer = this.config.authority.publicKey;

      tipTx1.add(SystemProgram.transfer({
        fromPubkey: this.config.authority.publicKey,
        toPubkey: new PublicKey(tipAccount1),
        lamports: fees.jitoTipLamports
      }));

      tipTx1.add(createMemoIx(
        `%[Jito Bundle 1] Vault Setup | Proposal #${this.id} | Authority: ${this.config.authority.publicKey.toBase58()}`
      ));

      tipTx1.sign(this.config.authority);
      bundle1Txs.push(tipTx1);

      // 1.2 Build vault initialization transactions (this sets the conditional mints)
      const baseVaultTx = await (this.__baseVault as Vault).buildInitializeTx();
      const quoteVaultTx = await (this.__quoteVault as Vault).buildInitializeTx();
      bundle1Txs.push(baseVaultTx, quoteVaultTx);

      // Now that conditional mints are set, create AMMs
      const executionConfig: IExecutionConfig = {
        rpcEndpoint: this.config.connection.rpcEndpoint,
        commitment: 'confirmed',
        maxRetries: 3,
        skipPreflight: false
      };

      // Initialize pass AMM (trades pBase/pQuote tokens)
      this.__pAMM = new AMM(
        this.__baseVault.passConditionalMint,
        this.__quoteVault.passConditionalMint,
        this.config.baseDecimals,
        this.config.quoteDecimals,
        this.config.authority,
        executionConfig
      );

      // Initialize fail AMM (trades fBase/fQuote tokens)
      this.__fAMM = new AMM(
        this.__baseVault.failConditionalMint,
        this.__quoteVault.failConditionalMint,
        this.config.baseDecimals,
        this.config.quoteDecimals,
        this.config.authority,
        executionConfig
      );

      // Submit and confirm Bundle 1
      const bundle1Serialized = bundle1Txs.map(tx => tx.serialize().toString('base64'));
      const bundle1Sigs = bundle1Txs.map(tx =>
        tx.signature ? bs58.encode(tx.signature) : null
      ).filter(sig => sig !== null);

      console.log(`Submitting Bundle 1 with ${bundle1Serialized.length} transactions`);
      const bundle1Response = await jito.sendBundle([
        bundle1Serialized,
        { encoding: 'base64' }
      ]);

      if (!bundle1Response.result) {
        throw new Error(`Bundle 1 submission failed: ${bundle1Response.error?.message || 'Unknown error'}`);
      }

      const bundle1Id = bundle1Response.result;
      console.log(`Bundle 1 ID: ${bundle1Id}`);
      console.log(`Bundle 1 signatures: ${bundle1Sigs.join(', ')}`);

      console.log('Waiting for Bundle 1 confirmation...');
      const bundle1Confirm = await jito.confirmInflightBundle(bundle1Id, 60000);

      if ('status' in bundle1Confirm && bundle1Confirm.status === 'Landed') {
        console.log(`✅ Bundle 1 landed successfully in slot ${(bundle1Confirm as any).landed_slot}`);
      } else if ('confirmation_status' in bundle1Confirm && bundle1Confirm.confirmation_status) {
        console.log(`✅ Bundle 1 confirmed with status: ${bundle1Confirm.confirmation_status}`);
      } else {
        throw new Error(`Bundle 1 failed to land: ${JSON.stringify(bundle1Confirm)}`);
      }

      // Update vault states after Bundle 1 success
      (this.__baseVault as Vault).setState(VaultState.Active);
      (this.__quoteVault as Vault).setState(VaultState.Active);
      console.log('Vaults initialized and active');

      // ========================================
      // Bundle 2: AMM Setup & Seeding (5 transactions)
      // ========================================
      console.log('\n📦 Bundle 2: AMM Setup & Seeding');
      const bundle2Txs: Transaction[] = [];

      // 2.1 Create Jito tip transaction for bundle 2
      const tipAccount2 = await jito.getRandomTipAccount();
      const tipTx2 = new Transaction();
      const { blockhash: blockhash2 } = await this.config.connection.getLatestBlockhash();
      tipTx2.recentBlockhash = blockhash2;
      tipTx2.feePayer = this.config.authority.publicKey;

      tipTx2.add(SystemProgram.transfer({
        fromPubkey: this.config.authority.publicKey,
        toPubkey: new PublicKey(tipAccount2),
        lamports: fees.jitoTipLamports
      }));

      tipTx2.add(createMemoIx(
        `%[Jito Bundle 2] AMM Setup | Proposal #${this.id} | Authority: ${this.config.authority.publicKey.toBase58()}`
      ));

      tipTx2.sign(this.config.authority);
      bundle2Txs.push(tipTx2);

      // 2.2 Build split transactions for initial liquidity (pre-signed)
      const baseTokensToSplit = BigInt(this.config.ammConfig.initialBaseAmount.toString());
      const quoteTokensToSplit = BigInt(this.config.ammConfig.initialQuoteAmount.toString());

      const baseSplitTx = await this.__baseVault.buildSplitTx(
        this.config.authority.publicKey,
        baseTokensToSplit,
        true  // presign with authority
      );
      const quoteSplitTx = await this.__quoteVault.buildSplitTx(
        this.config.authority.publicKey,
        quoteTokensToSplit,
        true  // presign with authority
      );
      bundle2Txs.push(baseSplitTx, quoteSplitTx);

      // 2.3 Build AMM initialization transactions
      const pAmmTx = await (this.__pAMM as AMM).buildInitializeTx(
        this.config.ammConfig.initialBaseAmount,
        this.config.ammConfig.initialQuoteAmount
      );
      const fAmmTx = await (this.__fAMM as AMM).buildInitializeTx(
        this.config.ammConfig.initialBaseAmount,
        this.config.ammConfig.initialQuoteAmount
      );
      bundle2Txs.push(pAmmTx, fAmmTx);

      // Submit and confirm Bundle 2
      const bundle2Serialized = bundle2Txs.map(tx => tx.serialize().toString('base64'));
      const bundle2Sigs = bundle2Txs.map(tx =>
        tx.signature ? bs58.encode(tx.signature) : null
      ).filter(sig => sig !== null);

      console.log(`Submitting Bundle 2 with ${bundle2Serialized.length} transactions`);
      const bundle2Response = await jito.sendBundle([
        bundle2Serialized,
        { encoding: 'base64' }
      ]);

      if (!bundle2Response.result) {
        throw new Error(`Bundle 2 submission failed: ${bundle2Response.error?.message || 'Unknown error'}`);
      }

      const bundle2Id = bundle2Response.result;
      console.log(`Bundle 2 ID: ${bundle2Id}`);
      console.log(`Bundle 2 signatures: ${bundle2Sigs.join(', ')}`);

      console.log('Waiting for Bundle 2 confirmation...');
      const bundle2Confirm = await jito.confirmInflightBundle(bundle2Id, 60000);

      if ('status' in bundle2Confirm && bundle2Confirm.status === 'Landed') {
        console.log(`✅ Bundle 2 landed successfully in slot ${(bundle2Confirm as any).landed_slot}`);
      } else if ('confirmation_status' in bundle2Confirm && bundle2Confirm.confirmation_status) {
        console.log(`✅ Bundle 2 confirmed with status: ${bundle2Confirm.confirmation_status}`);
      } else {
        throw new Error(`Bundle 2 failed to land: ${JSON.stringify(bundle2Confirm)}`);
      }

      // Update AMM states after Bundle 2 success
      (this.__pAMM as AMM).setState(AMMState.Trading);
      (this.__fAMM as AMM).setState(AMMState.Trading);

      // Set AMMs in TWAP oracle so it can track prices
      this.twapOracle.setAMMs(this.__pAMM, this.__fAMM);

      // Update status to Pending now that everything is initialized
      this._status = ProposalStatus.Pending;

      console.log(`\n🎉 Proposal #${this.id} initialized successfully via Jito bundles`);

    } catch (error) {
      // Clean up on failure - reset all components
      this.__baseVault = null;
      this.__quoteVault = null;
      this.__pAMM = null;
      this.__fAMM = null;

      throw new Error(`Failed to initialize proposal via bundles: ${error}`);
    }
  }

  /**
   * Returns both AMMs for the proposal
   * @returns Tuple of [pAMM, fAMM]
   * @throws Error if AMMs are not initialized
   */
  getAMMs(): [IAMM, IAMM] {
    if (this._status === ProposalStatus.Uninitialized) {
      throw new Error(`Proposal #${this.id}: Not initialized - call initialize() first`);
    }
    if (!this.__pAMM || !this.__fAMM) {
      throw new Error(`Proposal #${this.id}: AMMs are uninitialized`);
    }
    return [this.__pAMM, this.__fAMM];
  }

  /**
   * Returns both vaults for the proposal
   * @returns Tuple of [baseVault, quoteVault]  
   * @throws Error if vaults are not initialized
   */
  getVaults(): [IVault, IVault] {
    if (this._status === ProposalStatus.Uninitialized) {
      throw new Error(`Proposal #${this.id}: Not initialized - call initialize() first`);
    }
    if (!this.__baseVault || !this.__quoteVault) {
      throw new Error(`Proposal #${this.id}: Vaults are uninitialized`);
    }
    return [this.__baseVault, this.__quoteVault];
  }

  /**
   * Finalizes the proposal based on time
   * Currently assumes all proposals pass for simplicity
   * Also finalizes the AMMs and vaults accordingly
   * @returns The current or updated proposal status
   */
  async finalize(): Promise<ProposalStatus> {
    if (this._status === ProposalStatus.Uninitialized) {
      throw new Error(`Proposal #${this.id}: Not initialized - call initialize() first`);
    }
    
    // Still pending if before finalization time
    if (Date.now() < this.finalizedAt) {
      return ProposalStatus.Pending;
    }
    
    // Update status if still pending after finalization time
    if (this._status === ProposalStatus.Pending) {
      // Perform final TWAP crank to ensure we have the most up-to-date data
      await this.twapOracle.crankTWAP();
      
      // Use TWAP oracle to determine pass/fail with fresh data
      const twapStatus = await this.twapOracle.fetchStatus();
      const passed = twapStatus === TWAPStatus.Passing;
      this._status = passed ? ProposalStatus.Passed : ProposalStatus.Failed;
      
      // Remove liquidity from AMMs before finalizing vaults
      if (this.__pAMM && !this.__pAMM.isFinalized) {
        try {
          await this.__pAMM.removeLiquidity();
        } catch (error) {
          console.error('Error removing liquidity from pAMM:', error);
        }
      }
      if (this.__fAMM && !this.__fAMM.isFinalized) {
        try {
          await this.__fAMM.removeLiquidity();
        } catch (error) {
          console.error('Error removing liquidity from fAMM:', error);
        }
      }
      
      // Finalize both vaults with the proposal status
      if (this.__baseVault && this.__quoteVault) {
        await this.__baseVault.finalize(this._status);
        await this.__quoteVault.finalize(this._status);
        
        // Redeem authority's winning tokens after finalization
        // This converts winning conditional tokens back to regular tokens
        try {
          const baseRedeemTx = await this.__baseVault.buildRedeemWinningTokensTx(
            this.config.authority.publicKey
          );
          baseRedeemTx.sign(this.config.authority);
          await this.__baseVault.executeRedeemWinningTokensTx(baseRedeemTx);
        } catch (error) {
          console.error('Error redeeming base vault winning tokens:', error);
        }

        try {
          const quoteRedeemTx = await this.__quoteVault.buildRedeemWinningTokensTx(
            this.config.authority.publicKey
          );
          quoteRedeemTx.sign(this.config.authority);
          await this.__quoteVault.executeRedeemWinningTokensTx(quoteRedeemTx);
        } catch (error) {
          console.error('Error redeeming quote vault winning tokens:', error);
        }
      }
    }
    
    return this._status;
  }

  /**
   * Finalizes the proposal using Jito bundles for atomic execution
   * Removes liquidity from AMMs and redeems authority's winning tokens
   * All operations execute atomically in a single bundle
   * @param jito - Jito service instance
   * @returns The updated proposal status (Passed or Failed)
   * @throws Error if finalization fails or proposal not ready
   */
  async finalizeViaBundle(jito: JitoService): Promise<ProposalStatus> {
    if (this._status === ProposalStatus.Uninitialized) {
      throw new Error(`Proposal #${this.id}: Not initialized - call initialize() first`);
    }

    // Still pending if before finalization time
    if (Date.now() < this.finalizedAt) {
      throw new Error(`Proposal #${this.id}: Cannot finalize before end time`);
    }

    // Already finalized
    if (this._status !== ProposalStatus.Pending) {
      console.log(`Proposal #${this.id} already finalized with status: ${this._status}`);
      return this._status;
    }

    console.log(`Finalizing proposal #${this.id} via Jito bundle`);

    try {
      // Perform final TWAP crank to ensure we have the most up-to-date data
      await this.twapOracle.crankTWAP();

      // Use TWAP oracle to determine pass/fail with fresh data
      const twapStatus = await this.twapOracle.fetchStatus();
      const passed = twapStatus === TWAPStatus.Passing;
      const newStatus = passed ? ProposalStatus.Passed : ProposalStatus.Failed;

      // Get fee recommendations
      const fees = await jito.getRecommendedFeeFromTipFloor(TipPercentile.P75);
      console.log(`Jito tip for finalization bundle: ${fees.jitoTipSol} SOL`);

      // ========================================
      // Build Finalization Bundle
      // ========================================
      console.log('\n📦 Building Finalization Bundle');
      const bundleTxs: Transaction[] = [];

      // 1. Create Jito tip transaction with memo
      const tipAccount = await jito.getRandomTipAccount();
      const tipTx = new Transaction();
      const { blockhash } = await this.config.connection.getLatestBlockhash();
      tipTx.recentBlockhash = blockhash;
      tipTx.feePayer = this.config.authority.publicKey;

      tipTx.add(SystemProgram.transfer({
        fromPubkey: this.config.authority.publicKey,
        toPubkey: new PublicKey(tipAccount),
        lamports: fees.jitoTipLamports
      }));

      tipTx.add(createMemoIx(
        `%[Jito Bundle] Finalize | Proposal #${this.id} | Status: ${newStatus} | Authority: ${this.config.authority.publicKey.toBase58()}`
      ));

      tipTx.sign(this.config.authority);
      bundleTxs.push(tipTx);

      // 2. Remove liquidity from pAMM (if not already finalized)
      if (this.__pAMM && !this.__pAMM.isFinalized) {
        console.log('Building pAMM liquidity removal transaction');
        const pAmmRemoveTx = await this.__pAMM.buildRemoveLiquidityTx();
        // Transaction already has blockhash, feePayer, signature, and priority fees from buildRemoveLiquidityTx
        bundleTxs.push(pAmmRemoveTx);
      }

      // 3. Remove liquidity from fAMM (if not already finalized)
      if (this.__fAMM && !this.__fAMM.isFinalized) {
        console.log('Building fAMM liquidity removal transaction');
        const fAmmRemoveTx = await this.__fAMM.buildRemoveLiquidityTx();
        // Transaction already has blockhash, feePayer, signature, and priority fees from buildRemoveLiquidityTx
        bundleTxs.push(fAmmRemoveTx);
      }

      // 4. Finalize vaults (state update only, no transaction needed)
      if (this.__baseVault && this.__quoteVault) {
        // Temporarily update vault states for building redeem transactions
        await this.__baseVault.finalize(newStatus);
        await this.__quoteVault.finalize(newStatus);

        // 5. Build redemption transactions for authority's winning tokens
        try {
          console.log('Building base vault redemption transaction');
          const baseRedeemTx = await this.__baseVault.buildRedeemWinningTokensTx(
            this.config.authority.publicKey,
            true  // presign with escrow
          );
          baseRedeemTx.recentBlockhash = blockhash;
          baseRedeemTx.feePayer = this.config.authority.publicKey;
          // Need to sign as fee payer (authority) after escrow pre-sign
          baseRedeemTx.partialSign(this.config.authority);
          bundleTxs.push(baseRedeemTx);
        } catch (error) {
          console.log('No base vault winning tokens to redeem:', error);
          // It's okay if there are no winning tokens to redeem
        }

        try {
          console.log('Building quote vault redemption transaction');
          const quoteRedeemTx = await this.__quoteVault.buildRedeemWinningTokensTx(
            this.config.authority.publicKey,
            true  // presign with escrow
          );
          quoteRedeemTx.recentBlockhash = blockhash;
          quoteRedeemTx.feePayer = this.config.authority.publicKey;
          // Need to sign as fee payer (authority) after escrow pre-sign
          quoteRedeemTx.partialSign(this.config.authority);
          bundleTxs.push(quoteRedeemTx);
        } catch (error) {
          console.log('No quote vault winning tokens to redeem:', error);
          // It's okay if there are no winning tokens to redeem
        }
      }

      // Submit and confirm the bundle
      const bundleSerialied = bundleTxs.map(tx => tx.serialize().toString('base64'));
      const bundleSigs = bundleTxs.map(tx =>
        tx.signature ? bs58.encode(tx.signature) : null
      ).filter(sig => sig !== null);

      console.log(`Submitting finalization bundle with ${bundleSerialied.length} transactions`);
      const bundleResponse = await jito.sendBundle([
        bundleSerialied,
        { encoding: 'base64' }
      ]);

      if (!bundleResponse.result) {
        // Revert vault states on failure
        if (this.__baseVault) (this.__baseVault as Vault).setState(VaultState.Active);
        if (this.__quoteVault) (this.__quoteVault as Vault).setState(VaultState.Active);
        throw new Error(`Bundle submission failed: ${bundleResponse.error?.message || 'Unknown error'}`);
      }

      const bundleId = bundleResponse.result;
      console.log(`Bundle ID: ${bundleId}`);
      console.log(`Bundle signatures: ${bundleSigs.join(', ')}`);

      console.log('Waiting for bundle confirmation...');
      const bundleConfirm = await jito.confirmInflightBundle(bundleId, 60000);

      if ('status' in bundleConfirm && bundleConfirm.status === 'Landed') {
        console.log(`✅ Finalization bundle landed successfully in slot ${(bundleConfirm as any).landed_slot}`);
      } else if ('confirmation_status' in bundleConfirm && bundleConfirm.confirmation_status) {
        console.log(`✅ Bundle confirmed with status: ${bundleConfirm.confirmation_status}`);
      } else {
        // Revert vault states on failure
        if (this.__baseVault) (this.__baseVault as Vault).setState(VaultState.Active);
        if (this.__quoteVault) (this.__quoteVault as Vault).setState(VaultState.Active);
        throw new Error(`Bundle failed to land: ${JSON.stringify(bundleConfirm)}`);
      }
      
      // Update states after successful bundle execution
      if (this.__pAMM) (this.__pAMM as AMM).setState(AMMState.Finalized);
      if (this.__fAMM) (this.__fAMM as AMM).setState(AMMState.Finalized);

      if(this.__pAMM &&this.__pAMM.position) delete this.__pAMM.position;
      if(this.__pAMM && this.__pAMM.positionNft) delete this.__pAMM.positionNft;
      if(this.__fAMM && this.__fAMM.position) delete this.__fAMM.position;
      if(this.__fAMM && this.__fAMM.positionNft) delete this.__fAMM.positionNft;

      // Update proposal status
      this._status = newStatus;

      console.log(`\n🎉 Proposal #${this.id} finalized successfully via Jito bundle with status: ${newStatus}`);

    } catch (error) {
      throw new Error(`Failed to finalize proposal via bundle: ${error}`);
    }

    return this._status;
  }

  /**
   * Executes the proposal's Solana transaction
   * Only callable for proposals with Passed status
   * @param signer - Keypair to sign and execute the transaction
   * @param executionConfig - Configuration for transaction execution
   * @returns Execution result with signature and status
   * @throws Error if proposal is pending, already executed, or failed
   */
  async execute(
    signer: Keypair,
    executionConfig: IExecutionConfig
  ): Promise<IExecutionResult> {
    switch (this._status) {
      case ProposalStatus.Uninitialized:
        throw new Error(`Proposal #${this.id}: Not initialized - call initialize() first`);

      case ProposalStatus.Pending:
        throw new Error(`Cannot execute proposal #${this.id} - not finalized`);

      case ProposalStatus.Failed:
        throw new Error(`Cannot execute proposal #${this.id} - proposal failed`);

      case ProposalStatus.Executed:
        throw new Error(`Proposal #${this.id} has already been executed`);

      case ProposalStatus.Passed:
        // Execute the Solana transaction
        const executionService = new ExecutionService(executionConfig);

        console.log('Executing transaction to execute proposal');
        const result = await executionService.executeTx(
          this.transaction,
          signer
        );

        // Update status to Executed regardless of transaction result
        this._status = ProposalStatus.Executed;

        return result;

      default:
        throw new Error(`Unknown proposal status: ${this._status}`);
    }
  }
}