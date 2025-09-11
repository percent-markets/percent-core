import { getPool } from './database.service';
import { 
  IHistoryService, 
  IPriceHistory, 
  ITWAPHistory, 
  ITradeHistory, 
  IChartDataPoint 
} from '../types/history.interface';
import { Decimal } from 'decimal.js';

/**
 * Service for managing historical data in PostgreSQL
 */
export class HistoryService implements IHistoryService {
  private static instance: HistoryService | null = null;
  
  private constructor() {}
  
  public static getInstance(): HistoryService {
    if (!HistoryService.instance) {
      HistoryService.instance = new HistoryService();
    }
    return HistoryService.instance;
  }
  
  /**
   * Record a price snapshot
   */
  async recordPrice(data: Omit<IPriceHistory, 'id' | 'timestamp'>): Promise<void> {
    const pool = getPool();
    
    try {
      const query = `
        INSERT INTO price_history (
          proposal_id, market, price, base_liquidity, quote_liquidity
        ) VALUES ($1, $2, $3, $4, $5)
      `;
      
      await pool.query(query, [
        data.proposalId,
        data.market,
        data.price.toString(),
        data.baseLiquidity?.toString() || null,
        data.quoteLiquidity?.toString() || null
      ]);
    } catch (error) {
      console.error('Failed to record price:', error);
      throw error;
    }
  }
  
  /**
   * Record a TWAP snapshot
   */
  async recordTWAP(data: Omit<ITWAPHistory, 'id' | 'timestamp'>): Promise<void> {
    const pool = getPool();
    
    try {
      const query = `
        INSERT INTO twap_history (
          proposal_id, pass_twap, fail_twap, pass_aggregation, fail_aggregation
        ) VALUES ($1, $2, $3, $4, $5)
      `;
      
      await pool.query(query, [
        data.proposalId,
        data.passTwap.toString(),
        data.failTwap.toString(),
        data.passAggregation.toString(),
        data.failAggregation.toString()
      ]);
    } catch (error) {
      console.error('Failed to record TWAP:', error);
      throw error;
    }
  }
  
  /**
   * Record a trade
   */
  async recordTrade(data: Omit<ITradeHistory, 'id' | 'timestamp'>): Promise<void> {
    const pool = getPool();
    
    try {
      const query = `
        INSERT INTO trade_history (
          proposal_id, market, user_address, is_base_to_quote,
          amount_in, amount_out, price, tx_signature
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `;
      
      await pool.query(query, [
        data.proposalId,
        data.market,
        data.userAddress,
        data.isBaseToQuote,
        data.amountIn.toString(),
        data.amountOut.toString(),
        data.price.toString(),
        data.txSignature || null
      ]);
    } catch (error) {
      console.error('Failed to record trade:', error);
      throw error;
    }
  }
  
