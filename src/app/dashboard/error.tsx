'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();

  useEffect(() => { console.error(error); }, [error]);

  return (
    <div className="flex flex-col items-center justify-center py-20 px-6">
      <div className="bg-white dark:bg-[#2A2522] rounded-2xl border border-slate-200 dark:border-brand-muted shadow-sm p-8 max-w-sm w-full text-center">
        <div className="w-14 h-14 rounded-2xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center mx-auto mb-4">
          <svg className="h-7 w-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
        </div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">Something went wrong</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Try refreshing or go back to the dashboard.</p>
        <div className="flex items-center justify-center gap-3">
          <button onClick={reset}
            className="px-4 py-2 rounded-xl bg-brand text-white text-sm font-medium hover:bg-brand/90 transition-colors">
            Try again
          </button>
          <button onClick={() => router.push('/dashboard')}
            className="px-4 py-2 rounded-xl border border-slate-200 dark:border-brand-muted text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-brand-muted/20 transition-colors">
            Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
