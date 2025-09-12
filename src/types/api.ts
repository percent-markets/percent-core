import { ProposalStatus } from '../../app/types/moderator.interface';
import { TWAPStatus } from '../../app/types/twap-oracle.interface';

// GET /api/proposals response - simplified list view
export interface ProposalListItem {
  id: number;
  description: string;
  status: ProposalStatus;
  createdAt: number; // Unix timestamp in milliseconds
  finalizedAt: number; // Unix timestamp in milliseconds
  passThresholdBps: number; // Basis points for pass threshold
}

export interface ProposalListResponse {
  proposals: ProposalListItem[];
}

// GET /api/proposals/:id response - detailed view
export interface ProposalDetailResponse {
  id: number;
  description: string;
  status: ProposalStatus;
  createdAt: number;
  finalizedAt: number;
  proposalStatus: ProposalStatus;
  proposalLength: number;
  baseMint: string;
  quoteMint: string;
  authority: string;
  ammConfig: {
    initialBaseAmount: string;
    initialQuoteAmount: string;
  } | null;
  passAmmState: any | null;
  failAmmState: any | null;
  baseVaultState: any | null;
  quoteVaultState: any | null;
  twapOracleState: any | null;
}

export interface ProposalAnalyticsResponse extends ProposalDetailResponse {
  baseMint: string;
  quoteMint: string;
  authority: string;
  
  ammConfig: {
    initialBaseAmount: string;
    initialQuoteAmount: string;
  } | null;
  
  vaults: {
    base: VaultData | null;
    quote: VaultData | null;
  };
  
  amms: {
    pass: AMMData | null;
    fail: AMMData | null;
  };
  
  twap: TWAPData;
}

interface VaultData {
  state: string;
  passConditionalMint: string;
  failConditionalMint: string;
  escrow: string;
  passConditionalSupply: string;
  failConditionalSupply: string;
  escrowSupply: string;
}

interface AMMData {
  state: string;
  baseMint: string;
  quoteMint: string;
  pool: string | null;
  price: number | null;
}

interface TWAPData {
  values: {
    passTwap: number;
    failTwap: number;
    passAggregation: number;
    failAggregation: number;
  } | null;
  status: string | null;
  initialTwapValue: number;
  twapStartDelay: number;
  passThresholdBps: number;
  twapMaxObservationChangePerUpdate: number | null;
}

export interface TWAPResponse {
  proposalId: number;
  twap: {
    passTwap: number;
    failTwap: number;
    passAggregation: number;
    failAggregation: number;
  };
  status: TWAPStatus;
}

export interface TWAPCrankResponse {
  proposalId: number;
  message: string;
}

export interface ActiveTasksResponse {
  activeTasks: Array<{
    id: string;
    type: string;
    proposalId: number;
    nextRunTime: number;
  }>;
  count: number;
}

export interface CreateProposalRequest {
  description: string;
  proposalLength: number;
  transaction?: string; // Base64-encoded serialized transaction
  twap: {
    initialTwapValue: number;
    twapMaxObservationChangePerUpdate: number | null;
    twapStartDelay: number;
    passThresholdBps: number;
    minUpdateInterval: number;
  };
  amm: {
    initialBaseAmount: string;
    initialQuoteAmount: string;
  };
}

export interface CreateProposalResponse {
  id: number;
  description: string;
  status: ProposalStatus;
  createdAt: number;
  finalizedAt: number;
  transactionHash?: string;
}

export interface UserBalancesResponse {
  proposalId: number;
  user: string;
  base: {
    regular: string;
    passConditional: string;
    failConditional: string;
  };
  quote: {
    regular: string;
    passConditional: string;
    failConditional: string;
  };
}