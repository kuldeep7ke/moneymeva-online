'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Download, X, Wifi, Zap, Shield, Smartphone } from 'lucide-react';

const LAST_SHOWN_KEY = 'mm_install_prompt_last_shown';
const MIN_DAYS = 4;
const MAX_DAYS = 7;
const SHOW_CHANCE = 0.4;

function shouldShow(): boolean {
  if (typeof window === 'undefined') return false;
  if ((window as any).Capacitor?.isNativePlatform?.()) return false;
  if (window.matchMedia('(display-mode: standalone)').matches) return false;
  if ((window.navigator as any).standalone) return false;
  if (Math.random() > SHOW_CHANCE) return false;
  const lastShown = localStorage.getItem(LAST_SHOWN_KEY);
  if (!lastShown) return true;
  const last = new Date(lastShown).getTime();
  const now = Date.now();
  const daysSince = (now - last) / (1000 * 60 * 60 * 24);
  const randomDays = MIN_DAYS + Math.random() * (MAX_DAYS - MIN_DAYS);
  return daysSince >= randomDays;
}

export default function InstallPrompt({ delay = 30000 }: { delay?: number }) {
  const [show, setShow] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const shownRef = useRef(false);

  useEffect(() => {
    const check = () => {
      if (shownRef.current) return;
      if (shouldShow()) {
        shownRef.current = true;
        const randomDelay = delay + Math.random() * 10000;
        setTimeout(() => setShow(true), randomDelay);
      }
    };

    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      check();
    };

    window.addEventListener('beforeinstallprompt', handler);
    check();
    const interval = setInterval(check, 6 * 60 * 60 * 1000);
    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      clearInterval(interval);
    };
  }, [delay]);

  if (!show) return null;

  const dismiss = () => {
    localStorage.setItem(LAST_SHOWN_KEY, new Date().toISOString());
    setShow(false);
  };

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        localStorage.setItem(LAST_SHOWN_KEY, new Date().toISOString());
        setShow(false);
      }
      setDeferredPrompt(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[120] p-4" onClick={dismiss}>
      <div className="bg-white dark:bg-[#2A2522] rounded-2xl max-w-md w-full p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-brand-secondary dark:bg-brand-muted/30">
              <Download className="h-5 w-5 text-brand dark:text-brand-secondary" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Install Money Meva</h3>
          </div>
          <button onClick={dismiss} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
            <X className="h-4 w-4 text-slate-400" />
          </button>
        </div>

        <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
          Install Money Meva for a native app experience — faster access, works offline, more secure.
        </p>

        <div className="grid grid-cols-2 gap-2 mb-5">
          <div className="flex items-center gap-2 px-3 py-2 bg-brand-light dark:bg-brand-muted rounded-lg">
            <Zap className="h-3.5 w-3.5 text-brand shrink-0" />
            <span className="text-xs text-slate-600 dark:text-slate-400">Faster Access</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 bg-brand-light dark:bg-brand-muted rounded-lg">
            <Wifi className="h-3.5 w-3.5 text-brand shrink-0" />
            <span className="text-xs text-slate-600 dark:text-slate-400">Works Offline</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 bg-brand-light dark:bg-brand-muted rounded-lg">
            <Shield className="h-3.5 w-3.5 text-brand shrink-0" />
            <span className="text-xs text-slate-600 dark:text-slate-400">More Secure</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 bg-brand-light dark:bg-brand-muted rounded-lg">
            <Smartphone className="h-3.5 w-3.5 text-brand shrink-0" />
            <span className="text-xs text-slate-600 dark:text-slate-400">Native App Feel</span>
          </div>
        </div>

        <div className="bg-slate-50 dark:bg-slate-800/50 px-3 py-2 rounded-lg mb-4">
          <p className="text-[11px] text-slate-500 dark:text-slate-400 text-center">
            Click <span className="inline-flex items-center mx-0.5 px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 rounded text-[10px] font-medium">⬇️ Install</span> in the address bar or browser menu
          </p>
        </div>

        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={dismiss}>Maybe Later</Button>
          <Button size="sm" onClick={handleInstall}>
            <Download className="h-3.5 w-3.5 mr-1" /> Install App
          </Button>
        </div>
      </div>
    </div>
  );
}
