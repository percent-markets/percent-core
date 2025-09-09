import { Keypair, PublicKey } from '@solana/web3.js';
import { IAMM, AMMState } from './types/amm.interface';
import { ExecutionService } from './services/execution.service';
import { 
  CpAmm, 
  MAX_SQRT_PRICE, 
  MIN_SQRT_PRICE, 
  PoolFeesParams, 
  PoolState, 
  PositionState,
  RemoveAllLiquidityAndClosePositionParams,
  SwapParams,
  getPriceFromSqrtPrice,
  derivePositionNftAccount
} from "@meteora-ag/cp-amm-sdk";
import { IExecutionConfig } from './types/execution.interface';
import { BN } from '@coral-xyz/anchor';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { Decimal } from 'decimal.js';

/**
 * AMM class implementing automated market maker functionality
 * Uses Meteora's CP-AMM SDK for constant product pools
 * Manages liquidity provision and token swaps for conditional tokens
 */
export class AMM implements IAMM {
  public readonly baseMint: PublicKey;          // Base token mint (e.g., conditional token)
  public readonly quoteMint: PublicKey;         // Quote token mint (e.g., SOL or USDC)
  public readonly baseDecimals: number;         // Decimal precision for base token
  public readonly quoteDecimals: number;        // Decimal precision for quote token
  public authority: Keypair;                    // Authority keypair for signing transactions
  private executionService: ExecutionService;   // Service for executing blockchain transactions
  public cpAmm: CpAmm;                          // Meteora CP-AMM SDK instance
  public pool?: PublicKey;                      // Pool address (set after initialization)
  public position?: PublicKey;                  // Position account (tracks LP ownership)
  public positionNft?: PublicKey;               // NFT mint representing position ownership
  private _state: AMMState = AMMState.Uninitialized;  // Current operational state

  /**
   * Creates a new AMM instance
   * @param baseMint - Public key of the base token mint
   * @param quoteMint - Public key of the quote token mint  
   * @param baseDecimals - Number of decimals for base token
   * @param quoteDecimals - Number of decimals for quote token
   * @param authority - Keypair with authority to manage the AMM
   * @param executionConfig - Configuration for transaction execution
   */
  constructor(
    baseMint: PublicKey,
    quoteMint: PublicKey,
    baseDecimals: number,
    quoteDecimals: number,
    authority: Keypair,
    executionConfig: IExecutionConfig
  ) {
    this.baseMint = baseMint;
    this.quoteMint = quoteMint;
    this.baseDecimals = baseDecimals;
    this.quoteDecimals = quoteDecimals;
    this.authority = authority;
    this.executionService = new ExecutionService(executionConfig);
    this.cpAmm = new CpAmm(this.executionService.connection);
  }

  /**
   * Getter for AMM state (read-only access)
   */
  get state(): AMMState {
    return this._state;
  }

  /**
   * Getter for finalized state (read-only access)
   */
  get isFinalized(): boolean {
    return this._state === AMMState.Finalized;
  }

