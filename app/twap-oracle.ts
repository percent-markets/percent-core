import { ITWAPOracle, ITWAPConfig, TWAPStatus } from './types/twap-oracle.interface';
import { IAMM } from './types/amm.interface';
import { Decimal } from 'decimal.js';


/**
 * TWAP Oracle implementation for tracking time-weighted average prices
 * Aggregates prices from both pass and fail AMMs to determine proposal outcome
 */
export class TWAPOracle implements ITWAPOracle {
  public readonly proposalId: number;
  public readonly initialTwapValue: number;
  public readonly twapMaxObservationChangePerUpdate: number | null;
  public readonly twapStartDelay: number;
  public readonly passThresholdBps: number;
  public readonly minUpdateInterval: number;
  public readonly createdAt: number;
  public readonly finalizedAt: number;

  private _passObservation: number;
  private _failObservation: number;
  private _passAggregation: number;
  private _failAggregation: number;
  private _lastUpdateTime: number;
  private _pAMM: IAMM | null = null;
  private _fAMM: IAMM | null = null;

  /**
   * Creates a new TWAP Oracle instance
   * @param proposalId - ID of the associated proposal
   * @param config - TWAP configuration parameters
   * @param createdAt - Proposal creation timestamp
   * @param finalizedAt - Proposal finalization timestamp
   */
  constructor(
    proposalId: number,
    config: ITWAPConfig,
    createdAt: number,
    finalizedAt: number
  ) {
    this.proposalId = proposalId;
    this.initialTwapValue = config.initialTwapValue;
    this.twapMaxObservationChangePerUpdate = config.twapMaxObservationChangePerUpdate;
    this.twapStartDelay = config.twapStartDelay;
    this.passThresholdBps = config.passThresholdBps;
    this.minUpdateInterval = config.minUpdateInterval;
    this.createdAt = createdAt;
    this.finalizedAt = finalizedAt;

    // Initialize observations and aggregations with the initial value
    this._passObservation = config.initialTwapValue;
    this._failObservation = config.initialTwapValue;
    this._passAggregation = 0;  // Aggregations start at 0
    this._failAggregation = 0;  // Aggregations start at 0
    this._lastUpdateTime = createdAt;
  }

  /**
   * Sets the AMMs for the oracle to track
   * @param pAMM - Pass AMM instance
   * @param fAMM - Fail AMM instance
   */
  setAMMs(pAMM: IAMM, fAMM: IAMM): void {
    if (this._pAMM || this._fAMM) {
      throw new Error('AMMs have already been set');
    }
    this._pAMM = pAMM;
    this._fAMM = fAMM;
  }

  /**
   * Updates the TWAP aggregations based on current AMM prices
   * Respects start delay and finalization time
   * Limited by twapMaxObservationChangePerUpdate per call
   */
  async crankTWAP(): Promise<void> {
    const currentTime = Date.now();
    
    // Check if we're after finalization
    if (currentTime >= this.finalizedAt) {
      return; // Don't update aggregations after finalization
    }

    if (!this._pAMM || !this._fAMM) {
      throw new Error('AMMs not set - call setAMMs first');
    }

    // Minimum time between updates
    if (currentTime < this._lastUpdateTime + this.minUpdateInterval) {
      return; // Not enough time has passed since last update
    }

    // Fetch current prices from both AMMs
    const passPrice = await this._pAMM.fetchPrice();
    const failPrice = await this._fAMM.fetchPrice();

    // Update observations with optional clamping to max change
    const maxChange = this.twapMaxObservationChangePerUpdate;
    
    const passPriceNum = passPrice.toNumber();
    const failPriceNum = failPrice.toNumber();
    
    if (maxChange === null) {
      // No max change - set observations directly to prices
      this._passObservation = passPriceNum;
      this._failObservation = failPriceNum;
    } else {
      // Update pass observation with clamping
      if (passPriceNum > this._passObservation) {
        const maxObservation = this._passObservation + maxChange;
        this._passObservation = Math.min(passPriceNum, maxObservation);
      } else {
        const minObservation = Math.max(0, this._passObservation - maxChange);
        this._passObservation = Math.max(passPriceNum, minObservation);
      }

      // Update fail observation with clamping
      if (failPriceNum > this._failObservation) {
        const maxObservation = this._failObservation + maxChange;
        this._failObservation = Math.min(failPriceNum, maxObservation);
      } else {
        const minObservation = Math.max(0, this._failObservation - maxChange);
        this._failObservation = Math.max(failPriceNum, minObservation);
      }
    }

    // Update aggregations if we're past the start delay
    const twapStartTime = this.createdAt + this.twapStartDelay;
    if (currentTime > twapStartTime) {
      // Calculate effective last update time (don't count time before start)
      const effectiveLastUpdateTime = Math.max(this._lastUpdateTime, twapStartTime);
      const effectiveCurrentTime = Math.min(currentTime, this.finalizedAt);
      const timeElapsed = effectiveCurrentTime - effectiveLastUpdateTime;

      if (timeElapsed > 0) {
        // Add weighted observations to aggregations
        this._passAggregation += this._passObservation * timeElapsed;
        this._failAggregation += this._failObservation * timeElapsed;
      }
    }

    // Update last update time
    this._lastUpdateTime = currentTime;
  }

  /**
   * Fetches the current TWAP prices and aggregations
   * @returns Object containing pass/fail TWAPs and aggregations
   * @throws Error if AMMs are not set or no time has passed
   */
  async fetchTWAP(): Promise<{
    passTwap: Decimal;
    failTwap: Decimal;
    passAggregation: number;
    failAggregation: number;
  }> {
    if (!this._pAMM || !this._fAMM) {
      throw new Error('AMMs not set - call setAMMs first');
    }

    const twapStartTime = this.createdAt + this.twapStartDelay;
    const currentTime = Math.min(Date.now(), this.finalizedAt);
    
    // Calculate time passed since TWAP started
    if (currentTime <= twapStartTime) {
      // TWAP hasn't started yet, return initial values
      return {
        passTwap: new Decimal(this.initialTwapValue),
        failTwap: new Decimal(this.initialTwapValue),
        passAggregation: 0,
        failAggregation: 0
      };
    }

    const timePassed = currentTime - twapStartTime;
    if (timePassed <= 0) {
      throw new Error('No time has passed since TWAP start');
    }

    // Calculate TWAP prices by dividing aggregations by time passed
    const passTwap = new Decimal(this._passAggregation).div(timePassed);
    const failTwap = new Decimal(this._failAggregation).div(timePassed);

    return {
      passTwap,
      failTwap,
      passAggregation: this._passAggregation,
      failAggregation: this._failAggregation
    };
  }

  /**
   * Determines the current status based on TWAP prices
   * @returns TWAPStatus indicating if proposal is passing or failing
   * @throws Error if AMMs are not set
   */
  async fetchStatus(): Promise<TWAPStatus> {
    if (!this._pAMM || !this._fAMM) {
      throw new Error('AMMs not set - call setAMMs first');
    }

    const { passTwap, failTwap } = await this.fetchTWAP();
    
    // Calculate the difference between pass and fail TWAP prices
    const passTwapNum = passTwap.toNumber();
    const failTwapNum = failTwap.toNumber();
    const difference = passTwapNum - failTwapNum;
    
    // Calculate threshold in absolute terms
    const threshold = (failTwapNum * this.passThresholdBps) / 10000;
    
    // Proposal is passing if pass TWAP exceeds fail TWAP by threshold
    if (difference > threshold) {
      return TWAPStatus.Passing;
    } else {
      return TWAPStatus.Failing;
    }
  }
}