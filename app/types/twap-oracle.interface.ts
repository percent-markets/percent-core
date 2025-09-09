import { Decimal } from 'decimal.js';
import { IAMM } from './amm.interface';

/**
 * Enum representing the TWAP oracle status
 */
export enum TWAPStatus {
  Passing = 'Passing',   // Pass TWAP exceeds fail TWAP by threshold
  Failing = 'Failing'     // Pass TWAP does not exceed threshold
}

/**
 * Configuration for TWAP oracle
 */
export interface ITWAPConfig {
  initialTwapValue: number;                     // Initial observation value for both AMMs
  twapMaxObservationChangePerUpdate: number | null;  // Maximum change allowed per update (null = no limit)
  twapStartDelay: number;                       // Delay in milliseconds before TWAP starts recording
  passThresholdBps: number;                     // Basis points threshold for proposal to pass
  minUpdateInterval: number;                    // Minimum interval between TWAP updates in milliseconds
}

/**
 * Interface for Time-Weighted Average Price oracle
 * Tracks and aggregates prices from pass and fail AMMs
 */
export interface ITWAPOracle {
  readonly proposalId: number;                          // ID of associated proposal (immutable)
  readonly initialTwapValue: number;                    // Initial observation value (immutable)
  readonly twapMaxObservationChangePerUpdate: number | null;  // Max observation change per update (null = no limit) (immutable)
  readonly twapStartDelay: number;                      // Start delay in milliseconds (immutable)
  readonly passThresholdBps: number;                    // Pass threshold in basis points (immutable)
  readonly createdAt: number;                           // Creation timestamp in milliseconds (immutable)
  readonly finalizedAt: number;                         // Finalization timestamp in milliseconds (immutable)
  
  /**
   * Sets the AMMs for the oracle to track
   * Must be called before any other oracle operations
   * @param pAMM - Pass AMM instance
   * @param fAMM - Fail AMM instance
   * @throws Error if AMMs have already been set
   */
  setAMMs(pAMM: IAMM, fAMM: IAMM): void;
  
  /**
   * Updates TWAP observations and aggregations based on current AMM prices
   * Respects start delay, finalization time, and minimum update interval
   * Observations are clamped by twapMaxObservationChangePerUpdate
   * @throws Error if AMMs are not set
   */
  crankTWAP(): Promise<void>;
  
  /**
   * Fetches current TWAP prices and aggregations
   * @returns Object containing:
   *   - passTwap: Time-weighted average price for pass AMM
   *   - failTwap: Time-weighted average price for fail AMM
   *   - passAggregation: Cumulative weighted pass observations
   *   - failAggregation: Cumulative weighted fail observations
   * @throws Error if AMMs are not set
   */
  fetchTWAP(): Promise<{
    passTwap: Decimal;
    failTwap: Decimal;
    passAggregation: number;
    failAggregation: number;
  }>;
  
  /**
   * Determines proposal status based on TWAP prices
   * @returns TWAPStatus.Passing if pass TWAP exceeds fail TWAP by threshold
   * @throws Error if AMMs are not set
   */
  fetchStatus(): Promise<TWAPStatus>;
}