export interface PriceUpdate {
  tokenAddress: string;
  price: number;
  timestamp: number;
}

type PriceUpdateCallback = (update: PriceUpdate) => void;

export class PriceStreamService {
  private ws: WebSocket | null = null;
  private subscriptions: Map<string, PriceUpdateCallback[]> = new Map();
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private pingInterval: NodeJS.Timeout | null = null;
  private isConnecting = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;

  constructor(private wsUrl: string = 'ws://localhost:9091') {}

  public connect(): Promise<void> {
    if (this.isConnecting) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      // Skip WebSocket on server-side rendering
      if (typeof window === 'undefined') {
        resolve();
        return;
      }

      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      this.isConnecting = true;

      try {
        this.ws = new WebSocket(this.wsUrl);

        this.ws.onopen = () => {
          console.log('Connected to price stream');
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          this.setupPingInterval();
          
          // Resubscribe to all tokens
          // Note: This won't include pool addresses on reconnect
          // The component will need to resubscribe with pool addresses
          if (this.subscriptions.size > 0) {
            const tokens = Array.from(this.subscriptions.keys());
            this.sendSubscription(tokens);
          }
          
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            console.error('Error parsing message:', error);
          }
        };

        this.ws.onerror = () => {
          this.isConnecting = false;
          console.warn('WebSocket error, will attempt reconnection');
          resolve(); // Resolve anyway to not block
        };

        this.ws.onclose = () => {
          this.isConnecting = false;
          this.cleanup();
          this.scheduleReconnect();
        };
      } catch (error) {
        this.isConnecting = false;
        console.error('Error creating WebSocket:', error);
        resolve(); // Resolve anyway to not block
      }
    });
  }

  private handleMessage(message: any) {
    if (message.type === 'PRICE_UPDATE' && message.data) {
      const { tokenAddress, price, timestamp } = message.data;
      
      // Notify all callbacks for this token
      const callbacks = this.subscriptions.get(tokenAddress) || [];
      callbacks.forEach(callback => {
        try {
          callback({ tokenAddress, price, timestamp });
        } catch (error) {
          console.error('Error in price callback:', error);
        }
      });
    } else if (message.type === 'PONG') {
      // Pong received, connection is alive
    }
  }

  private setupPingInterval() {
    if (typeof window === 'undefined') return;
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

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectAttempts++;
      this.connect();
    }, delay);
  }

  private sendSubscription(tokens: Array<string | { address: string; poolAddress?: string }>) {
    if (typeof window === 'undefined') return;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'SUBSCRIBE',
        tokens
      }));
    }
  }

  private sendUnsubscription(tokens: string[]) {
    if (typeof window === 'undefined') return;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'UNSUBSCRIBE',
        tokens
      }));
    }
  }

  public async subscribeToToken(tokenAddress: string, callback: PriceUpdateCallback, poolAddress?: string): Promise<void> {
    // Ensure we're connected
    await this.connect();

    // Add callback to subscription list
    const callbacks = this.subscriptions.get(tokenAddress) || [];
    callbacks.push(callback);
    this.subscriptions.set(tokenAddress, callbacks);

    // Send subscription message with pool address if provided
    const subscriptionData = poolAddress 
      ? [{ address: tokenAddress, poolAddress }]
      : [tokenAddress];
    this.sendSubscription(subscriptionData);
    console.log(`Subscribed to price updates for ${tokenAddress}${poolAddress ? ` with pool ${poolAddress}` : ''}`);
  }

  public unsubscribeFromToken(tokenAddress: string, callback: PriceUpdateCallback): void {
    const callbacks = this.subscriptions.get(tokenAddress) || [];
    const index = callbacks.indexOf(callback);
    
    if (index > -1) {
      callbacks.splice(index, 1);
      
      if (callbacks.length === 0) {
        this.subscriptions.delete(tokenAddress);
        this.sendUnsubscription([tokenAddress]);
        console.log(`Unsubscribed from price updates for ${tokenAddress}`);
      } else {
        this.subscriptions.set(tokenAddress, callbacks);
      }
    }
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
  }
}

// Singleton instance
let priceStreamInstance: PriceStreamService | null = null;

export function getPriceStreamService(wsUrl?: string): PriceStreamService {
  if (!priceStreamInstance) {
    priceStreamInstance = new PriceStreamService(
      wsUrl || process.env.NEXT_PUBLIC_WS_PRICE_URL || 'ws://localhost:9091'
    );
  }
  return priceStreamInstance;
}