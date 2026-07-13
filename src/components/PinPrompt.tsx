'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Lock, Key } from 'lucide-react';
import { validatePin, getRemainingPins } from '@/lib/pinStore';

interface PinPromptProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  title?: string;
  message?: string;
}

export default function PinPrompt({ open, onClose, onSuccess, title, message }: PinPromptProps) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validatePin(pin)) {
      setPin('');
      setError(false);
      onSuccess();
    } else {
      setError(true);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[110] p-4" onClick={onClose}>
      <div className="bg-white dark:bg-[#2A2522] rounded-2xl max-w-sm w-full p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-full bg-brand-secondary dark:bg-brand-muted/30">
            <Key className="h-5 w-5 text-brand dark:text-brand-secondary" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">{title || 'PIN Required'}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">{message || 'Enter a PIN to proceed'}</p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="password" inputMode="numeric" autoFocus maxLength={4} value={pin}
            onChange={e => { setPin(e.target.value.replace(/\D/g, '').slice(0, 4)); setError(false); }}
            className={cn("w-full text-center text-2xl tracking-[0.5em] px-4 py-3 rounded-lg border outline-none focus:ring-2",
              error ? "border-red-500 focus:ring-red-500 bg-red-50" : "border-slate-200 dark:border-brand-muted dark:bg-brand-dark dark:text-slate-100 focus:ring-brand"
            )} placeholder="••••" />
          {error && <p className="text-xs text-red-500 font-medium">Invalid PIN. Try another one.</p>}
          <p className="text-xs text-slate-400 dark:text-slate-500">{getRemainingPins()} PIN{getRemainingPins() !== 1 ? 's' : ''} remaining</p>
          <div className="flex gap-3 pt-1">
            <Button variant="ghost" className="flex-1" onClick={onClose} type="button">Cancel</Button>
            <Button type="submit" className="flex-1" disabled={pin.length < 4}><Lock className="h-4 w-4 mr-1" /> Confirm</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
