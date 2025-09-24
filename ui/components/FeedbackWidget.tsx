'use client';

import { FeedbackFish } from '@feedback-fish/react';
import { usePrivyWallet } from '@/hooks/usePrivyWallet';

export default function FeedbackWidget() {
  const { walletAddress } = usePrivyWallet();

  const FEEDBACK_FISH_PROJECT_ID = process.env.NEXT_PUBLIC_FEEDBACK_FISH_PROJECT_ID || '5391a511d6a890';

  return (
    <FeedbackFish
      projectId={FEEDBACK_FISH_PROJECT_ID}
      userId={walletAddress || undefined}
      metadata={{
        walletAddress: walletAddress || 'not-connected',
        url: typeof window !== 'undefined' ? window.location.href : '',
        timestamp: new Date().toISOString()
      }}
    >
      <button
        className="fixed bottom-6 right-6 w-14 h-14 text-white rounded-full shadow-lg transition-all hover:scale-110 flex items-center justify-center z-40 cursor-pointer"
        style={{ backgroundColor: '#ef6400' }}
        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#d75700'}
        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ef6400'}
        title="Send feedback"
      >
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
          />
        </svg>
      </button>
    </FeedbackFish>
  );
}