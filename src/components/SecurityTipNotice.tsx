'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Shield, Key, Clock, X, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { hasPins, arePinsShown } from '@/lib/pinStore';

const LAST_SHOWN_KEY = 'mm_security_tip_last_shown';
const MIN_DAYS = 3;
const MAX_DAYS = 7;
const SHOW_CHANCE = 0.4;

const tips = [
  {
    icon: Key,
    title: 'Protect Your Data with PINs',
    desc: 'Set up one-time PINs to guard sensitive actions like editing entries, restoring archived items, and more.',
  },
  {
    icon: Clock,
    title: 'Auto-Lock Your Session',
    desc: 'Enable session auto-lock so the app locks after inactivity. Refresh, back, or address bar changes won\'t bypass it — only your PIN can unlock.',
  },
  {
    icon: Shield,
    title: 'Your Data Stays on Your Device',
    desc: 'All your financial data is stored locally. PINs and session lock add an extra layer of protection so only you can access or modify it.',
  },
];

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

export default function SecurityTipNotice({ delay = 10000 }: { delay?: number }) {
  const [show, setShow] = useState(false);
  const [tipIndex] = useState(() => Math.floor(Math.random() * tips.length));
  const shownRef = useRef(false);
  const router = useRouter();

  useEffect(() => {
    const check = () => {
      if (shownRef.current) return;
      if (shouldShow()) {
        shownRef.current = true;
        const randomDelay = delay + Math.random() * 8000;
        setTimeout(() => setShow(true), randomDelay);
      }
    };

    check();
    const interval = setInterval(check, 12 * 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [delay]);

  if (!show) return null;

  const tip = tips[tipIndex];
  const Icon = tip.icon;

  const dismiss = () => {
    localStorage.setItem(LAST_SHOWN_KEY, new Date().toISOString());
    setShow(false);
  };

  const alreadySetup = hasPins() && arePinsShown();

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[120] p-4">
      <div className="bg-white dark:bg-[#2A2522] rounded-2xl max-w-md w-full p-6 shadow-2xl border border-brand/10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-brand-secondary dark:bg-brand-muted/30">
              <Icon className="h-5 w-5 text-brand dark:text-brand-secondary" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">{tip.title}</h3>
          </div>
          <button onClick={dismiss} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
            <X className="h-4 w-4 text-slate-400" />
          </button>
        </div>

        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-5">
          {tip.desc}
        </p>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={dismiss}>Got it</Button>
          {!alreadySetup && (
            <Button size="sm" className="gap-1.5" onClick={() => { dismiss(); router.push('/dashboard/settings'); }}>
              Set Up Security <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
