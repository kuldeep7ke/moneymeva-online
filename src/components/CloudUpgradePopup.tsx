'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Cloud, X, Send, Globe, Database, Shield } from 'lucide-react';

const LAST_SHOWN_KEY = 'mm_cloud_upgrade_last_shown';
const MIN_DAYS = 3;
const MAX_DAYS = 5;
const SHOW_CHANCE = 0.45;

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

export default function CloudUpgradePopup({ delay = 60000 }: { delay?: number }) {
  const [show, setShow] = useState(false);
  const shownRef = useRef(false);

  useEffect(() => {
    const check = () => {
      if (shownRef.current) return;
      if (shouldShow()) {
        shownRef.current = true;
        const randomDelay = delay + Math.random() * 15000;
        setTimeout(() => setShow(true), randomDelay);
      }
    };

    check();
    const interval = setInterval(check, 6 * 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [delay]);

  if (!show) return null;

  const dismiss = () => {
    localStorage.setItem(LAST_SHOWN_KEY, new Date().toISOString());
    setShow(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[120] p-4" onClick={dismiss}>
      <div className="bg-white dark:bg-[#2A2522] rounded-2xl max-w-md w-full p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600">
              <Cloud className="h-5 w-5 text-white" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Upgrade to Cloud</h3>
          </div>
          <button onClick={dismiss} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
            <X className="h-4 w-4 text-slate-400" />
          </button>
        </div>

        <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 leading-relaxed">
          Your data stays on-device. Want <strong>auto-backup & multi-device sync</strong>? We offer cloud plans.
        </p>

        <div className="space-y-2 mb-5">
          <div className="flex items-center gap-2.5 px-3 py-2 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <Database className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
            <span className="text-xs text-slate-700 dark:text-slate-300 font-medium">Cloud Backup & Sync</span>
            <span className="ml-auto px-1.5 py-0.5 bg-blue-600 text-white text-[10px] font-bold rounded">PAID</span>
          </div>
          <div className="flex items-center gap-2.5 px-3 py-2 bg-brand-light dark:bg-brand-muted rounded-lg">
            <Globe className="h-4 w-4 text-brand shrink-0" />
            <span className="text-xs text-slate-700 dark:text-slate-300 font-medium">WordPress Plugin</span>
          </div>
          <div className="flex items-center gap-2.5 px-3 py-2 bg-brand-light dark:bg-brand-muted rounded-lg">
            <Shield className="h-4 w-4 text-brand shrink-0" />
            <span className="text-xs text-slate-700 dark:text-slate-300 font-medium">Supabase Cloud — Full Auth & Sync</span>
          </div>
        </div>

        <div className="bg-slate-50 dark:bg-slate-800/50 px-3 py-2 rounded-lg mb-4">
          <p className="text-[11px] text-slate-500 dark:text-slate-400 text-center">
            Available on Telegram — pricing & setup details
          </p>
        </div>

        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={dismiss}>Maybe Later</Button>
          <a href="https://t.me/marathimeva" target="_blank" rel="noopener noreferrer">
            <Button size="sm" className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700">
              <Send className="h-3.5 w-3.5 mr-1" /> Contact on Telegram
            </Button>
          </a>
        </div>
      </div>
    </div>
  );
}
