import { WebSocketServer } from 'ws';
import type { WebSocket } from 'ws';
import { getDevnetPriceService } from './devnet-price-service';
import { getMainnetPriceService } from './mainnet-price-service';
import { Client } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

interface PriceData {
  tokenAddress: string;
  price: number;
  timestamp: number;
  source?: 'dexscreener' | 'devnet-amm' | 'mainnet-amm';
}

interface ClientSubscription {
  tokens: Set<string>;
  poolAddresses?: Map<string, string>; // token -> pool mapping
  proposals: Set<number>; // subscribed proposal IDs for trades
}

interface TradeEvent {
  type: 'TRADE';
  proposalId: number;
  market: 'pass' | 'fail';
  userAddress: string;
  isBaseToQuote: boolean;
  amountIn: string;
  amountOut: string;
  price: string;
  txSignature: string | null;
  timestamp: string;
}

class PriceWebSocketServer {
  private wss: WebSocketServer;
  private clients: Map<WebSocket, ClientSubscription> = new Map();
  private prices: Map<string, PriceData> = new Map();
  private priceUpdateInterval: NodeJS.Timeout | null = null;
  private subscribedTokens: Set<string> = new Set();
  private devnetService = getDevnetPriceService();
  private mainnetService = getMainnetPriceService();
  private devnetTokens: Set<string> = new Set(); // Track which tokens are on devnet
  private mainnetPools: Set<string> = new Set(); // Track which pools are on mainnet
  private poolMonitors: Map<string, number> = new Map(); // poolAddress -> subscriptionId
  private pgClient: Client | null = null;
  private subscribedProposals: Set<number> = new Set();
  private solPrice: number = 180; // Default SOL price in USD
  private SOL_ADDRESS = 'So11111111111111111111111111111111111111112';

  constructor(port: number = 9091) {
    this.wss = new WebSocketServer({ port });
    console.log(`Price & Trade WebSocket server started on port ${port}`);
    this.setupServer();
    this.startPriceUpdates();
    this.setupDatabaseListener();
  }

  private setupServer() {
    // Start fetching SOL price
    this.fetchSolPrice();
    setInterval(() => this.fetchSolPrice(), 30000); // Update every 30 seconds

    this.wss.on('connection', (ws: WebSocket) => {
      console.log('New client connected');
      
      // Initialize client subscription
      this.clients.set(ws, { tokens: new Set(), proposals: new Set() });

      ws.on('message', (message: string) => {
        try {
          const data = JSON.parse(message.toString());
          this.handleClientMessage(ws, data);
        } catch (error) {
          console.error('Error parsing client message:', error);
        }
      });

      ws.on('close', () => {
        console.log('Client disconnected');
        this.clients.delete(ws);
        this.updateSubscribedTokens();
      });

      ws.on('error', (error) => {
        console.error('Client WebSocket error:', error);
      });

      // Send initial prices for any cached data
      this.sendCachedPrices(ws);
    });
  }

  private handleClientMessage(ws: WebSocket, data: any) {
    const client = this.clients.get(ws);
    if (!client) return;

    switch (data.type) {
      case 'SUBSCRIBE':
        if (data.tokens && Array.isArray(data.tokens)) {
          console.log('Client subscribing to tokens:', data.tokens.length);
          // Handle simple token array or token objects with pool info
          data.tokens.forEach((tokenOrConfig: string | { address: string, poolAddress?: string }) => {
            let token: string;
            let pool: string | undefined;
            
            if (typeof tokenOrConfig === 'string') {
              token = tokenOrConfig;
            } else {
              token = tokenOrConfig.address;
              pool = tokenOrConfig.poolAddress;
              
              // Store pool address for this token
              if (pool) {
                if (!client.poolAddresses) {
                  client.poolAddresses = new Map();
                }
                client.poolAddresses.set(token, pool);
                this.devnetTokens.add(token); // Mark as devnet token
              }
            }

            client.tokens.add(token);
            this.subscribedTokens.add(token);

            // If this is a devnet token with a pool, set up real-time monitoring
            if (pool && !this.poolMonitors.has(pool)) {
              this.startPoolMonitoring(token, pool);
            }
            
            // Fetch price immediately for new subscription
            this.fetchTokenPrice(token, pool);
            
            // Send current price if available
            const priceData = this.prices.get(token);
            if (priceData) {
              ws.send(JSON.stringify({
                type: 'PRICE_UPDATE',
                data: priceData
              }));
            }
          });
        }
        break;

      case 'UNSUBSCRIBE':
        if (data.tokens && Array.isArray(data.tokens)) {
          data.tokens.forEach((token: string) => {
            client.tokens.delete(token);
            // Client unsubscribed
          });
          this.updateSubscribedTokens();
        }
        break;

      case 'PING':
        ws.send(JSON.stringify({ type: 'PONG' }));
        break;

      case 'SUBSCRIBE_TRADES':
        if (data.proposalId && typeof data.proposalId === 'number') {
          console.log('Client subscribing to trades for proposal:', data.proposalId);
          client.proposals.add(data.proposalId);
          this.subscribedProposals.add(data.proposalId);

          // Send acknowledgment
          ws.send(JSON.stringify({
            type: 'TRADES_SUBSCRIBED',
            proposalId: data.proposalId
          }));
        }
        break;

      case 'UNSUBSCRIBE_TRADES':
        if (data.proposalId && typeof data.proposalId === 'number') {
          client.proposals.delete(data.proposalId);
          this.updateSubscribedProposals();
        }
        break;
    }
  }

