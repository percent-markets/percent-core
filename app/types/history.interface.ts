import { Decimal } from 'decimal.js';

/**
 * Price history record
 */
export interface IPriceHistory {
  id?: number;
  timestamp: Date;
  proposalId: number;
  market: 'pass' | 'fail';
  price: Decimal;
  baseLiquidity?: Decimal;
  quoteLiquidity?: Decimal;
}

/**
 * TWAP history record
 */
export interface ITWAPHistory {
  id?: number;
  timestamp: Date;
  proposalId: number;
  passTwap: Decimal;
  failTwap: Decimal;
  passAggregation: Decimal;
  failAggregation: Decimal;
}

/**
 * Trade history record
 */
export interface ITradeHistory {
  id?: number;
  timestamp: Date;
  proposalId: number;
  market: 'pass' | 'fail';
  userAddress: string;
  isBaseToQuote: boolean;
  amountIn: Decimal;
  amountOut: Decimal;
  price: Decimal;
  txSignature?: string;
}

/**
 * Chart data point
 */
export interface IChartDataPoint {
  timestamp: number;
  passPrice?: number;
  failPrice?: number;
  volume?: number;
}

/**
 * Service for managing historical data
 */
export interface IHistoryService {
  /**
   * Record a price snapshot
   */
  recordPrice(data: Omit<IPriceHistory, 'id' | 'timestamp'>): Promise<void>;
  
  /**
   * Record a TWAP snapshot
   */
  recordTWAP(data: Omit<ITWAPHistory, 'id' | 'timestamp'>): Promise<void>;
  
  /**
   * Record a trade
   */
  recordTrade(data: Omit<ITradeHistory, 'id' | 'timestamp'>): Promise<void>;
  
  /**
   * Get price history for a proposal
   */
  getPriceHistory(
    proposalId: number,
    from?: Date,
    to?: Date,
    interval?: string
  ): Promise<IPriceHistory[]>;
  
  /**
   * Get TWAP history for a proposal
   */
  getTWAPHistory(
    proposalId: number,
    from?: Date,
    to?: Date
  ): Promise<ITWAPHistory[]>;
  
  /**
   * Get trade history for a proposal
   */
  getTradeHistory(
    proposalId: number,
    from?: Date,
    to?: Date,
    limit?: number
  ): Promise<ITradeHistory[]>;
  
  /**
   * Get chart data for a proposal
   */
  getChartData(
    proposalId: number,
    interval: '1m' | '5m' | '15m' | '1h' | '4h' | '1d',
    from?: Date,
    to?: Date
  ): Promise<IChartDataPoint[]>;
}