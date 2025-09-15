import { useState, useEffect, useCallback, useRef } from 'react';
import { useTokenPrices } from './useTokenPrices';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export interface Trade {
  id: number;
  timestamp: string;
  proposalId: number;
  market: 'pass' | 'fail';
  userAddress: string;
  isBaseToQuote: boolean;
  amountIn: string;
  amountOut: string;
  price: string;
  txSignature: string | null;
}

interface TradeHistoryResponse {
  proposalId: number;
  count: number;
  data: Trade[];
}

export function useTradeHistory(proposalId: number | null) {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { sol: solPrice, oogway: oogwayPrice } = useTokenPrices();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const fetchTrades = useCallback(async () => {
    if (proposalId === null) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/history/${proposalId}/trades?limit=100`);
      if (!response.ok) {
        throw new Error('Failed to fetch trades');
      }

      const data: TradeHistoryResponse = await response.json();
      // Sort by timestamp descending (most recent first)
      const sortedTrades = data.data.sort((a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      setTrades(sortedTrades);
    } catch (err) {
      console.error('Error fetching trades:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch trades');
    } finally {
      setLoading(false);
    }
  }, [proposalId]);

  // WebSocket connection for real-time trade updates
  const connectWebSocket = useCallback(() => {
    if (!proposalId) return;

    try {
      const ws = new WebSocket('ws://localhost:9091');
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('Trade WebSocket connected');
        // Subscribe to trades for this proposal
        ws.send(JSON.stringify({
          type: 'SUBSCRIBE_TRADES',
          proposalId: proposalId
        }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'TRADE') {
            // New trade received, add to the beginning of the array
            const newTrade: Trade = {
              id: Date.now(), // Generate a temporary ID
              timestamp: data.timestamp,
              proposalId: data.proposalId,
              market: data.market,
              userAddress: data.userAddress,
              isBaseToQuote: data.isBaseToQuote,
              amountIn: data.amountIn,
              amountOut: data.amountOut,
              price: data.price,
              txSignature: data.txSignature
            };

            setTrades(prevTrades => {
              // Check if trade already exists (by signature)
              if (data.txSignature && prevTrades.some(t => t.txSignature === data.txSignature)) {
                return prevTrades;
              }
              // Add new trade to the beginning
              return [newTrade, ...prevTrades];
            });
          }
        } catch (err) {
          console.error('Error parsing WebSocket message:', err);
        }
      };

      ws.onerror = (error) => {
        console.error('Trade WebSocket error:', error);
      };

      ws.onclose = () => {
        console.log('Trade WebSocket disconnected');
        wsRef.current = null;

        // Reconnect after 3 seconds
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
        reconnectTimeoutRef.current = setTimeout(() => {
          connectWebSocket();
        }, 3000);
      };
    } catch (err) {
      console.error('Failed to connect trade WebSocket:', err);
    }
  }, [proposalId]);

  // Disconnect WebSocket when component unmounts or proposal changes
  const disconnectWebSocket = useCallback(() => {
    if (wsRef.current) {
      if (proposalId && wsRef.current.readyState === WebSocket.OPEN) {
        // Unsubscribe from trades
        wsRef.current.send(JSON.stringify({
          type: 'UNSUBSCRIBE_TRADES',
          proposalId: proposalId
        }));
      }
      wsRef.current.close();
      wsRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, [proposalId]);

  useEffect(() => {
    // Fetch initial trades
    fetchTrades();

    // Connect WebSocket for real-time updates
    connectWebSocket();

    return () => {
      disconnectWebSocket();
    };
  }, [fetchTrades, connectWebSocket, disconnectWebSocket]);

  // Helper function to format time ago
  const getTimeAgo = (timestamp: string) => {
    const now = Date.now();
    const then = new Date(timestamp).getTime();
    const diff = now - then;

    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days > 0) return `${days}d`;
    if (hours > 0) return `${hours}h`;
    if (minutes > 0) return `${minutes}m`;
    return 'now';
  };

  // Helper function to format address - show first 6 characters
  const formatAddress = (address: string) => {
    if (!address) return '';
    if (address.length <= 6) return address;
    return address.slice(0, 6);
  };

  // Helper function to determine token used
  const getTokenUsed = (isBaseToQuote: boolean, market: 'pass' | 'fail') => {
    // For pass market: base is oogway, quote is SOL
    // For fail market: base is SOL, quote is oogway
    if (market === 'pass') {
      return isBaseToQuote ? '$oogway' : 'SOL';
    } else {
      return isBaseToQuote ? 'SOL' : '$oogway';
    }
  };

  // Helper function to calculate volume in USD
  const calculateVolume = (amountIn: string, isBaseToQuote: boolean, market: 'pass' | 'fail') => {
    const amount = parseFloat(amountIn);
    const token = getTokenUsed(isBaseToQuote, market);

    if (token === 'SOL') {
      return amount * solPrice;
    } else {
      return amount * oogwayPrice;
    }
  };

  return {
    trades,
    loading,
    error,
    refetch: fetchTrades,
    getTimeAgo,
    formatAddress,
    getTokenUsed,
    calculateVolume
  };
}