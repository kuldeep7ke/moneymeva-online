'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { db } from '@/lib/db';
import { clearRemote, getConfig, checkConnection, getRemoteStats, getRemoteRows, manualSync, connectRemote, disconnectRemote, ensureConnected, connected } from '@/lib/pouchdb';
import { downloadBlob } from '@/lib/download';
import { AlertTriangle, Trash2, Loader2, Download, Upload, Eye, EyeOff, Cloud, Activity, ShieldAlert, Palette, User, FileUp, Megaphone, RefreshCw } from 'lucide-react';
import { getPins, getUsedIndex, getRemainingPins, hasPins } from '@/lib/pinStore';
import { cn } from '@/lib/utils';
import { getSession } from '@/lib/localAuth';
import { useTheme, getBrands } from '@/components/ThemeProvider';
import { useToast } from '@/components/Toast';
import { createProgressOverlay } from '@/lib/progressOverlay';
import { getLastSyncEvent } from '@/lib/sync-notify';
import { BROADCAST_BIN_ID, BANNER_BIN_ID, JSONBIN_BASE, ANNOUNCEMENTS_API, BASE_PATH } from '@/lib/env';
import { RELEASE_NOTES, getLastSeenVersion } from '@/lib/whats-new';
import { exportCustomDataExcel, type CustomExportSection } from '@/lib/export';
import * as XLSX from 'xlsx';
import Reveal from '@/components/Reveal';

const inputCls = 'w-full px-3 py-2 rounded-lg bg-white dark:bg-brand-dark border border-slate-200 dark:border-brand-muted text-sm text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-brand font-mono placeholder:text-slate-400 placeholder:font-sans';
const mask = (s: string) => (s && s.length > 12 ? `${s.slice(0, 6)}…${s.slice(-4)}` : s);

