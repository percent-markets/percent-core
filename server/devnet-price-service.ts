import { Connection, PublicKey } from '@solana/web3.js';
import { CpAmm, PoolState, getPriceFromSqrtPrice } from '@meteora-ag/cp-amm-sdk';
import { Decimal } from 'decimal.js';

interface AMMPriceData {
  tokenAddress: string;
  price: number;
  baseReserve: string;
  quoteReserve: string;
  timestamp: number;
}

export class DevnetPriceService {
  private connection: Connection;
  private cpAmm: CpAmm;
  private priceCache: Map<string, AMMPriceData> = new Map();
  private CACHE_DURATION = 5000; // 5 seconds cache

  constructor(rpcUrl: string = 'https://api.devnet.solana.com') {
    this.connection = new Connection(rpcUrl, 'confirmed');
    this.cpAmm = new CpAmm(this.connection);
    console.log('DevnetPriceService initialized with RPC:', rpcUrl);
  }

  /**
   * Get the price of a token from its AMM pool
   * For pass/fail tokens, this calculates price based on pool reserves
   */
  async getTokenPrice(tokenMint: string, poolAddress?: string): Promise<AMMPriceData | null> {
    try {
      // Check cache first
      const cached = this.priceCache.get(tokenMint);
      if (cached && (Date.now() - cached.timestamp) < this.CACHE_DURATION) {
        return cached;
      }

      // If no pool address provided, try to find it
      if (!poolAddress) {
        // For now, we'll need the pool address from the proposal data
        console.log(`No pool address provided for token ${tokenMint}`);
        return null;
      }

      // Parse pool data using the SDK
      const poolData = await this.parsePoolData(poolAddress, tokenMint);
      
      if (poolData) {
        // Cache the result
        this.priceCache.set(tokenMint, poolData);
        return poolData;
      }

      return null;
    } catch (error) {
      console.error(`Error fetching price for ${tokenMint}:`, error);
      return null;
    }
  }