  /**
   * Get price history for a proposal
   */
  async getPriceHistory(
    proposalId: number,
    from?: Date,
    to?: Date,
    interval?: string
  ): Promise<IPriceHistory[]> {
    const pool = getPool();
    
    try {
      let query = `
        SELECT * FROM price_history
        WHERE proposal_id = $1
      `;
      const params: (number | Date)[] = [proposalId];
      
      if (from) {
        params.push(from);
        query += ` AND timestamp >= $${params.length}`;
      }
      
      if (to) {
        params.push(to);
        query += ` AND timestamp <= $${params.length}`;
      }
      
      query += ' ORDER BY timestamp DESC';
      
      if (interval) {
        // For intervals, we'll aggregate the data
        // This is a simplified version - you might want more sophisticated aggregation
        const intervalSeconds = this.parseInterval(interval);
        if (intervalSeconds > 0) {
          query = `
            SELECT 
              MIN(id) as id,
              date_trunc('epoch', timestamp) + 
                interval '${intervalSeconds} seconds' * 
                floor(extract(epoch from timestamp) / ${intervalSeconds}) as timestamp,
              proposal_id,
              market,
              AVG(price) as price,
              AVG(base_liquidity) as base_liquidity,
              AVG(quote_liquidity) as quote_liquidity
            FROM price_history
            WHERE proposal_id = $1
          `;
          
          if (from) {
            query += ` AND timestamp >= $2`;
          }
          if (to) {
            const toParam = from ? 3 : 2;
            query += ` AND timestamp <= $${toParam}`;
          }
          
          query += `
            GROUP BY proposal_id, market, 
              date_trunc('epoch', timestamp) + 
              interval '${intervalSeconds} seconds' * 
              floor(extract(epoch from timestamp) / ${intervalSeconds})
            ORDER BY timestamp DESC
          `;
        }
      }
      
      const result = await pool.query(query, params);
      
      return result.rows.map(row => {
        const priceHistory: IPriceHistory = {
          id: row.id,
          timestamp: row.timestamp,
          proposalId: row.proposal_id,
          market: row.market,
          price: new Decimal(row.price),
        };
        
        if (row.base_liquidity) {
          priceHistory.baseLiquidity = new Decimal(row.base_liquidity);
        }
        if (row.quote_liquidity) {
          priceHistory.quoteLiquidity = new Decimal(row.quote_liquidity);
        }
        
        return priceHistory;
      });
    } catch (error) {
      console.error('Failed to get price history:', error);
      throw error;
    }
  }
  
  /**
   * Get TWAP history for a proposal
   */
  async getTWAPHistory(
    proposalId: number,
    from?: Date,
    to?: Date
  ): Promise<ITWAPHistory[]> {
    const pool = getPool();
    
    try {
      let query = `
        SELECT * FROM twap_history
        WHERE proposal_id = $1
      `;
      const params: (number | Date)[] = [proposalId];
      
      if (from) {
        params.push(from);
        query += ` AND timestamp >= $${params.length}`;
      }
      
      if (to) {
        params.push(to);
        query += ` AND timestamp <= $${params.length}`;
      }
      
      query += ' ORDER BY timestamp DESC';
      
      const result = await pool.query(query, params);
      
      return result.rows.map(row => ({
        id: row.id,
        timestamp: row.timestamp,
        proposalId: row.proposal_id,
        passTwap: new Decimal(row.pass_twap),
        failTwap: new Decimal(row.fail_twap),
        passAggregation: new Decimal(row.pass_aggregation),
        failAggregation: new Decimal(row.fail_aggregation),
      }));
    } catch (error) {
      console.error('Failed to get TWAP history:', error);
      throw error;
    }
  }
  
  /**
   * Get trade history for a proposal
   */
  async getTradeHistory(
    proposalId: number,
    from?: Date,
    to?: Date,
    limit?: number
  ): Promise<ITradeHistory[]> {
    const pool = getPool();
    
    try {
      let query = `
        SELECT * FROM trade_history
        WHERE proposal_id = $1
      `;
      const params: (number | Date)[] = [proposalId];
      
      if (from) {
        params.push(from);
        query += ` AND timestamp >= $${params.length}`;
      }
      
      if (to) {
        params.push(to);
        query += ` AND timestamp <= $${params.length}`;
      }
      
      query += ' ORDER BY timestamp DESC';
      
      if (limit) {
        query += ` LIMIT ${limit}`;
      }
      
      const result = await pool.query(query, params);
      
      return result.rows.map(row => ({
        id: row.id,
        timestamp: row.timestamp,
        proposalId: row.proposal_id,
        market: row.market,
        userAddress: row.user_address,
        isBaseToQuote: row.is_base_to_quote,
        amountIn: new Decimal(row.amount_in),
        amountOut: new Decimal(row.amount_out),
        price: new Decimal(row.price),
        txSignature: row.tx_signature,
      }));
    } catch (error) {
      console.error('Failed to get trade history:', error);
      throw error;
    }
  }
  
