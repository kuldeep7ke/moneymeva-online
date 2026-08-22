'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Shield, Download, Trash2, X } from 'lucide-react';
import { requestPopup, cancelPopup } from '@/lib/popup-queue';

const LAST_SHOWN_KEY = 'mm_data_safety_last_shown';
const MIN_DAYS = 2;
const MAX_DAYS = 4;
const SHOW_CHANCE = 0.5;

function shouldShow(): boolean {
  if (typeof window === 'undefined') return false;
  if (Math.random() > SHOW_CHANCE) return false;
  const lastShown = localStorage.getItem(LAST_SHOWN_KEY);
  if (!lastShown) return true;
  const last = new Date(lastShown).getTime();
  const now = Date.now();
  const daysSince = (now - last) / (1000 * 60 * 60 * 24);
  const randomDays = MIN_DAYS + Math.random() * (MAX_DAYS - MIN_DAYS);
  return daysSince >= randomDays;
}

export default function DataSafetyNotice() {
  const [show, setShow] = useState(false);
  const shownRef = useRef(false);

  useEffect(() => {
    const check = () => {
      if (shownRef.current) return;
      if (shouldShow()) {
        shownRef.current = true;
        requestPopup('data-safety', 20, () => setShow(true));
      }
    };

    check();
    const interval = setInterval(check, 6 * 60 * 60 * 1000); // check every 6 hours
    return () => {
      clearInterval(interval);
      cancelPopup('data-safety');
    };
  }, []);

  if (!show) return null;

  const dismiss = () => {
    localStorage.setItem(LAST_SHOWN_KEY, new Date().toISOString());
    cancelPopup('data-safety');
    setShow(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[120] p-4">
      <div className="bg-white dark:bg-[#2A2522] rounded-2xl max-w-md w-full p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-amber-100 dark:bg-amber-900/30">
              <Shield className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Data Safety Notice</h3>
          </div>
          <button onClick={dismiss} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
            <X className="h-4 w-4 text-slate-400" />
          </button>
        </div>

        <div className="space-y-2 mb-5">
          <div className="flex items-center gap-2.5 px-3 py-2 bg-brand-light dark:bg-brand-muted rounded-lg">
            <Shield className="h-3.5 w-3.5 text-brand shrink-0" />
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Stored <strong>locally on this device</strong> — nothing is sent to any server unless you enable <strong>Multi-Device Sync</strong>
            </p>
          </div>
          <div className="flex items-center gap-2.5 px-3 py-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
            <Download className="h-3.5 w-3.5 text-amber-600 shrink-0" />
            <p className="text-xs text-slate-600 dark:text-slate-400">
              <strong>Backup regularly</strong> from Settings → Export (weekly recommended)
            </p>
          </div>
          <div className="flex items-center gap-2.5 px-3 py-2 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <Trash2 className="h-3.5 w-3.5 text-red-500 shrink-0" />
            <p className="text-xs text-slate-600 dark:text-slate-400">
              <strong>Clearing browser data deletes everything</strong> — keep a backup first
            </p>
          </div>
        </div>

        <div className="flex justify-end">
          <Button size="sm" onClick={dismiss}>Got it</Button>
        </div>
      </div>
    </div>
  );
}
