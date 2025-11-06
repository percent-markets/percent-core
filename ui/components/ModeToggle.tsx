'use client';

interface ModeToggleProps {
  isPassMode: boolean;
  onToggle: (isPassMode: boolean) => void;
  pfgPercentage: number | null;
}

export function ModeToggle({ isPassMode, onToggle, pfgPercentage }: ModeToggleProps) {
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
        <span className="text-sm font-semibold font-ibm-plex-mono tracking-[0.2em] uppercase mb-2" style={{ color: '#DDDDD7' }}>
          II. Select Coin
        </span>
        <div className="border border-[#191919] rounded-[6px] py-4 px-6 flex flex-col items-center gap-4">
        <div className="inline-flex flex-row items-center select-none py-2">
        {/* Dark Label */}
        <h6
          className={`text-md uppercase pr-6 py-3 min-w-[48px] cursor-pointer transition-colors duration-200 flex items-center gap-2.5 ${
            isPassMode
              ? 'text-[#FFFFFF] pointer-events-none'
              : 'text-[#5B5E62] hover:text-[#404346] active:text-[#010101]'
          }`}
          onClick={handleDarkClick}
          style={{ fontFamily: 'IBM Plex Mono, monospace', letterSpacing: '0em' }}
        >
          PASS COIN
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 20 20" strokeWidth="1.5">
            <circle cx="10" cy="10" r="8" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 10l2 2 4-4" />
          </svg>
        </h6>

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
        <h6
          className={`text-md uppercase pl-6 py-3 min-w-[48px] cursor-pointer transition-colors duration-200 flex items-center gap-2.5 ${
            isPassMode
              ? 'text-[#6B6E71] hover:text-[#9B9E9F] active:text-[#8B8E8F]'
              : 'text-[#FFFFFF] pointer-events-none'
          }`}
          onClick={handleLightClick}
          style={{ fontFamily: 'IBM Plex Mono, monospace', letterSpacing: '0em' }}
        >
          FAIL COIN
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 20 20" strokeWidth="1.5">
            <circle cx="10" cy="10" r="8" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 7l6 6M13 7l-6 6" />
          </svg>
        </h6>
      </div>

      {/* PFG Value */}
      <div
        className="text-md pb-2"
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
