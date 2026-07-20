'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function NotFound() {
  const router = useRouter();

  useEffect(() => {
    const t = setTimeout(() => router.push('/dashboard'), 4000);
    return () => clearTimeout(t);
  }, [router]);

  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-[#F8F6F3] dark:bg-slate-950 p-6">
      <div className="relative flex items-center justify-center mb-8">
        <img src="/favicon.jpg" alt="" className="h-20 w-20 rounded-2xl shadow-lg opacity-60" />
      </div>
      <h1 className="text-5xl font-bold text-slate-800 dark:text-slate-100 mb-3">404</h1>
      <p className="text-base text-slate-500 dark:text-slate-400 mb-6 text-center max-w-xs">
        This page doesn&apos;t exist or was moved.
      </p>
      <p className="text-sm text-slate-400 dark:text-slate-500">Redirecting to dashboard…</p>
    </div>
  );
}
