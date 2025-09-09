import { BN } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { Decimal } from "decimal.js";

/**
 * Enum representing the operational state of the AMM
 */
export enum AMMState {
  Uninitialized = 'Uninitialized', // AMM not yet initialized
  Trading = 'Trading',              // AMM is active and can perform swaps
  Finalized = 'Finalized'           // AMM has removed liquidity and is closed
}

/**
 * Interface for Automated Market Maker (AMM) in the protocol
 * Manages liquidity pools for conditional token trading
 */
export interface IAMM {
  readonly baseMint: PublicKey;       // Base token mint address (immutable)
  readonly quoteMint: PublicKey;      // Quote token mint address (immutable)
  readonly baseDecimals: number;      // Decimals for base token (immutable)
  readonly quoteDecimals: number;     // Decimals for quote token (immutable)
  readonly state: AMMState;           // Current operational state (readonly)
  readonly isFinalized: boolean;      // Whether the AMM has been finalized
  pool?: PublicKey;                   // Pool address (set after initialization)
  position?: PublicKey;               // Position account address
  positionNft?: PublicKey;            // Position NFT mint address
  
  /**
   * Initializes the AMM pool with initial liquidity
   * Creates pool, position, and deposits initial tokens
   * @param initialBaseTokenAmount - Initial base token amount to deposit
   * @param initialQuoteAmount - Initial quote token amount to deposit
   */
  initialize(
    initialBaseTokenAmount: BN,
    initialQuoteAmount: BN
  ): Promise<void>;
  
  /**
   * Fetches the current price from the pool
   * @returns Current price as base/quote ratio
   * @throws Error if pool is uninitialized or finalized
   */
  fetchPrice(): Promise<Decimal>;
  
  /**
   * Removes all liquidity and closes the position
   * Sets AMM state to finalized, preventing further operations
   * @throws Error if already finalized or pool uninitialized
   */
  removeLiquidity(): Promise<void>;
  
  /**
   * Executes a token swap on the AMM
   * @param isBaseToQuote - Direction of swap (true: base->quote, false: quote->base)
   * @param amountIn - Amount of input tokens to swap
   * @param slippageBps - Slippage tolerance in basis points (default: 50 = 0.5%)
   * @param payer - Optional payer for transaction fees
   * @throws Error if pool is finalized or uninitialized
   */
  swap(
    isBaseToQuote: boolean,
    amountIn: BN,
    slippageBps?: number,
    payer?: PublicKey
  ): Promise<void>;
}