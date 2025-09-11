'use client';

import { useEffect, useState } from 'react';
import { X, Copy, ExternalLink, AlertCircle, Shield, Zap, DollarSign } from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { connected, disconnect, publicKey } = useWallet();
  const [copied, setCopied] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'wallet' | 'trading' | 'claims'>('wallet');
  
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
  
  if (!isOpen) return null;
  
  const walletAddress = publicKey?.toBase58() || '';
  const shortAddress = walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : '';
  
  const handleCopy = () => {
    if (walletAddress) {
      navigator.clipboard.writeText(walletAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };
  
  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
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
        
        {/* Tabs */}
        <div className="flex border-b border-[#2A2A2A]">
          <button
            onClick={() => setSelectedTab('wallet')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors cursor-pointer ${
              selectedTab === 'wallet' 
                ? 'text-orange-500 border-b-2 border-orange-500' 
                : 'text-[#AFAFAF] hover:text-white'
            }`}
          >
            Wallet
          </button>
          <button
            onClick={() => setSelectedTab('trading')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors cursor-pointer ${
              selectedTab === 'trading' 
                ? 'text-orange-500 border-b-2 border-orange-500' 
                : 'text-[#AFAFAF] hover:text-white'
            }`}
          >
            Trading
          </button>
          <button
            onClick={() => setSelectedTab('claims')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors cursor-pointer ${
              selectedTab === 'claims' 
                ? 'text-sky-500 border-b-2 border-sky-500' 
                : 'text-[#AFAFAF] hover:text-white'
            }`}
          >
            Claims
          </button>
        </div>
        
        {/* Content */}
        <div className="p-6 max-h-[500px] overflow-y-auto">
          {selectedTab === 'wallet' && (
            <div className="space-y-4">
              {connected ? (
                <>
                  {/* Wallet Address Card */}
                  <div className="bg-gradient-to-r from-orange-500/10 to-orange-600/10 border border-orange-500/20 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-10 h-10 bg-orange-500/20 rounded-full flex items-center justify-center">
                          <span className="text-sm font-bold text-orange-500">
                            {walletAddress.slice(0, 2).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="text-xs text-[#AFAFAF]">Active Wallet</p>
                          <p className="text-sm text-white font-medium">{shortAddress}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleCopy}
                          className="p-2 hover:bg-white/5 rounded transition-colors cursor-pointer"
                          title="Copy address"
                        >
                          {copied ? (
                            <span className="text-xs text-emerald-400">Copied!</span>
                          ) : (
                            <Copy size={16} className="text-[#AFAFAF]" />
                          )}
                        </button>
                        <a 
                          href={`https://solscan.io/account/${walletAddress}?cluster=devnet`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 hover:bg-white/5 rounded transition-colors cursor-pointer"
                          title="View on Solscan"
                        >
                          <ExternalLink size={16} className="text-[#AFAFAF]" />
                        </a>
                      </div>
                    </div>
                    <button
                      onClick={() => disconnect()}
                      className="w-full mt-2 px-3 py-2 text-sm text-rose-400 hover:bg-rose-400/10 border border-rose-400/20 rounded transition-colors cursor-pointer"
                    >
                      Disconnect Wallet
                    </button>
                  </div>
                  
                  {/* Portfolio Overview */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-medium text-[#AFAFAF]">Portfolio Value</h3>
                    <div className="bg-[#121212] border border-[#2A2A2A] rounded-lg p-4">
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-2xl font-bold text-white">$142.50</span>
                        <span className="text-xs text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded">+12.5%</span>
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <svg className="h-4 w-4" viewBox="0 0 101 88" fill="none">
                              <path d="M100.48 69.3817L83.8068 86.8015C83.4444 87.1799 83.0058 87.4816 82.5185 87.6878C82.0312 87.894 81.5055 88.0003 80.9743 88H1.93563C1.55849 88 1.18957 87.8926 0.874202 87.6912C0.558829 87.4897 0.31074 87.2029 0.160416 86.8659C0.0100923 86.529 -0.0359181 86.1566 0.0280382 85.7945C0.0919944 85.4324 0.263131 85.0964 0.520422 84.8278L17.2061 67.408C17.5676 67.0306 18.0047 66.7295 18.4904 66.5234C18.9762 66.3172 19.5002 66.2104 20.0301 66.2095H99.0644C99.4415 66.2095 99.8104 66.3169 100.126 66.5183C100.441 66.7198 100.689 67.0065 100.84 67.3435C100.99 67.6804 101.036 68.0529 100.972 68.415C100.908 68.7771 100.737 69.1131 100.48 69.3817ZM83.8068 36.3032C83.4444 35.9248 83.0058 35.6231 82.5185 35.4169C82.0312 35.2108 81.5055 35.1045 80.9743 35.1048H1.93563C1.55849 35.1048 1.18957 35.2121 0.874202 35.4136C0.558829 35.6151 0.31074 35.9019 0.160416 36.2388C0.0100923 36.5758 -0.0359181 36.9482 0.0280382 37.3103C0.0919944 37.6723 0.263131 38.0083 0.520422 38.277L17.2061 55.6968C17.5676 56.0742 18.0047 56.3752 18.4904 56.5814C18.9762 56.7875 19.5002 56.8944 20.0301 56.8952H99.0644C99.4415 56.8952 99.8104 56.7879 100.126 56.5864C100.441 56.3849 100.689 56.0981 100.84 55.7612C100.99 55.4242 101.036 55.0518 100.972 54.6897C100.908 54.3277 100.737 53.9917 100.48 53.723L83.8068 36.3032ZM1.93563 21.7905H80.9743C81.5055 21.7898 82.0312 21.6835 82.5185 21.4773C83.0058 21.2712 83.4444 20.9695 83.8068 20.5911L100.48 3.17133C100.737 2.90265 100.908 2.56667 100.972 2.2046C101.036 1.84253 100.99 1.47008 100.84 1.13314C100.689 0.796193 100.441 0.509443 100.126 0.307961C99.8104 0.106479 99.4415 -0.000854492 99.0644 -0.000854492H20.0301C19.5002 -0.00013126 18.9762 0.106791 18.4904 0.312929C18.0047 0.519068 17.5676 0.820087 17.2061 1.19754L0.524723 18.6173C0.267481 18.8859 0.0963642 19.2219 0.0323936 19.584C-0.0315771 19.946 0.0144792 20.3184 0.164862 20.6554C0.315245 20.9923 0.563347 21.2791 0.878727 21.4806C1.19411 21.682 1.56303 21.7894 1.94013 21.7896L1.93563 21.7905Z" fill="#AFAFAF"/>
                            </svg>
                            <span className="text-sm text-white">Solana</span>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-white">5 SOL</p>
                            <p className="text-xs text-[#AFAFAF]">≈ $137.50</p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-white">$oogway</span>
                          <div className="text-right">
                            <p className="text-sm text-white">5 $oogway</p>
                            <p className="text-xs text-[#AFAFAF]">≈ $5.00</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Active Positions */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-medium text-[#AFAFAF]">Active Positions</h3>
                    <div className="bg-[#121212] border border-[#2A2A2A] rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-[#AFAFAF]">Pass Tokens</span>
                        <span className="text-xs text-emerald-400">2 positions</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-[#AFAFAF]">Fail Tokens</span>
                        <span className="text-xs text-rose-400">1 position</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-[#AFAFAF]">Total P&L</span>
                        <span className="text-xs text-emerald-400">+$24.50</span>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="bg-[#121212] border border-[#2A2A2A] rounded-lg p-8 text-center">
                  <div className="w-16 h-16 bg-orange-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Shield className="w-8 h-8 text-orange-500" />
                  </div>
                  <h3 className="text-lg font-medium text-white mb-2">Connect Your Wallet</h3>
                  <p className="text-sm text-[#AFAFAF] mb-4">Connect your Solana wallet to start trading prediction markets</p>
                  <WalletMultiButton className="!bg-orange-500 hover:!bg-orange-600 !h-10 !text-sm !font-medium !w-full" />
                </div>
              )}
            </div>
          )}
          
          {selectedTab === 'trading' && (
            <div className="space-y-4">
              <div className="bg-[#121212] border border-[#2A2A2A] rounded-lg p-4">
                <h3 className="text-sm font-medium text-white mb-3">Trading Preferences</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Zap size={16} className="text-orange-500" />
                      <span className="text-sm text-[#AFAFAF]">Max Slippage</span>
                    </div>
                    <select className="bg-[#181818] border border-[#2A2A2A] rounded px-2 py-1 text-sm text-white cursor-pointer">
                      <option>0.5%</option>
                      <option>1%</option>
                      <option>2%</option>
                      <option>5%</option>
                    </select>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <DollarSign size={16} className="text-orange-500" />
                      <span className="text-sm text-[#AFAFAF]">Default Amount</span>
                    </div>
                    <input 
                      type="text" 
                      className="bg-[#181818] border border-[#2A2A2A] rounded px-2 py-1 text-sm text-white w-20 text-right"
                      defaultValue="1"
                    />
                  </div>
                </div>
              </div>
              
              <div className="bg-[#121212] border border-[#2A2A2A] rounded-lg p-4">
                <h3 className="text-sm font-medium text-white mb-3">Transaction Settings</h3>
                <div className="space-y-3">
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-sm text-[#AFAFAF]">Auto-approve transactions</span>
                    <input type="checkbox" className="w-4 h-4 accent-orange-500 cursor-pointer" />
                  </label>
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-sm text-[#AFAFAF]">Show gas estimates</span>
                    <input type="checkbox" className="w-4 h-4 accent-orange-500 cursor-pointer" defaultChecked />
                  </label>
                </div>
              </div>
            </div>
          )}
          
          {selectedTab === 'claims' && (
            <div className="space-y-4">
              {/* Claims header */}
              <h3 className="text-sm font-medium text-[#AFAFAF] mb-4">Payouts</h3>
              
              {/* Claims table */}
              <div className="bg-[#121212] border border-[#2A2A2A] rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#2A2A2A]">
                      <th className="text-left text-xs text-[#AFAFAF] font-medium p-3">Proposal</th>
                      <th className="text-right text-xs text-[#AFAFAF] font-medium p-3 w-fit whitespace-nowrap">Status</th>
                      <th className="text-right text-xs text-[#AFAFAF] font-medium p-3 w-fit whitespace-nowrap">Payout</th>
                      <th className="text-right text-xs text-[#AFAFAF] font-medium p-3 w-fit whitespace-nowrap">Claim</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Example claim rows */}
                    <tr className="border-b border-[#2A2A2A]/50">
                      <td className="p-3 w-full max-w-0">
                        <div className="overflow-hidden">
                          <p className="text-sm text-white truncate whitespace-nowrap">Bitcoin ETF approval by SEC?</p>
                        </div>
                      </td>
                      <td className="p-3 text-right whitespace-nowrap">
                        <span className="text-xs text-emerald-400 bg-emerald-400/20 px-2 py-1 rounded-full inline-flex items-center gap-1">
                          Passed
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                        </span>
                      </td>
                      <td className="p-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <span className="text-sm text-white font-medium">42.5</span>
                          <span className="text-xs text-[#AFAFAF] font-bold">$oogway</span>
                        </div>
                      </td>
                      <td className="p-3 text-right whitespace-nowrap">
                        <button className="px-3 py-1.5 bg-sky-500 hover:bg-sky-600 text-[#181818] text-xs font-semibold rounded transition-colors cursor-pointer">
                          Claim
                        </button>
                      </td>
                    </tr>
                    
                    <tr className="border-b border-[#2A2A2A]/50">
                      <td className="p-3 w-full max-w-0">
                        <div className="overflow-hidden">
                          <p className="text-sm text-white truncate whitespace-nowrap">Fed rate cut in Q1 2024?</p>
                        </div>
                      </td>
                      <td className="p-3 text-right whitespace-nowrap">
                        <span className="text-xs text-rose-400 bg-rose-400/20 px-2 py-1 rounded-full inline-flex items-center gap-1">
                          Failed
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                          </svg>
                        </span>
                      </td>
                      <td className="p-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <span className="text-sm text-white font-medium">18.2</span>
                          <svg className="h-3 w-3 text-[#AFAFAF]" viewBox="0 0 101 88" fill="none">
                            <path d="M100.48 69.3817L83.8068 86.8015C83.4444 87.1799 83.0058 87.4816 82.5185 87.6878C82.0312 87.894 81.5055 88.0003 80.9743 88H1.93563C1.55849 88 1.18957 87.8926 0.874202 87.6912C0.558829 87.4897 0.31074 87.2029 0.160416 86.8659C0.0100923 86.529 -0.0359181 86.1566 0.0280382 85.7945C0.0919944 85.4324 0.263131 85.0964 0.520422 84.8278L17.2061 67.408C17.5676 67.0306 18.0047 66.7295 18.4904 66.5234C18.9762 66.3172 19.5002 66.2104 20.0301 66.2095H99.0644C99.4415 66.2095 99.8104 66.3169 100.126 66.5183C100.441 66.7198 100.689 67.0065 100.84 67.3435C100.99 67.6804 101.036 68.0529 100.972 68.415C100.908 68.7771 100.737 69.1131 100.48 69.3817ZM83.8068 36.3032C83.4444 35.9248 83.0058 35.6231 82.5185 35.4169C82.0312 35.2108 81.5055 35.1045 80.9743 35.1048H1.93563C1.55849 35.1048 1.18957 35.2121 0.874202 35.4136C0.558829 35.6151 0.31074 35.9019 0.160416 36.2388C0.0100923 36.5758 -0.0359181 36.9482 0.0280382 37.3103C0.0919944 37.6723 0.263131 38.0083 0.520422 38.277L17.2061 55.6968C17.5676 56.0742 18.0047 56.3752 18.4904 56.5814C18.9762 56.7875 19.5002 56.8944 20.0301 56.8952H99.0644C99.4415 56.8952 99.8104 56.7879 100.126 56.5864C100.441 56.3849 100.689 56.0981 100.84 55.7612C100.99 55.4242 101.036 55.0518 100.972 54.6897C100.908 54.3277 100.737 53.9917 100.48 53.723L83.8068 36.3032ZM1.93563 21.7905H80.9743C81.5055 21.7898 82.0312 21.6835 82.5185 21.4773C83.0058 21.2712 83.4444 20.9695 83.8068 20.5911L100.48 3.17133C100.737 2.90265 100.908 2.56667 100.972 2.2046C101.036 1.84253 100.99 1.47008 100.84 1.13314C100.689 0.796193 100.441 0.509443 100.126 0.307961C99.8104 0.106479 99.4415 -0.000854492 99.0644 -0.000854492H20.0301C19.5002 -0.00013126 18.9762 0.106791 18.4904 0.312929C18.0047 0.519068 17.5676 0.820087 17.2061 1.19754L0.524723 18.6173C0.267481 18.8859 0.0963642 19.2219 0.0323936 19.584C-0.0315771 19.946 0.0144792 20.3184 0.164862 20.6554C0.315245 20.9923 0.563347 21.2791 0.878727 21.4806C1.19411 21.682 1.56303 21.7894 1.94013 21.7896L1.93563 21.7905Z" fill="currentColor"/>
                          </svg>
                        </div>
                      </td>
                      <td className="p-3 text-right whitespace-nowrap">
                        <button className="px-3 py-1.5 bg-sky-500 hover:bg-sky-600 text-[#181818] text-xs font-semibold rounded transition-colors cursor-pointer">
                          Claim
                        </button>
                      </td>
                    </tr>
                    
                    <tr>
                      <td className="p-3 w-full max-w-0">
                        <div className="overflow-hidden">
                          <p className="text-sm text-white truncate whitespace-nowrap">Ethereum merge success?</p>
                        </div>
                      </td>
                      <td className="p-3 text-right whitespace-nowrap">
                        <span className="text-xs text-emerald-400 bg-emerald-400/20 px-2 py-1 rounded-full inline-flex items-center gap-1">
                          Passed
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                        </span>
                      </td>
                      <td className="p-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <span className="text-sm text-white font-medium">125.0</span>
                          <span className="text-xs text-[#AFAFAF] font-bold">$oogway</span>
                        </div>
                      </td>
                      <td className="p-3 text-right whitespace-nowrap">
                        <button className="px-3 py-1.5 bg-sky-500 hover:bg-sky-600 text-[#181818] text-xs font-semibold rounded transition-colors cursor-pointer">
                          Claim
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              
              {/* Total */}
              <div className="bg-gradient-to-r from-sky-500/10 to-sky-600/10 border border-sky-500/20 rounded-lg p-4">
                <div>
                  <p className="text-xs text-[#AFAFAF] mb-3">Total</p>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold text-white">185.7</span>
                        <span className="text-sm text-[#AFAFAF] font-bold">$oogway</span>
                      </div>
                      <button className="px-4 py-1.5 bg-sky-500 hover:bg-sky-600 text-[#181818] text-sm font-semibold rounded transition-colors cursor-pointer flex items-center justify-center gap-1">
                        Claim
                        <span className="font-bold">$oogway</span>
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold text-white">18.2</span>
                        <svg className="h-3.5 w-3.5 text-[#AFAFAF]" viewBox="0 0 101 88" fill="none">
                          <path d="M100.48 69.3817L83.8068 86.8015C83.4444 87.1799 83.0058 87.4816 82.5185 87.6878C82.0312 87.894 81.5055 88.0003 80.9743 88H1.93563C1.55849 88 1.18957 87.8926 0.874202 87.6912C0.558829 87.4897 0.31074 87.2029 0.160416 86.8659C0.0100923 86.529 -0.0359181 86.1566 0.0280382 85.7945C0.0919944 85.4324 0.263131 85.0964 0.520422 84.8278L17.2061 67.408C17.5676 67.0306 18.0047 66.7295 18.4904 66.5234C18.9762 66.3172 19.5002 66.2104 20.0301 66.2095H99.0644C99.4415 66.2095 99.8104 66.3169 100.126 66.5183C100.441 66.7198 100.689 67.0065 100.84 67.3435C100.99 67.6804 101.036 68.0529 100.972 68.415C100.908 68.7771 100.737 69.1131 100.48 69.3817ZM83.8068 36.3032C83.4444 35.9248 83.0058 35.6231 82.5185 35.4169C82.0312 35.2108 81.5055 35.1045 80.9743 35.1048H1.93563C1.55849 35.1048 1.18957 35.2121 0.874202 35.4136C0.558829 35.6151 0.31074 35.9019 0.160416 36.2388C0.0100923 36.5758 -0.0359181 36.9482 0.0280382 37.3103C0.0919944 37.6723 0.263131 38.0083 0.520422 38.277L17.2061 55.6968C17.5676 56.0742 18.0047 56.3752 18.4904 56.5814C18.9762 56.7875 19.5002 56.8944 20.0301 56.8952H99.0644C99.4415 56.8952 99.8104 56.7879 100.126 56.5864C100.441 56.3849 100.689 56.0981 100.84 55.7612C100.99 55.4242 101.036 55.0518 100.972 54.6897C100.908 54.3277 100.737 53.9917 100.48 53.723L83.8068 36.3032ZM1.93563 21.7905H80.9743C81.5055 21.7898 82.0312 21.6835 82.5185 21.4773C83.0058 21.2712 83.4444 20.9695 83.8068 20.5911L100.48 3.17133C100.737 2.90265 100.908 2.56667 100.972 2.2046C101.036 1.84253 100.99 1.47008 100.84 1.13314C100.689 0.796193 100.441 0.509443 100.126 0.307961C99.8104 0.106479 99.4415 -0.000854492 99.0644 -0.000854492H20.0301C19.5002 -0.00013126 18.9762 0.106791 18.4904 0.312929C18.0047 0.519068 17.5676 0.820087 17.2061 1.19754L0.524723 18.6173C0.267481 18.8859 0.0963642 19.2219 0.0323936 19.584C -0.0315771 19.946 0.0144792 20.3184 0.164862 20.6554C0.315245 20.9923 0.563347 21.2791 0.878727 21.4806C1.19411 21.682 1.56303 21.7894 1.94013 21.7896L1.93563 21.7905Z" fill="currentColor"/>
                        </svg>
                      </div>
                      <button className="px-4 py-1.5 bg-sky-500 hover:bg-sky-600 text-[#181818] text-sm font-semibold rounded transition-colors cursor-pointer flex items-center justify-center gap-1">
                        Claim
                        <svg className="h-3.5 w-3.5" viewBox="0 0 101 88" fill="none">
                          <path d="M100.48 69.3817L83.8068 86.8015C83.4444 87.1799 83.0058 87.4816 82.5185 87.6878C82.0312 87.894 81.5055 88.0003 80.9743 88H1.93563C1.55849 88 1.18957 87.8926 0.874202 87.6912C0.558829 87.4897 0.31074 87.2029 0.160416 86.8659C0.0100923 86.529 -0.0359181 86.1566 0.0280382 85.7945C0.0919944 85.4324 0.263131 85.0964 0.520422 84.8278L17.2061 67.408C17.5676 67.0306 18.0047 66.7295 18.4904 66.5234C18.9762 66.3172 19.5002 66.2104 20.0301 66.2095H99.0644C99.4415 66.2095 99.8104 66.3169 100.126 66.5183C100.441 66.7198 100.689 67.0065 100.84 67.3435C100.99 67.6804 101.036 68.0529 100.972 68.415C100.908 68.7771 100.737 69.1131 100.48 69.3817ZM83.8068 36.3032C83.4444 35.9248 83.0058 35.6231 82.5185 35.4169C82.0312 35.2108 81.5055 35.1045 80.9743 35.1048H1.93563C1.55849 35.1048 1.18957 35.2121 0.874202 35.4136C0.558829 35.6151 0.31074 35.9019 0.160416 36.2388C0.0100923 36.5758 -0.0359181 36.9482 0.0280382 37.3103C0.0919944 37.6723 0.263131 38.0083 0.520422 38.277L17.2061 55.6968C17.5676 56.0742 18.0047 56.3752 18.4904 56.5814C18.9762 56.7875 19.5002 56.8944 20.0301 56.8952H99.0644C99.4415 56.8952 99.8104 56.7879 100.126 56.5864C100.441 56.3849 100.689 56.0981 100.84 55.7612C100.99 55.4242 101.036 55.0518 100.972 54.6897C100.908 54.3277 100.737 53.9917 100.48 53.723L83.8068 36.3032ZM1.93563 21.7905H80.9743C81.5055 21.7898 82.0312 21.6835 82.5185 21.4773C83.0058 21.2712 83.4444 20.9695 83.8068 20.5911L100.48 3.17133C100.737 2.90265 100.908 2.56667 100.972 2.2046C101.036 1.84253 100.99 1.47008 100.84 1.13314C100.689 0.796193 100.441 0.509443 100.126 0.307961C99.8104 0.106479 99.4415 -0.000854492 99.0644 -0.000854492H20.0301C19.5002 -0.00013126 18.9762 0.106791 18.4904 0.312929C18.0047 0.519068 17.5676 0.820087 17.2061 1.19754L0.524723 18.6173C0.267481 18.8859 0.0963642 19.2219 0.0323936 19.584C -0.0315771 19.946 0.0144792 20.3184 0.164862 20.6554C0.315245 20.9923 0.563347 21.2791 0.878727 21.4806C1.19411 21.682 1.56303 21.7894 1.94013 21.7896L1.93563 21.7905Z" fill="currentColor"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}