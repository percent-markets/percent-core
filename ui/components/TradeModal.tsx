'use client';

import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { ArrowUpDown, X } from 'lucide-react';

interface TradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  proposalId: number;
  proposalTitle: string;
  passPrice: number;
  failPrice: number;
}

export default function TradeModal({ 
  isOpen,
  onClose,
  proposalId,
  proposalTitle,
  passPrice,
  failPrice 
}: TradeModalProps) {
  const { connected } = useWallet();
  const [selectedMarket, setSelectedMarket] = useState<'pass' | 'fail'>('pass');
  const [tradeType, setTradeType] = useState<'buy' | 'sell'>('buy');
  const [amount, setAmount] = useState('');
  
  const currentPrice = selectedMarket === 'pass' ? passPrice : failPrice;
  const estimatedCost = amount ? parseFloat(amount) * currentPrice : 0;

  const handleTrade = () => {
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
    
    // Clear form and close modal after trade
    setAmount('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-[#212121] border border-gray-800 rounded-2xl p-6 w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold">Trade</h2>
            <p className="text-sm text-gray-500 mt-1 line-clamp-1">{proposalTitle}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded-lg transition"
          >
            <X className="h-5 w-5 text-gray-400" />
          </button>
        </div>
        
        {/* Market Selection */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <button
            onClick={() => setSelectedMarket('pass')}
            className={`py-2 px-4 rounded-lg font-medium transition ${
              selectedMarket === 'pass'
                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                : 'bg-gray-900 text-gray-400 hover:bg-gray-800 border border-gray-800'
            }`}
          >
            PASS
          </button>
          <button
            onClick={() => setSelectedMarket('fail')}
            className={`py-2 px-4 rounded-lg font-medium transition ${
              selectedMarket === 'fail'
                ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                : 'bg-gray-900 text-gray-400 hover:bg-gray-800 border border-gray-800'
            }`}
          >
            FAIL
          </button>
        </div>

        {/* Buy/Sell Selection */}
        <div className="grid grid-cols-2 gap-2 mb-6">
          <button
            onClick={() => setTradeType('buy')}
            className={`py-2 px-4 rounded-lg font-medium transition ${
              tradeType === 'buy'
                ? 'bg-orange-500 text-white'
                : 'bg-gray-900 text-gray-400 hover:bg-gray-800 border border-gray-800'
            }`}
          >
            Buy
          </button>
          <button
            onClick={() => setTradeType('sell')}
            className={`py-2 px-4 rounded-lg font-medium transition ${
              tradeType === 'sell'
                ? 'bg-orange-500 text-white'
                : 'bg-gray-900 text-gray-400 hover:bg-gray-800 border border-gray-800'
            }`}
          >
            Sell
          </button>
        </div>

        {/* Amount Input */}
        <div className="mb-4">
          <label className="block text-sm text-gray-400 mb-2">Amount</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="w-full px-4 py-3 bg-gray-900 border border-gray-800 rounded-lg focus:outline-none focus:border-orange-500 text-lg"
          />
        </div>

        {/* Summary */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 mb-6">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-400">Current Price</span>
            <span className="font-medium">${currentPrice.toFixed(3)}</span>
          </div>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-400">Tokens</span>
            <span className="font-medium">{amount || '0'}</span>
          </div>
          <div className="border-t border-gray-700 pt-2 mt-2">
            <div className="flex justify-between">
              <span className="text-gray-400">Total Cost</span>
              <span className="font-bold text-lg">${estimatedCost.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Trade Button */}
        <button
          onClick={handleTrade}
          disabled={!amount || parseFloat(amount) <= 0}
          className={`w-full py-3 px-6 rounded-lg font-medium transition flex items-center justify-center gap-2 ${
            amount && parseFloat(amount) > 0
              ? 'bg-orange-500 hover:bg-orange-600 text-white'
              : 'bg-gray-900 text-gray-500 cursor-not-allowed border border-gray-800'
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
    </div>
  );
}