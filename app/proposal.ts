import { Transaction } from '@solana/web3.js';
import { IProposal } from './types/proposal.interface';
import { IAMM } from './types/amm.interface';
import { IVault } from './types/vault.interface';
import { ITWAPOracle } from './types/twap-oracle.interface';
import { ProposalStatus } from './types/moderator.interface';
import { TWAPOracle } from './twap-oracle';

/**
 * Proposal class representing a governance proposal in the protocol
 * Handles initialization, finalization, and execution of proposals
 * Manages prediction markets through AMMs and vaults
 */
export class Proposal implements IProposal {
  public id: number;
  public description: string;
  public transaction: Transaction;
  public __pAMM: IAMM | null = null;
  public __fAMM: IAMM | null = null;
  public __pVault: IVault | null = null;
  public __fVault: IVault | null = null;
  public twapOracle: ITWAPOracle;
  public createdAt: number;
  public finalizedAt: number;
  public baseMint: string;
  public quoteMint: string;
  private _status: ProposalStatus = ProposalStatus.Pending;

  /**
   * Getter for proposal status (read-only access)
   */
  get status(): ProposalStatus { 
    return this._status;
  }

  /**
   * Creates a new Proposal instance
   * @param id - Unique proposal identifier
   * @param description - Human-readable description
   * @param transaction - Solana transaction to execute if passed
   * @param createdAt - Creation timestamp in milliseconds
   * @param proposalLength - Duration of voting period in seconds
   * @param baseMint - Public key of base token mint
   * @param quoteMint - Public key of quote token mint
   * @param twapMaxObservationChangePerUpdate - Max TWAP change per update
   * @param twapStartDelay - Delay before TWAP starts in seconds
   * @param passThresholdBps - Basis points threshold for passing
   */
  constructor(
    id: number,
    description: string,
    transaction: Transaction,
    createdAt: number,
    proposalLength: number,
    baseMint: string,
    quoteMint: string,
    twapMaxObservationChangePerUpdate: bigint,
    twapStartDelay: number,
    passThresholdBps: number
  ) {
    this.id = id;
    this.description = description;
    this.transaction = transaction;
    this.createdAt = createdAt;
    this.finalizedAt = createdAt + (proposalLength * 1000);
    this.baseMint = baseMint;
    this.quoteMint = quoteMint;
    
    this.twapOracle = new TWAPOracle(
      id,
      twapMaxObservationChangePerUpdate,
      twapStartDelay,
      passThresholdBps,
      createdAt,
      this.finalizedAt
    );
  }

  /**
   * Initializes the proposal's blockchain components
   * Deploys AMMs, vaults, and starts TWAP oracle recording
   */
  async initialize(): Promise<void> {
    // TODO: Initialize AMMs, Vaults, and other blockchain interactions
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
   * Deploys virtual vaults for token management
   * @private
   */
  private async deployVirtualVault(): Promise<void> {
    throw new Error('Method not implemented.');
  }

  /**
   * Deploys AMMs for prediction market trading
   * @private
   */
  private async deployAMM(): Promise<void> {
    throw new Error('Method not implemented.');
  }

  /**
   * Returns both AMMs for the proposal
   * @returns Tuple of [pAMM, fAMM]
   * @throws Error if AMMs are not initialized
   */
  getAMMs(): [IAMM, IAMM] {
    if (!this.__pAMM || !this.__fAMM) {
      throw new Error('Proposal AMMs are uninitialized');
    }
    return [this.__pAMM, this.__fAMM];
  }

  /**
   * Returns both vaults for the proposal
   * @returns Tuple of [pVault, fVault]  
   * @throws Error if vaults are not initialized
   */
  getVaults(): [IVault, IVault] {
    if (!this.__pVault || !this.__fVault) {
      throw new Error('Proposal Vaults are uninitialized');
    }
    return [this.__pVault, this.__fVault];
  }

  /**
   * Finalizes the proposal based on time and voting results
   * Updates status from Pending to Passed/Failed if time has expired
   * @returns The current or updated proposal status
   */
  finalize(): ProposalStatus {
    // Still pending if before finalization time
    if (Date.now() < this.finalizedAt) {
      return ProposalStatus.Pending;
    }
    
    // Update status if still pending after finalization time
    if (this._status === ProposalStatus.Pending) {
      this._status = ProposalStatus.Failed; // TODO: Implement finalization logic
    }
    
    return this._status;
  }

  /**
   * Executes the proposal's Solana transaction
   * Only callable for proposals with Passed status
   * @throws Error if proposal is pending, already executed, or failed
   */
  async execute(): Promise<void> {
    if (this._status === ProposalStatus.Pending) {
      throw new Error('Cannot execute proposal that has not been finalized');
    }
    
    if (this._status === ProposalStatus.Executed) {
      throw new Error('Proposal has already been executed');
    }
    
    if (this._status !== ProposalStatus.Passed) {
      throw new Error('Cannot execute proposal that has not passed');
    }
    
    // TODO: Execute the Solana transaction
    this._status = ProposalStatus.Executed;
  }
}