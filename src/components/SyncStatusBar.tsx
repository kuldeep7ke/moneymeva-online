'use client';

import React, { useState, useEffect } from 'react';
import { RefreshCw, Cloud, CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { listenSyncEvents, type SyncEvent } from '@/lib/sync-notify';

export default function SyncStatusBar() {
  const [ev, setEv] = useState<SyncEvent | null>(null);

  useEffect(() => listenSyncEvents(setEv), []);

  if (!ev || ev.status === 'complete') return null;

  const isError = ev.status === 'error';
  const iconClass = isError ? 'text-red-500' : 'text-brand';

  return (
    <div className={cn(
      "fixed bottom-4 right-4 z-[100] flex items-center gap-2.5 px-4 py-2.5 rounded-xl shadow-lg border transition-all",
      isError
        ? "bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800"
        : "bg-white dark:bg-[#2A2522] border-slate-200 dark:border-brand-muted"
    )}>
      {isError ? (
        <XCircle className="h-4 w-4 text-red-500 shrink-0" />
      ) : (
        <RefreshCw className={cn("h-4 w-4 shrink-0 animate-spin", iconClass)} />
      )}
      <span className={cn(
        "text-xs font-medium",
        isError ? "text-red-700 dark:text-red-300" : "text-slate-700 dark:text-slate-300"
      )}>
        {ev.message}
      </span>
    </div>
  );
}
