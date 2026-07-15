'use client';

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from '@/lib/i18n';
import { languages, type Language } from '@/lib/i18n/translations';
import { Globe, Check } from 'lucide-react';

export default function LanguageSelector({ variant = 'default' }: { variant?: 'default' | 'minimal' }) {
  const { lang, setLang } = useTranslation();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const updatePos = () => {
    if (!btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    setPos({ top: r.bottom + 6, left: r.left, width: r.width });
  };

  const current = languages.find(l => l.code === lang);

  if (variant === 'minimal') {
    return (
      <div ref={containerRef} className="relative inline-flex items-center">
        <button ref={btnRef} onClick={() => setOpen(v => !v)}
          className="flex items-center gap-1.5 bg-transparent border border-slate-200/60 dark:border-brand-muted rounded-full pl-2.5 pr-3 py-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600 focus-visible:ring-2 focus-visible:ring-brand/30 cursor-pointer transition-colors"
        >
          <Globe className="h-3.5 w-3.5 text-slate-400" />
          <span>{current?.nativeName}</span>
          <svg className={`h-3 w-3 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {open && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50">
            <div className="bg-white dark:bg-[#2A2522] border border-slate-200 dark:border-brand-muted shadow-lg rounded-xl py-1.5 min-w-[140px] overflow-y-auto max-h-72">
              {languages.map(l => (
                <button key={l.code} onMouseDown={() => { setLang(l.code as Language); setOpen(false); }}
                  className={`w-full flex items-center gap-3 px-3.5 py-2 text-xs font-medium cursor-pointer ${
                    lang === l.code
                      ? 'text-brand dark:text-brand-secondary bg-brand-secondary/50 dark:bg-brand-muted/30'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-brand-muted/20'
                  }`}
                >
                  <span className="flex-1 text-left">{l.nativeName}</span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500">{l.name}</span>
                  {lang === l.code && <Check className="h-3.5 w-3.5 text-brand shrink-0" />}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="inline-block">
      <button ref={btnRef} onClick={() => { updatePos(); setOpen(v => !v); }}
        className="flex items-center gap-2 bg-white dark:bg-[#2A2522] border border-slate-200 dark:border-brand-muted rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600 focus-visible:ring-2 focus-visible:ring-brand cursor-pointer transition-colors whitespace-nowrap"
      >
        <Globe className="h-4 w-4 text-slate-400 shrink-0" />
        <span className="flex-1 text-left">{current?.nativeName} ({current?.name})</span>
        <svg className={`h-3.5 w-3.5 text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && createPortal(
        <div className="fixed inset-0 z-[9999]" onClick={() => setOpen(false)}>
          <div className="fixed" style={{ top: pos.top, left: pos.left, width: pos.width }}>
            <div className="bg-white dark:bg-[#2A2522] border border-slate-200 dark:border-brand-muted shadow-lg rounded-lg py-1 overflow-y-auto max-h-72" onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()}>
              {languages.map(l => (
                <button key={l.code} onMouseDown={() => { setLang(l.code as Language); setOpen(false); }}
                  className={`w-full flex items-center gap-3 px-3.5 py-2 text-xs font-medium cursor-pointer ${
                    lang === l.code
                      ? 'text-brand dark:text-brand-secondary bg-brand-secondary/50 dark:bg-brand-muted/30'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-brand-muted/20'
                  }`}
                >
                  <span className="flex-1 text-left">{l.nativeName}</span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500">{l.name}</span>
                  {lang === l.code && <Check className="h-3.5 w-3.5 text-brand shrink-0" />}
                </button>
              ))}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
