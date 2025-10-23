import { Keypair } from '@solana/web3.js';
import { IProposal, IProposalConfig } from './types/proposal.interface';
import { IAMM } from './types/amm.interface';
import { IVault, VaultType } from './types/vault.interface';
import { ITWAPOracle, TWAPStatus } from './types/twap-oracle.interface';
import { ProposalStatus } from './types/moderator.interface';
import { TWAPOracle } from './twap-oracle';
import { IExecutionResult, IExecutionService } from './types/execution.interface';
import { Vault } from './vault';
import { AMM } from './amm';
import { LoggerService } from '../src/services/logger.service';

/**
 * Proposal class representing a governance proposal in the protocol
 * Handles initialization, finalization, and execution of proposals
 * Manages prediction markets through AMMs and vaults
 */
export class Proposal implements IProposal {
  public readonly config: IProposalConfig;
  public pAMM: IAMM;
  public fAMM: IAMM;
  public baseVault: IVault;
  public quoteVault: IVault;
  public readonly twapOracle: ITWAPOracle;
  public readonly finalizedAt: number;

  private _status: ProposalStatus = ProposalStatus.Uninitialized;
  private readonly executionService: IExecutionService;
  private logger: LoggerService;

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
    this.finalizedAt = config.createdAt + (config.proposalLength * 1000);
    this.executionService = config.executionService;
    this.logger = config.logger;

    // Create TWAP oracle
    this.twapOracle = new TWAPOracle(
      config.id,
      config.twap,
      config.createdAt,
      this.finalizedAt
    );

    // Create vaults
    this.baseVault = new Vault({
      proposalId: config.id,
      vaultType: VaultType.Base,
      regularMint: config.baseMint,
      decimals: config.baseDecimals,
      authority: config.authority,
      executionService: config.executionService
    });

    this.quoteVault = new Vault({
      proposalId: config.id,
      vaultType: VaultType.Quote,
      regularMint: config.quoteMint,
      decimals: config.quoteDecimals,
      authority: config.authority,
      executionService: config.executionService
    });

    // Initialize pass AMM (trades pBase/pQuote tokens)
    this.pAMM = new AMM(
      this.baseVault.passConditionalMint,
      this.quoteVault.passConditionalMint,
      config.baseDecimals,
      config.quoteDecimals,
      config.authority,
      config.executionService
    );
    
