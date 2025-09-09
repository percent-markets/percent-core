import { ProposalStatus } from '../../app/types/moderator.interface';
import { TWAPStatus } from '../../app/types/twap-oracle.interface';

export interface ProposalResponse {
  id: number;
  description: string;
  status: ProposalStatus;
  createdAt: number;
  finalizedAt: number | null;
  proposalStatus: ProposalStatus;
  proposalLength: number;
}

export interface ProposalAnalyticsResponse extends ProposalResponse {
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