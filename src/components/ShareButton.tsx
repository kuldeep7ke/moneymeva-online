'use client';

import { Share2 } from 'lucide-react';
import { useState } from 'react';
import { copyText } from '@/lib/download';

const SHARE_URL = typeof window !== 'undefined' ? window.location.origin : 'https://money-meva.app';

export default function ShareButton({ variant = 'default', className = '' }: { variant?: 'default' | 'icon'; className?: string }) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const shareData = {
      title: 'Money Meva',
      text: 'Track expenses, watch savings grow, and see where your investments are headed — all wrapped in a minimalist canvas. Built for Indian wallets.',
      url: SHARE_URL,
    };

    if (navigator.share) {
      try { await navigator.share(shareData); return; } catch { /* user cancelled */ }
    }
    try {
      copyText(SHARE_URL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard unavailable */ }
  };

  if (variant === 'icon') {
    return (
      <button onClick={handleShare} className={`p-2 rounded-full hover:bg-brand/10 text-slate-400 hover:text-brand transition-colors ${className}`} title="Share Money Meva">
        {copied ? <span className="text-[10px] font-semibold text-brand">Copied!</span> : <Share2 className="h-4 w-4" />}
      </button>
    );
  }

  return (
    <button onClick={handleShare} className={`flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-brand transition-colors ${className}`}>
      {copied ? 'Link copied!' : <><Share2 className="h-3.5 w-3.5" /> Share</>}
    </button>
  );
}
