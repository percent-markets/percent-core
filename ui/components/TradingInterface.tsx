'use client';

import { useState, useCallback, useMemo, memo } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { ArrowUpDown } from 'lucide-react';

interface TradingInterfaceProps {
  proposalId: number;
  selectedMarket: 'pass' | 'fail';
  onMarketChange: (market: 'pass' | 'fail') => void;
  passPrice: number;
  failPrice: number;
}

const TradingInterface = memo(({ 
  proposalId, 
  selectedMarket, 
  onMarketChange,
  passPrice,
  failPrice 
}: TradingInterfaceProps) => {
  const { connected } = useWallet();
  const [tradeType, setTradeType] = useState<'buy' | 'sell'>('buy');
  const [amount, setAmount] = useState('');
  
  const currentPrice = useMemo(() => 
    selectedMarket === 'pass' ? passPrice : failPrice,
    [selectedMarket, passPrice, failPrice]
  );
  
  const estimatedCost = useMemo(() => 
    amount ? parseFloat(amount) * currentPrice : 0,
    [amount, currentPrice]
  );

  const handleTrade = useCallback(() => {
    if (!connected) {
      alert('Please connect your wallet first');
      return;
    }
    
    console.log('Executing trade:', {
      proposalId,
      market: selectedMarket,
      type: tradeType,
      amount,
      estimatedCost
    });
  }, [connected, proposalId, selectedMarket, tradeType, amount, estimatedCost]);
  
  const handleAmountChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setAmount(e.target.value);
  }, []);
  
  const handleSetBuy = useCallback(() => setTradeType('buy'), []);
  const handleSetSell = useCallback(() => setTradeType('sell'), []);

  return (
    <div>
      <h2 className="text-xl font-semibold mb-6">Trade</h2>
      
      <div className="grid grid-cols-2 gap-2 mb-4">
        <button
          onClick={useCallback(() => onMarketChange('pass'), [onMarketChange])}
          className={`py-2 px-4 rounded-lg font-medium transition ${
            selectedMarket === 'pass'
              ? 'bg-green-500/20 text-green-500'
              : 'bg-gray-900 text-gray-400 hover:bg-gray-800'
          }`}
        >
          PASS
        </button>
        <button
          onClick={useCallback(() => onMarketChange('fail'), [onMarketChange])}
          className={`py-2 px-4 rounded-lg font-medium transition ${
            selectedMarket === 'fail'
              ? 'bg-red-500/20 text-red-500'
              : 'bg-gray-900 text-gray-400 hover:bg-gray-800'
          }`}
        >
          FAIL
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-6">
        <button
          onClick={handleSetBuy}
          className={`py-2 px-4 rounded-lg font-medium transition ${
            tradeType === 'buy'
              ? 'bg-orange-500 text-white'
              : 'bg-gray-900 text-gray-400 hover:bg-gray-800'
          }`}
        >
          Buy
        </button>
        <button
          onClick={handleSetSell}
          className={`py-2 px-4 rounded-lg font-medium transition ${
            tradeType === 'sell'
              ? 'bg-orange-500 text-white'
              : 'bg-gray-900 text-gray-400 hover:bg-gray-800'
          }`}
        >
          Sell
        </button>
      </div>

      <div className="mb-4">
        <label className="block text-sm text-gray-400 mb-2">Amount</label>
        <input
          type="number"
          value={amount}
          onChange={handleAmountChange}
          placeholder="0.00"
          className="w-full px-4 py-3 bg-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-lg"
        />
      </div>

      <div className="bg-gray-900 rounded-lg p-4 mb-6">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-gray-400">Current Price</span>
          <span className="font-medium">${currentPrice.toFixed(3)}</span>
        </div>
        <div className="flex justify-between text-sm mb-2">
          <span className="text-gray-400">Tokens</span>
          <span className="font-medium">{amount || '0'}</span>
        </div>
        <div className="pt-2 mt-2">
          <div className="flex justify-between">
            <span className="text-gray-400">Total Cost</span>
            <span className="font-bold text-lg">${estimatedCost.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <button
        onClick={handleTrade}
        disabled={!amount || parseFloat(amount) <= 0}
        className={`w-full py-3 px-6 rounded-lg font-medium transition flex items-center justify-center gap-2 ${
          amount && parseFloat(amount) > 0
            ? 'bg-orange-500 hover:bg-orange-600 text-white'
            : 'bg-gray-900 text-gray-500 cursor-not-allowed'
        }`}
      >
        <ArrowUpDown className="h-4 w-4" />
        {tradeType === 'buy' ? 'Buy' : 'Sell'} {selectedMarket.toUpperCase()} Tokens
      </button>

      {!connected && (
        <p className="text-center text-orange-500 text-sm mt-4">
          Connect wallet to trade
        </p>
      )}
    </div>
  );
});

TradingInterface.displayName = 'TradingInterface';

export default TradingInterface;