  /**
   * Parse pool data to extract reserves and calculate price
   * Using Meteora CP-AMM SDK to properly fetch pool state
   */
  private async parsePoolData(poolAddress: string, tokenMint: string): Promise<AMMPriceData | null> {
    try {
      const poolPubkey = new PublicKey(poolAddress);
      
      // Fetch pool state using the SDK
      const poolState: PoolState = await this.cpAmm.fetchPoolState(poolPubkey);
      
      // Determine if the requested token is tokenA or tokenB
      const tokenMintPubkey = new PublicKey(tokenMint);
      const isTokenA = poolState.tokenAMint.equals(tokenMintPubkey);
      const isTokenB = poolState.tokenBMint.equals(tokenMintPubkey);
      
      if (!isTokenA && !isTokenB) {
        console.log(`Token ${tokenMint} not found in pool ${poolAddress}`);
        return null;
      }
      
      // Get price from the sqrt price stored in the pool
      // The price represents tokenB/tokenA (quote/base)
      // Default to 9 decimals if not provided (standard for Solana tokens)
      const tokenADecimal = poolState.tokenADecimal ?? 6;
      const tokenBDecimal = poolState.tokenBDecimal ?? 9;
      
      const priceDecimal = getPriceFromSqrtPrice(
        poolState.sqrtPrice,
        tokenADecimal,
        tokenBDecimal
      );
      
      // Price calculation done
      
      // If we're looking for tokenA price (in terms of tokenB), use the price directly
      // If we're looking for tokenB price (in terms of tokenA), use 1/price
      let priceNumber: number;
      let baseReserve: Decimal;
      let quoteReserve: Decimal;
      
      if (isTokenA) {
        // Token A is the base token, price is already in correct format (tokenB per tokenA)
        priceNumber = priceDecimal.toNumber();
        baseReserve = poolState.tokenAAmount || new Decimal(0);
        quoteReserve = poolState.tokenBAmount || new Decimal(0);
      } else {
        // Token B is what we're pricing, need to invert (tokenA per tokenB)
        priceNumber = priceDecimal.isZero() ? 0 : new Decimal(1).div(priceDecimal).toNumber();
        baseReserve = poolState.tokenBAmount || new Decimal(0);
        quoteReserve = poolState.tokenAAmount || new Decimal(0);
      }
      
      
      // Handle case where pools have no reserve data but have sqrt price
      // This can happen with Meteora pools - use the price from sqrt price
      if ((!baseReserve || baseReserve.isZero()) && (!quoteReserve || quoteReserve.isZero())) {
        // If we have a valid price from sqrt price, use it
        if (!isNaN(priceNumber) && isFinite(priceNumber) && priceNumber > 0) {
          return {
            tokenAddress: tokenMint,
            price: priceNumber,
            baseReserve: '0',
            quoteReserve: '0',
            timestamp: Date.now()
          };
        }
        
        // No liquidity in pool
        return {
          tokenAddress: tokenMint,
          price: 0, // No liquidity, no price
          baseReserve: '0',
          quoteReserve: '0',
          timestamp: Date.now()
        };
      }
      
      return {
        tokenAddress: tokenMint,
        price: priceNumber,
        baseReserve: baseReserve.toString(),
        quoteReserve: quoteReserve.toString(),
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('Error parsing pool data:', error);
      return null;
    }
  }

  /**
   * Get prices for multiple tokens in batch
   */
  async getBatchPrices(tokens: Array<{ mint: string, pool?: string }>): Promise<Map<string, AMMPriceData>> {
    const prices = new Map<string, AMMPriceData>();
    
    // Fetch all prices in parallel
    const results = await Promise.all(
      tokens.map(async ({ mint, pool }) => {
        const price = await this.getTokenPrice(mint, pool);
        return { mint, price };
      })
    );
    
    // Build the result map
    results.forEach(({ mint, price }) => {
      if (price) {
        prices.set(mint, price);
      }
    });
    
    return prices;
  }

  /**
   * Calculate price from reserves directly (for simple constant product AMMs)
   */
  calculatePrice(baseReserve: Decimal, quoteReserve: Decimal): number {
    if (baseReserve.isZero()) return 0;
    return quoteReserve.div(baseReserve).toNumber();
  }

  /**
   * Monitor a pool for price changes
   * @param poolAddress The pool address to monitor
   * @param tokenMint The token mint we're interested in (for price calculation)
   * @param callback Function to call when price changes
   */
  async monitorPool(poolAddress: string, callback: (price: AMMPriceData) => void, tokenMint?: string): Promise<number> {
    const poolPubkey = new PublicKey(poolAddress);
    
    // Subscribe to account changes
    const subscriptionId = this.connection.onAccountChange(
      poolPubkey,
      async (accountInfo) => {
        // Parse the updated pool data
        // If tokenMint is provided, use it; otherwise try to parse from the pool
        const poolData = await this.parsePoolData(poolAddress, tokenMint || poolAddress);
        if (poolData) {
          callback(poolData);
        }
      },
      'confirmed'
    );
    
    console.log(`Monitoring pool ${poolAddress} with subscription ${subscriptionId}`);
    return subscriptionId;
  }

  /**
   * Stop monitoring a pool
   */
  async unmonitor(subscriptionId: number): Promise<void> {
    await this.connection.removeAccountChangeListener(subscriptionId);
    console.log(`Stopped monitoring subscription ${subscriptionId}`);
  }
}

// Singleton instance
let devnetPriceServiceInstance: DevnetPriceService | null = null;

export function getDevnetPriceService(rpcUrl?: string): DevnetPriceService {
  if (!devnetPriceServiceInstance) {
    devnetPriceServiceInstance = new DevnetPriceService(
      rpcUrl || process.env.DEVNET_RPC_URL || 'https://api.devnet.solana.com'
    );
  }
  return devnetPriceServiceInstance;
}