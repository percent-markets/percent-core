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

export class MainnetPriceService {
  private connection: Connection;
  private cpAmm: CpAmm;
  private priceCache: Map<string, AMMPriceData> = new Map();
  private CACHE_DURATION = 5000; // 5 seconds cache

  constructor(rpcUrl: string = 'https://api.mainnet-beta.solana.com') {
    this.connection = new Connection(rpcUrl, 'confirmed');
    this.cpAmm = new CpAmm(this.connection);
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
      let poolState: PoolState;
      try {
        poolState = await this.cpAmm.fetchPoolState(poolPubkey);
      } catch (poolError: any) {
        // Handle pool not found error gracefully
        if (poolError.message?.includes('not found') || poolError.message?.includes('Invariant Violation') || poolError.message?.includes('Account does not exist')) {
          return null;
        }
        throw poolError;
      }

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
      const tokenADecimal = (poolState as any).tokenADecimal ?? 6;
      const tokenBDecimal = (poolState as any).tokenBDecimal ?? 9;

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
        baseReserve = (poolState as any).tokenAAmount || new Decimal(0);
        quoteReserve = (poolState as any).tokenBAmount || new Decimal(0);
      } else {
        // Token B is what we're pricing, need to invert (tokenA per tokenB)
        priceNumber = priceDecimal.isZero() ? 0 : new Decimal(1).div(priceDecimal).toNumber();
        baseReserve = (poolState as any).tokenBAmount || new Decimal(0);
        quoteReserve = (poolState as any).tokenAAmount || new Decimal(0);
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
      }

      // Validate price
      if (isNaN(priceNumber) || !isFinite(priceNumber)) {
        console.log(`Invalid price calculated for ${tokenMint}: ${priceNumber}`);
        return null;
      }

      return {
        tokenAddress: tokenMint,
        price: priceNumber,
        baseReserve: baseReserve.toString(),
        quoteReserve: quoteReserve.toString(),
        timestamp: Date.now()
      };
    } catch (error: any) {
      // Only log non-pool-not-found errors
      if (!error.message?.includes('not found') && !error.message?.includes('Invariant Violation')) {
        console.error('Error parsing pool data:', error);
      }
      return null;
    }
  }

  /**
   * Get prices for multiple tokens in batch
   */
  async getTokenPrices(tokenConfigs: Array<{address: string, poolAddress?: string}>): Promise<Map<string, AMMPriceData>> {
    const prices = new Map<string, AMMPriceData>();

    // Process in parallel with a reasonable concurrency limit
    const batchSize = 5;
    for (let i = 0; i < tokenConfigs.length; i += batchSize) {
      const batch = tokenConfigs.slice(i, i + batchSize);
      const results = await Promise.all(
        batch.map(config => this.getTokenPrice(config.address, config.poolAddress))
      );

      results.forEach((priceData, index) => {
        if (priceData) {
          prices.set(batch[index].address, priceData);
        }
      });
    }

    return prices;
  }

  /**
   * Clear the price cache
   */
  clearCache() {
    this.priceCache.clear();
  }
}

// Export singleton instance
let mainnetPriceService: MainnetPriceService | null = null;

export function getMainnetPriceService(rpcUrl?: string): MainnetPriceService {
  if (!mainnetPriceService) {
    mainnetPriceService = new MainnetPriceService(rpcUrl);
  }
  return mainnetPriceService;
}