  private updateSubscribedTokens() {
    // Update the set of all subscribed tokens across all clients
    this.subscribedTokens.clear();
    this.clients.forEach(client => {
      client.tokens.forEach(token => {
        this.subscribedTokens.add(token);
      });
    });
  }

  private startPriceUpdates() {
    // Initial fetch for OOGWAY
    const OOGWAY_ADDRESS = 'C7MGcMnN8cXUkj8JQuMhkJZh6WqY2r8QnT3AUfKTkrix';
    this.fetchTokenPrice(OOGWAY_ADDRESS);

    // For mainnet tokens (like OOGWAY), poll DexScreener every 10 seconds
    // This is acceptable since DexScreener itself aggregates data
    this.priceUpdateInterval = setInterval(() => {
      // Only poll for mainnet tokens (OOGWAY)
      if (this.subscribedTokens.has(OOGWAY_ADDRESS)) {
        this.fetchTokenPrice(OOGWAY_ADDRESS);
      }
    }, 10000); // 10 seconds for mainnet tokens

    // For devnet tokens, we'll set up real-time monitoring when they subscribe
  }

  private async fetchTokenPrice(tokenAddress: string, poolAddress?: string) {
    try {
      // If we already know the pool is on mainnet, fetch from mainnet directly
      if (poolAddress && this.mainnetPools.has(poolAddress)) {
        const mainnetPrice = await this.mainnetService.getTokenPrice(tokenAddress, poolAddress);
        if (mainnetPrice && !isNaN(mainnetPrice.price) && isFinite(mainnetPrice.price)) {
          this.updatePrice({
            tokenAddress,
            price: mainnetPrice.price,
            timestamp: Date.now(),
            source: 'mainnet-amm'
          });
          return;
        }
      }

      // If we already know it's a devnet token, fetch from devnet directly
      if (this.devnetTokens.has(tokenAddress) && poolAddress) {
        const devnetPrice = await this.devnetService.getTokenPrice(tokenAddress, poolAddress);
        if (devnetPrice && !isNaN(devnetPrice.price) && isFinite(devnetPrice.price)) {
          this.updatePrice({
            tokenAddress,
            price: devnetPrice.price,
            timestamp: Date.now(),
            source: 'devnet-amm'
          });
          return;
        }
      }
      
      // If we have a pool address but don't know which network it's on, try to detect
      if (poolAddress && !this.mainnetPools.has(poolAddress)) {
        // First try mainnet (most common)
        const mainnetPrice = await this.mainnetService.getTokenPrice(tokenAddress, poolAddress);
        if (mainnetPrice && !isNaN(mainnetPrice.price) && isFinite(mainnetPrice.price)) {
          this.mainnetPools.add(poolAddress);
          this.updatePrice({
            tokenAddress,
            price: mainnetPrice.price,
            timestamp: Date.now(),
            source: 'mainnet-amm'
          });
          return; // Exit early if found on mainnet
        }

        // If not on mainnet, try devnet
        const devnetPrice = await this.devnetService.getTokenPrice(tokenAddress, poolAddress);
        if (devnetPrice && !isNaN(devnetPrice.price) && isFinite(devnetPrice.price)) {
          this.devnetTokens.add(tokenAddress);
          this.updatePrice({
            tokenAddress,
            price: devnetPrice.price,
            timestamp: Date.now(),
            source: 'devnet-amm'
          });
          return;
        }
      }

      // Try DexScreener for mainnet tokens
      const response = await fetch(
        `https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`
      );

      if (response.ok) {
        const data = await response.json();
        const pairs = data.pairs || [];
        
        // Find the pair with highest liquidity
        const sortedPairs = pairs.sort((a: any, b: any) => 
          (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0)
        );
        
        if (sortedPairs.length > 0) {
          const price = parseFloat(sortedPairs[0].priceUsd || '0');
          
          // Only update if price changed significantly (> 0.01%)
          const existingPrice = this.prices.get(tokenAddress);
          const priceChanged = !existingPrice || 
            Math.abs(existingPrice.price - price) / existingPrice.price > 0.0001;
          
          if (priceChanged) {
            this.updatePrice({
              tokenAddress,
              price,
              timestamp: Date.now(),
              source: 'dexscreener'
            });
          }
        }
      } else if (response.status === 404) {
        // Token not found on DexScreener, try AMM pools
        if (poolAddress) {
          // First try mainnet (most common)
          const mainnetPrice = await this.mainnetService.getTokenPrice(tokenAddress, poolAddress);
          if (mainnetPrice && !isNaN(mainnetPrice.price) && isFinite(mainnetPrice.price)) {
            this.mainnetPools.add(poolAddress);
            this.updatePrice({
              tokenAddress,
              price: mainnetPrice.price,
              timestamp: Date.now(),
              source: 'mainnet-amm'
            });
            return; // Exit early if found on mainnet
          }

          // If not on mainnet, try devnet
          const devnetPrice = await this.devnetService.getTokenPrice(tokenAddress, poolAddress);
          if (devnetPrice && !isNaN(devnetPrice.price) && isFinite(devnetPrice.price)) {
            this.devnetTokens.add(tokenAddress);
            this.updatePrice({
              tokenAddress,
              price: devnetPrice.price,
              timestamp: Date.now(),
              source: 'devnet-amm'
            });
          }
        }
      }
    } catch (error) {
      // Silently handle errors for non-existent tokens
      if (error instanceof Error && !error.message?.includes('404')) {
        console.error(`Error fetching price for ${tokenAddress}:`, error.message);
      }
    }
  }

