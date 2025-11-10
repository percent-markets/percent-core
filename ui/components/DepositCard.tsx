'use client';

import { useState, useCallback, useMemo } from 'react';
import { usePrivyWallet } from '@/hooks/usePrivyWallet';
import { useSolanaWallets } from '@privy-io/react-auth/solana';
import { Transaction } from '@solana/web3.js';
import toast from 'react-hot-toast';
import { formatNumber } from '@/lib/formatters';
import { buildApiUrl } from '@/lib/api-utils';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const SOL_DECIMALS = 9;
const ZC_DECIMALS = 6;
const SOL_GAS_RESERVE = 0.02; // Reserve for transaction fees

interface DepositCardProps {
  proposalId: number;
  solBalance: number | null;
  zcBalance: number | null;
  onDepositSuccess: () => void;
}

export function DepositCard({ proposalId, solBalance, zcBalance, onDepositSuccess }: DepositCardProps) {
  const { authenticated, walletAddress, login } = usePrivyWallet();
  const { wallets } = useSolanaWallets();
  const [amount, setAmount] = useState('');
  const [selectedToken, setSelectedToken] = useState<'sol' | 'zc'>('sol');
  const [isDepositing, setIsDepositing] = useState(false);

  // Calculate max balance
  const maxBalance = useMemo(() => {
    const balance = selectedToken === 'sol' ? (solBalance || 0) : (zcBalance || 0);
    // Reserve gas for SOL deposits
    return selectedToken === 'sol' ? Math.max(0, balance - SOL_GAS_RESERVE) : balance;
  }, [selectedToken, solBalance, zcBalance]);

  // Validate balance
  const balanceError = useMemo(() => {
    if (!amount) return null;
    const inputAmount = parseFloat(amount);
    if (isNaN(inputAmount) || inputAmount <= 0) return null;

    if (inputAmount > maxBalance) {
      const decimals = selectedToken === 'sol' ? 3 : 0;
      return `Insufficient balance. Max: ${formatNumber(maxBalance, decimals)} ${selectedToken === 'sol' ? 'SOL' : 'ZC'}`;
    }
    return null;
  }, [amount, maxBalance, selectedToken]);

  // Handle MAX button
  const handleMaxClick = useCallback(() => {
    if (maxBalance > 0) {
      setAmount(maxBalance.toString());
    } else {
      toast.error(`No ${selectedToken.toUpperCase()} balance available`);
    }
  }, [maxBalance, selectedToken]);

  // Handle deposit
  const handleDeposit = useCallback(async () => {
    if (!authenticated) {
      login();
      return;
    }

    if (!walletAddress) {
      toast.error('No wallet address found');
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    if (balanceError) {
      toast.error(balanceError);
      return;
    }

    const wallet = wallets[0];
    if (!wallet) {
      toast.error('No wallet connected');
      return;
    }

    setIsDepositing(true);
    const toastId = toast.loading(`Depositing ${amount} ${selectedToken.toUpperCase()}...`);

    try {
      // Convert amount to smallest units
      const decimals = selectedToken === 'sol' ? SOL_DECIMALS : ZC_DECIMALS;
      const amountInSmallestUnits = Math.floor(parseFloat(amount) * Math.pow(10, decimals));

      // Determine vault type
      const vaultType = selectedToken === 'zc' ? 'base' : 'quote';

      // Step 1: Build split transaction
      const buildResponse = await fetch(
        buildApiUrl(API_BASE_URL, `/api/vaults/${proposalId}/${vaultType}/buildSplitTx`),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user: walletAddress,
            amount: amountInSmallestUnits.toString()
          })
        }
      );

      if (!buildResponse.ok) {
        const error = await buildResponse.json();
        throw new Error(error.message || 'Failed to build transaction');
      }

      const buildData = await buildResponse.json();

      // Step 2: Sign transaction
      const splitTx = Transaction.from(Buffer.from(buildData.transaction, 'base64'));
      const signedTx = await wallet.signTransaction(splitTx);

      // Step 3: Execute split transaction
      const executeResponse = await fetch(
        buildApiUrl(API_BASE_URL, `/api/vaults/${proposalId}/${vaultType}/executeSplitTx`),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transaction: Buffer.from(signedTx.serialize({ requireAllSignatures: false })).toString('base64')
          })
        }
      );

      if (!executeResponse.ok) {
        const error = await executeResponse.json();
        throw new Error(error.message || 'Failed to execute transaction');
      }

      // Success
      toast.success(`Successfully deposited ${amount} ${selectedToken.toUpperCase()}!`, { id: toastId, duration: 5000 });
      setAmount('');
      onDepositSuccess();

    } catch (error) {
      console.error('Deposit error:', error);
      toast.error(
        `Failed to deposit: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { id: toastId }
      );
    } finally {
      setIsDepositing(false);
    }
  }, [authenticated, walletAddress, amount, balanceError, selectedToken, wallets, proposalId, login, onDepositSuccess]);

  return (
    <div className="bg-[#121212] border border-[#191919] rounded-[9px] py-4 px-5 transition-all duration-300">
      <div className="text-white flex flex-col items-center">
        <span className="text-sm font-semibold font-ibm-plex-mono tracking-[0.2em] uppercase mb-6 block text-center" style={{ color: '#DDDDD7' }}>
          I. Deposit Funds
        </span>

        {/* Input and Button Row */}
        <div className="flex items-center gap-2 w-full pb-1">
        {/* Amount Input */}
        <div className="relative flex-1">
          <input
            type="text"
            inputMode="decimal"
            pattern="[0-9]*[.]?[0-9]*"
            autoComplete="off"
            data-form-type="other"
            data-lpignore="true"
            data-1p-ignore="true"
            value={amount}
            onChange={(e) => {
              const value = e.target.value;
              if (value === '' || /^\d*\.?\d*$/.test(value)) {
                const numValue = parseFloat(value);
                if (!isNaN(numValue) && numValue > maxBalance) {
                  setAmount(maxBalance.toFixed(3));
                } else {
                  setAmount(value);
                }
              }
            }}
            placeholder={!authenticated ? "LOG IN" : "0.0"}
            disabled={!authenticated}
            className={`w-full h-[56px] px-3 pr-22 bg-[#2a2a2a] rounded-[6px] text-white placeholder-gray-600 focus:outline-none border border-[#191919] text-2xl font-ibm-plex-mono ${
              !authenticated ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            style={{ WebkitAppearance: 'none', MozAppearance: 'textfield', fontFamily: 'IBM Plex Mono, monospace', letterSpacing: '0em' }}
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            <button
              onClick={handleMaxClick}
              className="px-2 h-7 rounded hover:bg-[#404040] transition cursor-pointer text-xs text-[#AFAFAF] font-medium"
            >
              MAX
            </button>
            <button
              onClick={() => setSelectedToken(selectedToken === 'sol' ? 'zc' : 'sol')}
              className="flex items-center justify-center px-2 h-7 bg-[#333] rounded hover:bg-[#404040] transition cursor-pointer"
            >
              {selectedToken === 'sol' ? (
                <span className="text-xs text-[#AFAFAF] font-bold">SOL</span>
              ) : (
                <span className="text-xs text-[#AFAFAF] font-bold">ZC</span>
              )}
            </button>
          </div>
        </div>

        {/* Deposit Button */}
        <button
          onClick={handleDeposit}
          disabled={!amount || parseFloat(amount) <= 0 || isDepositing || !!balanceError}
          className={`h-[56px] w-[140px] px-6 rounded-[6px] font-semibold transition cursor-pointer whitespace-nowrap uppercase font-ibm-plex-mono text-md flex items-center justify-center ${
            amount && parseFloat(amount) > 0 && !balanceError && !isDepositing
              ? 'bg-[#DDDDD7]'
              : 'bg-[#414346] cursor-not-allowed'
          }`}
          style={{ color: '#161616', fontFamily: 'IBM Plex Mono, monospace', letterSpacing: '0em' }}
        >
          {isDepositing ? (
            <div className="animate-spin h-4 w-4 rounded-full border-2 border-[#161616] border-t-transparent"></div>
          ) : (
            'DEPOSIT'
          )}
        </button>
        </div>
      </div>
    </div>
  );
}
