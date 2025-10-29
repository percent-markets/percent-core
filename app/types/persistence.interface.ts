import { IModeratorConfig, ProposalStatus } from './moderator.interface';
import { IProposal } from './proposal.interface';
import { ITWAPConfig } from './twap-oracle.interface';

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
 * Database representation of a proposal (new schema)
 */
export interface IProposalDB {
  id: number;                          // Global unique ID
  moderator_id: number;                 // Reference to moderator
  proposal_id: number;                  // Per-moderator proposal ID
  title?: string;                       // Proposal title (optional)
  description?: string;                 // Proposal description (optional)
  status: ProposalStatus;               // Proposal status enum
  created_at: Date;
  finalized_at: Date;
  proposal_length: string;              // bigint stored as string

  // Transaction data
  transaction_instructions: string | ITransactionInstructionData[]; // JSON string or parsed array
  transaction_fee_payer?: string;       // Optional fee payer

  // Token configuration
  base_mint: string;
  quote_mint: string;
  base_decimals: number;
  quote_decimals: number;

  // AMM configuration
  amm_config: string | {                // JSON string or parsed object
    initialBaseAmount: string;
    initialQuoteAmount: string;
  };

  // TWAP configuration
  twap_config: string | ITWAPConfig;    // JSON string or parsed object

  // Serialized component data
  pass_amm_data: string | any;          // JSON string or parsed object
  fail_amm_data: string | any;          // JSON string or parsed object
  base_vault_data: string | any;        // JSON string or parsed object
  quote_vault_data: string | any;       // JSON string or parsed object
  twap_oracle_data: string | any;       // JSON string or parsed object

  // Optional fields
  spot_pool_address?: string;
  total_supply: number;

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
  protocol_name?: string;
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
  saveModeratorState(proposalCounter: number, config: IModeratorConfig, protocolName?: string): Promise<void>;

  /**
   * Load moderator state from the database
   */
  loadModeratorState(): Promise<{ proposalCounter: number; config: IModeratorConfig; protocolName?: string } | null>;
}