  private updatePrice(priceData: PriceData) {
    // Calculate USD price based on source
    let priceUsd: number;

    if (priceData.source === 'dexscreener') {
      // DexScreener already provides USD price
      priceUsd = priceData.price;
    } else {
      // AMM prices are in SOL, need to convert to USD
      priceUsd = priceData.price * this.solPrice;
    }

    // Create extended price data with USD value
    const extendedPriceData = {
      ...priceData,
      priceUsd
    };

    // Update stored price
    this.prices.set(priceData.tokenAddress, extendedPriceData);

    // Broadcast to all subscribed clients
    this.broadcast(priceData.tokenAddress, priceData);
  }

  private broadcast(tokenAddress: string, priceData: PriceData) {
    // Get the stored price data which already has the correct priceUsd
    const storedData = this.prices.get(tokenAddress);
    const broadcastData = storedData || priceData;

    this.clients.forEach((subscription, ws) => {
      if (subscription.tokens.has(tokenAddress) && ws.readyState === 1) {
        ws.send(JSON.stringify({
          type: 'PRICE_UPDATE',
          data: broadcastData
        }));
      }
    });
  }

  private sendCachedPrices(ws: WebSocket) {
    const client = this.clients.get(ws);
    if (!client) return;

    client.tokens.forEach(token => {
      const priceData = this.prices.get(token);
      if (priceData && ws.readyState === 1) {
        ws.send(JSON.stringify({
          type: 'PRICE_UPDATE',
          data: priceData
        }));
      }
    });
  }

  private async startPoolMonitoring(tokenAddress: string, poolAddress: string) {
    try {
      // Set up real-time monitoring for this pool
      const subscriptionId = await this.devnetService.monitorPool(
        poolAddress,
        (priceData) => {
          // When pool state changes, update price
          if (priceData && priceData.price) {
            this.updatePrice({
              tokenAddress,
              price: priceData.price,
              timestamp: Date.now(),
              source: 'devnet-amm'
            });
            console.log(`Real-time update: ${tokenAddress.substring(0, 8)}... = ${priceData.price}`);
          }
        },
        tokenAddress // Pass the token mint so we get the right price
      );
      
      this.poolMonitors.set(poolAddress, subscriptionId);
      console.log(`Started real-time monitoring for pool ${poolAddress.substring(0, 8)}...`);
    } catch (error) {
      console.error(`Failed to start pool monitoring for ${poolAddress}:`, error);
    }
  }


  private updateSubscribedProposals() {
    // Update the set of all subscribed proposals across all clients
    const allProposals = new Set<number>();
    this.clients.forEach(subscription => {
      subscription.proposals.forEach(proposalId => allProposals.add(proposalId));
    });
    this.subscribedProposals = allProposals;
  }

