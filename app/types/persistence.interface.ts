import { IModeratorConfig } from './moderator.interface';
import { IProposal } from './proposal.interface';
import { AMMState } from './amm.interface';
import { VaultState } from './vault.interface';

/**
 * Serialized transaction instruction data
 */
export interface ITransactionInstructionData {
  programId: string;
  keys: {
    pubkey: string;
    isSigner: boolean;
    isWritable: boolean;
  }[];
  data: string; // base64 encoded
}

/**
 * Serialized transaction data for storage
 */
export interface ITransactionData {
  instructions: ITransactionInstructionData[];
  feePayer: string | null;
}

/**
 * Database representation of a proposal
 */
export interface IProposalDB {
  id: number;
  description: string;
  status: string;
  created_at: Date;
  finalized_at: Date;
  proposal_length: string; // bigint stored as string
  transaction_data: string | ITransactionData; // JSON string or parsed object containing ITransactionData
  
  // Token configuration
  base_mint: string;
  quote_mint: string;
  base_decimals: number;
  quote_decimals: number;
  authority: string;
  
  // AMM configuration
  amm_config: {
    initialBaseAmount: string;
    initialQuoteAmount: string;
  } | null;
  
  // AMM states
  pass_amm_state: {
    state: AMMState;
    pool?: string;
    position?: string;
    positionNft?: string;
  } | null;
  
  fail_amm_state: {
    state: AMMState;
    pool?: string;
    position?: string;
    positionNft?: string;
  } | null;
  
  // Vault states
  base_vault_state: {
    state: VaultState;
    escrow: string;
    passConditionalMint: string;
    failConditionalMint: string;
  } | null;
  
  quote_vault_state: {
    state: VaultState;
    escrow: string;
    passConditionalMint: string;
    failConditionalMint: string;
  } | null;
  
  // TWAP Oracle state
  twap_oracle_state: {
    passObservation: number;
    failObservation: number;
    passAggregation: number;
    failAggregation: number;
    lastUpdateTime: number;
    initialTwapValue: number;
    twapMaxObservationChangePerUpdate: number;
    twapStartDelay: number;
    passThresholdBps: number;
  } | null;
  
  updated_at: Date;
}

/**
 * Database representation of moderator state
 */
export interface IModeratorStateDB {
  id: number;
  proposal_id_counter: number;
  config: {
    baseMint: string;
    quoteMint: string;
    baseDecimals: number;
    quoteDecimals: number;
    authority: string;
    rpcUrl: string;
  };
  updated_at: Date;
}

/**
 * Service for persisting and loading state from database
 */
export interface IPersistenceService {
  /**
   * Save a proposal to the database
   */
  saveProposal(proposal: IProposal): Promise<void>;
  
  /**
   * Load a proposal from the database
   */
  loadProposal(id: number): Promise<IProposal | null>;
  
  /**
   * Load all proposals from the database
   */
  loadAllProposals(): Promise<IProposal[]>;
  
  /**
   * Get proposals for frontend (simplified data)
   */
  getProposalsForFrontend(): Promise<IProposalDB[]>;
  
  /**
   * Get a single proposal for frontend
   */
  getProposalForFrontend(id: number): Promise<IProposalDB | null>;
  
  /**
   * Save moderator state to the database
   */
  saveModeratorState(proposalCounter: number, config: IModeratorConfig): Promise<void>;
  
  /**
   * Load moderator state from the database
   */
  loadModeratorState(): Promise<{ proposalCounter: number; config: IModeratorConfig } | null>;
  
  /**
   * Run database migrations
   */
  runMigrations(): Promise<void>;
}