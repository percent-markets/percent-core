'use client';

import { useState } from 'react';
import MarketChart from './MarketChart';

interface Trade {
  id: number;
  userAddress: string;
  market: 'pass' | 'fail';
  isBaseToQuote: boolean;
  amountIn: string;
  txSignature: string | null;
  timestamp: string;
}

interface ChartBoxProps {
  proposalId: number;
  selectedMarket: 'pass' | 'fail';
  trades: Trade[];
  tradesLoading: boolean;
  getTimeAgo: (timestamp: string) => string;
  getTokenUsed: (isBaseToQuote: boolean, market: 'pass' | 'fail') => string;
}

export function ChartBox({
  proposalId,
  selectedMarket,
  trades,
  tradesLoading,
  getTimeAgo,
  getTokenUsed
}: ChartBoxProps) {
  const [view, setView] = useState<'chart' | 'history'>('chart');
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

  return (
    <div className="bg-[#121212] border border-[#191919] rounded-[9px] py-4 px-5 transition-all duration-300">
      {/* Header with inline toggle */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold font-ibm-plex-mono tracking-[0.2em] uppercase text-left" style={{ color: '#DDDDD7' }}>
          {view === 'chart'
            ? selectedMarket === 'pass' ? 'Chart: Pass Coin' : 'Chart: Fail Coin'
            : selectedMarket === 'pass' ? 'Trades: Pass Coin' : 'Trades: Fail Coin'
          }
        </span>

        {/* Pill Toggle */}
        <div className="flex items-center gap-[2px] p-[3px] border border-[#191919] rounded-full">
          <button
            onClick={() => setView('chart')}
            className={`px-3 py-1 rounded-full text-xs font-medium transition cursor-pointer font-ibm-plex-mono ${
              view === 'chart'
                ? 'bg-[#DDDDD7]'
                : 'bg-transparent'
            }`}
            style={view === 'chart' ? { color: '#161616', fontFamily: 'IBM Plex Mono, monospace' } : { color: '#6B6E71', fontFamily: 'IBM Plex Mono, monospace' }}
          >
            Chart
          </button>
          <button
            onClick={() => setView('history')}
            className={`px-3 py-1 rounded-full text-xs font-medium transition cursor-pointer font-ibm-plex-mono ${
              view === 'history'
                ? 'bg-[#DDDDD7]'
                : 'bg-transparent'
            }`}
            style={view === 'history' ? { color: '#161616', fontFamily: 'IBM Plex Mono, monospace' } : { color: '#6B6E71', fontFamily: 'IBM Plex Mono, monospace' }}
          >
            Trades
          </button>
        </div>
      </div>

      {/* Conditional Content */}
      {view === 'chart' ? (
        <div className="bg-[#121212] border border-[#191919] overflow-hidden rounded-[6px]">
          <MarketChart proposalId={proposalId} market={selectedMarket} height={615} />
        </div>
      ) : (
        <div className="h-[615px] overflow-y-auto scrollbar-hide border border-[#191919] rounded-[6px]">
          <table className="w-full text-sm">
            <thead className="text-[#6B6E71] font-medium uppercase">
              <tr>
                <th className="py-3 pl-3 text-left font-medium w-[240px]">Trader</th>
                <th className="py-3 text-left font-medium w-[100px]">Coin</th>
                <th className="py-3 text-left font-medium w-[100px]">Trade</th>
                <th className="py-3 text-left font-medium w-[140px]">Amount</th>
                <th className="py-3 text-left font-medium w-[160px]">Tx</th>
                <th className="py-3 pr-3 text-right font-medium">Age</th>
              </tr>
            </thead>
            <tbody>
            {tradesLoading ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-[#6B6E71]">
                  Loading trades...
                </td>
              </tr>
            ) : trades.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-[#6B6E71]">
                  No trades yet
                </td>
              </tr>
            ) : (
              trades.map((trade) => (
                <tr
                  key={trade.id}
                  className="group border-t border-[#191919] hover:bg-[#1a1a1a] transition-colors"
                  style={{ color: '#E9E9E3' }}
                >
                  <td className="py-3 pl-3 w-[200px]">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium">{trade.userAddress.slice(0, 6)}...{trade.userAddress.slice(-6)}</span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(trade.userAddress);
                          setCopiedAddress(trade.userAddress);
                          setTimeout(() => setCopiedAddress(null), 2000);
                        }}
                        className="hover:text-white transition-colors cursor-pointer"
                        style={{ color: copiedAddress === trade.userAddress ? '#ffffff' : '#6B6E71' }}
                        title="Copy address"
                      >
                        {copiedAddress === trade.userAddress ? (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        )}
                      </button>
                      <a
                        href={`https://solscan.io/address/${trade.userAddress}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-white transition-colors"
                        style={{ color: '#6B6E71' }}
                        title="View on Solscan"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    </div>
                  </td>
                  <td className="py-3 font-medium uppercase w-[100px]">{trade.market}</td>
                  <td className="py-3 w-[100px]">
                    <span style={{ color: trade.isBaseToQuote ? '#FF6F94' : '#6ECC94' }}>
                      {trade.isBaseToQuote ? 'Sell' : 'Buy'}
                    </span>
                  </td>
                  <td className="py-3 w-[140px]">
                    {(() => {
                      const tokenUsed = getTokenUsed(trade.isBaseToQuote, trade.market);
                      const amount = parseFloat(trade.amountIn);

                      const removeTrailingZeros = (num: string): string => {
                        return num.replace(/\.?0+$/, '');
                      };

                      let formattedAmount;
                      if (tokenUsed === 'SOL') {
                        formattedAmount = removeTrailingZeros(amount.toFixed(3));
                      } else {
                        // ZC formatting with K/M/B notation
                        if (amount >= 1000000000) {
                          formattedAmount = removeTrailingZeros((amount / 1000000000).toFixed(3)) + 'B';
                        } else if (amount >= 1000000) {
                          formattedAmount = removeTrailingZeros((amount / 1000000).toFixed(3)) + 'M';
                        } else if (amount >= 1000) {
                          formattedAmount = removeTrailingZeros((amount / 1000).toFixed(3)) + 'K';
                        } else {
                          formattedAmount = removeTrailingZeros(amount.toFixed(3));
                        }
                      }

                      return `${formattedAmount} ${tokenUsed.replace('$', '')}`;
                    })()}
                  </td>
                  <td className="py-3 w-[160px]">
                    {trade.txSignature ? (
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium">{trade.txSignature.slice(0, 12)}...</span>
                        <a
                          href={`https://solscan.io/tx/${trade.txSignature}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-white transition-colors"
                          style={{ color: '#6B6E71' }}
                          title="View transaction"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                      </div>
                    ) : (
                      <span className="text-[#6B6E71]">-</span>
                    )}
                  </td>
                  <td className="py-3 pr-3 text-right" style={{ color: '#6B6E71' }}>{getTimeAgo(trade.timestamp)}</td>
                </tr>
              ))
            )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
