'use client';

import { useState } from 'react';
import { Wallet, FileText } from 'lucide-react';
import { useSolanaWallets } from '@privy-io/react-auth/solana';

interface HeaderProps {
  walletAddress: string | null;
  authenticated: boolean;
  solBalance: number;
  zcBalance: number;
  hasWalletBalance?: boolean;
  login?: () => void;
  navTab: 'live' | 'history';
  onNavTabChange: (tab: 'live' | 'history') => void;
  isPassMode?: boolean;
}

export default function Header({ walletAddress, authenticated, solBalance, zcBalance, login, navTab, onNavTabChange, isPassMode = true }: HeaderProps) {
  const { exportWallet } = useSolanaWallets();
  const [isHoveringWallet, setIsHoveringWallet] = useState(false);
  const walletPrefix = walletAddress ? walletAddress.slice(0, 6) : 'N/A';

  // Format ZC balance with K, M, B abbreviations
  const formatZcBalance = (balance: number): string => {
    const absBalance = Math.abs(balance);

    if (absBalance >= 1e9) {
      return (balance / 1e9).toFixed(3) + 'B';
    } else if (absBalance >= 1e6) {
      return (balance / 1e6).toFixed(3) + 'M';
    } else if (absBalance >= 1e3) {
      return (balance / 1e3).toFixed(3) + 'K';
    } else {
      return balance.toFixed(3);
    }
  };

  return (
    <div style={{ backgroundColor: '#0a0a0a' }}>
      {/* First Row: Logo / wallet / balances / links */}
      <div className="h-14 flex items-center justify-between px-8">
        {/* Left side: Logo / wallet / balances / links */}
        <div className="flex items-center gap-4 text-gray-400">
        <img
          src="/long-logo.svg"
          alt="percent.markets"
          className="h-8"
        />
        <span className="text-2xl" style={{ color: '#2D2D2D' }}>/</span>
        {!authenticated && login && (
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded-full flex items-center justify-center border border-[#191919]" style={{ backgroundColor: '#121212' }}>
              <Wallet className="w-3 h-3" style={{ color: '#EF6300' }} />
            </div>
            <span
              onClick={login}
              className="text-sm font-ibm-plex-mono font-medium cursor-pointer transition-colors"
              style={{ color: '#EF6300', fontFamily: 'IBM Plex Mono, monospace' }}
              onMouseEnter={(e) => e.currentTarget.style.color = '#C56125'}
              onMouseLeave={(e) => e.currentTarget.style.color = '#EF6300'}
            >
              Click to log in
            </span>
          </div>
        )}
        {authenticated && walletAddress && (
          <>
            <div
              className="flex items-center gap-1.5 cursor-pointer transition-colors"
              onMouseEnter={() => setIsHoveringWallet(true)}
              onMouseLeave={() => setIsHoveringWallet(false)}
              onClick={() => exportWallet()}
            >
              <div className="w-5 h-5 rounded-full flex items-center justify-center border border-[#191919]" style={{ backgroundColor: '#121212' }}>
                <Wallet className="w-3 h-3 transition-colors" style={{ color: isHoveringWallet ? '#EF6300' : '#ffffff' }} />
              </div>
              <span
                className="text-sm font-ibm-plex-mono font-medium transition-colors"
                style={{ color: isHoveringWallet ? '#EF6300' : '#DDDDD7', fontFamily: 'IBM Plex Mono, monospace' }}
              >
                {isHoveringWallet ? 'Export or copy' : walletPrefix}
              </span>
            </div>
            <span className="text-2xl" style={{ color: '#2D2D2D' }}>/</span>
            <div className="flex items-center gap-1.5">
              <img src="/solana-logo.jpg" alt="SOL" className="w-5 h-5 rounded-full border border-[#191919]" />
              <span className="text-sm font-ibm-plex-mono font-medium" style={{ color: '#DDDDD7', fontFamily: 'IBM Plex Mono, monospace' }}>{solBalance.toFixed(3)}</span>
            </div>
            <span className="text-2xl" style={{ color: '#2D2D2D' }}>/</span>
            <div className="flex items-center gap-1.5">
              <img src="/zc-logo.jpg" alt="ZC" className="w-5 h-5 rounded-full border border-[#191919]" />
              <span className="text-sm font-ibm-plex-mono font-medium" style={{ color: '#DDDDD7', fontFamily: 'IBM Plex Mono, monospace' }}>{formatZcBalance(zcBalance)}</span>
            </div>
          </>
        )}
      </div>

      {/* Right side: Links */}
      <nav className="flex items-center gap-3 sm:gap-6">
        <a
          href="https://axiom.trade/meme/CCZdbVvDqPN8DmMLVELfnt9G1Q9pQNt3bTGifSpUY9Ad"
          target="_blank"
          rel="noopener noreferrer"
          className="transition-colors"
          style={{ color: '#6B6E71' }}
          onMouseEnter={(e) => e.currentTarget.style.color = '#9B9E9F'}
          onMouseLeave={(e) => e.currentTarget.style.color = '#6B6E71'}
        >
          <span className="text-sm">$ZC</span>
        </a>
        <a
          href="https://jup.ag/tokens/zcQPTGhdiTMFM6erwko2DWBTkN8nCnAGM7MUX9RpERC"
          target="_blank"
          rel="noopener noreferrer"
          className="transition-colors"
          style={{ color: '#6B6E71' }}
          onMouseEnter={(e) => e.currentTarget.style.color = '#9B9E9F'}
          onMouseLeave={(e) => e.currentTarget.style.color = '#6B6E71'}
        >
          <span className="text-sm">$PERC</span>
        </a>
        <a
          href="https://docs.percent.markets/"
          target="_blank"
          rel="noopener noreferrer"
          className="transition-colors"
          style={{ color: '#6B6E71' }}
          onMouseEnter={(e) => e.currentTarget.style.color = '#9B9E9F'}
          onMouseLeave={(e) => e.currentTarget.style.color = '#6B6E71'}
        >
          <FileText className="w-4 h-4 sm:hidden" />
          <span className="hidden sm:inline text-sm">Docs</span>
        </a>
        <a
          href="https://github.com/percent-markets/percent-core"
          target="_blank"
          rel="noopener noreferrer"
          className="transition-colors"
          style={{ color: '#6B6E71' }}
          onMouseEnter={(e) => e.currentTarget.style.color = '#9B9E9F'}
          onMouseLeave={(e) => e.currentTarget.style.color = '#6B6E71'}
        >
          <svg className="w-4 h-4 sm:hidden" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
          </svg>
          <span className="hidden sm:inline text-sm">Github</span>
        </a>
        <a
          href="http://discord.gg/zcombinator"
          target="_blank"
          rel="noopener noreferrer"
          className="transition-colors"
          style={{ color: '#6B6E71' }}
          onMouseEnter={(e) => e.currentTarget.style.color = '#9B9E9F'}
          onMouseLeave={(e) => e.currentTarget.style.color = '#6B6E71'}
        >
          <svg className="w-4 h-4 sm:hidden" fill="currentColor" viewBox="0 0 24 24">
            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"/>
          </svg>
          <span className="hidden sm:inline text-sm">Discord</span>
        </a>
        <a
          href="https://x.com/percentmarkets"
          target="_blank"
          rel="noopener noreferrer"
          className="transition-colors"
          style={{ color: '#6B6E71' }}
          onMouseEnter={(e) => e.currentTarget.style.color = '#9B9E9F'}
          onMouseLeave={(e) => e.currentTarget.style.color = '#6B6E71'}
        >
          <svg className="w-4 h-4 sm:hidden" fill="currentColor" viewBox="0 0 24 24">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
          </svg>
          <span className="hidden sm:inline text-sm">Twitter</span>
        </a>
      </nav>
      </div>

      {/* Second Row: Live/History Tab Navigation */}
      <div className="px-8 border-b border-[#292929]">
        <div className="flex">
          <button
            onClick={() => onNavTabChange('live')}
            className="text-sm py-1 px-4 transition-all duration-200 ease-in-out cursor-pointer my-0.5 hover:bg-white/10 hover:rounded relative"
            style={navTab === 'live' ? { color: '#DDDDD7' } : { color: '#6B6E71' }}
            onMouseEnter={(e) => { if (navTab !== 'live') e.currentTarget.style.color = '#9B9E9F'; }}
            onMouseLeave={(e) => { if (navTab !== 'live') e.currentTarget.style.color = '#6B6E71'; }}
          >
            {navTab === 'live' && (
              <div className="absolute -bottom-[4px] left-0 right-0 h-[2px] z-10" style={{ backgroundColor: '#DDDDD7' }} />
            )}
            Live
          </button>
          <button
            onClick={() => onNavTabChange('history')}
            className="text-sm py-1 px-4 transition-all duration-200 ease-in-out cursor-pointer my-0.5 hover:bg-white/10 hover:rounded relative"
            style={navTab === 'history' ? { color: '#DDDDD7' } : { color: '#6B6E71' }}
            onMouseEnter={(e) => { if (navTab !== 'history') e.currentTarget.style.color = '#9B9E9F'; }}
            onMouseLeave={(e) => { if (navTab !== 'history') e.currentTarget.style.color = '#6B6E71'; }}
          >
            {navTab === 'history' && (
              <div className="absolute -bottom-[4px] left-0 right-0 h-[2px] z-10" style={{ backgroundColor: '#DDDDD7' }} />
            )}
            History
          </button>
        </div>
      </div>
    </div>
  );
}