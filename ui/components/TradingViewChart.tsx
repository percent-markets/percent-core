'use client';

import { useEffect, useRef } from 'react';

declare global {
  interface Window {
    TradingView: any;
  }
}

interface TradingViewChartProps {
  symbol?: string;
  proposalId: number;
}

export default function TradingViewChart({ symbol = "PASS", proposalId }: TradingViewChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Add custom CSS to override TradingView backgrounds
    const styleId = `tv-custom-style-${proposalId}`;
    let styleElement = document.getElementById(styleId) as HTMLStyleElement;
    
    if (!styleElement) {
      styleElement = document.createElement('style');
      styleElement.id = styleId;
      styleElement.innerHTML = `
        #tradingview_${proposalId} iframe {
          background: #181818 !important;
        }
        #tradingview_${proposalId} .tv-chart-container {
          background: #181818 !important;
        }
        #tradingview_${proposalId} .chart-page {
          background: #181818 !important;
        }
        #tradingview_${proposalId} .chart-container {
          background: #181818 !important;
        }
        #tradingview_${proposalId} [class*="chart"] {
          background-color: #181818 !important;
        }
      `;
      document.head.appendChild(styleElement);
    }

    // Check if TradingView library is loaded
    if (typeof window !== 'undefined' && window.TradingView && containerRef.current) {
      // Clear any existing widget
      containerRef.current.innerHTML = '';
      
      // Create new widget
      new window.TradingView.widget({
        autosize: true,
        symbol: 'NASDAQ:AAPL',
        interval: 'D',
        timezone: 'Etc/UTC',
        theme: 'dark',
        style: '1',
        locale: 'en',
        toolbar_bg: '#181818',
        enable_publishing: false,
        hide_side_toolbar: true,
        allow_symbol_change: false,
        container_id: `tradingview_${proposalId}`,
        studies: [],
        hide_volume: true,
        overrides: {
          "paneProperties.background": "#181818",
          "paneProperties.backgroundType": "solid",
          "paneProperties.backgroundGradientStartColor": "#181818",
          "paneProperties.backgroundGradientEndColor": "#181818",
          "scalesProperties.backgroundColor": "#181818",
          "chartProperties.background": "#181818",
          "chartProperties.backgroundType": "solid",
          "paneProperties.vertGridProperties.color": "rgba(255, 255, 255, 0.04)",
          "paneProperties.horzGridProperties.color": "rgba(255, 255, 255, 0.04)",
          "symbolWatermarkProperties.transparency": 98,
          "symbolWatermarkProperties.color": "rgba(255, 255, 255, 0.02)",
          "scalesProperties.textColor": "#9ca3af",
          "scalesProperties.lineColor": "rgba(255, 255, 255, 0.1)",
          "mainSeriesProperties.candleStyle.upColor": "#22c55e",
          "mainSeriesProperties.candleStyle.downColor": "#ef4444",
          "mainSeriesProperties.candleStyle.borderUpColor": "#22c55e",
          "mainSeriesProperties.candleStyle.borderDownColor": "#ef4444",
          "mainSeriesProperties.candleStyle.wickUpColor": "#22c55e",
          "mainSeriesProperties.candleStyle.wickDownColor": "#ef4444",
          "mainSeriesProperties.style": 1,
          "mainSeriesProperties.showVolume": false,
          "volumePaneSize": "tiny"
        },
        disabled_features: [
          "header_widget",
          "left_toolbar",
          "context_menus",
          "control_bar",
          "timeframes_toolbar",
          "volume_force_overlay"
        ],
        enabled_features: []
      });
      
      // Try to inject styles into the iframe after widget loads
      setTimeout(() => {
        const iframe = containerRef.current?.querySelector('iframe');
        if (iframe) {
          try {
            const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
            if (iframeDoc) {
              const style = iframeDoc.createElement('style');
              style.innerHTML = `
                body, html { background: #181818 !important; }
                .chart-page { background: #181818 !important; }
                .chart-container { background: #181818 !important; }
                [class*="chart-"] { background-color: #181818 !important; }
                .tv-chart-view { background: #181818 !important; }
              `;
              iframeDoc.head.appendChild(style);
            }
          } catch (e) {
            // Cross-origin restrictions might prevent this
            console.log('Could not inject styles into TradingView iframe');
          }
        }
      }, 1000);
    } else {
      // If TradingView is not loaded, show a placeholder
      if (containerRef.current) {
        containerRef.current.innerHTML = `
          <div style="width: 100%; height: 500px; background: #181818; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #666;">
            <div style="text-align: center;">
              <div style="font-size: 48px; margin-bottom: 16px;">📊</div>
              <div style="font-size: 18px; margin-bottom: 8px;">Chart Loading...</div>
              <div style="font-size: 14px; opacity: 0.7;">TradingView widget will appear here</div>
            </div>
          </div>
        `;
      }
    }
    
    // Cleanup function to remove style element
    return () => {
      const style = document.getElementById(styleId);
      if (style) {
        style.remove();
      }
    };
  }, [symbol, proposalId]);

  return (
    <div 
      id={`tradingview_${proposalId}`} 
      ref={containerRef} 
      style={{ 
        height: '500px', 
        minHeight: '500px',
        background: '#181818'
      }}
    />
  );
}