    // Initialize fail AMM (trades fBase/fQuote tokens)
    this.fAMM = new AMM(
      this.baseVault.failConditionalMint,
      this.quoteVault.failConditionalMint,
      config.baseDecimals,
      config.quoteDecimals,
      config.authority,
      config.executionService
    );
  }


  /**
   * Initializes the proposal's blockchain components
   * Deploys AMMs, vaults, and starts TWAP oracle recording
   * Uses connection, authority, and decimals from constructor config
   */
  async initialize(): Promise<void> {
    this.logger.info('Initializing proposal');
    // Initialize vaults
    this.logger.info('Initializing vaults');
    await this.baseVault.initialize();
    await this.quoteVault.initialize();
    
    // Split regular tokens through vaults to get conditional tokens for AMM seeding
    // The authority needs to have regular tokens to split
    // Splitting gives equal amounts of pass and fail tokens
    const baseTokensToSplit = BigInt(this.config.ammConfig.initialBaseAmount.toString());
    const quoteTokensToSplit = BigInt(this.config.ammConfig.initialQuoteAmount.toString());
    
    // Build and execute split transactions for both vaults
    this.logger.info('Building split transactions');
    const baseSplitTx = await this.baseVault.buildSplitTx(
      this.config.authority.publicKey,
      baseTokensToSplit
    );

    const quoteSplitTx = await this.quoteVault.buildSplitTx(
      this.config.authority.publicKey,
      quoteTokensToSplit
    );
    
    // Execute splits using vault's executeSplitTx method
    this.logger.info('Executing split transactions');
    await this.baseVault.executeSplitTx(baseSplitTx);
    await this.quoteVault.executeSplitTx(quoteSplitTx);
    
    // Initialize AMMs with initial liquidity
    // Both AMMs get the same amounts since splitting gives equal pass and fail tokens
    this.logger.info('Initializing AMMs');
    await this.pAMM.initialize(
      this.config.ammConfig.initialBaseAmount,
      this.config.ammConfig.initialQuoteAmount
    );
    
    await this.fAMM.initialize(
      this.config.ammConfig.initialBaseAmount,
      this.config.ammConfig.initialQuoteAmount
    );
    
    // Set AMMs in TWAP oracle so it can track prices
    this.twapOracle.setAMMs(this.pAMM, this.fAMM);
    
    // Update status to Pending now that everything is initialized
    this._status = ProposalStatus.Pending;
    this.logger.info('Proposal initialized and set to pending');
  }

  /**
   * Returns both AMMs for the proposal
   * @returns Tuple of [pAMM, fAMM]
   * @throws Error if AMMs are not initialized
   */
  getAMMs(): [IAMM, IAMM] {
    if (this._status === ProposalStatus.Uninitialized) {
      throw new Error(`Proposal #${this.config.id}: Not initialized - call initialize() first`);
    }

    return [this.pAMM, this.fAMM];
  }

  /**
   * Returns both vaults for the proposal
   * @returns Tuple of [baseVault, quoteVault]  
   * @throws Error if vaults are not initialized
   */
  getVaults(): [IVault, IVault] {
    if (this._status === ProposalStatus.Uninitialized) {
      throw new Error(`Proposal #${this.config.id}: Not initialized - call initialize() first`);
    }
    return [this.baseVault, this.quoteVault];
  }

  /**
   * Finalizes the proposal based on time
   * Currently assumes all proposals pass for simplicity
   * Also finalizes the AMMs and vaults accordingly
   * @returns The current or updated proposal status
   */
  async finalize(): Promise<ProposalStatus> {
    this.logger.info('Finalizing proposal');
    if (this._status === ProposalStatus.Uninitialized) {
      throw new Error(`Proposal #${this.config.id}: Not initialized - call initialize() first`);
    }
    
    // Still pending if before finalization time
    if (Date.now() < this.finalizedAt) {
      return ProposalStatus.Pending;
    }
    
    // Update status if still pending after finalization time
    if (this._status === ProposalStatus.Pending) {
      // Perform final TWAP crank to ensure we have the most up-to-date data
      this.logger.info('Cranking TWAP');
      await this.twapOracle.crankTWAP();

      // Use TWAP oracle to determine pass/fail with fresh data
      const twapStatus = await this.twapOracle.fetchStatus();
      this.logger.info(`TWAP status is ${twapStatus}`);
      const passed = twapStatus === TWAPStatus.Passing;
      this._status = passed ? ProposalStatus.Passed : ProposalStatus.Failed;
      
      // Remove liquidity from AMMs before finalizing vaults
      if (!this.pAMM.isFinalized) {
        this.logger.info('Removing liquidity from pAMM', {
          ammType: 'pass'
        });
        try {
          await this.pAMM.removeLiquidity();
        } catch (error) {
          this.logger.error('Error removing liquidity from pAMM', {
            ammType: 'pass',
            error
          });
        }
      }
      if (!this.fAMM.isFinalized) {
        this.logger.info('Removing liquidity from fAMM', {
          ammType: 'fail'
        });
        try {
          await this.fAMM.removeLiquidity();
        } catch (error) {
          this.logger.error('Error removing liquidity from fAMM', {
            ammType: 'fail',
            error
          });
        }
      }
      
      // Finalize both vaults with the proposal status
      this.logger.info('Finalizing vaults');
      await this.baseVault.finalize(this._status);
      await this.quoteVault.finalize(this._status);
      
      // Redeem authority's winning tokens after finalization
      // This converts winning conditional tokens back to regular tokens
      try {
        this.logger.info('Building redeem winning tokens transaction for base vault');
        const baseRedeemTx = await this.baseVault.buildRedeemWinningTokensTx(
          this.config.authority.publicKey
        );
        this.logger.info('Executing redeem winning tokens transaction for base vault');
        baseRedeemTx.sign(this.config.authority);
        await this.baseVault.executeRedeemWinningTokensTx(baseRedeemTx);
      } catch (error) {
        this.logger.warn('Error redeeming base vault winning tokens', {
          vaultType: 'base',
          error
        });
      }

      try {
        this.logger.info('Building redeem winning tokens transaction for quote vault');
        const quoteRedeemTx = await this.quoteVault.buildRedeemWinningTokensTx(
          this.config.authority.publicKey
        );
        this.logger.info('Executing redeem winning tokens transaction for quote vault');
        quoteRedeemTx.sign(this.config.authority);
        await this.quoteVault.executeRedeemWinningTokensTx(quoteRedeemTx);
      } catch (error) {
        this.logger.warn('Error redeeming quote vault winning tokens', {
          vaultType: 'quote',
          error
        });
      }
    }

    this.logger.info('Proposal finalization returned', { status: this._status });
    return this._status;
  }

  /**
   * Executes the proposal's Solana transaction
   * Only callable for proposals with Passed status
   * @param signer - Keypair to sign and execute the transaction
   * @returns Execution result with signature and status
   * @throws Error if proposal is pending, already executed, or failed
   */
  async execute(signer: Keypair): Promise<IExecutionResult> {
    this.logger.info('Executing proposal');
    if (this._status !== ProposalStatus.Passed) {
      throw new Error('Failed to execute - proposal not passed');
    }

    // Execute the Solana transaction
    this.logger.info('Adding compute budget instructions');
    await this.executionService.addComputeBudgetInstructions(this.config.transaction);
    this.logger.info('Executing transaction');
    const result = await this.executionService.executeTx(
      this.config.transaction,
      signer
    );

    // Update status to Executed regardless of transaction result
    this._status = ProposalStatus.Executed;
    this.logger.info('Proposal execution returned', { result: result });
    return result;
  }
}