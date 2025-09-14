'use client';

import { useState } from 'react';
import SettingsModal from './SettingsModal';

interface HeaderProps {
  walletAddress: string | null;
  authenticated: boolean;
  solBalance: number;
  oogwayBalance: number;
}

export default function Header({ walletAddress, authenticated, solBalance, oogwayBalance }: HeaderProps) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  const shortAddress = walletAddress ? walletAddress.slice(0, 6) : 'CONNECT WALLET';
  const avatarText = walletAddress ? walletAddress.slice(0, 2).toUpperCase() : '??';

  return (
    <>
      <div className="h-14 flex items-center justify-between px-8 bg-[#181818] border-b border-[#2A2A2A]">
        <div className="flex items-center gap-6">
          <img 
            src="/percent-logo-big.svg" 
            alt="percent.markets" 
            className="h-8"
          />
          <div className="flex items-center gap-2">
            <a 
              href="https://x.com/percentmarkets" 
              target="_blank" 
              rel="noopener noreferrer"
              className="w-7 h-7 bg-[#272727] hover:bg-[#303030] rounded-md transition-colors mb-0.5 flex items-center justify-center"
            >
              <svg className="h-3.5 w-3.5 fill-[#AFAFAF]" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
            </a>
            <a 
              href="https://discord.gg/your-discord" 
              target="_blank" 
              rel="noopener noreferrer"
              className="w-7 h-7 bg-[#272727] hover:bg-[#303030] rounded-md transition-colors mb-0.5 flex items-center justify-center"
            >
              <svg className="h-4 w-4 fill-[#AFAFAF]" viewBox="0 0 24 24">
                <path d="M19.27 5.33C17.94 4.71 16.5 4.26 15 4a.09.09 0 0 0-.07.03c-.18.33-.39.76-.53 1.09a16.09 16.09 0 0 0-4.8 0c-.14-.34-.35-.76-.54-1.09c-.01-.02-.04-.03-.07-.03c-1.5.26-2.93.71-4.27 1.33c-.01 0-.02.01-.03.02c-2.72 4.07-3.47 8.03-3.1 11.95c0 .02.01.04.03.05c1.8 1.32 3.53 2.12 5.24 2.65c.03.01.06 0 .07-.02c.4-.55.76-1.13 1.07-1.74c.02-.04 0-.08-.04-.09c-.57-.22-1.11-.48-1.64-.78c-.04-.02-.04-.08-.01-.11c.11-.08.22-.17.33-.25c.02-.02.05-.02.07-.01c3.44 1.57 7.15 1.57 10.55 0c.02-.01.05-.01.07.01c.11.09.22.17.33.25c.04.03.04.09-.01.11c-.52.31-1.07.56-1.64.78c-.04.01-.05.06-.04.09c.32.61.68 1.19 1.07 1.74c.02.03.05.03.07.02c1.72-.53 3.45-1.33 5.25-2.65c.02-.01.03-.03.03-.05c.44-4.53-.73-8.46-3.1-11.95c-.01-.01-.02-.02-.04-.02zM8.52 14.91c-1.03 0-1.89-.95-1.89-2.12s.84-2.12 1.89-2.12c1.06 0 1.9.96 1.89 2.12c0 1.17-.84 2.12-1.89 2.12zm6.97 0c-1.03 0-1.89-.95-1.89-2.12s.84-2.12 1.89-2.12c1.06 0 1.9.96 1.89 2.12c0 1.17-.83 2.12-1.89 2.12z"/>
              </svg>
            </a>
            <a 
              href="https://axiom.trade/meme/2FCqTyvFcE4uXgRL1yh56riZ9vdjVgoP6yknZW3f8afX" 
              target="_blank" 
              rel="noopener noreferrer"
              className="px-2 h-7 bg-[#272727] hover:bg-[#303030] rounded-md transition-colors mb-0.5 flex items-center justify-center"
            >
              <span className="text-xs text-[#AFAFAF] font-bold">$oogway</span>
            </a>
          </div>
        </div>
        
        {/* Wallet Info - Only show when authenticated */}
        {authenticated && (
          <div className="flex items-center gap-2.5">
            {/* SOL Balance */}
            <div className="flex items-center gap-1.5">
              <span className="text-sm text-[#AFAFAF]">{solBalance.toFixed(3)}</span>
              <svg className="h-3 w-3" viewBox="0 0 101 88" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M100.48 69.3817L83.8068 86.8015C83.4444 87.1799 83.0058 87.4816 82.5185 87.6878C82.0312 87.894 81.5055 88.0003 80.9743 88H1.93563C1.55849 88 1.18957 87.8926 0.874202 87.6912C0.558829 87.4897 0.31074 87.2029 0.160416 86.8659C0.0100923 86.529 -0.0359181 86.1566 0.0280382 85.7945C0.0919944 85.4324 0.263131 85.0964 0.520422 84.8278L17.2061 67.408C17.5676 67.0306 18.0047 66.7295 18.4904 66.5234C18.9762 66.3172 19.5002 66.2104 20.0301 66.2095H99.0644C99.4415 66.2095 99.8104 66.3169 100.126 66.5183C100.441 66.7198 100.689 67.0065 100.84 67.3435C100.99 67.6804 101.036 68.0529 100.972 68.415C100.908 68.7771 100.737 69.1131 100.48 69.3817ZM83.8068 36.3032C83.4444 35.9248 83.0058 35.6231 82.5185 35.4169C82.0312 35.2108 81.5055 35.1045 80.9743 35.1048H1.93563C1.55849 35.1048 1.18957 35.2121 0.874202 35.4136C0.558829 35.6151 0.31074 35.9019 0.160416 36.2388C0.0100923 36.5758 -0.0359181 36.9482 0.0280382 37.3103C0.0919944 37.6723 0.263131 38.0083 0.520422 38.277L17.2061 55.6968C17.5676 56.0742 18.0047 56.3752 18.4904 56.5814C18.9762 56.7875 19.5002 56.8944 20.0301 56.8952H99.0644C99.4415 56.8952 99.8104 56.7879 100.126 56.5864C100.441 56.3849 100.689 56.0981 100.84 55.7612C100.99 55.4242 101.036 55.0518 100.972 54.6897C100.908 54.3277 100.737 53.9917 100.48 53.723L83.8068 36.3032ZM1.93563 21.7905H80.9743C81.5055 21.7898 82.0312 21.6835 82.5185 21.4773C83.0058 21.2712 83.4444 20.9695 83.8068 20.5911L100.48 3.17133C100.737 2.90265 100.908 2.56667 100.972 2.2046C101.036 1.84253 100.99 1.47008 100.84 1.13314C100.689 0.796193 100.441 0.509443 100.126 0.307961C99.8104 0.106479 99.4415 -0.000854492 99.0644 -0.000854492H20.0301C19.5002 -0.00013126 18.9762 0.106791 18.4904 0.312929C18.0047 0.519068 17.5676 0.820087 17.2061 1.19754L0.524723 18.6173C0.267481 18.8859 0.0963642 19.2219 0.0323936 19.584C-0.0315771 19.946 0.0144792 20.3184 0.164862 20.6554C0.315245 20.9923 0.563347 21.2791 0.878727 21.4806C1.19411 21.682 1.56303 21.7894 1.94013 21.7896L1.93563 21.7905Z" fill="#AFAFAF"/>
              </svg>
            </div>
            
            {/* Divider */}
            <div className="w-px h-4 bg-[#3D3D3D]"></div>
            
            {/* $oogway Balance */}
            <div className="flex items-center gap-1.5">
              <span className="text-sm text-[#AFAFAF]">{oogwayBalance.toFixed(3)}</span>
              <span className="text-sm text-[#AFAFAF] font-bold">$oogway</span>
            </div>
            
            {/* Divider */}
            <div className="w-px h-4 bg-[#3D3D3D]"></div>
            
            {/* Wallet Button */}
            <button 
              onClick={() => setIsSettingsOpen(true)}
              className="group flex items-center gap-2 transition cursor-pointer"
            >
              <span className="text-sm text-[#AFAFAF] group-hover:text-orange-400 transition-colors">{shortAddress}</span>
              <div className="w-8 h-8 bg-[#272727] group-hover:bg-[#303030] rounded-full flex items-center justify-center transition-colors">
                <span className="text-xs font-medium text-[#AFAFAF] group-hover:text-orange-400 transition-colors">{avatarText}</span>
              </div>
            </button>
          </div>
        )}
      </div>
      
      {/* Settings Modal */}
      <SettingsModal 
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </>
  );
}