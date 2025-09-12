import { PublicKey } from '@solana/web3.js';

export interface TokenPrice {
  address: string;
  price: number;
  priceChange24h?: number;
  volume24h?: number;
  timestamp: number;
}

export interface PriceUpdate {
  tokenAddress: string;
  price: number;
  timestamp: number;
}

type PriceUpdateCallback = (update: PriceUpdate) => void;

export class PriceWebSocketService {
  private ws: WebSocket | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private pingInterval: NodeJS.Timeout | null = null;
  private subscriptions: Map<string, PriceUpdateCallback[]> = new Map();
  private prices: Map<string, TokenPrice> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000;
  private isConnecting = false;
  private connectionPromise: Promise<void> | null = null;

  constructor(private birdeyeApiKey?: string) {
    if (typeof window !== 'undefined') {
      this.connect();
    }
  }

  private async connect(): Promise<void> {
    if (this.isConnecting && this.connectionPromise) {
      return this.connectionPromise;
    }

    this.isConnecting = true;
    this.connectionPromise = this.performConnect();
    
    try {
      await this.connectionPromise;
    } finally {
      this.isConnecting = false;
      this.connectionPromise = null;
    }
  }

  private async performConnect(): Promise<void> {
    return new Promise((resolve) => {
      try {
        // Only try WebSocket if API key is provided
        if (!this.birdeyeApiKey) {
          console.log('No Birdeye API key provided, skipping WebSocket connection');
          resolve();
          return;
        }

        const wsUrl = `wss://public-api.birdeye.so/socket/solana?x-api-key=${this.birdeyeApiKey}`;
        
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          console.log('✅ Connected to Birdeye WebSocket');
          this.reconnectAttempts = 0;
          this.setupPingInterval();
          
          // Resubscribe to all tokens
          this.subscriptions.forEach((_, tokenAddress) => {
            this.subscribeToToken(tokenAddress);
          });
          
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.handleMessage(data);
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        };

        this.ws.onerror = (error) => {
          // Don't reject, just log and resolve
          console.warn('WebSocket connection failed, will use polling fallback');
          resolve();
        };

        this.ws.onclose = () => {
          this.cleanup();
          // Only try to reconnect if we have an API key
          if (this.birdeyeApiKey) {
            this.scheduleReconnect();
          }
        };
      } catch (error) {
        console.warn('Error creating WebSocket, will use polling fallback');
        resolve();
      }
    });
  }

  private handleMessage(data: any) {
    // Handle different message types from Birdeye
    if (data.type === 'PRICE_DATA') {
      const update: PriceUpdate = {
        tokenAddress: data.address,
        price: data.value,
        timestamp: Date.now()
      };

      // Update stored price
      const existingPrice = this.prices.get(data.address);
      this.prices.set(data.address, {
        address: data.address,
        price: data.value,
        priceChange24h: data.priceChange24h,
        volume24h: data.volume24h,
        timestamp: Date.now()
      });

      // Notify subscribers
      const callbacks = this.subscriptions.get(data.address) || [];
      callbacks.forEach(callback => callback(update));
    } else if (data.type === 'TXS_DATA' || data.type === 'TX') {
      // Parse transaction data for price updates
      this.parseTransactionForPrice(data);
    } else if (data.data && data.data.type === 'tx') {
      // Handle nested transaction format from Birdeye
      this.parseTransactionForPrice(data.data);
    }
  }

  private parseTransactionForPrice(txData: any) {
    // Extract price from transaction data - handle various formats
    let tokenAddress: string | null = null;
    let price: number | null = null;

    // Try to extract from different data structures
    if (txData.tokenAddress && txData.price) {
      tokenAddress = txData.tokenAddress;
      price = txData.price;
    } else if (txData.market && txData.price) {
      tokenAddress = txData.market;
      price = txData.price;
    } else if (txData.token && txData.priceUsd) {
      tokenAddress = txData.token;
      price = parseFloat(txData.priceUsd);
    } else if (txData.events && Array.isArray(txData.events)) {
      // Parse swap events for price data
      for (const event of txData.events) {
        if (event.type === 'swap' && event.tokenAddress && event.price) {
          tokenAddress = event.tokenAddress;
          price = event.price;
          break;
        }
      }
    }

    // If we found valid price data, update and notify
    if (tokenAddress && price !== null && !isNaN(price)) {
      const update: PriceUpdate = {
        tokenAddress,
        price,
        timestamp: Date.now()
      };

      // Update stored price
      this.prices.set(tokenAddress, {
        address: tokenAddress,
        price,
        timestamp: Date.now()
      });

      // Notify subscribers
      const callbacks = this.subscriptions.get(tokenAddress) || [];
      callbacks.forEach(callback => callback(update));
    }
  }

  private setupPingInterval() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }

    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'PING' }));
      }
    }, 30000); // Ping every 30 seconds
  }

  private cleanup() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts),
      30000
    );

    console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts + 1})`);

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectAttempts++;
      this.connect();
    }, delay);
  }

  public subscribeToToken(tokenAddress: string, callback?: PriceUpdateCallback): void {
    // Add callback to subscription list
    if (callback) {
      const callbacks = this.subscriptions.get(tokenAddress) || [];
      callbacks.push(callback);
      this.subscriptions.set(tokenAddress, callbacks);
    }

    // Send subscription message to WebSocket - Birdeye format
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const subscribeMessage = {
        type: 'SUBSCRIBE_TXS',
        data: {
          markets: [tokenAddress]
        }
      };
      
      this.ws.send(JSON.stringify(subscribeMessage));
      console.log(`Subscribed to price updates for ${tokenAddress}`);
    }
  }

  public unsubscribeFromToken(tokenAddress: string, callback?: PriceUpdateCallback): void {
    if (callback) {
      const callbacks = this.subscriptions.get(tokenAddress) || [];
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
      
      if (callbacks.length === 0) {
        this.subscriptions.delete(tokenAddress);
        
        // Send unsubscribe message - Birdeye format
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          const unsubscribeMessage = {
            type: 'UNSUBSCRIBE_TXS',
            data: {
              markets: [tokenAddress]
            }
          };
          
          this.ws.send(JSON.stringify(unsubscribeMessage));
          console.log(`Unsubscribed from price updates for ${tokenAddress}`);
        }
      } else {
        this.subscriptions.set(tokenAddress, callbacks);
      }
    }
  }

  public getPrice(tokenAddress: string): TokenPrice | null {
    return this.prices.get(tokenAddress) || null;
  }

  public disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    this.cleanup();

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.subscriptions.clear();
    this.prices.clear();
  }

  public isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}

// Singleton instance
let priceWebSocketInstance: PriceWebSocketService | null = null;

export function getPriceWebSocketService(apiKey?: string): PriceWebSocketService {
  if (!priceWebSocketInstance) {
    priceWebSocketInstance = new PriceWebSocketService(apiKey);
  }
  return priceWebSocketInstance;
}