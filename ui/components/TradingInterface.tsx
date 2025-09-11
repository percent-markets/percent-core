'use client';

import { useState, useCallback, useMemo, memo } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';

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
  const [tradeType] = useState<'buy' | 'sell'>('buy');
  const [amount, setAmount] = useState('');
  const [inputMode, setInputMode] = useState<'sol' | 'percent'>('sol');
  const [isEditingQuickAmounts, setIsEditingQuickAmounts] = useState(false);
  const [hoveredPayout, setHoveredPayout] = useState<'pass' | 'fail' | null>(null);
  const [reducePercent, setReducePercent] = useState('');
  
  // Load saved values from localStorage or use defaults
  const [solQuickAmounts, setSolQuickAmounts] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('solQuickAmounts');
      return saved ? JSON.parse(saved) : ['0.01', '0.1', '1', '10'];
    }
    return ['0.01', '0.1', '1', '10'];
  });
  
  const [percentQuickAmounts, setPercentQuickAmounts] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('percentQuickAmounts');
      return saved ? JSON.parse(saved) : ['10', '25', '50', '100'];
    }
    return ['10', '25', '50', '100'];
  });
  
  const [tempSolAmounts, setTempSolAmounts] = useState(['0.01', '0.1', '1', '10']);
  const [tempPercentAmounts, setTempPercentAmounts] = useState(['10', '25', '50', '100']);
  
  const currentPrice = useMemo(() => 
    selectedMarket === 'pass' ? passPrice : failPrice,
    [selectedMarket, passPrice, failPrice]
  );
  
  const estimatedCost = useMemo(() => {
    if (!amount) return 0;
    const val = parseFloat(amount);
    if (inputMode === 'percent') {
      // Convert percentage to SOL amount (assuming 100 SOL max for demo)
      return (val / 100) * 100;
    }
    return val * currentPrice;
  }, [amount, currentPrice, inputMode]);

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
  

  // Quick amount buttons
  const quickAmounts = inputMode === 'sol' 
    ? (isEditingQuickAmounts ? tempSolAmounts : solQuickAmounts)
    : (isEditingQuickAmounts ? tempPercentAmounts : percentQuickAmounts);

  const handleEditToggle = useCallback(() => {
    if (isEditingQuickAmounts) {
      // Save the changes
      setSolQuickAmounts([...tempSolAmounts]);
      setPercentQuickAmounts([...tempPercentAmounts]);
      
      // Save to localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('solQuickAmounts', JSON.stringify(tempSolAmounts));
        localStorage.setItem('percentQuickAmounts', JSON.stringify(tempPercentAmounts));
      }
    } else {
      // Start editing, copy current values to temp
      setTempSolAmounts([...solQuickAmounts]);
      setTempPercentAmounts([...percentQuickAmounts]);
    }
    setIsEditingQuickAmounts(!isEditingQuickAmounts);
  }, [isEditingQuickAmounts, tempSolAmounts, tempPercentAmounts, solQuickAmounts, percentQuickAmounts]);

  const handleQuickAmountChange = useCallback((index: number, value: string) => {
    // Only allow numbers and decimal points
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      if (inputMode === 'sol') {
        const newAmounts = [...tempSolAmounts];
        newAmounts[index] = value;
        setTempSolAmounts(newAmounts);
      } else {
        const newAmounts = [...tempPercentAmounts];
        newAmounts[index] = value;
        setTempPercentAmounts(newAmounts);
      }
    }
  }, [inputMode, tempSolAmounts, tempPercentAmounts]);

  return (
    <div>
      {/* Expected Payouts */}
      <div className="mb-8">
        <div className="text-xs text-gray-400 mb-2">Expected Payouts</div>
        <div className="space-y-2">
          <div 
            className="border border-[#2A2A2A] rounded-lg p-3 flex items-center justify-between cursor-pointer transition-colors hover:bg-[#2a2a2a]/30"
            onMouseEnter={() => setHoveredPayout('pass')}
            onMouseLeave={() => setHoveredPayout(null)}
          >
            <div className="flex items-center gap-1">
              <span className="text-xs text-emerald-400">If Pass</span>
              <svg className="w-3 h-3 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="text-base font-medium text-white">
              {hoveredPayout === 'pass' ? (
                `$${amount ? (parseFloat(amount) / passPrice).toFixed(2) : '0.00'}`
              ) : (
                <div className="flex items-center gap-1">
                  {amount ? (parseFloat(amount) / passPrice).toFixed(2) : '0.00'}
                  <span className="text-gray-400 text-sm font-bold">$oogway</span>
                </div>
              )}
            </div>
          </div>
          <div 
            className="border border-[#2A2A2A] rounded-lg p-3 flex items-center justify-between cursor-pointer transition-colors hover:bg-[#2a2a2a]/30"
            onMouseEnter={() => setHoveredPayout('fail')}
            onMouseLeave={() => setHoveredPayout(null)}
          >
            <div className="flex items-center gap-1">
              <span className="text-xs text-rose-400">If Fail</span>
              <svg className="w-3 h-3 text-rose-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="text-base font-medium text-white">
              {hoveredPayout === 'fail' ? (
                `$${amount ? (parseFloat(amount) / failPrice).toFixed(2) : '0.00'}`
              ) : (
                <div className="flex items-center gap-1">
                  {amount ? (parseFloat(amount) / failPrice).toFixed(2) : '0.00'}
                  <svg className="h-3 w-3 text-gray-400" viewBox="0 0 101 88" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M100.48 69.3817L83.8068 86.8015C83.4444 87.1799 83.0058 87.4816 82.5185 87.6878C82.0312 87.894 81.5055 88.0003 80.9743 88H1.93563C1.55849 88 1.18957 87.8926 0.874202 87.6912C0.558829 87.4897 0.31074 87.2029 0.160416 86.8659C0.0100923 86.529 -0.0359181 86.1566 0.0280382 85.7945C0.0919944 85.4324 0.263131 85.0964 0.520422 84.8278L17.2061 67.408C17.5676 67.0306 18.0047 66.7295 18.4904 66.5234C18.9762 66.3172 19.5002 66.2104 20.0301 66.2095H99.0644C99.4415 66.2095 99.8104 66.3169 100.126 66.5183C100.441 66.7198 100.689 67.0065 100.84 67.3435C100.99 67.6804 101.036 68.0529 100.972 68.415C100.908 68.7771 100.737 69.1131 100.48 69.3817ZM83.8068 36.3032C83.4444 35.9248 83.0058 35.6231 82.5185 35.4169C82.0312 35.2108 81.5055 35.1045 80.9743 35.1048H1.93563C1.55849 35.1048 1.18957 35.2121 0.874202 35.4136C0.558829 35.6151 0.31074 35.9019 0.160416 36.2388C0.0100923 36.5758 -0.0359181 36.9482 0.0280382 37.3103C0.0919944 37.6723 0.263131 38.0083 0.520422 38.277L17.2061 55.6968C17.5676 56.0742 18.0047 56.3752 18.4904 56.5814C18.9762 56.7875 19.5002 56.8944 20.0301 56.8952H99.0644C99.4415 56.8952 99.8104 56.7879 100.126 56.5864C100.441 56.3849 100.689 56.0981 100.84 55.7612C100.99 55.4242 101.036 55.0518 100.972 54.6897C100.908 54.3277 100.737 53.9917 100.48 53.723L83.8068 36.3032ZM1.93563 21.7905H80.9743C81.5055 21.7898 82.0312 21.6835 82.5185 21.4773C83.0058 21.2712 83.4444 20.9695 83.8068 20.5911L100.48 3.17133C100.737 2.90265 100.908 2.56667 100.972 2.2046C101.036 1.84253 100.99 1.47008 100.84 1.13314C100.689 0.796193 100.441 0.509443 100.126 0.307961C99.8104 0.106479 99.4415 -0.000854492 99.0644 -0.000854492H20.0301C19.5002 -0.00013126 18.9762 0.106791 18.4904 0.312929C18.0047 0.519068 17.5676 0.820087 17.2061 1.19754L0.524723 18.6173C0.267481 18.8859 0.0963642 19.2219 0.0323936 19.584C-0.0315771 19.946 0.0144792 20.3184 0.164862 20.6554C0.315245 20.9923 0.563347 21.2791 0.878727 21.4806C1.19411 21.682 1.56303 21.7894 1.94013 21.7896L1.93563 21.7905Z" fill="currentColor"/>
                  </svg>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* PASS/FAIL Market Selection - Toggle Style */}
      <div className="flex justify-between items-center mb-2">
        <div className="text-xs text-gray-400">Place Bet</div>
        <div className="text-xs text-gray-400 flex items-center gap-1">
          Position: 0
          <svg className="h-2.5 w-2.5" viewBox="0 0 101 88" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M100.48 69.3817L83.8068 86.8015C83.4444 87.1799 83.0058 87.4816 82.5185 87.6878C82.0312 87.894 81.5055 88.0003 80.9743 88H1.93563C1.55849 88 1.18957 87.8926 0.874202 87.6912C0.558829 87.4897 0.31074 87.2029 0.160416 86.8659C0.0100923 86.529 -0.0359181 86.1566 0.0280382 85.7945C0.0919944 85.4324 0.263131 85.0964 0.520422 84.8278L17.2061 67.408C17.5676 67.0306 18.0047 66.7295 18.4904 66.5234C18.9762 66.3172 19.5002 66.2104 20.0301 66.2095H99.0644C99.4415 66.2095 99.8104 66.3169 100.126 66.5183C100.441 66.7198 100.689 67.0065 100.84 67.3435C100.99 67.6804 101.036 68.0529 100.972 68.415C100.908 68.7771 100.737 69.1131 100.48 69.3817ZM83.8068 36.3032C83.4444 35.9248 83.0058 35.6231 82.5185 35.4169C82.0312 35.2108 81.5055 35.1045 80.9743 35.1048H1.93563C1.55849 35.1048 1.18957 35.2121 0.874202 35.4136C0.558829 35.6151 0.31074 35.9019 0.160416 36.2388C0.0100923 36.5758 -0.0359181 36.9482 0.0280382 37.3103C0.0919944 37.6723 0.263131 38.0083 0.520422 38.277L17.2061 55.6968C17.5676 56.0742 18.0047 56.3752 18.4904 56.5814C18.9762 56.7875 19.5002 56.8944 20.0301 56.8952H99.0644C99.4415 56.8952 99.8104 56.7879 100.126 56.5864C100.441 56.3849 100.689 56.0981 100.84 55.7612C100.99 55.4242 101.036 55.0518 100.972 54.6897C100.908 54.3277 100.737 53.9917 100.48 53.723L83.8068 36.3032ZM1.93563 21.7905H80.9743C81.5055 21.7898 82.0312 21.6835 82.5185 21.4773C83.0058 21.2712 83.4444 20.9695 83.8068 20.5911L100.48 3.17133C100.737 2.90265 100.908 2.56667 100.972 2.2046C101.036 1.84253 100.99 1.47008 100.84 1.13314C100.689 0.796193 100.441 0.509443 100.126 0.307961C99.8104 0.106479 99.4415 -0.000854492 99.0644 -0.000854492H20.0301C19.5002 -0.00013126 18.9762 0.106791 18.4904 0.312929C18.0047 0.519068 17.5676 0.820087 17.2061 1.19754L0.524723 18.6173C0.267481 18.8859 0.0963642 19.2219 0.0323936 19.584C-0.0315771 19.946 0.0144792 20.3184 0.164862 20.6554C0.315245 20.9923 0.563347 21.2791 0.878727 21.4806C1.19411 21.682 1.56303 21.7894 1.94013 21.7896L1.93563 21.7905Z" fill="currentColor"/>
          </svg>
          Fail
        </div>
      </div>
      <div className="flex flex-row flex-1 min-h-[40px] max-h-[40px] gap-[4px] border border-[#2A2A2A] p-[4px] justify-center items-center rounded-[8px] mb-2">
        <button
          onClick={() => onMarketChange('pass')}
          className={`flex flex-row flex-1 min-h-[32px] max-h-[32px] p-[4px] justify-center items-center rounded-[8px] transition cursor-pointer ${
            selectedMarket === 'pass'
              ? 'bg-emerald-500 text-[#181818] font-bold'
              : 'bg-transparent text-gray-400 font-medium hover:bg-[#303030]'
          }`}
        >
          <span className="text-[12px] leading-[16px]">Pass</span>
        </button>
        <button
          onClick={() => onMarketChange('fail')}
          className={`flex flex-row flex-1 min-h-[32px] max-h-[32px] p-[4px] justify-center items-center rounded-[8px] transition cursor-pointer ${
            selectedMarket === 'fail'
              ? 'bg-rose-500 text-[#181818] font-bold'
              : 'bg-transparent text-gray-400 font-medium hover:bg-[#303030]'
          }`}
        >
          <span className="text-[12px] leading-[16px]">Fail</span>
        </button>
      </div>

      {/* Amount Input with Toggle */}
      <div>
        <div className="relative">
          <input
            type="text"
            inputMode="decimal"
            pattern="[0-9]*[.]?[0-9]*"
            value={amount}
            onChange={(e) => {
              const value = e.target.value;
              if (value === '' || /^\d*\.?\d*$/.test(value)) {
                setAmount(value);
              }
            }}
            placeholder="0.0"
            className="w-full px-3 py-3 pr-20 bg-[#2a2a2a] rounded-t-lg text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-gray-600 border-t border-l border-r border-[#2A2A2A]"
            style={{ WebkitAppearance: 'none', MozAppearance: 'textfield' }}
          />
          <button
            onClick={() => setInputMode(inputMode === 'sol' ? 'percent' : 'sol')}
            className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center px-2 h-7 bg-[#333] rounded hover:bg-[#404040] transition cursor-pointer"
          >
            {inputMode === 'sol' ? (
              <svg className="h-3 w-3" viewBox="0 0 101 88" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M100.48 69.3817L83.8068 86.8015C83.4444 87.1799 83.0058 87.4816 82.5185 87.6878C82.0312 87.894 81.5055 88.0003 80.9743 88H1.93563C1.55849 88 1.18957 87.8926 0.874202 87.6912C0.558829 87.4897 0.31074 87.2029 0.160416 86.8659C0.0100923 86.529 -0.0359181 86.1566 0.0280382 85.7945C0.0919944 85.4324 0.263131 85.0964 0.520422 84.8278L17.2061 67.408C17.5676 67.0306 18.0047 66.7295 18.4904 66.5234C18.9762 66.3172 19.5002 66.2104 20.0301 66.2095H99.0644C99.4415 66.2095 99.8104 66.3169 100.126 66.5183C100.441 66.7198 100.689 67.0065 100.84 67.3435C100.99 67.6804 101.036 68.0529 100.972 68.415C100.908 68.7771 100.737 69.1131 100.48 69.3817ZM83.8068 36.3032C83.4444 35.9248 83.0058 35.6231 82.5185 35.4169C82.0312 35.2108 81.5055 35.1045 80.9743 35.1048H1.93563C1.55849 35.1048 1.18957 35.2121 0.874202 35.4136C0.558829 35.6151 0.31074 35.9019 0.160416 36.2388C0.0100923 36.5758 -0.0359181 36.9482 0.0280382 37.3103C0.0919944 37.6723 0.263131 38.0083 0.520422 38.277L17.2061 55.6968C17.5676 56.0742 18.0047 56.3752 18.4904 56.5814C18.9762 56.7875 19.5002 56.8944 20.0301 56.8952H99.0644C99.4415 56.8952 99.8104 56.7879 100.126 56.5864C100.441 56.3849 100.689 56.0981 100.84 55.7612C100.99 55.4242 101.036 55.0518 100.972 54.6897C100.908 54.3277 100.737 53.9917 100.48 53.723L83.8068 36.3032ZM1.93563 21.7905H80.9743C81.5055 21.7898 82.0312 21.6835 82.5185 21.4773C83.0058 21.2712 83.4444 20.9695 83.8068 20.5911L100.48 3.17133C100.737 2.90265 100.908 2.56667 100.972 2.2046C101.036 1.84253 100.99 1.47008 100.84 1.13314C100.689 0.796193 100.441 0.509443 100.126 0.307961C99.8104 0.106479 99.4415 -0.000854492 99.0644 -0.000854492H20.0301C19.5002 -0.00013126 18.9762 0.106791 18.4904 0.312929C18.0047 0.519068 17.5676 0.820087 17.2061 1.19754L0.524723 18.6173C0.267481 18.8859 0.0963642 19.2219 0.0323936 19.584C-0.0315771 19.946 0.0144792 20.3184 0.164862 20.6554C0.315245 20.9923 0.563347 21.2791 0.878727 21.4806C1.19411 21.682 1.56303 21.7894 1.94013 21.7896L1.93563 21.7905Z" fill="#AFAFAF"/>
              </svg>
            ) : (
              <span className="text-xs text-[#AFAFAF] font-bold">$oogway</span>
            )}
          </button>
        </div>
      </div>

      {/* Quick Amount Buttons */}
      <div className="flex mb-4">
        {quickAmounts.map((val: string, index: number) => (
          <button
            key={index}
            onClick={isEditingQuickAmounts ? undefined : () => setAmount(val)}
            contentEditable={isEditingQuickAmounts}
            suppressContentEditableWarning={true}
            onBlur={isEditingQuickAmounts ? (e) => {
              let currentValue = e.currentTarget.textContent || '';
              currentValue = currentValue.trim();
              
              // Format the number: remove leading zeros, handle decimal points
              if (currentValue && !isNaN(parseFloat(currentValue))) {
                const num = parseFloat(currentValue);
                // Format based on whether it's a whole number or has decimals
                currentValue = num.toString();
                e.currentTarget.textContent = currentValue;
              } else if (currentValue === '' || currentValue === '.') {
                // If empty or just a dot, default to 0
                currentValue = '0';
                e.currentTarget.textContent = currentValue;
              }
              
              handleQuickAmountChange(index, currentValue);
            } : undefined}
            className={`flex-1 py-1.5 border-b border-l border-r border-[#2A2A2A] text-sm text-center ${
              isEditingQuickAmounts 
                ? 'text-gray-400 cursor-text focus:bg-[#2a2a2a] focus:text-white focus:outline-none' 
                : 'text-gray-400 hover:bg-[#303030] transition cursor-pointer'
            } ${
              index === 0 ? 'rounded-bl-lg' : ''
            } ${
              index > 0 ? 'border-l-0' : ''
            }`}
          >
            {val}
          </button>
        ))}
        <button
          onClick={handleEditToggle}
          className={`px-3 py-1.5 border-b border-r border-[#2A2A2A] rounded-br-lg text-sm transition cursor-pointer text-gray-400 hover:bg-[#303030]`}
          title={isEditingQuickAmounts ? 'Save' : 'Edit quick amounts'}
        >
          {isEditingQuickAmounts ? (
            <svg className="w-3.5 h-3.5 inline" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          ) : '✎'}
        </button>
      </div>


      {/* Trade Button */}
      <button
        onClick={handleTrade}
        disabled={!amount || parseFloat(amount) <= 0}
        className={`w-full py-3 rounded-full font-semibold transition cursor-pointer flex items-center justify-center gap-1 ${
          selectedMarket === 'pass'
            ? amount && parseFloat(amount) > 0
              ? 'bg-emerald-500 hover:bg-emerald-600 text-[#181818]'
              : 'bg-[#2a2a2a] text-gray-600 cursor-not-allowed'
            : amount && parseFloat(amount) > 0
              ? 'bg-rose-500 hover:bg-rose-600 text-[#181818]'
              : 'bg-[#2a2a2a] text-gray-600 cursor-not-allowed'
        }`}
      >
        <span>Bet {selectedMarket === 'pass' ? 'Pass' : 'Fail'} {amount || '0'}</span>
        {inputMode === 'sol' ? (
          <svg className="h-3.5 w-3.5" viewBox="0 0 101 88" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M100.48 69.3817L83.8068 86.8015C83.4444 87.1799 83.0058 87.4816 82.5185 87.6878C82.0312 87.894 81.5055 88.0003 80.9743 88H1.93563C1.55849 88 1.18957 87.8926 0.874202 87.6912C0.558829 87.4897 0.31074 87.2029 0.160416 86.8659C0.0100923 86.529 -0.0359181 86.1566 0.0280382 85.7945C0.0919944 85.4324 0.263131 85.0964 0.520422 84.8278L17.2061 67.408C17.5676 67.0306 18.0047 66.7295 18.4904 66.5234C18.9762 66.3172 19.5002 66.2104 20.0301 66.2095H99.0644C99.4415 66.2095 99.8104 66.3169 100.126 66.5183C100.441 66.7198 100.689 67.0065 100.84 67.3435C100.99 67.6804 101.036 68.0529 100.972 68.415C100.908 68.7771 100.737 69.1131 100.48 69.3817ZM83.8068 36.3032C83.4444 35.9248 83.0058 35.6231 82.5185 35.4169C82.0312 35.2108 81.5055 35.1045 80.9743 35.1048H1.93563C1.55849 35.1048 1.18957 35.2121 0.874202 35.4136C0.558829 35.6151 0.31074 35.9019 0.160416 36.2388C0.0100923 36.5758 -0.0359181 36.9482 0.0280382 37.3103C0.0919944 37.6723 0.263131 38.0083 0.520422 38.277L17.2061 55.6968C17.5676 56.0742 18.0047 56.3752 18.4904 56.5814C18.9762 56.7875 19.5002 56.8944 20.0301 56.8952H99.0644C99.4415 56.8952 99.8104 56.7879 100.126 56.5864C100.441 56.3849 100.689 56.0981 100.84 55.7612C100.99 55.4242 101.036 55.0518 100.972 54.6897C100.908 54.3277 100.737 53.9917 100.48 53.723L83.8068 36.3032ZM1.93563 21.7905H80.9743C81.5055 21.7898 82.0312 21.6835 82.5185 21.4773C83.0058 21.2712 83.4444 20.9695 83.8068 20.5911L100.48 3.17133C100.737 2.90265 100.908 2.56667 100.972 2.2046C101.036 1.84253 100.99 1.47008 100.84 1.13314C100.689 0.796193 100.441 0.509443 100.126 0.307961C99.8104 0.106479 99.4415 -0.000854492 99.0644 -0.000854492H20.0301C19.5002 -0.00013126 18.9762 0.106791 18.4904 0.312929C18.0047 0.519068 17.5676 0.820087 17.2061 1.19754L0.524723 18.6173C0.267481 18.8859 0.0963642 19.2219 0.0323936 19.584C-0.0315771 19.946 0.0144792 20.3184 0.164862 20.6554C0.315245 20.9923 0.563347 21.2791 0.878727 21.4806C1.19411 21.682 1.56303 21.7894 1.94013 21.7896L1.93563 21.7905Z" fill="currentColor"/>
          </svg>
        ) : (
          <span className="ml-0.5">{amount && parseFloat(amount) > 0 ? '$oogway' : <span className="text-gray-600">$oogway</span>}</span>
        )}
      </button>

      {/* Reduce Bet Section */}
      <div className="mt-8">
        <div className="text-xs text-gray-400 mb-2">Reduce [Fail] Position</div>
        
        {/* Input Field */}
        <div>
          <div className="relative">
            <input
              type="text"
              inputMode="decimal"
              pattern="[0-9]*[.]?[0-9]*"
              value={reducePercent}
              onChange={(e) => {
                const value = e.target.value;
                if (value === '' || /^\d*\.?\d*$/.test(value)) {
                  setReducePercent(value);
                }
              }}
              placeholder="100"
              className="w-full px-3 py-3 pr-20 bg-[#2a2a2a] rounded-t-lg text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-gray-600 border-t border-l border-r border-[#2A2A2A]"
              style={{ WebkitAppearance: 'none', MozAppearance: 'textfield' }}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
          </div>
        </div>

        {/* Quick Amount Buttons */}
        <div className="flex mb-4">
          <button
            onClick={() => setReducePercent('10')}
            className="flex-1 py-1.5 border-b border-l border-r border-[#2A2A2A] text-sm text-center text-gray-400 hover:bg-[#303030] transition cursor-pointer rounded-bl-lg"
          >
            10
          </button>
          <button
            onClick={() => setReducePercent('25')}
            className="flex-1 py-1.5 border-b border-r border-[#2A2A2A] text-sm text-center text-gray-400 hover:bg-[#303030] transition cursor-pointer"
          >
            25
          </button>
          <button
            onClick={() => setReducePercent('50')}
            className="flex-1 py-1.5 border-b border-r border-[#2A2A2A] text-sm text-center text-gray-400 hover:bg-[#303030] transition cursor-pointer"
          >
            50
          </button>
          <button
            onClick={() => setReducePercent('100')}
            className="flex-1 py-1.5 border-b border-r border-[#2A2A2A] text-sm text-center text-gray-400 hover:bg-[#303030] transition cursor-pointer"
          >
            100
          </button>
          <div className="px-3 py-1.5 border-b border-r border-[#2A2A2A] rounded-br-lg text-sm text-gray-400">
            %
          </div>
        </div>


        {/* Submit Button */}
        <button
          onClick={() => {
            if (!connected) {
              alert('Please connect your wallet first');
              return;
            }
            console.log('Reducing position by', reducePercent, '%');
          }}
          disabled={!reducePercent || parseFloat(reducePercent) <= 0}
          className={`w-full py-3 rounded-lg font-semibold transition cursor-pointer flex items-center justify-center gap-1 ${
            reducePercent && parseFloat(reducePercent) > 0
              ? 'bg-sky-500 hover:bg-sky-600 text-[#181818]'
              : 'bg-[#2a2a2a] text-gray-600 cursor-not-allowed'
          }`}
        >
          <span>Reduce Fail {reducePercent ? (parseFloat(reducePercent) * 0.3).toFixed(1) : '30'}</span>
          <svg className="h-3.5 w-3.5" viewBox="0 0 101 88" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M100.48 69.3817L83.8068 86.8015C83.4444 87.1799 83.0058 87.4816 82.5185 87.6878C82.0312 87.894 81.5055 88.0003 80.9743 88H1.93563C1.55849 88 1.18957 87.8926 0.874202 87.6912C0.558829 87.4897 0.31074 87.2029 0.160416 86.8659C0.0100923 86.529 -0.0359181 86.1566 0.0280382 85.7945C0.0919944 85.4324 0.263131 85.0964 0.520422 84.8278L17.2061 67.408C17.5676 67.0306 18.0047 66.7295 18.4904 66.5234C18.9762 66.3172 19.5002 66.2104 20.0301 66.2095H99.0644C99.4415 66.2095 99.8104 66.3169 100.126 66.5183C100.441 66.7198 100.689 67.0065 100.84 67.3435C100.99 67.6804 101.036 68.0529 100.972 68.415C100.908 68.7771 100.737 69.1131 100.48 69.3817ZM83.8068 36.3032C83.4444 35.9248 83.0058 35.6231 82.5185 35.4169C82.0312 35.2108 81.5055 35.1045 80.9743 35.1048H1.93563C1.55849 35.1048 1.18957 35.2121 0.874202 35.4136C0.558829 35.6151 0.31074 35.9019 0.160416 36.2388C0.0100923 36.5758 -0.0359181 36.9482 0.0280382 37.3103C0.0919944 37.6723 0.263131 38.0083 0.520422 38.277L17.2061 55.6968C17.5676 56.0742 18.0047 56.3752 18.4904 56.5814C18.9762 56.7875 19.5002 56.8944 20.0301 56.8952H99.0644C99.4415 56.8952 99.8104 56.7879 100.126 56.5864C100.441 56.3849 100.689 56.0981 100.84 55.7612C100.99 55.4242 101.036 55.0518 100.972 54.6897C100.908 54.3277 100.737 53.9917 100.48 53.723L83.8068 36.3032ZM1.93563 21.7905H80.9743C81.5055 21.7898 82.0312 21.6835 82.5185 21.4773C83.0058 21.2712 83.4444 20.9695 83.8068 20.5911L100.48 3.17133C100.737 2.90265 100.908 2.56667 100.972 2.2046C101.036 1.84253 100.99 1.47008 100.84 1.13314C100.689 0.796193 100.441 0.509443 100.126 0.307961C99.8104 0.106479 99.4415 -0.000854492 99.0644 -0.000854492H20.0301C19.5002 -0.00013126 18.9762 0.106791 18.4904 0.312929C18.0047 0.519068 17.5676 0.820087 17.2061 1.19754L0.524723 18.6173C0.267481 18.8859 0.0963642 19.2219 0.0323936 19.584C-0.0315771 19.946 0.0144792 20.3184 0.164862 20.6554C0.315245 20.9923 0.563347 21.2791 0.878727 21.4806C1.19411 21.682 1.56303 21.7894 1.94013 21.7896L1.93563 21.7905Z" fill="currentColor"/>
          </svg>
        </button>
      </div>
    </div>
  );
});

TradingInterface.displayName = 'TradingInterface';

export default TradingInterface;