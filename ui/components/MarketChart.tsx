'use client';

import { useEffect, useRef, useState } from 'react';
import { ProposalMarketDatafeed } from '@/services/tradingview-datafeed';
import { api } from '@/lib/api';
import { formatUSD } from '@/lib/format';

declare global {
  interface Window {
    TradingView: any;
  }
}

interface MarketChartProps {
  proposalId: number;
  market: 'pass' | 'fail';
  height?: number;
}

export default function MarketChart({ proposalId, market, height = 256 }: MarketChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    let retryCount = 0;
    const MAX_RETRIES = 20; // 10 seconds max wait time (20 * 500ms)

    const initChart = async () => {
      try {
        // Fetch proposal details to get token/pool addresses
        const proposal = await api.getProposal(proposalId);
        if (!proposal) {
          throw new Error('Failed to fetch proposal details');
        }

        // Get token and pool addresses based on market type
        const tokenAddress = market === 'pass'
          ? proposal.baseVaultState?.passConditionalMint
          : proposal.baseVaultState?.failConditionalMint;

        const poolAddress = market === 'pass'
          ? proposal.passAmmState?.pool
          : proposal.failAmmState?.pool;

        if (!tokenAddress || !poolAddress) {
          throw new Error(`Missing ${market} market addresses`);
        }

        // Wait for TradingView library to load with timeout
        if (typeof window === 'undefined' || !window.TradingView) {
          retryCount++;
          if (retryCount >= MAX_RETRIES) {
            throw new Error(
              'TradingView library failed to load. This may be due to a CDN issue or ad blocker. ' +
              'Please refresh the page or check your browser console for errors.'
            );
          }
          // If library not loaded yet, wait a bit and retry
          setTimeout(initChart, 500);
          return;
        }

        // Wait for container to be mounted in DOM
        if (!containerRef.current) {
          // Container not ready yet, retry
          setTimeout(initChart, 100);
          return;
        }

        // Check if component is still mounted
        if (!isMounted) {
          return;
        }

        // Create datafeed with spot pool address for overlay support
        const datafeed = new ProposalMarketDatafeed(proposalId, market, proposal.spotPoolAddress);
        datafeed.setAddresses(tokenAddress, poolAddress);

        // Clear any existing widget
        containerRef.current.innerHTML = '';

        // Create widget
        const widget = new window.TradingView.widget({
          container: containerRef.current,
          library_path: '/charting_library/charting_library/',
          datafeed: datafeed,
          symbol: `${market.toUpperCase()}-MARKET`,
          interval: '1' as any,
          timezone: 'Etc/UTC',
          theme: 'dark',
          locale: 'en',
          autosize: true,
          style: '1', // 1 = Candles (default)
          save_load_adapter: null, // Disable saving/loading chart settings
          auto_save_delay: 0, // Disable auto-save
          disabled_features: [
            'header_symbol_search',
            'symbol_search_hot_key',
            'header_compare',
            'header_undo_redo',
            'header_screenshot',
            'header_chart_type',
            'header_settings',
            'header_indicators',
            'header_fullscreen_button',
            'left_toolbar',
            'control_bar',
            'timeframes_toolbar',
            'volume_force_overlay',
            'create_volume_indicator_by_default',
          ],
          enabled_features: [
            'hide_left_toolbar_by_default',
          ],
          custom_css_url: '/charting_library/charting_library/custom.css',
          custom_formatters: {
            priceFormatterFactory: () => ({
              format: (price: number) => formatUSD(price, 1)
            }),
          },
          overrides: {
            'paneProperties.background': '#181818',
            'paneProperties.backgroundType': 'solid',
            'paneProperties.vertGridProperties.color': 'rgba(255, 255, 255, 0.04)',
            'paneProperties.horzGridProperties.color': 'rgba(255, 255, 255, 0.04)',
            'paneProperties.separatorColor': '#181818',
            'symbolWatermarkProperties.transparency': 98,
            'symbolWatermarkProperties.color': 'rgba(255, 255, 255, 0.02)',
            'scalesProperties.textColor': '#9ca3af',
            'scalesProperties.lineColor': '#2A2A2A',
            // Force price scale to show absolute prices, not percentage/log/indexed
            'scalesProperties.scaleSeriesOnly': false,
            'scalesProperties.percentage': false,
            'mainSeriesProperties.priceAxisProperties.percentage': false,
            'mainSeriesProperties.priceAxisProperties.log': false,
            'mainSeriesProperties.priceAxisProperties.indexedTo100': false,
            'mainSeriesProperties.priceAxisProperties.autoScale': true,
            // Standard trading colors: green = up, red = down
            'mainSeriesProperties.candleStyle.upColor': '#10b981',
            'mainSeriesProperties.candleStyle.downColor': '#ef4444',
            'mainSeriesProperties.candleStyle.borderUpColor': '#10b981',
            'mainSeriesProperties.candleStyle.borderDownColor': '#ef4444',
            'mainSeriesProperties.candleStyle.wickUpColor': '#10b981',
            'mainSeriesProperties.candleStyle.wickDownColor': '#ef4444',
            'mainSeriesProperties.candleStyle.drawWick': true,
            'mainSeriesProperties.candleStyle.drawBorder': true,
            // Hollow candles
            'mainSeriesProperties.hollowCandleStyle.upColor': '#10b981',
            'mainSeriesProperties.hollowCandleStyle.downColor': '#ef4444',
            'mainSeriesProperties.hollowCandleStyle.borderUpColor': '#10b981',
            'mainSeriesProperties.hollowCandleStyle.borderDownColor': '#ef4444',
            'mainSeriesProperties.hollowCandleStyle.wickUpColor': '#10b981',
            'mainSeriesProperties.hollowCandleStyle.wickDownColor': '#ef4444',
            // Bars
            'mainSeriesProperties.barStyle.upColor': '#10b981',
            'mainSeriesProperties.barStyle.downColor': '#ef4444',
            'mainSeriesProperties.lineStyle.color': '#10b981',
            'mainSeriesProperties.areaStyle.color1': 'rgba(16, 185, 129, 0.3)',
            'mainSeriesProperties.areaStyle.color2': 'rgba(16, 185, 129, 0.05)',
            'mainSeriesProperties.areaStyle.linecolor': '#10b981',
          },
        });

        widgetRef.current = widget;

        // Wait for chart to be ready before hiding loading state
        widget.onChartReady(async () => {
          console.log(`[Chart ${market}] Chart ready`);
          const chart = widget.chart();

          setIsLoading(false);

          // Add spot price overlay FIRST (if available)
          // Note: Compare study automatically switches to percentage mode
          if (proposal.spotPoolAddress) {
            try {
              console.log(`[Chart ${market}] Adding spot price overlay for pool ${proposal.spotPoolAddress}`);

              // Use the chart's createStudy method to add a line overlay
              // The 'Compare' study allows adding additional price series
              // The main datafeed (ProposalMarketDatafeed) handles 'SPOT-MARKET' symbol requests
              // WARNING: Compare study automatically switches to percentage mode!
              const studyId = await chart.createStudy(
                'Compare',     // indicator name
                false,         // forceOverlay
                false,         // lock
                {              // inputs
                  symbol: 'SPOT-MARKET',
                  source: 'close',
                },
                {              // overrides
                  'plot.color': '#9ca3af',      // Neutral gray (default is #9C27B0 purple)
                  'plot.linewidth': 2,
                  'plot.transparency': 0,
                  'plot.linestyle': 0,          // Solid line
                }
              );

              console.log(`[Chart ${market}] ✅ Spot price overlay added (study ID: ${studyId}, color: #9ca3af)`);
            } catch (error) {
              console.error(`[Chart ${market}] ❌ Failed to add spot price overlay:`, error);
              // Don't throw - chart should still work without overlay
            }
          }

          // Force normal price scale mode AFTER adding Compare study
          // Compare study automatically switches to percentage mode, so we override it here
          try {
            const panes = chart.getPanes();

            if (panes && panes.length > 0) {
              const rightScales = panes[0].getRightPriceScales();

              if (rightScales && rightScales.length > 0) {
                const currentMode = rightScales[0].getMode();
                console.log(`[Chart ${market}] Current price scale mode (after Compare): ${currentMode}`);

                // Mode 0 = Normal, 1 = Log, 2 = Percentage, 3 = IndexedTo100
                if (currentMode !== 0) {
                  rightScales[0].setMode(0); // Set to Normal mode
                  const newMode = rightScales[0].getMode();
                  console.log(`[Chart ${market}] ✅ Forced Normal mode (was ${currentMode}, now ${newMode})`);
                } else {
                  console.log(`[Chart ${market}] Price scale already in Normal mode`);
                }
              }
            }
          } catch (e) {
            console.error(`[Chart ${market}] Failed to set price scale mode:`, e);
          }
        });
      } catch (err) {
        console.error('Error initializing chart:', err);
        setError(err instanceof Error ? err.message : 'Failed to load chart');
        setIsLoading(false);
      }
    };

    initChart();

    // Cleanup
    return () => {
      isMounted = false;
      if (widgetRef.current) {
        try {
          widgetRef.current.remove();
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    };
  }, [proposalId, market]);

  return (
    <div style={{ position: 'relative', height: `${height}px`, width: '100%' }}>
      {/* Chart container - always rendered so ref is attached */}
      <div
        ref={containerRef}
        style={{
          height: `${height}px`,
          width: '100%',
          background: '#181818'
        }}
      />

      {/* Loading overlay */}
      {isLoading && (
        <div
          className="flex items-center justify-center text-gray-500 text-sm"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: '#181818',
            zIndex: 10
          }}
        >
          <div className="text-center">
            <div className="text-4xl mb-2 animate-pulse">📊</div>
            <div>Loading chart...</div>
          </div>
        </div>
      )}

      {/* Error overlay */}
      {error && (
        <div
          className="flex items-center justify-center text-gray-500 text-sm"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: '#181818',
            zIndex: 10
          }}
        >
          <div className="text-center">
            <div className="text-4xl mb-2">📊</div>
            <div>{error}</div>
          </div>
        </div>
      )}
    </div>
  );
}