function readRemoteAccount(cfg: { url: string; key: string }): string {
  try {
    const ref = (cfg.url || '').replace(/^https?:\/\//, '').replace(/\.supabase\.co.*$/, '');
    const tok = JSON.parse(localStorage.getItem(`sb-${ref}-auth-token`) || 'null');
    const u = tok?.user;
    if (!u) return 'not signed in';
    if (u.is_anonymous || u.role === 'anonymous' || !u.email) return `anonymous (${(u.id || '').slice(0, 8)}…)`;
    return u.email;
  } catch { return 'not signed in'; }
}

export default function DeveloperPage() {
  const toast = useToast();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [warnDismissed, setWarnDismissed] = useState(false);
  const [status, setStatus] = useState('');
  const [clearing, setClearing] = useState(false);
  const [cleared, setCleared] = useState(false);
  const [showPins, setShowPins] = useState(false);
  const [dbStats, setDbStats] = useState<Record<string, number> | null>(null);
  const [lsData, setLsData] = useState<{ key: string; value: string }[] | null>(null);
  const [syncOk, setSyncOk] = useState<boolean | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [importData, setImportData] = useState<Record<string, any[]> | null>(null);
  const [importFileName, setImportFileName] = useState('');
  const [timer, setTimer] = useState(180);
  const [appVersion, setAppVersion] = useState('');
  const [annTest, setAnnTest] = useState<string | null>(null);
  const [annTesting, setAnnTesting] = useState(false);
  const [dismissedCount, setDismissedCount] = useState(0);
  const [confirmBox, setConfirmBox] = useState<{ mode: 'clear' | 'clearRemote'; stage: number } | null>(null);
  const [exportFrom, setExportFrom] = useState('');
  const [exportTo, setExportTo] = useState('');
  const [exportSections, setExportSections] = useState<Record<string, boolean>>({ income: true, expenses: true, parties: true, recurring: false, investments: false, categories: true, works: false, goals: false, accounts: true, partnership: false });
  const [exportFormat, setExportFormat] = useState<'xlsx' | 'json'>('xlsx');
  const [exporting, setExporting] = useState(false);
  const [remoteStats, setRemoteStats] = useState<{ total: number; byEntity: Record<string, number> } | null>(null);
  const [remoteRows, setRemoteRows] = useState<{ id: string; entity: string; updated_at: string; deleted_at: string | null }[] | null>(null);
  const [dbLoading, setDbLoading] = useState(false);
  const [freshConfirm, setFreshConfirm] = useState(false);
  const [freshStage, setFreshStage] = useState(0);
  const [pullLoading, setPullLoading] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [freshLoading, setFreshLoading] = useState(false);
  const [clearLocalConfirm, setClearLocalConfirm] = useState(false);
  const [clearLocalStage, setClearLocalStage] = useState(0);
  const [clearLocalLoading, setClearLocalLoading] = useState(false);
  const [connectUrl, setConnectUrl] = useState('');
  const [connectKey, setConnectKey] = useState('');
  const [connectEmail, setConnectEmail] = useState('');
  const [connectPassword, setConnectPassword] = useState('');
  const [connectAnonymous, setConnectAnonymous] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [connectStatus, setConnectStatus] = useState<string | null>(null);

  useEffect(() => {
    const m = document.querySelector('meta[name="app-version"]');
    if (m) setAppVersion(m.getAttribute('content') || '');
    refreshDismissed();
    const cfg = getConfig();
    if (cfg.url) setConnectUrl(cfg.url);
    if (cfg.key) setConnectKey(cfg.key);
    checkConnection().then(ok => setSyncOk(ok));
  }, []);

  const readDismissed = (): string[] => {
    try { return JSON.parse(localStorage.getItem('mm_dismissed_broadcasts') || '[]'); } catch { return []; }
  };
  const refreshDismissed = () => setDismissedCount(readDismissed().length);

  useEffect(() => {
    if (!warnDismissed) return;
    const handler = () => setTimer(180);
    window.addEventListener('mousedown', handler);
    window.addEventListener('keydown', handler);
    window.addEventListener('touchstart', handler);
    const interval = setInterval(() => {
      setTimer(t => (t <= 1 ? 0 : t - 1));
    }, 1000);
    return () => { clearInterval(interval); window.removeEventListener('mousedown', handler); window.removeEventListener('keydown', handler); window.removeEventListener('touchstart', handler); };
  }, [warnDismissed]);

  useEffect(() => {
    if (warnDismissed && timer <= 0) router.push('/dashboard');
  }, [timer, warnDismissed, router]);

  const dismissWarn = () => {
    setWarnDismissed(true);
  };

  const session = typeof window !== 'undefined' ? getSession() : null;
  const { brand, setBrand } = useTheme();
  const brands = getBrands();

  const handleClear = async () => {
    setClearing(true);
    const overlay = createProgressOverlay('Clearing data…');
    try {
      overlay.update('Clearing remote data…', 1, 3);
      await clearRemote();
      overlay.update('Clearing local database…', 2, 3);
      const { clearAllDB } = await import('@/lib/store');
      await clearAllDB((label, done, total) => overlay.update(label, done, total));
      // Wipe any persisted Supabase auth token too, so "clear all data" is complete
      // and the cloud session can't auto-restore on the next reload.
      Object.keys(localStorage).filter(k => k.startsWith('sb-')).forEach(k => localStorage.removeItem(k));
      setClearing(false);
      setCleared(true);
      overlay.finish('All data cleared — reloading', () => window.location.reload());
    } catch {
      setClearing(false);
      overlay.error('Failed to clear data', () => window.location.reload());
    }
  };

  const handleClearRemote = async () => {
    setStatus('Clearing remote...');
    await clearRemote();
    setStatus('Remote cleared');
  };

  const confirmPrimary = () => {
    if (!confirmBox) return;
    if (confirmBox.stage === 1) { setConfirmBox({ ...confirmBox, stage: 2 }); return; }
    const mode = confirmBox.mode;
    setConfirmBox(null);
    if (mode === 'clear') handleClear();
    else if (mode === 'clearRemote') handleClearRemote();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFileName(file.name);
    try {
      const isExcel = /\.(xlsx|xls|csv)$/i.test(file.name);
      if (isExcel) {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf);
        const parsed: Record<string, any[]> = {};
        for (const name of wb.SheetNames) {
          if (!name.startsWith('_mm_')) continue;
          const key = name.slice(4);
          const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[name], { defval: '' });
          parsed[key] = rows.map(r => {
            const row: Record<string, any> = {};
            for (const [k, v] of Object.entries(r as Record<string, any>)) {
              let val = v;
              if (typeof v === 'string' && (v.startsWith('[') || v.startsWith('{'))) {
                try { const p = JSON.parse(v); if (p !== null && typeof p === 'object') val = p; } catch { /* keep raw string */ }
              }
              row[k] = val;
            }
            return row;
          });
        }
        if (!Object.keys(parsed).length) { setStatus('No importable sheets found in the workbook. Use the app\'s Custom Export (XLSX) or JSON.'); return; }
        setImportData(parsed);
        setStatus(`Loaded ${file.name} — ${Object.keys(parsed).length} tables found (XLSX)`);
      } else {
        const text = await file.text();
        const parsed = JSON.parse(text);
        if (typeof parsed !== 'object' || parsed === null) { setStatus('Invalid file format: expected JSON object with table arrays.'); return; }
        setImportData(parsed as Record<string, any[]>);
        setStatus(`Loaded ${file.name} — ${Object.keys(parsed).length} tables found`);
      }
    } catch { setStatus('Failed to parse file. Ensure it is a valid JSON or XLSX export.'); }
  };

  const handleFileImport = async () => {
    if (!importData) { setStatus('No file loaded.'); return; }
    const overlay = createProgressOverlay('Importing data…');
    try {
      const tableMap: Record<string, string> = {
        transactions: 'transactions', partners: 'partners', recurring: 'recurring',
        budgets: 'budgets', reminders: 'reminders', adjustments: 'adjustments',
        goals: 'goals', mutation_log: 'mutation_log',
        works: 'works', partnerships: 'partnerships', partnershipEntries: 'partnership_entries',
        _audit_log: 'mutation_log',
      };
      const entries = Object.entries(tableMap).filter(([key]) => Array.isArray(importData[key]) && importData[key].length > 0);
      const actLog = Array.isArray(importData._activity_log) ? importData._activity_log : [];
      const total = entries.reduce((n, [key]) => n + importData[key].length, 0) + actLog.length;
      let done = 0;
      for (const [key, tableName] of entries) {
        const items = importData[key];
        done += items.length;
        overlay.update(`Importing ${key}…`, done, Math.max(total, 1));
        setStatus(`Importing ${key}… (${done.toLocaleString()} / ${total.toLocaleString()})`);
        await (db as any)[tableName].bulkPut(items);
      }
      if (actLog.length > 0) {
        const existing: any[] = JSON.parse(localStorage.getItem('mm_activity_log') || '[]');
        const existingTs = new Set(existing.map((e: any) => e.timestamp + (e.detail || '')));
        const merged = [...actLog.filter((e: any) => !existingTs.has(e.timestamp + (e.detail || ''))), ...existing];
        merged.sort((a: any, b: any) => (b.timestamp || '').localeCompare(a.timestamp || ''));
        if (merged.length > 200) merged.length = 200;
        localStorage.setItem('mm_activity_log', JSON.stringify(merged));
      }
      setStatus(`Import complete — ${total.toLocaleString()} items. Redirecting...`);
      // Hard navigation (not router.push): the raw progress overlay is appended to
      // document.body and must not linger, and the store cache is hydrated from
      // Dexie on init — a full reload is required so imported rows actually appear.
      overlay.finish(`Import complete — ${total.toLocaleString()} items`, () => { window.location.assign(`${BASE_PATH}/dashboard`); });
    } catch {
      setStatus('Import failed.');
      overlay.error('Import failed', () => overlay.close());
    }
  };

  const loadDbStats = async () => {
    setDbStats(null);
    const tables = ['transactions','partners','recurring','budgets','reminders','adjustments','goals','mutation_log','works','partnerships','partnership_entries'] as const;
    const stats: Record<string, number> = {};
    for (const t of tables) {
      try { stats[t] = await (db[t] as any).count(); } catch { stats[t] = -1; }
    }
    setDbStats(stats);
  };

  const loadLsInspector = () => {
    const items: { key: string; value: string }[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k) {
        let v = localStorage.getItem(k) || '';
        try { v = JSON.parse(v); v = JSON.stringify(v, null, 2).slice(0, 200); } catch {}
        items.push({ key: k, value: v.slice(0, 200) });
      }
    }
    setLsData(items);
  };

  const testSync = async () => {
    setSyncing(true);
    const cfg = getConfig();
    if (!cfg.url) { setSyncOk(false); setSyncing(false); return; }
    const r = await checkConnection();
    setSyncOk(r);
    setSyncing(false);
  };

  const testAnnouncements = async () => {
    setAnnTesting(true);
    setAnnTest(null);
    const out: string[] = [];
    // Proxy first (production path, edge-cached), then direct jsonbin fallback
    try {
      const r = await fetch(`${ANNOUNCEMENTS_API}?type=broadcast`, { cache: 'no-store' });
      if (!r.ok) throw new Error('http');
      const j = await r.json();
      const rec = j?.record ?? j;
      out.push(`Broadcast OK · ${Array.isArray(rec) ? rec.length : 1} item(s)`);
    } catch { out.push('Proxy FAILED · trying jsonbin…'); }
    try {
      const r = await fetch(`${JSONBIN_BASE}${BROADCAST_BIN_ID}/latest?t=${Date.now()}`, { cache: 'no-store' });
      if (!r.ok) throw new Error('http');
      const j = await r.json();
      const rec = j?.record ?? j;
      out.push(`jsonbin broadcast OK · ${Array.isArray(rec) ? rec.length : 1} item(s)`);
    } catch { out.push('jsonbin broadcast FAILED'); }
    try {
      const r = await fetch(`${ANNOUNCEMENTS_API}?type=banner`, { cache: 'no-store' });
      if (!r.ok) throw new Error('http');
      const j = await r.json();
      out.push(`Banner OK · ${j?.record?.id || 'no id'}`);
    } catch { out.push('Banner proxy FAILED'); }
    setAnnTest(out.join(' · '));
    setAnnTesting(false);
  };

  const clearDismissed = () => {
    localStorage.removeItem('mm_dismissed_broadcasts');
    refreshDismissed();
    toast('Dismissed broadcasts cleared — all pills will reappear', 'success');
  };

  const handleExportRaw = async () => {
    const tables = ['transactions','partners','recurring','budgets','reminders','adjustments','goals','mutation_log','works','partnerships','partnership_entries'] as const;
    const overlay = createProgressOverlay('Exporting raw data…');
    const data: Record<string, any> = {};
    const total = tables.length;
    let done = 0;
    for (const t of tables) {
      done++;
      overlay.update(`Exporting ${t}…`, done, total);
      try { data[t] = await (db[t] as any).toArray(); } catch { data[t] = []; }
    }
    downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), `money-meva-raw-${new Date().toISOString().split('T')[0]}.json`);
    overlay.finish('Raw export complete — check downloads', () => overlay.close());
  };

  const handleBrandCycle = () => {
    const idx = brands.findIndex(b => b.key === brand);
    setBrand(brands[(idx + 1) % brands.length].key);
  };

  const handleCustomExport = async () => {
    const sections = (Object.keys(exportSections).filter(k => exportSections[k]) as CustomExportSection[]);
    if (sections.length === 0) { toast('Select at least one section to export.', 'warning'); return; }
    if (exportFrom && exportTo && exportFrom > exportTo) { toast('From date must be before To date.', 'warning'); return; }
    setExporting(true);
    const overlay = createProgressOverlay('Exporting data…');
    try {
      await exportCustomDataExcel({
        from: exportFrom || undefined,
        to: exportTo || undefined,
        sections,
        format: exportFormat,
        onProgress: (label, pct) => overlay.update(label, pct, 100),
      });
      setExporting(false);
      overlay.finish(`Export complete (${exportFormat.toUpperCase()}) — check downloads`, () => overlay.close());
      toast('Custom export downloaded', 'success');
    } catch {
      setExporting(false);
      overlay.error('Export failed', () => overlay.close());
    }
  };

  // ─── Database Control Handlers ──────────────────────────────────

  const loadRemoteStats = async () => {
    setDbLoading(true);
    if (!connected()) await ensureConnected();
    const stats = await getRemoteStats();
    setRemoteStats(stats);
    setSyncOk(connected());
    setDbLoading(false);
  };

  const loadRemoteRows = async () => {
    setDbLoading(true);
    if (!connected()) await ensureConnected();
    const rows = await getRemoteRows();
    setRemoteRows(rows);
    setSyncOk(connected());
    setDbLoading(false);
  };

  const handlePull = async () => {
    setPullLoading(true);
    const overlay = createProgressOverlay('Pulling remote data…');
    try {
      const { ok } = await manualSync();
      if (ok) {
        overlay.update('Applying remote changes…', 1, 2);
        const { processRemoteChanges } = await import('@/lib/store');
        await processRemoteChanges();
        overlay.finish('Pull complete — local data updated', () => {
          window.location.reload();
        });
      } else {
        overlay.error('Pull failed — check connection', () => overlay.close());
      }
    } catch {
      overlay.error('Pull failed', () => overlay.close());
    }
    setPullLoading(false);
  };

  const handlePush = async () => {
    setPushLoading(true);
    const overlay = createProgressOverlay('Pushing local data…');
    try {
      const { pushAllToPouch } = await import('@/lib/store');
      const count = await pushAllToPouch();
      overlay.update('Uploading to remote…', 1, 2);
      const { ok, pushed, pushErr } = await manualSync();
      if (ok) {
        if (pushed > 0) {
          overlay.finish(`Push complete — ${pushed} item(s) uploaded to remote`, () => overlay.close());
        } else if (count > 0) {
          overlay.error(`Staged ${count} item(s) locally but 0 reached remote${pushErr ? ` (${pushErr})` : ''} — reconnect and retry`, () => overlay.close());
        } else {
          overlay.finish('Push complete — nothing to send', () => overlay.close());
        }
      } else {
        overlay.error('Push failed — remote not connected', () => overlay.close());
      }
    } catch {
      overlay.error('Push failed', () => overlay.close());
    }
    setPushLoading(false);
  };

  const handleStartFresh = async () => {
    setFreshConfirm(false);
    setFreshLoading(true);
    const overlay = createProgressOverlay('Starting fresh…');
    try {
      overlay.update('Clearing remote database…', 1, 3);
      await clearRemote();
      overlay.update('Staging local data…', 2, 3);
      const { pushAllToPouch } = await import('@/lib/store');
      await pushAllToPouch();
      overlay.update('Uploading to remote…', 3, 3);
      const { ok, pushed } = await manualSync();
      if (!ok) {
        overlay.error('Push failed — remote not connected', () => overlay.close());
        return;
      }
      overlay.finish(`Done — pushed ${pushed} item(s). Local data is now the source of truth.`, () => {
        window.location.reload();
      });
    } catch {
      overlay.error('Start fresh failed', () => overlay.close());
    }
    setFreshLoading(false);
  };

  const handleClearLocal = async () => {
    setClearLocalConfirm(false);
    setClearLocalLoading(true);
    const overlay = createProgressOverlay('Clearing local data…');
    try {
      const { clearAllDB } = await import('@/lib/store');
      await clearAllDB((label, done, total) => overlay.update(label, done, total));
      overlay.finish('Local data cleared — reloading', () => window.location.reload());
    } catch {
      overlay.error('Failed to clear local data', () => overlay.close());
    }
    setClearLocalLoading(false);
  };

  const handleConnect = async () => {
    if (!connectUrl.trim()) { setConnectStatus('URL is required'); return; }
    if (!connectAnonymous && !connectKey.trim()) { setConnectStatus('Anon key is required'); return; }
    if (!connectAnonymous && (!connectEmail.trim() || !connectPassword.trim())) { setConnectStatus('Email + password are required (or use anonymous mode)'); return; }
    setConnecting(true);
    setConnectStatus('Connecting…');
    try {
      const result = await connectRemote(connectUrl.trim(), connectKey.trim(), connectEmail.trim(), connectPassword, connectAnonymous);
      if (result.ok) {
        setSyncOk(true);
        setConnectStatus('Connected successfully');
        toast('Supabase connected', 'success');
      } else {
        setSyncOk(false);
        setConnectStatus(result.error || 'Connection failed');
      }
    } catch (e: any) {
      setSyncOk(false);
      setConnectStatus(e?.message || 'Connection failed');
    }
    setConnecting(false);
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    disconnectRemote();
    setSyncOk(false);
    setConnectStatus('Disconnected');
    setDisconnecting(false);
    toast('Supabase disconnected', 'info');
  };

  if (!warnDismissed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-[#1A1615] p-4">
        <div className="max-w-sm w-full bg-white dark:bg-[#2A2522] rounded-2xl border border-amber-200 dark:border-amber-800/40 shadow-xl p-6 text-center space-y-5">
          <div className="mx-auto w-14 h-14 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
            <AlertTriangle className="h-7 w-7 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">Developer Zone</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">You are entering the developer page.</p>
          </div>
          <Button onClick={dismissWarn} className="w-full bg-amber-600 hover:bg-amber-700 text-white">I Understand, Continue</Button>
          <Button variant="ghost" onClick={() => router.push('/dashboard')} className="w-full text-sm text-slate-400">Go Back to Dashboard</Button>
        </div>
      </div>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <Reveal>
          <div className="mb-2">
            <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 hidden md:block">Developer Zone</h1>
            <p className="text-slate-500 dark:text-slate-400 text-base font-semibold md:font-normal md:text-sm block md:hidden">Tools, diagnostics, and database management</p>
            <p className="text-slate-500 dark:text-slate-400 text-sm md:mt-1 hidden md:block">Tools, diagnostics, and database management</p>
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-brand-muted text-slate-600 dark:text-slate-300"><span className="font-mono">{appVersion || 'v?.?.?.?'}</span></span>
              <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-brand-muted text-slate-600 dark:text-slate-300">Release {RELEASE_NOTES.version} · seen {getLastSeenVersion() || '—'}</span>
              <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 font-mono">inactivity {Math.floor(timer / 60)}:{(timer % 60).toString().padStart(2, '0')}</span>
            </div>
          </div>
        </Reveal>

        {/* Database & Cloud Sync */}
        <Reveal delay={100}>
          <DevCard
            icon={Cloud}
            cardClass="bg-gradient-to-r from-sky-50 to-blue-50 dark:from-sky-900/20 dark:to-blue-900/20 border border-sky-200 dark:border-sky-800"
            tileClass="bg-gradient-to-br from-sky-500 to-blue-600"
            title="Database & Cloud Sync"
            subtitle="Connect to your Supabase project, inspect remote data, and sync between devices."
            right={
              <button onClick={() => { setSyncOk(null); checkConnection().then(ok => setSyncOk(ok)); }} className="flex items-center gap-1.5 shrink-0 select-none cursor-pointer" title="Re-test connection">
                <div className={cn('w-2.5 h-2.5 rounded-full', syncOk === true ? 'bg-green-500' : syncOk === false ? 'bg-red-500' : 'bg-slate-300 animate-pulse')} />
                <span className={cn('text-xs font-semibold', syncOk === true ? 'text-green-600 dark:text-green-400' : syncOk === false ? 'text-red-500 dark:text-red-400' : 'text-slate-400')}>
                  {syncOk === null ? 'Checking…' : syncOk ? 'Connected' : 'Offline'}
                </span>
              </button>
            }
          >
            <div className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Quick Connect</p>
              <div className="p-3 sm:p-4 rounded-xl bg-white/60 dark:bg-white/5 border border-slate-200 dark:border-brand-muted/40 space-y-3">
                <Field label="Supabase URL">
                  <input type="text" placeholder="https://xxx.supabase.co" value={connectUrl} onChange={e => setConnectUrl(e.target.value)} className={inputCls} />
                </Field>
                <Field label="Anon key">
                  <input type="text" placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9…" value={connectKey} onChange={e => setConnectKey(e.target.value)} className={inputCls} />
                </Field>
                <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-600 dark:text-slate-300">
                  <input type="checkbox" checked={connectAnonymous} onChange={e => setConnectAnonymous(e.target.checked)} className="accent-brand h-4 w-4" />
                  <span><span className="font-semibold">Anonymous mode</span> — connect with URL + anon key only, no email/password</span>
                </label>
                {connectAnonymous && (
                  <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/60 text-xs text-amber-800 dark:text-amber-200 space-y-1">
                    <p className="font-bold">Enable Anonymous sign-ins first (one-time, Supabase dashboard):</p>
                    <p className="font-mono">Authentication → Sign In / Providers → Anonymous sign-ins → Enable</p>
                    <p>Then paste the URL + anon key above and click Connect — no email/password needed.</p>
                  </div>
                )}
                {!connectAnonymous && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label="Email">
                      <input type="email" placeholder="you@example.com" value={connectEmail} onChange={e => setConnectEmail(e.target.value)} className={inputCls} />
                    </Field>
                    <Field label="Password">
                      <input type="password" placeholder="••••••••" value={connectPassword} onChange={e => setConnectPassword(e.target.value)} className={inputCls} />
                    </Field>
                  </div>
                )}
                {connectStatus && (
                  <p className={cn('text-xs font-mono break-all', connectStatus.includes('success') || connectStatus.includes('Connected') ? 'text-green-600 dark:text-green-400' : connectStatus.includes('Disconnected') ? 'text-slate-500' : 'text-red-500')}>{connectStatus}</p>
                )}
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button variant="outline" onClick={handleConnect} disabled={connecting || disconnecting} className="flex-1">
                    {connecting ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> Connecting…</> : connectAnonymous ? 'Connect (Anonymous)' : 'Connect'}
                  </Button>
                  <Button variant="outline" onClick={handleDisconnect} disabled={connecting || disconnecting || syncOk === false} className="flex-1 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20">
                    {disconnecting ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> Disconnecting…</> : 'Disconnect'}
                  </Button>
                </div>
                <p className="text-xs text-slate-400">Temporary connection — does not overwrite saved Settings config. Link-only uses a fresh anonymous user (your rows get that user's ID).</p>
              </div>
            </div>

            {(() => {
              const cfg = getConfig();
              const sbAccount = readRemoteAccount(cfg);
              return (
                <div className="border-t border-slate-200/60 dark:border-brand-muted/40 pt-4 space-y-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Current Config</p>
                  <div className="rounded-xl border border-slate-200 dark:border-brand-muted/40 bg-white/60 dark:bg-white/5 p-3">
                    <StatRow label="URL" value={cfg.url ? mask(cfg.url) : '(none)'} />
                    <StatRow label="Account" value={sbAccount} />
                  </div>
                </div>
              );
            })()}

            <div className="border-t border-slate-200/60 dark:border-brand-muted/40 pt-4 space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Remote Data</p>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={loadRemoteStats} disabled={dbLoading} className="w-full">
                  {dbLoading && !remoteStats ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> Loading…</> : remoteStats ? 'Refresh Stats' : 'Load Stats'}
                </Button>
                <Button variant="outline" onClick={loadRemoteRows} disabled={dbLoading} className="w-full">
                  {dbLoading && !remoteRows ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> Loading…</> : remoteRows ? 'Refresh Rows' : 'Browse Rows'}
                </Button>
              </div>
              {remoteStats && (
                <div className="rounded-xl border border-slate-200 dark:border-brand-muted/40 bg-white/60 dark:bg-white/5 p-3 space-y-0.5">
                  <StatRow label="Total" value={remoteStats.total} />
                  {Object.entries(remoteStats.byEntity).sort((a, b) => b[1] - a[1]).map(([entity, count]) => (
                    <StatRow key={entity} label={entity.replace('_', ' ')} value={count} />
                  ))}
                </div>
              )}
              {remoteRows && (
                <div className="rounded-xl border border-slate-200 dark:border-brand-muted/40 bg-white/60 dark:bg-white/5 overflow-hidden">
                  <div className="max-h-40 overflow-y-auto divide-y divide-slate-100 dark:divide-brand-muted/20">
                    {remoteRows.length === 0 && <p className="text-xs text-slate-400 text-center py-3">No remote rows</p>}
                    {remoteRows.map((row, i) => (
                      <div key={i} className="flex items-center justify-between gap-3 px-3 py-1.5">
                        <span className="text-xs text-slate-600 dark:text-slate-300 font-mono truncate">{row.id}</span>
                        <span className="text-xs text-slate-400 font-mono shrink-0">{row.entity}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-slate-200/60 dark:border-brand-muted/40 pt-4 space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Sync Operations</p>
              <Button variant="outline" onClick={handlePull} disabled={pullLoading || pushLoading || freshLoading} className="w-full">
                {pullLoading ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> Pulling…</> : <><Download className="h-3.5 w-3.5 mr-1.5" /> Pull Remote → Local</>}
              </Button>
              <Button variant="outline" onClick={handlePush} disabled={pullLoading || pushLoading || freshLoading} className="w-full">
                {pushLoading ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> Pushing…</> : <><Upload className="h-3.5 w-3.5 mr-1.5" /> Push Local → Remote</>}
              </Button>
              <p className="text-xs text-slate-400">Realtime push ≈ seconds · periodic pull every 2 min · reconnect watchdog 30 s</p>
            </div>
          </DevCard>
        </Reveal>

        {/* Data Management */}
        <Reveal delay={150}>
          <DevCard
            icon={FileUp}
            cardClass="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border border-emerald-200 dark:border-emerald-800"
            tileClass="bg-gradient-to-br from-emerald-500 to-teal-600"
            title="Data Management"
            subtitle="Import a backup, export raw data, or download custom reports."
          >
            <div className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Import</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Select a JSON or XLSX export file to preview and import. XLSX files from the Custom Export (Excel) round-trip with original IDs.</p>
              <input ref={fileInputRef} type="file" accept=".json,.xlsx,.xls" onChange={handleFileSelect} className="hidden" />
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="flex-1"><Upload className="h-3.5 w-3.5 mr-1.5" /> Choose File</Button>
                {importFileName && <span className="text-xs text-slate-500 truncate">{importFileName}</span>}
              </div>
              {importData !== null && (
                <div className="rounded-xl border border-slate-200 dark:border-brand-muted/40 bg-white/60 dark:bg-white/5 p-3 text-xs space-y-1.5">
                  <p className="font-bold text-slate-500 dark:text-slate-400">Preview</p>
                  {Object.entries(importData).map(([key, items]) =>
                    Array.isArray(items) && (
                      <div key={key} className="flex justify-between border-b border-slate-100 dark:border-brand-muted/20 py-1 last:border-0">
                        <span className="text-slate-600 dark:text-slate-300 capitalize">{key.replace('_', ' ')}</span>
                        <span className="font-mono text-slate-800 dark:text-slate-200">{items.length}</span>
                      </div>
                    )
                  )}
                  <Button onClick={handleFileImport} className="w-full mt-2"><Download className="h-3.5 w-3.5 mr-1.5" /> Import Data</Button>
                </div>
              )}
              {status && <div className="p-3 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-sm text-green-700 dark:text-green-300">{status}</div>}
            </div>

            <div className="border-t border-slate-200/60 dark:border-brand-muted/40 pt-4 space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Export</p>
              <Button variant="outline" onClick={handleExportRaw} disabled={exporting} className="w-full"><Download className="h-3.5 w-3.5 mr-1.5" /> Export Raw Data (JSON)</Button>
              <p className="text-xs text-slate-500 dark:text-slate-400 pt-1">Custom Export — selected sections for a specific period. Dates are optional — leave both empty for all time.</p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="From date">
                  <input id="custom-export-from" name="custom-export-from" type="date" value={exportFrom} onChange={e => setExportFrom(e.target.value)} className={inputCls} />
                </Field>
                <Field label="To date">
                  <input id="custom-export-to" name="custom-export-to" type="date" value={exportTo} onChange={e => setExportTo(e.target.value)} className={inputCls} />
                </Field>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Sections — select one or all</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {[{ k: 'income', l: 'Income' }, { k: 'expenses', l: 'Expenses' }, { k: 'investments', l: 'Investments' }, { k: 'categories', l: 'Categories' }, { k: 'parties', l: 'Party' }, { k: 'recurring', l: 'Recurring' }, { k: 'works', l: 'Works' }, { k: 'goals', l: 'Goals' }, { k: 'accounts', l: 'Accounts' }, { k: 'partnership', l: 'Partnership' }].map(s => (
                    <label key={s.k} className={cn("flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer select-none transition-colors text-xs",
                      exportSections[s.k] ? "border-emerald-400/60 bg-emerald-50 dark:bg-emerald-900/30 text-slate-900 dark:text-slate-100" : "border-slate-200 dark:border-brand-muted text-slate-500")}>
                      <input type="checkbox" checked={!!exportSections[s.k]} onChange={() => setExportSections({ ...exportSections, [s.k]: !exportSections[s.k] })} className="accent-emerald-600" />
                      {s.l}
                    </label>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { k: 'xlsx', l: 'Excel (XLSX)' },
                  { k: 'json', l: 'JSON (re-importable)' },
                ].map(f => (
                  <button key={f.k} type="button" onClick={() => setExportFormat(f.k as 'xlsx' | 'json')}
                    className={cn("px-3 py-2 rounded-lg border text-xs font-medium transition-colors",
                      exportFormat === f.k ? "border-emerald-400/60 bg-emerald-50 dark:bg-emerald-900/30 text-slate-900 dark:text-slate-100" : "border-slate-200 dark:border-brand-muted text-slate-500")}>
                    {f.l}
                  </button>
                ))}
              </div>
              <Button variant="outline" onClick={handleCustomExport} disabled={exporting} className="w-full">
                {exporting ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Exporting...</> : <><Download className="h-4 w-4 mr-1.5" /> Export Custom ({exportFormat.toUpperCase()})</>}
              </Button>
            </div>
          </DevCard>
        </Reveal>

        {/* Diagnostics */}
        <Reveal delay={200}>
          <DevCard
            icon={Activity}
            cardClass="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200 dark:border-amber-800"
            tileClass="bg-gradient-to-br from-amber-500 to-orange-600"
            title="Diagnostics"
            subtitle="Sync health, local database stats, and storage usage."
          >
            <div className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Sync Health</p>
              <div className="rounded-xl border border-slate-200 dark:border-brand-muted/40 bg-white/60 dark:bg-white/5 p-3">
                {(() => {
                  const cfg = getConfig();
                  const sbAccount = readRemoteAccount(cfg);
                  const lastEv = getLastSyncEvent();
                  return (
                    <>
                      <StatRow label="URL" value={cfg.url ? mask(cfg.url) : '(none)'} />
                      <StatRow label="Sync account" value={sbAccount} />
                      <StatRow mono={false} label="Status" value={<span className={cn('font-mono', syncOk === true ? 'text-green-600 dark:text-green-400' : syncOk === false ? 'text-red-500' : 'text-slate-400')}>{syncOk === null ? 'untested' : syncOk ? 'connected' : 'failed'}</span>} />
                      <StatRow label="Last sync event" value={lastEv ? `${lastEv.status}${lastEv.message ? ` · ${lastEv.message}` : ''}` : '—'} />
                    </>
                  );
                })()}
              </div>
              <Button variant="outline" onClick={testSync} disabled={syncing} className="w-full">
                {syncing ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> Testing...</> : 'Test Connection'}
              </Button>
            </div>

            <div className="border-t border-slate-200/60 dark:border-brand-muted/40 pt-4 space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Local Database</p>
              <Button variant="outline" onClick={loadDbStats} className="w-full">{dbStats ? 'Refresh Stats' : 'Load Stats'}</Button>
              {dbStats && (
                <div className="rounded-xl border border-slate-200 dark:border-brand-muted/40 bg-white/60 dark:bg-white/5 p-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
                    {Object.entries(dbStats).map(([k, v]) => (
                      <StatRow key={k} label={k.replace('_', ' ')} value={v < 0 ? 'err' : v} />
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-slate-200/60 dark:border-brand-muted/40 pt-4 space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Storage</p>
              <div className="rounded-xl border border-slate-200 dark:border-brand-muted/40 bg-white/60 dark:bg-white/5 p-3">
                {(() => {
                  let lsSize = 0;
                  try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k) lsSize += (k.length + (localStorage.getItem(k) || '').length) * 2; } } catch {}
                  return (
                    <>
                      <StatRow label="localStorage" value={`${(lsSize / 1024).toFixed(1)} KB`} />
                      <StatRow label="IndexedDB" value="(auto-managed)" />
                    </>
                  );
                })()}
              </div>
            </div>

            <div className="border-t border-slate-200/60 dark:border-brand-muted/40 pt-4 space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">localStorage Keys</p>
              <Button variant="outline" onClick={loadLsInspector} className="w-full">{lsData ? 'Refresh Keys' : 'Browse Keys'}</Button>
              {lsData && (
                <div className="rounded-xl border border-slate-200 dark:border-brand-muted/40 bg-white/60 dark:bg-white/5 overflow-hidden">
                  <div className="max-h-40 overflow-y-auto divide-y divide-slate-100 dark:divide-brand-muted/20 text-[11px]">
                    {lsData.map((item, i) => (
                      <div key={i} className="px-3 py-2 space-y-0.5">
                        <div className="font-mono text-slate-700 dark:text-slate-300 break-all">{item.key}</div>
                        <div className="text-slate-400 dark:text-slate-500 break-all">{item.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </DevCard>
        </Reveal>

        {/* Announcements */}
        <Reveal delay={250}>
          <DevCard
            icon={Megaphone}
            cardClass="bg-gradient-to-r from-orange-50 to-rose-50 dark:from-orange-900/20 dark:to-rose-900/20 border border-orange-200 dark:border-orange-800"
            tileClass="bg-gradient-to-br from-orange-500 to-rose-600"
            title="Announcements"
            subtitle="Broadcast pills & banner are fetched live from jsonbin.io on every dashboard load — edit them online, no app update needed."
          >
            <div className="rounded-xl border border-slate-200 dark:border-brand-muted/40 bg-white/60 dark:bg-white/5 p-3">
              <StatRow label="Broadcast bin" value={mask(BROADCAST_BIN_ID)} />
              <StatRow label="Banner bin" value={mask(BANNER_BIN_ID)} />
              <StatRow label="Dismissed pills (this device)" value={dismissedCount} />
            </div>
            {annTest && (
              <div className={cn('p-3 rounded-xl text-sm', annTest.includes('FAILED') ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800' : 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800')}>
                {annTest}
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Button variant="outline" onClick={testAnnouncements} disabled={annTesting} className="w-full">
                {annTesting ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> Testing...</> : 'Test Bin Fetch'}
              </Button>
              <Button variant="outline" onClick={clearDismissed} disabled={!dismissedCount} className="w-full">
                Clear Dismissed Pills
              </Button>
            </div>
          </DevCard>
        </Reveal>

        {/* App & Session */}
        <Reveal delay={300}>
          <DevCard
            icon={User}
            cardClass="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border border-purple-200 dark:border-purple-800"
            tileClass="bg-gradient-to-br from-purple-500 to-pink-600"
            title="App & Session"
            subtitle="Active session, theme brand, and recovery PINs."
          >
            <div className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Session</p>
              <div className="rounded-xl border border-slate-200 dark:border-brand-muted/40 bg-white/60 dark:bg-white/5 p-3">
                <StatRow label="ID" value={session?.user?.id || 'unknown'} />
                <StatRow label="Name" value={session?.user?.full_name || session?.user?.email || 'unknown'} />
              </div>
            </div>

            <div className="border-t border-slate-200/60 dark:border-brand-muted/40 pt-4 space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Theme Brand</p>
              <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-brand-muted/40 bg-white/60 dark:bg-white/5 p-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 capitalize">{brand}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Active theme brand ({brands.length} available)</p>
                </div>
                <Button variant="outline" size="sm" onClick={handleBrandCycle}><Palette className="h-3.5 w-3.5 mr-1.5" /> Next Brand</Button>
              </div>
            </div>

            {hasPins() && (
              <div className="border-t border-slate-200/60 dark:border-brand-muted/40 pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Recovery PINs</p>
                  <span className="text-xs text-slate-400">{getRemainingPins()} remaining</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {getPins().map((pin, i) => (
                    <span key={i} className={cn('font-mono text-sm px-3 py-1.5 rounded-lg border', i < getUsedIndex() ? 'bg-slate-100 dark:bg-brand-muted text-slate-400 dark:text-slate-500 line-through border-slate-200 dark:border-brand-muted' : 'bg-amber-50 dark:bg-amber-900/20 text-slate-900 dark:text-slate-100 border-amber-200 dark:border-amber-800/40')}>
                      {showPins ? pin : '••••'}
                    </span>
                  ))}
                </div>
                <Button variant="ghost" size="sm" onClick={() => setShowPins(!showPins)} className="text-xs">
                  {showPins ? <><EyeOff className="h-3.5 w-3.5 mr-1.5" /> Hide PINs</> : <><Eye className="h-3.5 w-3.5 mr-1.5" /> Reveal PINs</>}
                </Button>
              </div>
            )}
          </DevCard>
        </Reveal>

        {/* Danger Zone */}
        <Reveal delay={350}>
          <DevCard
            icon={ShieldAlert}
            cardClass="bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/20 border border-red-200 dark:border-red-800"
            tileClass="bg-gradient-to-br from-red-500 to-rose-600"
            title="Danger Zone"
            subtitle="Destructive actions. Read each warning carefully before proceeding."
          >
            <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50/70 dark:bg-red-950/30 p-4 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-red-700 dark:text-red-300">Irreversible operations</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">These actions permanently delete data. Export a backup first if in doubt.</p>
              </div>
            </div>
            <div className="space-y-2">
              <Button variant="outline" onClick={() => { setFreshConfirm(true); setFreshStage(1); }} disabled={freshLoading || pullLoading || pushLoading} className="w-full text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800 hover:bg-amber-50 dark:hover:bg-amber-900/20">
                {freshLoading ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> Processing...</> : <><RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Start Fresh: Clear Remote + Push Local</>}
              </Button>
              <Button variant="outline" onClick={() => setConfirmBox({ mode: 'clearRemote', stage: 1 })} className="w-full text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20">
                <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Clear Remote Only
              </Button>
              <Button variant="outline" onClick={() => { setClearLocalConfirm(true); setClearLocalStage(1); }} disabled={clearLocalLoading || pullLoading || pushLoading || freshLoading} className="w-full text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20">
                {clearLocalLoading ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> Clearing...</> : <><Trash2 className="h-3.5 w-3.5 mr-1.5" /> Clear Local Only</>}
              </Button>
              <Button variant="outline" onClick={() => setConfirmBox({ mode: 'clear', stage: 1 })} disabled={clearing || pullLoading || pushLoading || freshLoading} className="w-full text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 font-bold">
                {clearing ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> Clearing...</> : <><Trash2 className="h-3.5 w-3.5 mr-1.5" /> Clear ALL Data (Local + Remote)</>}
              </Button>
            </div>
          </DevCard>
        </Reveal>
      </div>

      {confirmBox && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md overflow-y-auto flex items-start sm:items-center justify-center z-[130] p-4">
          <div className="bg-white dark:bg-[#2A2522] rounded-2xl max-w-md w-full shadow-2xl border-2 border-red-400 dark:border-red-600 overflow-hidden my-4">
            <div className="bg-gradient-to-r from-red-600 to-red-700 px-6 py-5 text-center">
              <div className="mx-auto w-14 h-14 rounded-full bg-white/20 flex items-center justify-center mb-3">
                <Trash2 className="h-7 w-7 text-white" />
              </div>
              <h3 className="text-xl font-bold text-white">
                {confirmBox.mode === 'clear'
                  ? (confirmBox.stage === 1 ? 'Clear All Data' : 'Are you absolutely sure?')
                  : 'Clear Remote Data'}
              </h3>
              <p className="text-sm text-red-100 mt-1">This action cannot be undone</p>
            </div>
            <div className="p-6 space-y-3">
              <div className="bg-red-50 dark:bg-red-950/40 rounded-xl p-4 border border-red-200 dark:border-red-800 space-y-2">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                  {confirmBox.mode === 'clear' ? (
                    <p className="text-sm font-semibold text-red-700 dark:text-red-300">
                      {confirmBox.stage === 1
                        ? 'Delete ALL data? This cannot be undone.'
                        : 'Are you absolutely sure? Everything will be erased.'}
                    </p>
                  ) : (
                    <p className="text-sm font-semibold text-red-700 dark:text-red-300">
                      Delete ALL remote Supabase data? Local data stays untouched.
                    </p>
                  )}
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setConfirmBox(null)}>Cancel</Button>
                <Button variant="danger" size="sm" className="gap-1.5" onClick={confirmPrimary}>
                  <Trash2 className="h-3.5 w-3.5" />
                  {confirmBox.mode === 'clear' && confirmBox.stage === 1 ? 'Continue' : 'Yes, Delete'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {freshConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md overflow-y-auto flex items-start sm:items-center justify-center z-[130] p-4">
          <div className="bg-white dark:bg-[#2A2522] rounded-2xl max-w-md w-full shadow-2xl border-2 border-amber-400 dark:border-amber-600 overflow-hidden my-4">
            <div className="bg-gradient-to-r from-amber-600 to-amber-700 px-6 py-5 text-center">
              <div className="mx-auto w-14 h-14 rounded-full bg-white/20 flex items-center justify-center mb-3">
                <AlertTriangle className="h-7 w-7 text-white" />
              </div>
              <h3 className="text-xl font-bold text-white">
                {freshStage === 1 ? 'Start Fresh?' : 'Confirm Start Fresh'}
              </h3>
              <p className="text-sm text-amber-100 mt-1">Clear remote, then push local data</p>
            </div>
            <div className="p-6 space-y-3">
              <div className="bg-amber-50 dark:bg-amber-950/40 rounded-xl p-4 border border-amber-200 dark:border-amber-800 space-y-2">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">
                    {freshStage === 1
                      ? 'This will delete ALL remote Supabase data, then push your current local data as the new source of truth.'
                      : 'Are you absolutely sure? Remote data will be erased and replaced with local data.'}
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setFreshConfirm(false)}>Cancel</Button>
                <Button variant="danger" size="sm" className="gap-1.5" onClick={() => { if (freshStage === 1) setFreshStage(2); else handleStartFresh(); }}>
                  <Trash2 className="h-3.5 w-3.5" />
                  {freshStage === 1 ? 'Continue' : 'Yes, Start Fresh'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {clearLocalConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md overflow-y-auto flex items-start sm:items-center justify-center z-[130] p-4">
          <div className="bg-white dark:bg-[#2A2522] rounded-2xl max-w-md w-full shadow-2xl border-2 border-red-400 dark:border-red-600 overflow-hidden my-4">
            <div className="bg-gradient-to-r from-red-600 to-red-700 px-6 py-5 text-center">
              <div className="mx-auto w-14 h-14 rounded-full bg-white/20 flex items-center justify-center mb-3">
                <AlertTriangle className="h-7 w-7 text-white" />
              </div>
              <h3 className="text-xl font-bold text-white">
                {clearLocalStage === 1 ? 'Clear Local Data?' : 'Confirm Clear Local'}
              </h3>
              <p className="text-sm text-red-100 mt-1">This cannot be undone</p>
            </div>
            <div className="p-6 space-y-3">
              <div className="bg-red-50 dark:bg-red-950/40 rounded-xl p-4 border border-red-200 dark:border-red-800 space-y-2">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-sm font-semibold text-red-700 dark:text-red-300">
                    {clearLocalStage === 1
                      ? 'Delete ALL local data (IndexedDB, PouchDB cache)? Remote data stays untouched.'
                      : 'Are you absolutely sure? All local data will be erased.'}
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setClearLocalConfirm(false)}>Cancel</Button>
                <Button variant="danger" size="sm" className="gap-1.5" onClick={() => { if (clearLocalStage === 1) setClearLocalStage(2); else handleClearLocal(); }}>
                  <Trash2 className="h-3.5 w-3.5" />
                  {clearLocalStage === 1 ? 'Continue' : 'Yes, Clear Local'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

function DevCard({ icon: Icon, cardClass, tileClass, title, subtitle, right, children }: {
  icon: any;
  cardClass: string;
  tileClass: string;
  title: string;
  subtitle: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('rounded-2xl p-6', cardClass)}>
      <div className="flex items-start gap-4">
        <div className={cn('p-3 rounded-xl shadow-sm', tileClass)}>
          <Icon className="h-6 w-6 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">{title}</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{subtitle}</p>
            </div>
            {right}
          </div>
          <div className="mt-4">{children}</div>
        </div>
      </div>
    </div>
  );
}

function StatRow({ label, value, mono = true }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-xs text-slate-500 dark:text-slate-400">{label}</span>
      <span className={cn('text-xs text-slate-800 dark:text-slate-200 text-right truncate', mono && 'font-mono')}>{value}</span>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1">{label}</span>
      {children}
    </label>
  );
}