  /**
   * Initializes the AMM pool with initial liquidity
   * Creates a new constant product pool and deposits initial tokens
   * @param initialBaseTokenAmount - Amount of base tokens to deposit initially
   * @param initialQuoteAmount - Amount of quote tokens to deposit initially
   * @throws Error if pool creation fails
   */
  async initialize(
    initialBaseTokenAmount: BN,
    initialQuoteAmount: BN
  ): Promise<void> {
    if (this._state !== AMMState.Uninitialized) {
      throw new Error('AMM already initialized');
    }
    
    // Generate keypair for position NFT (represents LP ownership)
    const positionNftKeypair = new Keypair();

    // Calculate initial price and liquidity based on deposited amounts
    const { initSqrtPrice, liquidityDelta } = this.cpAmm.preparePoolCreationParams({
      tokenAAmount: initialBaseTokenAmount,
      tokenBAmount: initialQuoteAmount,
      minSqrtPrice: MIN_SQRT_PRICE,
      maxSqrtPrice: MAX_SQRT_PRICE
    });

    // Configure pool fees (10% base fee for prediction markets)
    const poolFees: PoolFeesParams = {
      baseFee: {
        feeSchedulerMode: 0,                     // Linear fee schedule
        cliffFeeNumerator: new BN(10_000_000),   // 10% fee (10M / 100M)
        numberOfPeriod: 0,                       // No fee decay
        reductionFactor: new BN(0),              // No reduction
        periodFrequency: new BN(0)               // No period changes
      },
      dynamicFee: null,                          // No dynamic fees
      padding: []                                // Reserved for future use
    };

    // Build transaction to create custom pool with initial liquidity
    const {
      tx,
      pool,
      position
    } = await this.cpAmm.createCustomPool({
      payer: this.authority.publicKey,
      creator: this.authority.publicKey,
      positionNft: positionNftKeypair.publicKey,
      tokenAMint: this.baseMint,
      tokenBMint: this.quoteMint,
      tokenAAmount: initialBaseTokenAmount,
      tokenBAmount: initialQuoteAmount,
      sqrtMinPrice: MIN_SQRT_PRICE,
      sqrtMaxPrice: MAX_SQRT_PRICE,
      initSqrtPrice: initSqrtPrice,
      liquidityDelta: liquidityDelta,
      poolFees: poolFees,
      hasAlphaVault: false,                     // No alpha vault needed
      collectFeeMode: 0,                        // Collect fees in both tokens
      activationPoint: new BN(Date.now()),      // Activate immediately
      activationType: 1,                        // Activation by timestamp
      tokenAProgram: TOKEN_PROGRAM_ID,
      tokenBProgram: TOKEN_PROGRAM_ID
    });

    // Execute pool creation transaction
    const result = await this.executionService.executeTx(
      tx,
      this.authority
    );

    if (result.status === 'failed') {
      throw new Error(`Failed to create custom pool: ${result.error}`);
    }

    // Store pool and position references for future operations
    this.pool = pool;
    this.position = position;
    this.positionNft = positionNftKeypair.publicKey;
    
    // Update state to Trading
    this._state = AMMState.Trading;
  }

  /**
   * Fetches the current price from the pool
   * Price represents the exchange rate between base and quote tokens
   * @returns Current price as a Decimal (base/quote ratio)
   * @throws Error if AMM is finalized or pool uninitialized
   */
  async fetchPrice(): Promise<Decimal> {
    if (this._state === AMMState.Uninitialized) {
      throw new Error('AMM not initialized');
    }
    
    if (this._state === AMMState.Finalized) {
      throw new Error('AMM is finalized - cannot fetch price');
    }
    
    if (!this.pool) {
      throw new Error('AMM pool is uninitialized');
    }
    
    // Fetch current pool state and convert sqrt price to regular price
    const poolState: PoolState = await this.cpAmm.fetchPoolState(this.pool);
    return getPriceFromSqrtPrice(poolState.sqrtPrice, this.baseDecimals, this.quoteDecimals);
  }

