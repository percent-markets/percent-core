'use client';

import { formatMarketCap } from '@/lib/formatters';

interface ModeToggleProps {
  isPassMode: boolean;
  onToggle: (isPassMode: boolean) => void;
  pfgPercentage: number | null;
  passMarketCap: number | null;
  failMarketCap: number | null;
}

export function ModeToggle({ isPassMode, onToggle, pfgPercentage, passMarketCap, failMarketCap }: ModeToggleProps) {
  const handleToggleClick = () => {
    onToggle(!isPassMode);
  };

  const handleDarkClick = () => {
    onToggle(true);
  };

  const handleLightClick = () => {
    onToggle(false);
  };

  return (
    <div className="bg-[#121212] border border-[#191919] rounded-[9px] py-4 transition-all duration-300">
      <div className="flex flex-col items-center gap-4">
        <span className="text-sm font-semibold font-ibm-plex-mono tracking-[0.2em] uppercase mb-2 text-center" style={{ color: '#DDDDD7' }}>
          II. Select Coin
        </span>
        <div className="border border-[#191919] rounded-[6px] py-4 px-6 flex flex-col items-center gap-4">
        <div className="inline-flex flex-row items-center select-none">
        {/* Dark Label */}
        <div className="pl-2 pr-10 py-3 min-w-[48px] cursor-pointer" onClick={handleDarkClick}>
          <h6
            className={`text-md uppercase transition-colors duration-200 text-center ${
              isPassMode
                ? 'text-[#FFFFFF] pointer-events-none'
                : 'text-[#5B5E62] hover:text-[#404346] active:text-[#010101]'
            }`}
            style={{ fontFamily: 'IBM Plex Mono, monospace', letterSpacing: '0em' }}
          >
            PASS COIN
          </h6>
          <div
            className={`text-xs mt-1 transition-colors duration-200 text-center ${
              isPassMode
                ? 'text-[#FFFFFF]'
                : 'text-[#5B5E62]'
            }`}
            style={{ fontFamily: 'IBM Plex Mono, monospace' }}
          >
            {formatMarketCap(passMarketCap)}
          </div>
        </div>

        {/* Toggle Switch */}
        <button
          onClick={handleToggleClick}
          className="relative w-[72px] h-[42px] border-none outline-none overflow-hidden rounded-[21px] transition-all duration-200 cursor-pointer"
          style={{
            background: '#404346',
          }}
        >
          {/* Circle */}
          <div
            className="absolute w-[30px] h-[30px] rounded-[18px] transition-all duration-200"
            style={{
              top: '6px',
              left: isPassMode ? '6px' : '36px',
              background: '#DCE0E3',
            }}
          />

          {/* Decorative Element (after pseudo) - Only show in Fail mode */}
          {!isPassMode && (
            <div
              className="absolute rounded-full transition-all duration-200"
              style={{
                top: '21px',
                right: '3px',
                width: '1.5px',
                height: '1.5px',
                borderRadius: '0.75px',
                background: '#404346',
              }}
            />
          )}
        </button>

        {/* Light Label */}
        <div className="pl-10 pr-2 py-3 min-w-[48px] cursor-pointer" onClick={handleLightClick}>
          <h6
            className={`text-md uppercase transition-colors duration-200 text-center ${
              isPassMode
                ? 'text-[#6B6E71] hover:text-[#9B9E9F] active:text-[#8B8E8F]'
                : 'text-[#FFFFFF] pointer-events-none'
            }`}
            style={{ fontFamily: 'IBM Plex Mono, monospace', letterSpacing: '0em' }}
          >
            FAIL COIN
          </h6>
          <div
            className={`text-xs mt-1 transition-colors duration-200 text-center ${
              isPassMode
                ? 'text-[#6B6E71]'
                : 'text-[#FFFFFF]'
            }`}
            style={{ fontFamily: 'IBM Plex Mono, monospace' }}
          >
            {formatMarketCap(failMarketCap)}
          </div>
        </div>
      </div>

      {/* PFG Value */}
      <div
        className="text-md pb-1"
        style={{
          fontFamily: 'IBM Plex Mono, monospace',
          letterSpacing: '0em',
          color: '#FFFFFF',
        }}
      >
        TWAP PFG {pfgPercentage !== null ? pfgPercentage.toFixed(2) : '0.00'}%
      </div>
      </div>
      </div>
    </div>
  );
}
