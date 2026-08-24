'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import {
  Check, ChevronRight, Circle, Copy, ExternalLink, Loader2, RefreshCw, X,
} from 'lucide-react';
import { CLOUD_SETUP_SQL } from '@/lib/cloud-setup-schema';
import { BASE_PATH } from '@/lib/env';

const LS_DRAFT = 'mm_setup_draft';
const LS_REDIRECT_OK = 'mm_setup_redirect_ok';

type Draft = { url: string; key: string };

function loadDraft(): Draft {
  try {
    const raw = localStorage.getItem(LS_DRAFT);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { url: '', key: '' };
}

function projectRef(url: string): string {
  const m = (url || '').match(/https:\/\/([a-z0-9-]+)\.supabase\.co/i);
  return m ? m[1] : '';
}

function cleanUrl(url: string): string {
  return (url || '').trim().replace(/\/+$/, '');
}

type AuthSettings = { external?: { google?: boolean } } | null;

async function fetchAuthSettings(url: string, key: string): Promise<AuthSettings> {
  try {
    const res = await fetch(`${cleanUrl(url)}/auth/v1/settings`, {
      headers: { apikey: key },
    });
    if (!res.ok) return null;
    return (await res.json()) as AuthSettings;
  } catch {
    return null;
  }
}

async function checkSchemaTable(url: string, key: string): Promise<boolean> {
  try {
    const res = await fetch(`${cleanUrl(url)}/rest/v1/sync_docs?select=id&limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}

type StepState = 'pending' | 'checking' | 'done';

export default function CloudSetupWizard({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [draft, setDraft] = useState<Draft>({ url: '', key: '' });
  const [states, setStates] = useState<Record<string, StepState>>({ project: 'pending', schema: 'pending', google: 'pending' });
  const [redirectOk, setRedirectOk] = useState(false);
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasCreds = /^https:\/\/[a-zA-Z0-9.-]+\.supabase\.co$/.test(cleanUrl(draft.url)) && draft.key.trim().length > 20;

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      setDraft(loadDraft());
      try { setRedirectOk(localStorage.getItem(LS_REDIRECT_OK) === '1'); } catch {}
    }, 0);
    return () => clearTimeout(t);
  }, [open]);

  const runChecks = useCallback(async (d: Draft) => {
    const url = cleanUrl(d.url);
    const key = d.key.trim();
    if (!/^https:\/\/[a-zA-Z0-9.-]+\.supabase\.co$/.test(url) || key.length <= 20) {
      setStates({ project: 'pending', schema: 'pending', google: 'pending' });
      return;
    }
    setStates({ project: 'checking', schema: 'checking', google: 'checking' });
    const settings = await fetchAuthSettings(url, key);
    setStates({
      project: settings ? 'done' : 'pending',
      google: settings?.external?.google === true ? 'done' : 'pending',
      schema: settings ? await checkSchemaTable(url, key) ? 'done' : 'pending' : 'pending',
    });
  }, []);

  useEffect(() => {
    if (!open || !hasCreds) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => runChecks(draft), 700);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [open, draft, hasCreds, runChecks]);

  // Save draft whenever it changes while open
  useEffect(() => {
    if (!open) return;
    try { localStorage.setItem(LS_DRAFT, JSON.stringify(draft)); } catch {}
  }, [draft, open]);

  if (!open) return null;

  const ref = projectRef(draft.url);
  const isNative = Capacitor.isNativePlatform();
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const redirectWeb = `${origin}${BASE_PATH}/login`;
  const doneCount = Object.values(states).filter(s => s === 'done').length + (redirectOk ? 1 : 0);
  const allDone = states.project === 'done' && states.schema === 'done' && states.google === 'done' && redirectOk;

  const persistAndClose = () => {
    // Config is saved by the login flow on first successful Google sign-in;
    // here we just stash the draft so "Continue with Google" can use it.
    try {
      localStorage.setItem('mm_pouch_url', cleanUrl(draft.url));
      localStorage.setItem('mm_sync_key', draft.key.trim());
    } catch {}
    onClose();
  };

  const copySql = async () => {
    try {
      await navigator.clipboard.writeText(CLOUD_SETUP_SQL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const dash = (path: string) => `https://supabase.com/dashboard/project/${ref || '_'}/${path}`;

  const stepIcon = (s: StepState) =>
    s === 'done' ? <Check className="h-4 w-4 text-green-600" />
    : s === 'checking' ? <Loader2 className="h-4 w-4 animate-spin text-sky-500" />
    : <Circle className="h-4 w-4 text-slate-300 dark:text-slate-600" />;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-[#2A2522] rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-[#2A2522] border-b border-slate-100 dark:border-brand-muted px-5 py-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Cloud Sync Setup</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Create your own free Supabase — 4 steps</p>
          </div>
          <button onClick={onClose} className="p-2 -mr-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Progress */}
        <div className="px-5 pt-4">
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 bg-slate-100 dark:bg-brand-muted/40 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-sky-500 to-blue-600 rounded-full transition-all duration-500"
                style={{ width: `${(doneCount / 4) * 100}%` }}
              />
            </div>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 shrink-0">{doneCount}/4</span>
          </div>
          {hasCreds && (
            <button
              onClick={() => runChecks(draft)}
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-sky-600 dark:text-sky-400 hover:underline"
            >
              <RefreshCw className="h-3 w-3" /> Re-check now
            </button>
          )}
        </div>

        <div className="p-5 space-y-4">
          {/* Credentials */}
          <div className="space-y-2">
            <input
              value={draft.url}
              onChange={e => setDraft(d => ({ ...d, url: e.target.value }))}
              placeholder="Project URL — https://xxxx.supabase.co"
              className="w-full bg-slate-50 dark:bg-brand-dark rounded-lg border border-slate-200 dark:border-brand-muted px-3 py-2.5 text-sm outline-none focus:border-sky-400 text-slate-700 dark:text-slate-200"
            />
            <input
              type="password"
              value={draft.key}
              onChange={e => setDraft(d => ({ ...d, key: e.target.value }))}
              placeholder="Anon public key (eyJ…)"
              className="w-full bg-slate-50 dark:bg-brand-dark rounded-lg border border-slate-200 dark:border-brand-muted px-3 py-2.5 text-sm outline-none focus:border-sky-400 text-slate-700 dark:text-slate-200"
            />
            {!hasCreds && (
              <p className="text-xs text-slate-400 dark:text-slate-500">
                Paste both values from your Supabase dashboard — steps below auto-check as you complete them.
              </p>
            )}
          </div>

          {/* Step 1 — Create project */}
          <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-brand-dark/60">
            <div className="mt-0.5">{stepIcon(hasCreds && states.project === 'pending' ? 'checking' : hasCreds ? states.project : 'pending')}</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">1. Create a free Supabase project</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {hasCreds && states.project === 'done' ? 'Project found and reachable.' : 'No credit card needed. Then paste the URL + anon key above.'}
              </p>
              <a href="https://database.new" target="_blank" rel="noreferrer"
                 className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-sky-600 dark:text-sky-400 hover:underline">
                Open supabase.com <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>

          {/* Step 2 — Run schema */}
          <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-brand-dark/60">
            <div className="mt-0.5">{hasCreds ? stepIcon(states.schema) : stepIcon('pending')}</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">2. Run the setup SQL</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {states.schema === 'done'
                  ? 'sync_docs table detected — schema is live.'
                  : 'In SQL Editor, paste and Run the copied SQL (creates the sync table).'}
              </p>
              <div className="mt-1.5 flex items-center gap-3">
                <button onClick={copySql}
                        className="inline-flex items-center gap-1 text-xs font-medium text-sky-600 dark:text-sky-400 hover:underline disabled:opacity-40"
                        disabled={!hasCreds}>
                  <Copy className="h-3 w-3" /> {copied ? 'Copied!' : 'Copy SQL'}
                </button>
                <a href={dash('sql/new')} target="_blank" rel="noreferrer"
                   className="inline-flex items-center gap-1 text-xs font-medium text-sky-600 dark:text-sky-400 hover:underline">
                  Open SQL Editor <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          </div>

          {/* Step 3 — Google provider */}
          <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-brand-dark/60">
            <div className="mt-0.5">{hasCreds ? stepIcon(states.google) : stepIcon('pending')}</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">3. Enable Google sign-in</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {states.google === 'done'
                  ? 'Google provider is active on your project.'
                  : 'Authentication → Providers → Google → Enable. Needs a Google OAuth client ID (guide: SELF-HOSTING.md).'}
              </p>
              <a href={dash('auth/providers')} target="_blank" rel="noreferrer"
                 className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-sky-600 dark:text-sky-400 hover:underline">
                Open Providers <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>

          {/* Step 4 — Redirect URLs */}
          <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-brand-dark/60">
            <button
              onClick={() => {
                const next = !redirectOk;
                setRedirectOk(next);
                try { localStorage.setItem(LS_REDIRECT_OK, next ? '1' : '0'); } catch {}
              }}
              className="mt-0.5"
              aria-label="Mark redirect URLs added"
            >
              {redirectOk
                ? <Check className="h-4 w-4 text-green-600" />
                : <Circle className="h-4 w-4 text-slate-300 dark:text-slate-600" />}
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">4. Add redirect URL</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Authentication → URL Configuration → Redirect URLs, add:
              </p>
              <code className="block mt-1 text-[11px] bg-white dark:bg-brand-dark border border-slate-200 dark:border-brand-muted rounded px-2 py-1 text-slate-600 dark:text-slate-300 break-all select-all">
                {isNative ? 'moneymeva://login' : redirectWeb}
              </code>
              {!isNative && (
                <code className="block mt-1 text-[11px] bg-white dark:bg-brand-dark border border-slate-200 dark:border-brand-muted rounded px-2 py-1 text-slate-400 dark:text-slate-500 break-all select-all">
                  moneymeva://login <span className="text-slate-400">(for the Android app)</span>
                </code>
              )}
              <a href={dash('auth/url-configuration')} target="_blank" rel="noreferrer"
                 className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-sky-600 dark:text-sky-400 hover:underline">
                Open URL Configuration <ExternalLink className="h-3 w-3" />
              </a>
              <label className="mt-2 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={redirectOk}
                  onChange={e => {
                    setRedirectOk(e.target.checked);
                    try { localStorage.setItem(LS_REDIRECT_OK, e.target.checked ? '1' : '0'); } catch {}
                  }}
                  className="accent-sky-600"
                />
                I added it and pressed Save
              </label>
            </div>
          </div>

          {/* Ready banner */}
          {allDone && (
            <div className="rounded-xl border border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/30 p-4">
              <p className="text-sm font-semibold text-green-700 dark:text-green-400 flex items-center gap-1.5">
                <Check className="h-4 w-4" /> Cloud ready!
              </p>
              <p className="text-xs text-green-600/80 dark:text-green-500/80 mt-1">
                Close this and tap “Continue with Google” again.
              </p>
              <button
                onClick={persistAndClose}
                className="mt-3 w-full py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 text-white text-sm font-medium hover:opacity-90 transition-opacity inline-flex items-center justify-center gap-1"
              >
                Done <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}

          <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed">
            Your keys stay on this device only (localStorage) — never sent anywhere except your own Supabase project.
            Full guide: SELF-HOSTING.md in the repo.
          </p>
        </div>
      </div>
    </div>
  );
}
