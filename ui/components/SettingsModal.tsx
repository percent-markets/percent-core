'use client';

import { useEffect, useState, useCallback } from 'react';
import { X, Copy, Shield, DollarSign, Key } from 'lucide-react';
import { usePrivyWallet } from '@/hooks/usePrivyWallet';
import { useSolanaWallets } from '@privy-io/react-auth/solana';
import toast from 'react-hot-toast';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  solBalance?: number;
  zcBalance?: number;
  solPrice?: number;
  zcPrice?: number;
}

export default function SettingsModal({
  isOpen,
  onClose,
  solBalance = 0,
  zcBalance = 0,
  solPrice = 0,
  zcPrice = 0
}: SettingsModalProps) {
  const { authenticated, walletAddress, logout, login } = usePrivyWallet();
  const { exportWallet } = useSolanaWallets();
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    if (walletAddress) {
      navigator.clipboard.writeText(walletAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [walletAddress]);

  // Handle escape key press
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
    }

    return () => {
      document.removeEventListener('keydown', handleEsc);
    };
  }, [isOpen, onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // Early return if modal is not open
  if (!isOpen) return null;

  // Computed values
  const shortAddress = walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : '';
  const isConnected = authenticated;
  
  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[#0a0a0a]/60 backdrop-blur-sm z-50"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-xl bg-[#181818] border border-[#2A2A2A] rounded-lg z-50">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#2A2A2A]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-orange-500/20 rounded-full flex items-center justify-center">
              <Shield className="w-4 h-4 text-orange-500" />
            </div>
            <h2 className="text-lg font-medium text-white">Account & Security</h2>
          </div>
          <button
            onClick={onClose}
            className="text-[#AFAFAF] hover:text-white transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>
        
        {/* No tabs - just border */}
        <div className="border-b border-[#2A2A2A]"></div>
        
        {/* Content */}
        <div className="p-6 max-h-[500px] overflow-y-auto">
          <div className="space-y-4">
            {isConnected ? (
              <>
                {/* Wallet Address Card */}
                <div className="bg-gradient-to-r from-orange-500/10 to-orange-600/10 border border-orange-500/20 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 bg-orange-500/20 rounded-full flex items-center justify-center">
                        <span className="text-base font-bold text-orange-500">
                          {walletAddress?.slice(0, 2).toUpperCase() || 'NA'}
                        </span>
                      </div>
                      <p className="text-sm text-white font-medium">{shortAddress}</p>
                      <button
                        onClick={handleCopy}
                        className="p-1 hover:bg-white/5 rounded transition-colors cursor-pointer"
                        title="Copy address"
                      >
                        {copied ? (
                          <span className="text-xs text-emerald-400">Copied!</span>
                        ) : (
                          <Copy size={14} className="text-[#AFAFAF]" />
                        )}
                      </button>
                    </div>
                    {authenticated && (
                      <button
                        onClick={() => exportWallet()}
                        className="px-3 py-2 bg-orange-400 hover:bg-orange-500 text-[#181818] text-xs font-semibold rounded transition-colors cursor-pointer flex items-center gap-2"
                      >
                        <Key size={12} />
                        Export PK
                      </button>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="space-y-3">
                  <button
                    onClick={logout}
                    className="w-full px-4 py-2.5 bg-[#272727] hover:bg-[#303030] text-[#AFAFAF] hover:text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-2 border border-[#3D3D3D]"
                  >
                    <Shield size={16} />
                    Log Out
                  </button>
                </div>
              </>
            ) : (
              <div className="bg-[#121212] border border-[#2A2A2A] rounded-lg p-8 text-center">
                <div className="w-16 h-16 bg-orange-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Shield className="w-8 h-8 text-orange-500" />
                </div>
                <h3 className="text-lg font-medium text-white mb-2">Log in to access your wallet</h3>
                <p className="text-sm text-[#AFAFAF] mb-4">Connect your Solana wallet to start trading prediction markets</p>
                <button
                  onClick={() => login()}
                  className="w-full h-10 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded transition-colors cursor-pointer"
                >
                  Log In
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}