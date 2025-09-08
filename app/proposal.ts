import { Transaction, PublicKey, Keypair, Connection } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import { IProposal, IProposalConfig } from './types/proposal.interface';
import { IAMM } from './types/amm.interface';
import { IVault, VaultType } from './types/vault.interface';
import { ITWAPOracle, TWAPStatus } from './types/twap-oracle.interface';
import { ProposalStatus } from './types/moderator.interface';
import { TWAPOracle } from './twap-oracle';
import { ExecutionService } from './services/execution.service';
import { IExecutionResult, IExecutionConfig } from './types/execution.interface';
import { Vault } from './vault';
import { AMM } from './amm';

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

  private _status: ProposalStatus = ProposalStatus.Pending;
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
  }

  /**
   * Calculates remaining time until proposal voting ends
   * @returns Time-to-live in seconds (0 if expired)
   */
  fetchTTL(): number {
    const remaining = this.finalizedAt - Date.now();
    return Math.max(0, Math.floor(remaining / 1000));
  }


  /**
   * Returns both AMMs for the proposal
   * @returns Tuple of [pAMM, fAMM]
   * @throws Error if AMMs are not initialized
   */
  getAMMs(): [IAMM, IAMM] {
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
    // Still pending if before finalization time
    if (Date.now() < this.finalizedAt) {
      return ProposalStatus.Pending;
    }
    
    // Update status if still pending after finalization time
    if (this._status === ProposalStatus.Pending) {
      // Use TWAP oracle to determine pass/fail
      const twapStatus = await this.twapOracle.fetchStatus();
      const passed = twapStatus === TWAPStatus.Passing;
      this._status = passed ? ProposalStatus.Passed : ProposalStatus.Failed;
      
      // Remove liquidity from AMMs before finalizing vaults
      if (this.__pAMM && !this.__pAMM.isFinalized) {
        await this.__pAMM.removeLiquidity();
      }
      if (this.__fAMM && !this.__fAMM.isFinalized) {
        await this.__fAMM.removeLiquidity();
      }
      
      // Finalize both vaults with the proposal status
      if (this.__baseVault && this.__quoteVault) {
        await this.__baseVault.finalize(this._status);
        await this.__quoteVault.finalize(this._status);
        
        // Redeem authority's winning tokens after finalization
        // This converts winning conditional tokens back to regular tokens
        const baseRedeemTx = await this.__baseVault.buildRedeemWinningTokensTx(
          this.config.authority.publicKey
        );
        const quoteRedeemTx = await this.__quoteVault.buildRedeemWinningTokensTx(
          this.config.authority.publicKey
        );
        
        await this.__baseVault.executeRedeemWinningTokensTx(baseRedeemTx);
        await this.__quoteVault.executeRedeemWinningTokensTx(quoteRedeemTx);
      }
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
    if (this._status === ProposalStatus.Pending) {
      throw new Error(`Cannot execute proposal #${this.id} - not finalized`);
    }
    
    if (this._status === ProposalStatus.Executed) {
      throw new Error(`Proposal #${this.id} has already been executed`);
    }
    
    if (this._status !== ProposalStatus.Passed) {
      throw new Error(`Cannot execute proposal #${this.id} - status is ${this._status}`);
    }
    
    // Execute the Solana transaction
    const executionService = new ExecutionService(executionConfig);
    const result = await executionService.executeTx(
      this.transaction,
      signer
    );
    
    // Update status to Executed regardless of transaction result
    this._status = ProposalStatus.Executed;
    
    return result;
  }
}