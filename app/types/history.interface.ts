import { Decimal } from 'decimal.js';

/**
 * Price history record for AMM price tracking
 * Captures point-in-time price and liquidity snapshots
 */
export interface IPriceHistory {
  id?: number;                   // Database primary key (auto-generated)
  timestamp: Date;                // Snapshot timestamp
  proposalId: number;             // Associated proposal ID
  market: 'pass' | 'fail';        // Which AMM market (pass or fail)
  price: Decimal;                 // Current price at this point in time
  baseLiquidity?: Decimal;        // Base token liquidity in the pool (optional)
  quoteLiquidity?: Decimal;       // Quote token liquidity in the pool (optional)
}

/**
 * TWAP (Time-Weighted Average Price) history record
 * Tracks both current TWAP values and cumulative aggregations
 */
export interface ITWAPHistory {
  id?: number;                   // Database primary key (auto-generated)
  timestamp: Date;                // Snapshot timestamp
  proposalId: number;             // Associated proposal ID
  passTwap: Decimal;              // Current pass market TWAP
  failTwap: Decimal;              // Current fail market TWAP
  passAggregation: Decimal;       // Cumulative pass price aggregation
  failAggregation: Decimal;       // Cumulative fail price aggregation
}

/**
 * Trade history record for swap transactions
 * Captures individual trades executed on the AMMs
 */
export interface ITradeHistory {
  id?: number;                   // Database primary key (auto-generated)
  timestamp: Date;                // Trade execution timestamp
  proposalId: number;             // Associated proposal ID
  market: 'pass' | 'fail';        // Which AMM market was traded
  userAddress: string;            // Trader's wallet address
  isBaseToQuote: boolean;         // Trade direction (true: base→quote, false: quote→base)
  amountIn: Decimal;              // Input token amount
  amountOut: Decimal;             // Output token amount received
  price: Decimal;                 // Execution price (calculated from amounts)
  txSignature?: string;           // Solana transaction signature (optional)
}

/**
 * Chart data point for visualization
 * Aggregated data for displaying price charts and volume
 */
export interface IChartDataPoint {
  timestamp: number;              // Unix timestamp in milliseconds
  passPrice?: number;             // Pass market price at this time (optional)
  failPrice?: number;             // Fail market price at this time (optional)
  volume?: number;                // Trading volume in this time period (optional)
}

/**
 * Service interface for managing historical data
 * Provides methods for recording and retrieving price, TWAP, and trade history
 * All data is persisted in PostgreSQL for analytics and visualization
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