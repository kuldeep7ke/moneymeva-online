'use client';

import { useEffect, useState } from 'react';

export default function LoadingOverlay({ message = 'Loading…' }: { message?: string }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setShow(true), 100);
    return () => clearTimeout(t);
  }, []);

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-[#F8F6F3] dark:bg-slate-950">
      <div className="relative flex items-center justify-center mb-6">
        <img src="/favicon.jpg" alt="" className="h-16 w-16 rounded-2xl shadow-lg" />
        <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-emerald-500 animate-ping" />
      </div>
      <div className="flex gap-1.5 mb-4">
        {[0, 1, 2].map((i) => (
          <div key={i}
            className="h-2.5 w-2.5 rounded-full bg-slate-900 dark:bg-white animate-bounce"
            style={{ animationDelay: `${i * 0.15}s`, animationDuration: '0.8s' }}
          />
        ))}
      </div>
      <p className="text-sm font-medium text-slate-500 dark:text-slate-400 animate-pulse">{message}</p>
    </div>
  );
}
