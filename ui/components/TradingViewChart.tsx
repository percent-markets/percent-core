'use client';

import { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    TradingView: any;
  }
}

interface TradingViewChartProps {
  proposalId: number;
}

export default function TradingViewChart({ proposalId }: TradingViewChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [chartHeight, setChartHeight] = useState(600);
  
  // Calculate dynamic height based on screen size
  useEffect(() => {
    const calculateHeight = () => {
      // Base height is 600px for 982px screen height
      const baseScreenHeight = 982;
      const baseChartHeight = 600;
      const screenHeight = window.innerHeight;
      
      // Calculate proportional height
      const scaleFactor = screenHeight / baseScreenHeight;
      const newHeight = Math.round(baseChartHeight * scaleFactor);
      
      // Set min and max bounds
      const minHeight = 400;
      const maxHeight = 900;
      
      setChartHeight(Math.min(Math.max(newHeight, minHeight), maxHeight));
    };
    
    calculateHeight();
    window.addEventListener('resize', calculateHeight);
    
    return () => window.removeEventListener('resize', calculateHeight);
  }, []);

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
        #tradingview_${proposalId} [class*="separator"] {
          background-color: #181818 !important;
          border-color: #181818 !important;
        }
        #tradingview_${proposalId} [class*="rightend"] {
          border-left-color: #181818 !important;
        }
        #tradingview_${proposalId} [class*="bottomend"] {
          border-top-color: #181818 !important;
        }
      `;
      document.head.appendChild(styleElement);
    }

    // Check if TradingView library is loaded
    if (typeof window !== 'undefined' && window.TradingView && containerRef.current) {
      // Clear any existing widget
      containerRef.current.innerHTML = '';
      
      // Create new widget
      const widget = new window.TradingView.widget({
        autosize: true,
        symbol: 'NASDAQ:AAPL',
        interval: 'D',
        timezone: 'Etc/UTC',
        theme: 'dark',
        style: '2',
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
          "paneProperties.vertGridProperties.color": "rgba(255, 255, 255, 0.04)",
          "paneProperties.horzGridProperties.color": "rgba(255, 255, 255, 0.04)",
          "paneProperties.separatorColor": "#181818",
          "symbolWatermarkProperties.transparency": 98,
          "symbolWatermarkProperties.color": "rgba(255, 255, 255, 0.02)",
          "scalesProperties.textColor": "#9ca3af",
          "scalesProperties.lineColor": "#181818",
          "mainSeriesProperties.candleStyle.upColor": "#22c55e",
          "mainSeriesProperties.candleStyle.downColor": "#ef4444",
          "mainSeriesProperties.candleStyle.borderUpColor": "#22c55e",
          "mainSeriesProperties.candleStyle.borderDownColor": "#ef4444",
          "mainSeriesProperties.candleStyle.wickUpColor": "#22c55e",
          "mainSeriesProperties.candleStyle.wickDownColor": "#ef4444",
          "mainSeriesProperties.style": 1
        },
        disabled_features: [
          "header_widget",
          "left_toolbar",
          "context_menus",
          "control_bar",
          "timeframes_toolbar",
          "volume_force_overlay",
          "header_compare",
          "header_symbol_search",
          "header_indicators"
        ],
        enabled_features: [],
        studies_overrides: {
          "compare.plot.color": "#FFD700",
          "compare.source": "close"
        }
      });
      
      // Add comparison lines after widget is ready
      if (widget && widget.onChartReady) {
        widget.onChartReady(() => {
          try {
            const chart = widget.chart();
            // Add Microsoft comparison
            chart.createStudy('Compare', false, false, {
              symbol: 'NASDAQ:MSFT'
            });
            // Add Google comparison
            chart.createStudy('Compare', false, false, {
              symbol: 'NASDAQ:GOOGL'
            });
          } catch (e) {
            console.log('Could not add comparison studies:', e);
          }
        });
      }
    } else {
      // If TradingView is not loaded, show a placeholder
      if (containerRef.current) {
        containerRef.current.innerHTML = `
          <div style="width: 100%; height: ${chartHeight}px; background: #181818; display: flex; align-items: center; justify-content: center; color: #666;">
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
  }, [proposalId, chartHeight]);

  return (
    <div 
      id={`tradingview_${proposalId}`} 
      ref={containerRef} 
      style={{ 
        height: `${chartHeight}px`, 
        minHeight: `${chartHeight}px`,
        background: '#181818',
        transition: 'height 0.3s ease'
      }}
    />
  );
}