  private async setupDatabaseListener() {
    try {
      // Get database connection info from environment
      const dbUrl = process.env.DB_LISTEN_URL;
      if (!dbUrl) {
        console.log('No database URL found, trade notifications disabled');
        return;
      }

      this.pgClient = new Client({ connectionString: dbUrl });
      await this.pgClient.connect();
      console.log('Connected to PostgreSQL for trade notifications');

      // Listen for new_trade notifications
      await this.pgClient.query('LISTEN new_trade');

      this.pgClient.on('notification', (msg) => {
        if (msg.channel === 'new_trade' && msg.payload) {
          try {
            const tradeData = JSON.parse(msg.payload);
            this.handleNewTrade(tradeData);
          } catch (error) {
            console.error('Error parsing trade notification:', error);
          }
        }
      });

      // Also poll for recent trades on connection (in case we missed any)
      this.pollRecentTrades();

    } catch (error) {
      console.error('Failed to setup database listener:', error);
      // Continue without database notifications
    }
  }

  private async pollRecentTrades() {
    if (!this.pgClient) return;

    try {
      // Get trades from last 5 seconds for all subscribed proposals
      if (this.subscribedProposals.size > 0) {
        const proposalIds = Array.from(this.subscribedProposals).join(',');
        const query = `
          SELECT * FROM trade_history
          WHERE proposal_id IN (${proposalIds})
          AND timestamp > NOW() - INTERVAL '5 seconds'
          ORDER BY timestamp DESC
        `;

        const result = await this.pgClient.query(query);
        result.rows.forEach(trade => {
          this.broadcastTrade({
            type: 'TRADE',
            proposalId: trade.proposal_id,
            market: trade.market,
            userAddress: trade.user_address,
            isBaseToQuote: trade.is_base_to_quote,
            amountIn: trade.amount_in,
            amountOut: trade.amount_out,
            price: trade.price,
            txSignature: trade.tx_signature,
            timestamp: trade.timestamp.toISOString()
          });
        });
      }
    } catch (error) {
      console.error('Error polling recent trades:', error);
    }
  }

  private handleNewTrade(tradeData: any) {
    // Broadcast to all clients subscribed to this proposal
    const trade: TradeEvent = {
      type: 'TRADE',
      proposalId: tradeData.proposalId || tradeData.proposal_id,
      market: tradeData.market,
      userAddress: tradeData.userAddress || tradeData.user_address,
      isBaseToQuote: tradeData.isBaseToQuote || tradeData.is_base_to_quote,
      amountIn: tradeData.amountIn || tradeData.amount_in,
      amountOut: tradeData.amountOut || tradeData.amount_out,
      price: tradeData.price,
      txSignature: tradeData.txSignature || tradeData.tx_signature,
      timestamp: tradeData.timestamp || new Date().toISOString()
    };

    this.broadcastTrade(trade);
  }

  private broadcastTrade(trade: TradeEvent) {
    this.clients.forEach((subscription, ws) => {
      if (subscription.proposals.has(trade.proposalId) && ws.readyState === 1) {
        ws.send(JSON.stringify(trade));
      }
    });
    console.log(`Trade broadcast for proposal ${trade.proposalId}: ${trade.market} ${trade.isBaseToQuote ? 'buy' : 'sell'}`);
  }

  private async fetchSolPrice() {
    try {
      const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${this.SOL_ADDRESS}`);

      if (!response.ok) {
        throw new Error('Failed to fetch SOL price');
      }

      const data = await response.json();
      const solPairs = data.pairs || [];

      if (solPairs.length > 0) {
        // Sort by liquidity and take the highest
        const sortedSolPairs = solPairs.sort((a: any, b: any) =>
          (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0)
        );
        this.solPrice = parseFloat(sortedSolPairs[0]?.priceUsd || '0') || 180;
      } else {
        this.solPrice = 180; // Fallback price
      }

      console.log(`SOL price updated: $${this.solPrice}`);
    } catch (error) {
      console.error('Error fetching SOL price:', error);
      this.solPrice = 180; // Fallback price
    }
  }

  public async shutdown() {
    // Stop all pool monitors
    for (const [, subscriptionId] of this.poolMonitors) {
      await this.devnetService.unmonitor(subscriptionId);
    }
    this.poolMonitors.clear();

    if (this.priceUpdateInterval) {
      clearInterval(this.priceUpdateInterval);
    }
    if (this.pgClient) {
      await this.pgClient.end();
    }
    this.wss.close();
  }
}

const ws_port = process.env.WS_PORT;
if (ws_port === undefined) throw Error("WS_PORT not set");
// Start the server
const server = new PriceWebSocketServer(Number(ws_port));

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down price WebSocket server...');
  server.shutdown();
  process.exit(0);
});

export default server;