  /**
   * Get chart data for a proposal
   */
  async getChartData(
    proposalId: number,
    interval: '1m' | '5m' | '15m' | '1h' | '4h' | '1d',
    from?: Date,
    to?: Date
  ): Promise<IChartDataPoint[]> {
    const pool = getPool();
    
    try {
      const intervalSeconds = this.parseInterval(interval);
      
      // Get aggregated price data
      let query = `
        SELECT 
          date_trunc('epoch', timestamp) + 
            interval '${intervalSeconds} seconds' * 
            floor(extract(epoch from timestamp) / ${intervalSeconds}) as bucket,
          market,
          AVG(price) as avg_price,
          MAX(price) as high,
          MIN(price) as low,
          FIRST_VALUE(price) OVER (
            PARTITION BY market, 
            date_trunc('epoch', timestamp) + 
              interval '${intervalSeconds} seconds' * 
              floor(extract(epoch from timestamp) / ${intervalSeconds})
            ORDER BY timestamp
          ) as open,
          LAST_VALUE(price) OVER (
            PARTITION BY market,
            date_trunc('epoch', timestamp) + 
              interval '${intervalSeconds} seconds' * 
              floor(extract(epoch from timestamp) / ${intervalSeconds})
            ORDER BY timestamp
            RANGE BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
          ) as close
        FROM price_history
        WHERE proposal_id = $1
      `;
      
      const params: (number | Date)[] = [proposalId];
      
      if (from) {
        params.push(from);
        query += ` AND timestamp >= $${params.length}`;
      }
      
      if (to) {
        params.push(to);
        query += ` AND timestamp <= $${params.length}`;
      }
      
      query += `
        ORDER BY bucket DESC
      `;
      
      const priceResult = await pool.query(query, params);
      
      // Get trade volume data
      let volumeQuery = `
        SELECT 
          date_trunc('epoch', timestamp) + 
            interval '${intervalSeconds} seconds' * 
            floor(extract(epoch from timestamp) / ${intervalSeconds}) as bucket,
          SUM(amount_in) as volume
        FROM trade_history
        WHERE proposal_id = $1
      `;
      
      if (from) {
        volumeQuery += ` AND timestamp >= $2`;
      }
      if (to) {
        const toParam = from ? 3 : 2;
        volumeQuery += ` AND timestamp <= $${toParam}`;
      }
      
      volumeQuery += `
        GROUP BY bucket
        ORDER BY bucket DESC
      `;
      
      const volumeResult = await pool.query(volumeQuery, params);
      
      // Combine price and volume data
      const chartData = new Map<number, IChartDataPoint>();
      
      // Process price data
      for (const row of priceResult.rows) {
        const timestamp = new Date(row.bucket).getTime();
        const existing = chartData.get(timestamp) || { timestamp };
        
        if (row.market === 'pass') {
          existing.passPrice = parseFloat(row.avg_price);
        } else {
          existing.failPrice = parseFloat(row.avg_price);
        }
        
        chartData.set(timestamp, existing);
      }
      
      // Add volume data
      for (const row of volumeResult.rows) {
        const timestamp = new Date(row.bucket).getTime();
        const existing = chartData.get(timestamp) || { timestamp };
        existing.volume = parseFloat(row.volume);
        chartData.set(timestamp, existing);
      }
      
      return Array.from(chartData.values()).sort((a, b) => b.timestamp - a.timestamp);
    } catch (error) {
      console.error('Failed to get chart data:', error);
      throw error;
    }
  }
  
  /**
   * Parse interval string to seconds
   */
  private parseInterval(interval: string): number {
    const intervals: Record<string, number> = {
      '1m': 60,
      '5m': 300,
      '15m': 900,
      '1h': 3600,
      '4h': 14400,
      '1d': 86400,
    };
    
    return intervals[interval] || 60;
  }
}