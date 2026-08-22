'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { db } from '@/lib/db';
import { clearRemote, getConfig, checkConnection } from '@/lib/pouchdb';
import { downloadBlob } from '@/lib/download';
import { AlertTriangle, Trash2, Loader2, Download, Upload, Key, Eye, EyeOff, Database, HardDrive, Search, Wifi, Palette, User, FileUp, Megaphone } from 'lucide-react';
import { getPins, getUsedIndex, getRemainingPins, hasPins } from '@/lib/pinStore';
import { cn } from '@/lib/utils';
import { getSession } from '@/lib/localAuth';
import { useTheme, getBrands } from '@/components/ThemeProvider';
import { useToast } from '@/components/Toast';
import { createProgressOverlay } from '@/lib/progressOverlay';
import { getLastSyncEvent } from '@/lib/sync-notify';
import { BROADCAST_BIN_ID, BANNER_BIN_ID, JSONBIN_BASE, ANNOUNCEMENTS_API } from '@/lib/env';
import { RELEASE_NOTES, getLastSeenVersion } from '@/lib/whats-new';

const mask = (s: string) => (s && s.length > 12 ? `${s.slice(0, 6)}…${s.slice(-4)}` : s);

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

  useEffect(() => {
    const m = document.querySelector('meta[name="app-version"]');
    if (m) setAppVersion(m.getAttribute('content') || '');
    refreshDismissed();
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
      setTimer(t => { if (t <= 1) { clearInterval(interval); router.push('/dashboard'); return 0; } return t - 1; });
    }, 1000);
    return () => { clearInterval(interval); window.removeEventListener('mousedown', handler); window.removeEventListener('keydown', handler); window.removeEventListener('touchstart', handler); };
  }, [warnDismissed]);

  const dismissWarn = () => {
    setWarnDismissed(true);
  };

  const session = typeof window !== 'undefined' ? getSession() : null;
  const { brand, setBrand } = useTheme();
  const brands = getBrands();

  const handleClear = async () => {
    if (!confirm('Delete ALL data? This cannot be undone.')) return;
    if (!confirm('Are you absolutely sure? Everything will be erased.')) return;
    setClearing(true);
    const overlay = createProgressOverlay('Clearing data…');
    try {
      overlay.update('Clearing remote data…', 1, 3);
      await clearRemote();
      overlay.update('Clearing local database…', 2, 3);
      const { clearAllDB } = await import('@/lib/store');
      await clearAllDB((label, done, total) => overlay.update(label, done, total));
      setClearing(false);
      setCleared(true);
      overlay.finish('All data cleared — reloading', () => window.location.reload());
    } catch {
      setClearing(false);
      overlay.error('Failed to clear data', () => window.location.reload());
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFileName(file.name);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (typeof parsed !== 'object' || parsed === null) { setStatus('Invalid file format: expected JSON object with table arrays.'); return; }
      setImportData(parsed as Record<string, any[]>);
      setStatus(`Loaded ${file.name} — ${Object.keys(parsed).length} tables found`);
    } catch { setStatus('Failed to parse file. Ensure it is a valid JSON export.'); }
  };

  const handleFileImport = async () => {
    if (!importData) { setStatus('No file loaded.'); return; }
    const overlay = createProgressOverlay('Importing data…');
    try {
      const tableMap: Record<string, string> = {
        transactions: 'transactions', partners: 'partners', recurring: 'recurring',
        budgets: 'budgets', reminders: 'reminders', adjustments: 'adjustments',
        goals: 'goals', todos: 'todos', mutation_log: 'mutation_log',
      };
      const entries = Object.entries(tableMap).filter(([key]) => Array.isArray(importData[key]) && importData[key].length > 0);
      const total = entries.reduce((n, [, table]) => n + importData[table].length, 0);
      let done = 0;
      for (const [key, tableName] of entries) {
        const items = importData[key];
        done += items.length;
        overlay.update(`Importing ${key}…`, done, Math.max(total, 1));
        setStatus(`Importing ${key}… (${done.toLocaleString()} / ${total.toLocaleString()})`);
        await (db as any)[tableName].bulkPut(items);
      }
      setStatus(`Import complete — ${total.toLocaleString()} items. Redirecting...`);
      overlay.finish(`Import complete — ${total.toLocaleString()} items`, () => router.push('/dashboard'));
    } catch {
      setStatus('Import failed.');
      overlay.error('Import failed', () => router.push('/dashboard'));
    }
  };

  const loadDbStats = async () => {
    setDbStats(null);
    const tables = ['transactions','partners','recurring','budgets','reminders','adjustments','goals','todos','mutation_log'] as const;
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
    const tables = ['transactions','partners','recurring','budgets','reminders','adjustments','goals','todos','mutation_log'] as const;
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
      <div className="max-w-2xl mx-auto py-12 px-4 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Developer Zone</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Tools and diagnostics</p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
            <p className="text-xs text-brand font-mono">{appVersion || 'v?.?.?.?'}</p>
            <p className="text-xs text-slate-400 font-mono">Release notes: {RELEASE_NOTES.version} · seen: {getLastSeenVersion() || 'never'}</p>
            <p className="text-xs text-amber-600 dark:text-amber-400 font-mono">Session expires in {Math.floor(timer / 60)}:{(timer % 60).toString().padStart(2, '0')}</p>
          </div>
        </div>

        {/* Import from File */}
        <Section icon={FileUp} title="Import from File" iconColor="text-brand">
          <p className="text-xs text-slate-500 dark:text-slate-400">Select a JSON export file to preview and import.</p>
          <input ref={fileInputRef} type="file" accept=".json" onChange={handleFileSelect} className="hidden" />
          <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="w-full gap-2"><Upload className="h-4 w-4" /> Choose File</Button>
          {importFileName && <p className="text-xs text-slate-500">Selected: {importFileName}</p>}
          {importData !== null && (
            <div className="text-xs space-y-2">
              <p className="text-slate-400 font-medium">Preview</p>
              {Object.entries(importData).map(([key, items]) => (
                Array.isArray(items) && <div key={key} className="flex justify-between border-b border-slate-100 dark:border-brand-muted/30 py-1">
                  <span className="text-slate-500 capitalize">{key.replace('_', ' ')}</span>
                  <span className="font-mono text-slate-700 dark:text-slate-300">{items.length}</span>
                </div>
              ))}
              <Button onClick={handleFileImport} className="w-full gap-2 mt-2"><Download className="h-4 w-4" /> Import Data</Button>
            </div>
          )}
          {status && <div className="p-3 rounded-xl bg-green-50 dark:bg-green-900/20 text-sm text-green-700 dark:text-green-300">{status}</div>}
        </Section>

        {/* DB Stats */}
        <Section icon={Database} title="DB Stats" iconColor="text-emerald-500">
          <Button variant="outline" onClick={loadDbStats} className="w-full text-xs">{dbStats ? 'Refresh' : 'Load Stats'}</Button>
          {dbStats && (
            <div className="text-xs space-y-1">
              {Object.entries(dbStats).map(([k, v]) => (
                <div key={k} className="flex justify-between border-b border-slate-100 dark:border-brand-muted/30 py-1">
                  <span className="text-slate-500 capitalize">{k.replace('_', ' ')}</span>
                  <span className="font-mono text-slate-700 dark:text-slate-300">{v < 0 ? 'err' : v}</span>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Storage Usage */}
        <Section icon={HardDrive} title="Storage Usage" iconColor="text-purple-500">
          {(() => {
            let lsSize = 0;
            try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k) lsSize += (k.length + (localStorage.getItem(k) || '').length) * 2; } } catch {}
            return (
              <div className="text-xs space-y-1">
                <div className="flex justify-between py-1"><span className="text-slate-500">localStorage</span><span className="font-mono text-slate-700 dark:text-slate-300">{(lsSize / 1024).toFixed(1)} KB</span></div>
                <div className="flex justify-between py-1"><span className="text-slate-500">IndexedDB</span><span className="font-mono text-slate-700 dark:text-slate-300">(auto-managed)</span></div>
              </div>
            );
          })()}
        </Section>

        {/* localStorage Inspector */}
        <Section icon={Search} title="localStorage Inspector" iconColor="text-cyan-500">
          <Button variant="outline" onClick={loadLsInspector} className="w-full text-xs">{lsData ? 'Refresh' : 'Browse Keys'}</Button>
          {lsData && (
            <div className="text-[10px] max-h-40 overflow-y-auto space-y-2">
              {lsData.map((item, i) => (
                <div key={i} className="border-b border-slate-100 dark:border-brand-muted/30 pb-1">
                  <div className="font-mono text-slate-700 dark:text-slate-300 break-all">{item.key}</div>
                  <div className="text-slate-400 break-all">{item.value}</div>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Export Raw Data */}
        <Section icon={Download} title="Export Raw Data" iconColor="text-orange-500">
          <p className="text-xs text-slate-500 dark:text-slate-400">Download all DB tables as a single JSON file.</p>
          <Button variant="outline" onClick={handleExportRaw} className="w-full text-xs gap-2"><Download className="h-3.5 w-3.5" /> Export JSON</Button>
        </Section>

        {/* Sync Diagnostics */}
        <Section icon={Wifi} title="Sync Diagnostics" iconColor="text-sky-500">
          {(() => {
            const cfg = getConfig();
            let sbEmail: string | null = null;
            try { sbEmail = JSON.parse(localStorage.getItem('mm_sb_session') || 'null')?.user?.email || null; } catch {}
            const lastEv = getLastSyncEvent();
            return (
              <>
                <div className="text-xs space-y-1 mb-3">
                  <div className="flex justify-between"><span className="text-slate-500">URL</span><span className="font-mono text-slate-700 dark:text-slate-300 truncate ml-2">{cfg.url ? mask(cfg.url) : '(none)'}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Sync account</span><span className="font-mono text-slate-700 dark:text-slate-300 truncate ml-2">{sbEmail || 'not signed in'}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Status</span><span className={cn('font-mono', syncOk === true ? 'text-green-500' : syncOk === false ? 'text-red-500' : 'text-slate-400')}>{syncOk === null ? 'untested' : syncOk ? 'connected' : 'failed'}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Last sync event</span><span className="font-mono text-slate-700 dark:text-slate-300 truncate ml-2">{lastEv ? `${lastEv.status}${lastEv.message ? ` · ${lastEv.message}` : ''}` : '—'}</span></div>
                  <p className="text-[10px] text-slate-400 pt-1">Realtime push ≈ seconds · periodic pull every 2 min · reconnect watchdog 30 s</p>
                </div>
                <Button variant="outline" onClick={testSync} disabled={syncing} className="w-full text-xs">
                  {syncing ? <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Testing...</> : 'Test Connection'}
                </Button>
                <Button variant="outline" onClick={async () => { if (!confirm('Delete ALL remote Supabase data? Local data stays untouched.')) return; setStatus('Clearing remote...'); await clearRemote(); setStatus('Remote cleared'); }} className="w-full text-xs text-red-500 border-red-200 hover:bg-red-50 dark:hover:bg-red-900/20">
                  Clear Remote Data
                </Button>
              </>
            );
          })()}
        </Section>

        {/* Remote Announcements */}
        <Section icon={Megaphone} title="Remote Announcements" iconColor="text-orange-500">
          <p className="text-xs text-slate-500 dark:text-slate-400">Broadcast pills &amp; banner are fetched live from jsonbin.io on every dashboard load — edit them online, no app update needed (see docs/BROADCAST-GUIDE.md).</p>
          <div className="text-xs space-y-1">
            <div className="flex justify-between"><span className="text-slate-500">Broadcast bin</span><span className="font-mono text-slate-700 dark:text-slate-300">{mask(BROADCAST_BIN_ID)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Banner bin</span><span className="font-mono text-slate-700 dark:text-slate-300">{mask(BANNER_BIN_ID)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Dismissed pills (this device)</span><span className="font-mono text-slate-700 dark:text-slate-300">{dismissedCount}</span></div>
          </div>
          {annTest && (
            <div className={cn('p-3 rounded-xl text-sm', annTest.includes('FAILED') ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300' : 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300')}>
              {annTest}
            </div>
          )}
          <Button variant="outline" onClick={testAnnouncements} disabled={annTesting} className="w-full text-xs">
            {annTesting ? <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Testing...</> : 'Test Bin Fetch'}
          </Button>
          <Button variant="outline" onClick={clearDismissed} disabled={!dismissedCount} className="w-full text-xs">
            Clear Dismissed Pills
          </Button>
        </Section>

        {/* Quick Brand Switcher */}
        <Section icon={Palette} title="Quick Brand Switcher" iconColor="text-pink-500">
          <p className="text-xs text-slate-500 dark:text-slate-400">Current: <span className="font-semibold text-slate-700 dark:text-slate-300 capitalize">{brand}</span></p>
          <Button variant="outline" onClick={handleBrandCycle} className="w-full text-xs">Next Brand</Button>
        </Section>

        {/* Session Info */}
        <Section icon={User} title="Session Info" iconColor="text-indigo-500">
          <div className="text-xs space-y-1">
            <div className="flex justify-between"><span className="text-slate-500">ID</span><span className="font-mono text-slate-700 dark:text-slate-300">{session?.user?.id || 'unknown'}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Name</span><span className="font-mono text-slate-700 dark:text-slate-300">{session?.user?.full_name || session?.user?.email || 'unknown'}</span></div>
          </div>
        </Section>

        {/* User PINs */}
        {hasPins() && (
          <Section icon={Key} title="User PINs" iconColor="text-amber-500" right={<span className="text-xs text-slate-400">{getRemainingPins()} remaining</span>}>
            <div className="flex flex-wrap gap-2">
              {getPins().map((pin, i) => (
                <span key={i} className={cn('font-mono text-sm px-3 py-1.5 rounded-lg border', i < getUsedIndex() ? 'bg-slate-100 dark:bg-brand-muted text-slate-400 dark:text-slate-500 line-through border-slate-200 dark:border-brand-muted' : 'bg-amber-50 dark:bg-amber-900/20 text-slate-900 dark:text-slate-100 border-amber-200 dark:border-amber-800/40')}>
                  {showPins ? pin : '••••'}
                </span>
              ))}
            </div>
            <Button variant="ghost" size="sm" onClick={() => setShowPins(!showPins)} className="text-xs gap-2">
              {showPins ? <><EyeOff className="h-3.5 w-3.5" /> Hide PINs</> : <><Eye className="h-3.5 w-3.5" /> Reveal PINs</>}
            </Button>
          </Section>
        )}

        {/* Danger Zone */}
        <div className="bg-white dark:bg-[#2A2522] rounded-2xl border border-red-200 dark:border-red-900/40 p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Trash2 className="h-4 w-4 text-red-500" />
            <h2 className="text-sm font-bold text-red-600 dark:text-red-400 uppercase tracking-wider">Danger Zone</h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">Wipes all data from local storage, IndexedDB, and your cloud sync rows (Supabase).</p>
          {cleared ? (
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-sm text-amber-700 dark:text-amber-300">Data cleared. Refresh the app.</div>
          ) : (
            <Button variant="danger" onClick={handleClear} disabled={clearing} className="w-full">
              {clearing ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Clearing...</> : 'Clear All Data'}
            </Button>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

function Section({ icon: Icon, title, children, iconColor, right }: { icon: any; title: string; children: React.ReactNode; iconColor?: string; right?: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-[#2A2522] rounded-2xl border border-slate-200 dark:border-brand-muted p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className={cn('h-4 w-4', iconColor || 'text-slate-500')} />
          <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">{title}</h2>
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}
