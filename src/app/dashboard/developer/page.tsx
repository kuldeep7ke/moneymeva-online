'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { db } from '@/lib/db';
import { addPartner, isStoreReady } from '@/lib/store';
import type { PartnerAccount } from '@/types';
import { clearRemote, getConfig, checkConnection, connected as syncConnected } from '@/lib/pouchdb';
import { downloadBlob } from '@/lib/download';
import { AlertTriangle, Trash2, Loader2, Download, Key, Eye, EyeOff, Database, BarChart3, HardDrive, Search, Wifi, Palette, User } from 'lucide-react';
import { getPins, getUsedIndex, getRemainingPins, hasPins } from '@/lib/pinStore';
import { cn } from '@/lib/utils';
import { getSession } from '@/lib/localAuth';
import { useTheme, getBrands } from '@/components/ThemeProvider';

function gid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 9); }
function gtid() { return 'tr_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
function now() { return new Date().toISOString(); }
function daysIn(y: number, m: number) { return new Date(y, m, 0).getDate(); }
function iso(y: number, m: number, d: number) { return y + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0'); }
function isSunday(y: number, m: number, d: number) { return new Date(y, m - 1, d).getDay() === 0; }
function seededRand(seed: number) { let s = seed; return () => { s = (s * 16807 + 0) % 2147483647; return (s - 1) / 2147483646; }; }

function mk(type: string, cat: string, desc: string, date: string, amount: number, account: string = 'bank', partner?: string) {
  return { id: gid(), transitionId: gtid(), userId: 'local-user', amount, type, category: cat, description: desc, date, account, partnerAccountId: partner || '', isRecurring: false, createdAt: now(), updatedAt: now() };
}

function randInt(rng: () => number, a: number, b: number) { return Math.floor(rng() * (b - a + 1)) + a; }

function pickMonday(rng: () => number, y: number, m: number, week: number): number {
  for (let d = 1; d <= 7; d++) {
    const dt = new Date(y, m - 1, d);
    if (dt.getDay() === 1) return d + (week - 1) * 7;
  }
  return 1;
}

function generateAll() {
  const allTx: any[] = [];

  const config: Record<number, { elecMin: number; elecMax: number; petrol: number; dailyPetrol: boolean }> = {
    2020: { elecMin: 300, elecMax: 400, petrol: 50, dailyPetrol: true },
    2021: { elecMin: 300, elecMax: 400, petrol: 60, dailyPetrol: true },
    2022: { elecMin: 300, elecMax: 400, petrol: 70, dailyPetrol: true },
    2023: { elecMin: 300, elecMax: 400, petrol: 500, dailyPetrol: false },
    2024: { elecMin: 400, elecMax: 500, petrol: 500, dailyPetrol: false },
    2025: { elecMin: 400, elecMax: 500, petrol: 500, dailyPetrol: false },
    2026: { elecMin: 400, elecMax: 500, petrol: 500, dailyPetrol: false },
  };

  for (let y = 2020; y <= 2026; y++) {
    const cfg = config[y];
    const startM = y === 2020 ? 5 : 1;
    const endM = y === 2026 ? 7 : 12;
    for (let m = startM; m <= endM; m++) {
      const seed = y * 100 + m;
      const rng = seededRand(seed);
      const days = daysIn(y, m);

      const eDay = randInt(rng, 10, Math.min(18, days));
      let elecAmt = randInt(rng, cfg.elecMin, cfg.elecMax);
      if (m >= 4 && m <= 6) elecAmt += 200;
      allTx.push(mk('expense', 'Electricity', `MSEDCL bill — ${y}-${String(m).padStart(2, '0')}`, iso(y, m, eDay), elecAmt, 'bank', 'msedcl'));

      const skipMonth = ((y * 7 + 13) % 12) + 1;
      if (m !== skipMonth) {
        const bDay = randInt(rng, 1, 7);
        allTx.push(mk('expense', 'Mobile Recharge', `BSNL recharge — ${y}-${String(m).padStart(2, '0')}`, iso(y, m, bDay), 141, 'bank', 'bsnl'));
      }

      if (cfg.dailyPetrol) {
        const totalDays = randInt(rng, 26, 30);
        allTx.push(mk('expense', 'Fuel', `Petrol ₹${cfg.petrol}/day × ${totalDays}d — ${y}-${String(m).padStart(2, '0')}`, iso(y, m, days), cfg.petrol * totalDays, 'bank', 'anand-petroleum'));
      } else {
        allTx.push(mk('expense', 'Fuel', `Petrol — ${y}-${String(m).padStart(2, '0')}`, iso(y, m, randInt(rng, 5, 15)), cfg.petrol, 'bank', 'anand-petroleum'));
      }

      for (let w = 1; w <= 3; w++) {
        const md = pickMonday(rng, y, m, w);
        if (md <= days) {
          const marketAmt = y <= 2020 ? randInt(rng, 240, 280) : y <= 2021 ? randInt(rng, 280, 320) : y <= 2022 ? randInt(rng, 320, 380) : y <= 2023 ? randInt(rng, 380, 430) : y <= 2024 ? randInt(rng, 430, 480) : randInt(rng, 450, 500);
          allTx.push(mk('expense', 'Groceries', `Weekly market — ${y}-${String(m).padStart(2, '0')} #${w}`, iso(y, m, md), marketAmt));
        }
      }

      if ((m === 4 || m === 7 || m === 10 || m === 1) && !(y === 2020 && m < 4)) {
        allTx.push(mk('expense', 'Vehicle Maintenance', `Hero Honda CD Dawn service — ${y}-${String(m).padStart(2, '0')}`, iso(y, m, 21), 3000, 'bank', 'ola'));
      }

      if (m === 11 || m === 2 || m === 5 || m === 8) {
        if (y > 2023 || (y === 2023 && m >= 11)) {
          allTx.push(mk('expense', 'Vehicle Maintenance', `OLA S1 Pro service — ${y}-${String(m).padStart(2, '0')}`, iso(y, m, 21), 3000, 'bank', 'ola'));
        }
      }
    }
  }

  for (let y = 2020; y <= 2026; y++) {
    for (let m = 1; m <= 12; m++) {
      if (y === 2020 && m < 5) continue;
      if (y === 2026 && m > 7) break;
      let sd = 7;
      if (isSunday(y, m, sd)) sd = 6;
      const amt = y <= 2020 ? 9800 : y <= 2022 ? 10800 : y <= 2023 ? 10800 : y <= 2024 ? 11800 : 13800;
      allTx.push(mk('income', 'Salary', `Salary — ${y}-${String(m).padStart(2, '0')}`, iso(y, m, sd), amt));
    }
  }

  const diwali: { y: number; m: number; a: number }[] = [
    { y: 2020, m: 11, a: 1500 }, { y: 2021, m: 11, a: 2500 }, { y: 2022, m: 10, a: 2500 },
    { y: 2023, m: 11, a: 3000 }, { y: 2024, m: 10, a: 4000 }, { y: 2025, m: 10, a: 5000 },
  ];
  diwali.forEach(d => allTx.push(mk('income', 'Bonus', `Diwali bonus — ${d.y}`, iso(d.y, d.m, 20), d.a)));

  for (let m = 5; m <= 12; m++) allTx.push(mk('income', 'Freelance', 'YouTube SEO Manager — 2025', iso(2025, m, 16), 5000));
  for (let m = 1; m <= 7; m++) allTx.push(mk('income', 'Freelance', 'YouTube SEO Manager — 2026', iso(2026, m, 16), 5000));

  allTx.push(mk('expense', 'Vehicle', 'OLA S1 Pro — Down Payment via UPI', '2023-11-06', 49750, 'bank', 'ola'));
  allTx.push(mk('expense', 'Loan Processing Fee', 'OLA S1 Pro — Processing Fees (incl. tax)', '2023-11-06', 1491, 'bank', 'ola'));
  allTx.push(mk('expense', 'Loan Processing Fee', 'OLA S1 Pro — Mandate Fees (incl. tax)', '2023-11-06', 600, 'bank', 'ola'));
  allTx.push(mk('expense', 'Loan Processing Fee', 'OLA S1 Pro — Stamp Duty', '2023-11-06', 150, 'bank', 'ola'));
  allTx.push(mk('expense', 'Interest', 'OLA S1 Pro — Broken Period Interest', '2023-11-06', 1000, 'bank', 'ola'));
  allTx.push(mk('expense', 'Insurance', 'OLA S1 Pro — Life Insurance Premium', '2023-11-06', 1456, 'bank', 'ola'));
  allTx.push(mk('expense', 'Insurance', 'OLA S1 Pro — EMI Protect Premium', '2023-11-06', 950, 'bank', 'ola'));

  const emiMonths = [
    '2024-01','2024-02','2024-03','2024-04','2024-05','2024-06',
    '2024-07','2024-08','2024-09','2024-10','2024-11','2024-12',
    '2025-01','2025-02','2025-03','2025-04','2025-05','2025-06',
    '2025-07','2025-08','2025-09','2025-10','2025-11','2025-12',
    '2026-01','2026-02','2026-03','2026-04','2026-05','2026-06',
  ];
  emiMonths.forEach((ym, i) => {
    const [y, m] = ym.split('-');
    const amt = i + 1 === 30 ? 4751 : 4772;
    allTx.push(mk('expense', 'Loan EMI', `OLA S1 Pro EMI #${i + 1}/30 — MH16DH5796`, `${y}-${m}-03`, amt, 'bank', 'ola'));
  });

  allTx.push(mk('expense', 'Electronics', 'Mi 11x Phone — debit card', '2021-05-15', 23800));
  allTx.push(mk('expense', 'Electronics', 'Build Editing PC — cash', '2024-11-10', 85000, 'cash'));
  allTx.push(mk('expense', 'Electronics', 'Battery Inverter', '2022-06-15', 18000, 'cash'));
  allTx.push(mk('expense', 'Electronics', 'Battery change', '2026-03-20', 12500, 'cash'));
  allTx.push(mk('expense', 'Electronics', 'Air Cooler', '2022-04-10', 2300, 'cash'));
  allTx.push(mk('expense', 'Electronics', 'Mixer grinder', '2025-12-20', 2800, 'cash'));

  allTx.push(mk('expense', 'Internet', 'Darshan Internet — installation + router', '2024-09-01', 4000, 'bank'));
  allTx.push(mk('expense', 'Internet', 'BSNL Internet — deposit', '2024-09-01', 1500, 'bank', 'bsnl'));
  for (let y = 2024; y <= 2026; y++) {
    const s = y === 2024 ? 9 : 1;
    const e = y === 2026 ? 7 : 12;
    for (let m = s; m <= e; m++) allTx.push(mk('expense', 'Internet', `Internet — ${y}-${String(m).padStart(2, '0')}`, iso(y, m, 5), 600, 'bank', 'bsnl'));
  }

  return allTx;
}

export default function DeveloperPage() {
  const router = useRouter();
  const [warnDismissed, setWarnDismissed] = useState(false);
  const [status, setStatus] = useState('');
  const [count, setCount] = useState(0);
  const [skipped, setSkipped] = useState(0);
  const [clearing, setClearing] = useState(false);
  const [cleared, setCleared] = useState(false);
  const [showPins, setShowPins] = useState(false);
  const [dbStats, setDbStats] = useState<Record<string, number> | null>(null);
  const [preview, setPreview] = useState<any[] | null>(null);
  const [lsData, setLsData] = useState<{ key: string; value: string }[] | null>(null);
  const [syncOk, setSyncOk] = useState<boolean | null>(null);
  const [syncing, setSyncing] = useState(false);

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

  const handleImport = async () => {
    const allTx = generateAll();
    if (allTx.length === 0) { setStatus('No data to import. Edit generateAll() with your entries.'); return; }
    try {
      const existing = await db.transactions.toArray();
      const existingKeys = new Set(
        existing.map((t: any) => `${t.date}|${t.amount}|${t.category}|${t.description?.slice(0, 30)}`)
      );
      const newTx = allTx.filter((t: any) => {
        const key = `${t.date}|${t.amount}|${t.category}|${t.description?.slice(0, 30)}`;
        return !existingKeys.has(key);
      });
      const dupCount = allTx.length - newTx.length;
      if (newTx.length === 0) { setStatus(`All ${allTx.length} entries already exist.`); setSkipped(dupCount); return; }

      // Create parties referenced in import data
      await isStoreReady();
      const partyDefs: (Omit<PartnerAccount, 'id' | 'transitionId' | 'userId' | 'createdAt' | 'updatedAt'>)[] = [
        { name: 'OLA', group: 'vendor', type: 'Vendor', description: 'OLA Electric / Ola S1 Pro loan & service', budgetWindowStart: '', budgetWindowEnd: '', initialInvestment: 0 },
        { name: 'Anand Petroleum', group: 'vendor', type: 'Vendor', description: 'Petrol / fuel', budgetWindowStart: '', budgetWindowEnd: '', initialInvestment: 0 },
        { name: 'MSEDCL', group: 'vendor', type: 'Vendor', description: 'Electricity bill', budgetWindowStart: '', budgetWindowEnd: '', initialInvestment: 0 },
        { name: 'BSNL', group: 'vendor', type: 'Vendor', description: 'Mobile recharge', budgetWindowStart: '', budgetWindowEnd: '', initialInvestment: 0 },
      ];
      for (const p of partyDefs) addPartner(p);

      await db.transactions.bulkAdd(newTx as any);
      setCount(newTx.length);
      setSkipped(dupCount);
      setStatus(`Imported ${newTx.length} entries${dupCount > 0 ? ` (${dupCount} duplicates skipped)` : ''}. Refreshing...`);
      setTimeout(() => window.location.reload(), 1500);
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

  const loadPreview = () => {
    const all = generateAll();
    setPreview(all);
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
        </div>

        {/* Import */}
        <Section icon={Download} title="Import History Data" iconColor="text-brand">
          <p className="text-xs text-slate-500 dark:text-slate-400">Edit <code className="text-brand text-[10px]">generateAll()</code> in this page source, then click below.</p>
          <Button onClick={handleImport} className="w-full gap-2"><Download className="h-4 w-4" /> Import All Entries</Button>
          {status && <div className="p-3 rounded-xl bg-green-50 dark:bg-green-900/20 text-sm text-green-700 dark:text-green-300">{status}</div>}
          {skipped > 0 && <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-sm text-amber-700 dark:text-amber-300">{skipped} duplicates skipped.</div>}
          {count > 0 && <Button variant="outline" onClick={() => router.push('/dashboard')} className="w-full">Go to Dashboard</Button>}
        </Section>

        {/* Preview Import */}
        <Section icon={Search} title="Preview Import" iconColor="text-blue-500">
          <p className="text-xs text-slate-500 dark:text-slate-400">See what entries <code>generateAll()</code> will produce.</p>
          <Button variant="outline" onClick={loadPreview} className="w-full text-xs">Preview {preview === null ? 'Entries' : 'Refresh'}</Button>
          {preview !== null && (
            <div className="text-xs text-slate-600 dark:text-slate-300 max-h-40 overflow-y-auto space-y-0.5">
              <p className="text-slate-400 font-medium mb-1">Total: {preview.length} entries</p>
              {preview.slice(0, 50).map((t, i) => (
                <div key={i} className="truncate opacity-80 hover:opacity-100">
                  <span className="text-[10px] font-mono text-slate-400">{t.date}</span>
                  {' '}<span className={cn(t.type === 'income' ? 'text-green-600' : 'text-red-500')}>{t.type === 'income' ? '+' : '-'}₹{t.amount}</span>
                  {' '}<span className="text-slate-400">{t.category}</span>
                  {' '}<span className="text-slate-500">{t.description?.slice(0, 60)}</span>
                </div>
              ))}
              {preview.length > 50 && <p className="text-slate-400 italic">...and {preview.length - 50} more</p>}
            </div>
          )}
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
