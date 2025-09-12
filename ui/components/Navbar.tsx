'use client';

import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { TrendingUp } from 'lucide-react';

export default function Navbar() {
  return (
    <nav className="bg-gray-900 border-b border-gray-800">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-2">
            <TrendingUp className="h-8 w-8 text-[#4CBBF4]" />
            <span className="text-white text-xl font-bold">Prediction Market</span>
          </div>
          
          <WalletMultiButton className="!bg-[#4CBBF4] hover:!bg-[#3CA5D8]" />
        </div>
      </div>
    </nav>
  );
}