'use client';

import { useEffect } from 'react';
import { BASE_PATH } from '@/lib/env';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);

  return (
    <html>
      <body className="min-h-full flex flex-col items-center justify-center bg-[#F8F6F3] dark:bg-slate-950 p-6">
        <div className="relative flex items-center justify-center mb-8">
          <img src={`${BASE_PATH}/favicon.jpg`} alt="" className="h-20 w-20 rounded-2xl shadow-lg opacity-60" />
        </div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-3">Something went wrong</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-8 text-center max-w-xs">
          A critical error occurred. Please refresh to continue.
        </p>
        <div className="flex items-center gap-3">
          <button onClick={reset}
            className="px-5 py-2.5 rounded-xl bg-brand text-white text-sm font-medium hover:bg-brand/90 transition-colors">
            Try again
          </button>
          <button onClick={() => window.location.href = `${BASE_PATH}/dashboard`}
            className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-brand-muted text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-brand-muted/20 transition-colors">
            Dashboard
          </button>
        </div>
      </body>
    </html>
  );
}
