'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { db } from '@/lib/db';
import { clearRemote, getConfig, checkConnection, connected as syncConnected } from '@/lib/pouchdb';
import { downloadBlob } from '@/lib/download';
import { AlertTriangle, Trash2, Loader2, Download, Upload, Key, Eye, EyeOff, Database, BarChart3, HardDrive, Search, Wifi, Palette, User, FileUp } from 'lucide-react';
import { getPins, getUsedIndex, getRemainingPins, hasPins } from '@/lib/pinStore';
import { cn } from '@/lib/utils';
import { getSession } from '@/lib/localAuth';
import { useTheme, getBrands } from '@/components/ThemeProvider';

export default function DeveloperPage() {
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
    try {
      await clearRemote();
      const { clearAllDB } = await import('@/lib/store');
      await clearAllDB();
      setClearing(false);
      setCleared(true);
      setTimeout(() => window.location.reload(), 1500);
    } catch {
      setClearing(false);
      alert('Failed to clear data.');
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
    try {
      const tableMap: Record<string, string> = {
        transactions: 'transactions', partners: 'partners', recurring: 'recurring',
        budgets: 'budgets', reminders: 'reminders', adjustments: 'adjustments',
        goals: 'goals', todos: 'todos', mutation_log: 'mutation_log',
      };
      for (const [key, tableName] of Object.entries(tableMap)) {
        const items = importData[key];
        if (!Array.isArray(items) || items.length === 0) continue;
        await (db as any)[tableName].bulkPut(items);
      }
      setStatus('Import complete. Redirecting...');
      setTimeout(() => router.push('/dashboard'), 1500);
    } catch { setStatus('Import failed.'); }
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

  const handleExportRaw = async () => {
    const tables = ['transactions','partners','recurring','budgets','reminders','adjustments','goals','todos','mutation_log'] as const;
    const data: Record<string, any> = {};
    for (const t of tables) {
      try { data[t] = await (db[t] as any).toArray(); } catch { data[t] = []; }
    }
    downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), `money-meva-raw-${new Date().toISOString().split('T')[0]}.json`);
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
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 font-mono">Session expires in {Math.floor(timer / 60)}:{(timer % 60).toString().padStart(2, '0')}</p>
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
            return (
              <>
                <div className="text-xs space-y-1 mb-3">
                  <div className="flex justify-between"><span className="text-slate-500">URL</span><span className="font-mono text-slate-700 dark:text-slate-300 truncate ml-2">{cfg.url || '(none)'}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Status</span><span className={cn('font-mono', syncOk === true ? 'text-green-500' : syncOk === false ? 'text-red-500' : 'text-slate-400')}>{syncOk === null ? 'untested' : syncOk ? 'connected' : 'failed'}</span></div>
                </div>
                <Button variant="outline" onClick={testSync} disabled={syncing} className="w-full text-xs">
                  {syncing ? <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Testing...</> : 'Test Connection'}
                </Button>
                <Button variant="outline" onClick={async () => { if (!confirm('Delete ALL remote CouchDB data? Local data stays untouched.')) return; setStatus('Clearing remote...'); await clearRemote(); setStatus('Remote cleared'); }} className="w-full text-xs text-red-500 border-red-200 hover:bg-red-50 dark:hover:bg-red-900/20">
                  Clear Remote Data
                </Button>
              </>
            );
          })()}
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
          <p className="text-xs text-slate-500 dark:text-slate-400">Wipes all data from local storage, IndexedDB, and remote CouchDB.</p>
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