  /**
   * Removes all liquidity from the pool and closes the position
   * This action is irreversible and finalizes the AMM
   * @throws Error if AMM is already finalized or pool uninitialized
   */
  async removeLiquidity(): Promise<void> {
    if (this._state === AMMState.Uninitialized) {
      throw new Error('AMM not initialized');
    }
    
    if (this._state === AMMState.Finalized) {
      throw new Error('AMM is already finalized');
    }
    
    if (!this.pool || !this.position || !this.positionNft) {
      throw new Error('AMM pool is uninitialized');
    }

    // Fetch current pool and position states for removal operation
    const poolState: PoolState = await this.cpAmm.fetchPoolState(this.pool);
    const positionState: PositionState = await this.cpAmm.fetchPositionState(this.position);
    
    // Derive the position NFT account (token account holding the NFT)
    const positionNftAccount = derivePositionNftAccount(this.positionNft);

    // Configure parameters for complete liquidity removal
    const params: RemoveAllLiquidityAndClosePositionParams = {
      owner: this.authority.publicKey,
      position: this.position,
      positionNftAccount: positionNftAccount,
      positionState: positionState,
      poolState: poolState,
      tokenAAmountThreshold: new BN(0),         // Accept any amount (no slippage protection)
      tokenBAmountThreshold: new BN(0),         // Accept any amount (no slippage protection)
      currentPoint: new BN(Math.floor(Date.now() / 1000)), // Current timestamp for vesting
      vestings: []                              // No vesting accounts
    };

    // Build transaction to remove all liquidity and close position
    const tx = await this.cpAmm.removeAllLiquidityAndClosePosition(params);
    
    // Execute the transaction
    const result = await this.executionService.executeTx(
      tx,
      this.authority
    );

    if (result.status === 'failed') {
      throw new Error(`Failed to remove liquidity and close position: ${result.error}`);
    }

    // Clear position references after successful closure
    this.position = undefined;
    this.positionNft = undefined;
    
    // Mark AMM as finalized - no further operations allowed
    this._state = AMMState.Finalized;
  }

  /**
   * Executes a token swap on the AMM pool
   * @param isBaseToQuote - true to swap base->quote, false for quote->base
   * @param amountIn - Amount of input token to swap
   * @param slippageBps - Slippage tolerance in basis points (e.g., 50 = 0.5%)
   * @param payer - Optional payer for the transaction (defaults to authority)
   */
  async swap(
    isBaseToQuote: boolean,
    amountIn: BN,
    slippageBps: number = 50, // Default 0.5% slippage
    payer?: PublicKey
  ): Promise<void> {
    if (this._state === AMMState.Uninitialized) {
      throw new Error('AMM not initialized');
    }
    
    if (this._state === AMMState.Finalized) {
      throw new Error('AMM is finalized - cannot execute swaps');
    }
    
    if (!this.pool) {
      throw new Error('AMM pool is uninitialized');
    }

    // Fetch current pool state
    const poolState: PoolState = await this.cpAmm.fetchPoolState(this.pool);
    
    // Get current slot and block time for quote calculation
    const connection = this.executionService.connection;
    const currentSlot = await connection.getSlot();
    const blockTime = await connection.getBlockTime(currentSlot);
    
    if (!blockTime) {
      throw new Error('Failed to get block time');
    }

    // Determine input and output mints based on swap direction
    const inputTokenMint = isBaseToQuote ? this.baseMint : this.quoteMint;
    const outputTokenMint = isBaseToQuote ? this.quoteMint : this.baseMint;
    
    // Get quote with slippage protection
    const quote = this.cpAmm.getQuote({
      inAmount: amountIn,
      inputTokenMint: inputTokenMint,
      slippage: slippageBps / 10000, // Convert basis points to decimal
      poolState,
      currentTime: blockTime,
      currentSlot,
      tokenADecimal: this.baseDecimals,
      tokenBDecimal: this.quoteDecimals,
    });

    // Prepare swap parameters
    const swapParams: SwapParams = {
      payer: payer || this.authority.publicKey,
      pool: this.pool,
      inputTokenMint: inputTokenMint,
      outputTokenMint: outputTokenMint,
      amountIn: amountIn,
      minimumAmountOut: quote.minSwapOutAmount,
      tokenAVault: poolState.tokenAVault,
      tokenBVault: poolState.tokenBVault,
      tokenAMint: poolState.tokenAMint,
      tokenBMint: poolState.tokenBMint,
      tokenAProgram: TOKEN_PROGRAM_ID,
      tokenBProgram: TOKEN_PROGRAM_ID,
      referralTokenAccount: null, // No referral account
    };

    // Build swap transaction
    const swapTx = await this.cpAmm.swap(swapParams);
    
    // Execute the swap transaction
    const result = await this.executionService.executeTx(
      swapTx,
      this.authority
    );

    if (result.status === 'failed') {
      throw new Error(`Failed to execute swap: ${result.error}`);
    }
  }
}