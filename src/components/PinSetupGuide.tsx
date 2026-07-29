'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Key, Shield, Clock, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface PinSetupGuideProps {
  open: boolean;
  onClose: () => void;
  action: string;
}

export default function PinSetupGuide({ open, onClose, action }: PinSetupGuideProps) {
  const router = useRouter();

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[120] p-4">
      <div className="bg-white dark:bg-[#2A2522] rounded-2xl max-w-md w-full shadow-2xl border border-brand/20 overflow-hidden">
        <div className="bg-gradient-to-r from-brand to-orange-600 px-6 py-5 text-center">
          <div className="mx-auto w-14 h-14 rounded-full bg-white/20 flex items-center justify-center mb-3">
            <Shield className="h-7 w-7 text-white" />
          </div>
          <h3 className="text-xl font-bold text-white">Security Feature Required</h3>
          <p className="text-sm text-orange-100 mt-1">Set up PINs to unlock this action</p>
        </div>
        <div className="p-6 space-y-5">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            <strong>{action}</strong> requires a PIN for security. PINs are part of Money Meva's safety features designed to protect your financial data.
          </p>

          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 bg-brand-light dark:bg-brand-muted/20 rounded-xl">
              <Key className="h-5 w-5 text-brand shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Access PINs</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">One-time PINs for sensitive actions — archiving, restoring, editing, and more. Each PIN is used once, then the cycle restarts.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-brand-light dark:bg-brand-muted/20 rounded-xl">
              <Clock className="h-5 w-5 text-brand shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Session Auto-Lock</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Automatically lock the app after inactivity. Only your PIN can unlock it — refresh, back, or address bar changes won't bypass it.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-brand-light dark:bg-brand-muted/20 rounded-xl">
              <Shield className="h-5 w-5 text-brand shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Data Safety</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Your financial data stays on your device. PINs and session lock add an extra layer of protection so only you can access or modify it.</p>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={onClose}>Not Now</Button>
            <Button size="sm" className="gap-1.5" onClick={() => { onClose(); router.push('/dashboard/settings'); }}>
              Set Up PINs <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
