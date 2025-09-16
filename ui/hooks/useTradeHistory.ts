import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useTokenPrices } from './useTokenPrices';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const WS_URL = process.env.NEXT_PUBLIC_WS_PRICE_URL || 'ws://localhost:9091';
const RECONNECT_DELAY = 3000;
const MAX_RECONNECT_ATTEMPTS = 5;

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

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export function useTradeHistory(proposalId: number | null) {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wsStatus, setWsStatus] = useState<ConnectionStatus>('disconnected');
  const { sol: solPrice, oogway: oogwayPrice } = useTokenPrices();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const proposalIdRef = useRef(proposalId);

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

  // Update proposalId ref
  useEffect(() => {
    proposalIdRef.current = proposalId;
  }, [proposalId]);

  // WebSocket connection for real-time trade updates
  const connectWebSocket = useCallback(() => {
    if (!proposalIdRef.current || wsRef.current?.readyState === WebSocket.OPEN) return;

    // Clear any existing reconnect timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    try {
      setWsStatus('connecting');
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('Trade WebSocket connected');
        setWsStatus('connected');
        setError(null);
        reconnectAttemptsRef.current = 0;

        // Subscribe to trades for this proposal
        ws.send(JSON.stringify({
          type: 'SUBSCRIBE_TRADES',
          proposalId: proposalIdRef.current
        }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'TRADE' && data.proposalId === proposalIdRef.current) {
            // New trade received, add to the beginning of the array
            const newTrade: Trade = {
              id: data.id || Date.now(),
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
              // Check if trade already exists (by signature or id)
              const exists = data.txSignature
                ? prevTrades.some(t => t.txSignature === data.txSignature)
                : prevTrades.some(t => t.id === newTrade.id);

              if (exists) return prevTrades;

              // Add new trade to the beginning and limit to 100 trades
              return [newTrade, ...prevTrades].slice(0, 100);
            });
          } else if (data.type === 'TRADES_SUBSCRIBED') {
            console.log('Successfully subscribed to trades for proposal', data.proposalId);
          }
        } catch (err) {
          console.error('Error parsing WebSocket message:', err);
        }
      };

      ws.onerror = (error) => {
        console.error('Trade WebSocket error:', error);
        setWsStatus('error');
        setError('WebSocket connection error');
      };

      ws.onclose = () => {
        console.log('Trade WebSocket disconnected');
        wsRef.current = null;
        setWsStatus('disconnected');

        // Attempt reconnection if we haven't exceeded max attempts
        if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS && proposalIdRef.current) {
          reconnectAttemptsRef.current++;
          const delay = RECONNECT_DELAY * Math.min(reconnectAttemptsRef.current, 3);
          console.log(`Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current})`);

          reconnectTimeoutRef.current = setTimeout(() => {
            connectWebSocket();
          }, delay);
        } else if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
          setError('Unable to maintain WebSocket connection');
        }
      };
    } catch (err) {
      console.error('Failed to connect trade WebSocket:', err);
      setWsStatus('error');
      setError('Failed to connect to trade updates');
    }
  }, []);

  // Disconnect WebSocket
  const disconnectWebSocket = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      // Send unsubscribe if connected
      if (proposalIdRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        try {
          wsRef.current.send(JSON.stringify({
            type: 'UNSUBSCRIBE_TRADES',
            proposalId: proposalIdRef.current
          }));
        } catch (err) {
          console.error('Error unsubscribing from trades:', err);
        }
      }
      wsRef.current.close();
      wsRef.current = null;
    }

    setWsStatus('disconnected');
    reconnectAttemptsRef.current = 0;
  }, []);

  useEffect(() => {
    if (!proposalId) {
      setTrades([]);
      disconnectWebSocket();
      return;
    }

    // Fetch initial trades
    fetchTrades();

    // Connect WebSocket for real-time updates
    connectWebSocket();

    return () => {
      disconnectWebSocket();
    };
  }, [proposalId, fetchTrades, connectWebSocket, disconnectWebSocket]);

  // Memoized helper function to format time ago
  const getTimeAgo = useCallback((timestamp: string) => {
    const now = Date.now();
    const then = new Date(timestamp).getTime();
    const diff = now - then;

    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days > 0) return `${days}d`;
    if (hours > 0) return `${hours}h`;
    if (minutes > 0) return `${minutes}m`;
    if (seconds > 0) return `${seconds}s`;
    return 'now';
  }, []);

  // Memoized helper function to format address - show first 6 characters
  const formatAddress = useCallback((address: string) => {
    if (!address) return '';
    if (address.length <= 6) return address;
    return address.slice(0, 6);
  }, []);

  // Memoized helper function to determine token used
  const getTokenUsed = useCallback((isBaseToQuote: boolean, market: 'pass' | 'fail') => {
    // For pass market: base is oogway, quote is SOL
    // For fail market: base is SOL, quote is oogway
    if (market === 'pass') {
      return isBaseToQuote ? '$oogway' : 'SOL';
    } else {
      return isBaseToQuote ? 'SOL' : '$oogway';
    }
  }, []);

  // Memoized helper function to calculate volume in USD
  const calculateVolume = useCallback((amountIn: string, isBaseToQuote: boolean, market: 'pass' | 'fail') => {
    const amount = parseFloat(amountIn);
    const token = getTokenUsed(isBaseToQuote, market);

    if (token === 'SOL') {
      return amount * solPrice;
    } else {
      return amount * oogwayPrice;
    }
  }, [solPrice, oogwayPrice, getTokenUsed]);

  return {
    trades,
    loading,
    error,
    wsStatus,
    refetch: fetchTrades,
    getTimeAgo,
    formatAddress,
    getTokenUsed,
    calculateVolume
  };
}