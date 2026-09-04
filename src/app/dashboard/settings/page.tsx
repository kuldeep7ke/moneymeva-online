'use client';

import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import LoadingOverlay from '@/components/LoadingOverlay';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Upload, Download, Trash2, AlertTriangle, AlertCircle, Shield, Key, Clock, Eye, EyeOff, Cloud, ArrowRight, PaintBucket, Check, ExternalLink, RefreshCw, Copy, Globe, User } from 'lucide-react';
import { cn, todayStr } from '@/lib/utils';
import { addTransaction, getTransactions, getBudgets, getGoals, getReminders, getRecurring, getPartners, getAdjustments, getWorks, getPartnerships, getAllPartnershipEntries, logMutation } from '@/lib/store';
import { exportAllDataPDF, exportAllDataExcel } from '@/lib/export';
import { switchUser, getAllUsers, getSession, logoutUser } from '@/lib/localAuth';
import { useAuth } from '@/components/AuthProvider';
import { useTheme, getBrands } from '@/components/ThemeProvider';
import { clearAllDB, processRemoteChanges, pushAllToPouch } from '@/lib/store';
import { generatePins, getPins, arePinsShown, markPinsShown, hasPins, getRemainingPins, getAutoLockMinutes, setAutoLockMinutes } from '@/lib/pinStore';
import PinPrompt from '@/components/PinPrompt';
import PinSetupGuide from '@/components/PinSetupGuide';
import CloudSetupWizard from '@/components/CloudSetupWizard';
import { logActivity, getActivityLog } from '@/lib/activityLog';
import { db } from '@/lib/db';
import { BASE_PATH } from '@/lib/env';
import Reveal from '@/components/Reveal';
import LanguageSelector from '@/components/LanguageSelector';
import { connectRemote, disconnectRemote, checkConnection, ensureConnected, getConfig, manualSync, getSyncUrlHistory, saveSyncUrlHistory, signUpUser } from '@/lib/pouchdb';
import { dispatchSyncEvent, listenSyncEvents } from '@/lib/sync-notify';
import { downloadFile, copyText, printHtml } from '@/lib/download';
import { createProgressOverlay } from '@/lib/progressOverlay';
import { useToast } from '@/components/Toast';
export default function SettingsPage() {
  const toast = useToast();
  const { refreshAuth } = useAuth();
  const { brand, setBrand } = useTheme();

  const [clearStep, setClearStep] = useState<'idle' | 'captcha' | 'confirm'>('idle');
  const [clearMode, setClearMode] = useState<'user-data' | 'all-data'>('all-data');
  const [pins, setPins] = useState<string[]>([]);
  const [pinsGenerated, setPinsGenerated] = useState(false);
  const [pinsShown, setPinsShown] = useState(false);
  const [showPins, setShowPins] = useState(false);
  const [showPinsConfirm, setShowPinsConfirm] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const [autoLock, setAutoLock] = useState(0);

  const [pinAction, setPinAction] = useState<'danger' | 'export' | 'import' | 'autolock' | null>(null);
  const [pinClearMode, setPinClearMode] = useState<'user-data' | 'all-data' | null>(null);
  const [showPinSetup, setShowPinSetup] = useState<string | null>(null);
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(null);
  const [pendingAutoLockVal, setPendingAutoLockVal] = useState<number>(0);
  const [loading, setLoading] = useState<string | null>(null);
  const [syncUrl, setSyncUrl] = useState('');
  const [syncKey, setSyncKey] = useState('');
  const [syncEmail, setSyncEmail] = useState('');
  const [syncPassword, setSyncPassword] = useState('');
  const [syncConnected, setSyncConnected] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState('');
  const [syncFailCount, setSyncFailCount] = useState(0);
  const [showSyncFailPopup, setShowSyncFailPopup] = useState(false);
  const [syncUrlHistory, setSyncUrlHistory] = useState<string[]>([]);
  const [setupOpen, setSetupOpen] = useState(false);

  useEffect(() => {
    const existingPins = hasPins();
    if (existingPins) {
      setPins(getPins());
      setPinsGenerated(true);
      const shown = arePinsShown();
      setPinsShown(shown);
      setRemaining(getRemainingPins());
      if (!shown) {
        setAutoLock(0);
        setAutoLockMinutes(0);
      } else {
        setAutoLock(getAutoLockMinutes());
      }
    } else {
      setAutoLock(getAutoLockMinutes());
      setAutoLockMinutes(0);
    }
  }, []);

  useEffect(() => {
    const cfg = getConfig();
    if (cfg.url) {
      setSyncUrl(cfg.url);
      setSyncKey(cfg.key);
      // Restore a live connection if a cloud session exists (e.g. signed in via Google),
      // so the panel reflects Connected instead of showing "Create account & sync".
      checkConnection().then(async ok => {
        if (!ok) {
          await ensureConnected();
          ok = await checkConnection();
        }
        setSyncConnected(ok);
        setSyncStatus(ok ? 'connected' : 'idle');
      });
    }
    setSyncUrlHistory(getSyncUrlHistory());
  }, []);

  useEffect(() => {
    return listenSyncEvents(() => {
      checkConnection().then(ok => {
        setSyncConnected(ok);
        setSyncStatus(ok ? 'connected' : 'idle');
      });
    });
  }, []);

  const [captchaA, setCaptchaA] = useState(0);
  const [captchaB, setCaptchaB] = useState(0);
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  const [captchaError, setCaptchaError] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [importConfirm, setImportConfirm] = useState<{
    data: any;
    backupUser: string;
    backupId: string;
    currentUser: string;
    currentId: string;
    isFresh: boolean;
    itemCount: number;
  } | null>(null);

  const startClearData = (mode: 'user-data' | 'all-data') => {
    if (hasPins()) {
      setPinClearMode(mode);
      setPinAction('danger');
    } else {
      setShowPinSetup('clear your data');
    }
  };

  const doClearData = (mode: 'user-data' | 'all-data') => {
    setClearMode(mode);
    setCaptchaA(Math.floor(Math.random() * 10) + 1);
    setCaptchaB(Math.floor(Math.random() * 10) + 1);
    setCaptchaAnswer('');
    setCaptchaError(false);
    setClearStep('captcha');
  };

  const doExportBackup = async () => {
    const overlay = createProgressOverlay('Preparing export…');
    try {
      const version = document.querySelector('meta[name="app-version"]')?.getAttribute('content') || '7.2.0';
      const session = getSession().user;
      const profile: any = session ? { ...session, password: undefined } : {};
      const tables: [string, any[]][] = [
        ['transactions', getTransactions()], ['budgets', getBudgets()], ['goals', getGoals()],
        ['reminders', getReminders()], ['recurring', getRecurring()], ['partners', getPartners()], ['adjustments', getAdjustments()],
        ['works', getWorks()], ['partnerships', getPartnerships()], ['partnershipEntries', getAllPartnershipEntries()],
      ];
      const total = Math.max(tables.reduce((n, [, items]) => n + items.length, 0), 1);
      let done = 0;
      const exportData: Record<string, any> = {
        _metadata: {
          app: 'Money Meva', version,
          exportDate: new Date().toISOString(),
          exportedBy: session?.full_name || session?.email || 'unknown',
        },
        profile,
        _audit_log: await db.mutation_log.toArray(),
        _activity_log: getActivityLog(),
      };
      for (const [name, items] of tables) {
        done += items.length;
        exportData[name] = items;
        overlay.update(`Exporting ${name}…`, Math.min(done, total), total);
        await new Promise(resolve => setTimeout(resolve, 0));
      }
      overlay.update('Creating backup file…', total, total);
      await new Promise(resolve => setTimeout(resolve, 50));
      downloadFile(JSON.stringify(exportData, null, 2), `money-meva-backup-${new Date().toISOString().split('T')[0]}.json`, 'application/json');
      logActivity('entry_exported', 'Full JSON backup');
      overlay.finish(`Export complete — ${done.toLocaleString()} items saved`, () => overlay.close());
    } catch {
      overlay.error('Export failed. Try again.', () => overlay.close());
    }
  };

  const handlePdfExport = async () => {
    const overlay = createProgressOverlay('Exporting PDF…');
    try {
      await exportAllDataPDF((label, pct) => overlay.update(label, pct, 100));
      overlay.finish('PDF export complete — check downloads', () => overlay.close());
    } catch {
      overlay.error('PDF export failed', () => overlay.close());
    }
  };

  const handleExcelExport = async () => {
    const overlay = createProgressOverlay('Exporting Excel…');
    try {
      await exportAllDataExcel((label, pct) => overlay.update(label, pct, 100));
      overlay.finish('Excel export complete — check downloads', () => overlay.close());
    } catch {
      overlay.error('Excel export failed', () => overlay.close());
    }
  };

  const processImportFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string);
        if (!data._metadata || !data._metadata.app) { toast('Invalid backup file', 'error'); return; }
        const session = getSession().user;
        const currentId = session?.id || 'local-user';
        const currentName = session?.full_name || session?.email || 'Current User';
        const backupId = data.profile?.id || 'unknown';
        const backupUser = data.profile?.full_name || data._metadata.exportedBy || 'Unknown';
        let itemCount = 0;
        ['transactions', 'budgets', 'goals', 'reminders', 'recurring', 'partners', 'adjustments'].forEach(k => {
          if (data[k]?.length) itemCount += data[k].length;
        });
        const isFresh = !localStorage.getItem('mm_transactions') ||
          JSON.parse(localStorage.getItem('mm_transactions') || '[]').length === 0;
        if (backupId !== currentId) {
          setImportConfirm({ data, backupUser, backupId, currentUser: currentName, currentId, isFresh, itemCount });
        } else {
          doImport(data, currentId);
        }
      } catch (err) {
        toast('Error importing backup. Make sure the file is a valid JSON backup file.', 'error');
      }
    };
    reader.readAsText(file);
  };

  const handleCaptchaSubmit = () => {
    const correct = captchaA + captchaB;
    if (Number(captchaAnswer) !== correct) {
      setCaptchaError(true);
      return;
    }
    setClearStep('confirm');
  };

  const handleFinalClear = async () => {
    setClearing(true);
    const overlay = createProgressOverlay('Clearing data…');
    logActivity('data_cleared', clearMode === 'user-data' ? 'User data only' : 'All data');

    const finish = () => {
      overlay.finish('Data cleared — signing out', () => {
        setClearing(false);
        setClearStep('idle');
        setCaptchaAnswer('');
        refreshAuth();
        // Hard navigation: fully reload into the login page. A full reload is
        // required (not router.replace) so the raw progress overlay is removed
        // and the dashboard auth guard can't bounce us straight back.
        window.location.href = `${BASE_PATH}/login`;
      });
    };

    try {
      if (clearMode === 'user-data') {
        await clearAllDB((label, d, t) => overlay.update(label, d, t));
        logoutUser();
        disconnectRemote();
        finish();
      } else {
        await clearAllDB((label, d, t) => overlay.update(label, d, t));
        const allKeys = Object.keys(localStorage).filter(k => k.startsWith('mm_') || k.startsWith('money_meva_') || k.startsWith('sb-'));
        allKeys.forEach(k => localStorage.removeItem(k));
        overlay.update('Clearing browser storage…', 1, 1);
        logoutUser();
        disconnectRemote();
        finish();
      }
    } catch {
      setClearing(false);
      overlay.error('Failed to clear data', () => overlay.close());
    }
  };

  const handleConnect = async () => {
    const url = syncUrl.trim().replace(/\/+$/, '');
    if (!/^https:\/\/[a-zA-Z0-9.-]+\.supabase\.co$/.test(url)) { setSyncError('Enter a valid Supabase project URL (e.g. https://xxxx.supabase.co)'); return; }
    if (!syncKey.trim() || !syncEmail.trim() || !syncPassword.trim()) { setSyncError('Enter your anon key, sync email, and password'); return; }
    setSyncStatus('connecting');
    setSyncError('');
    dispatchSyncEvent({ status: 'started', message: 'Connecting to Supabase…' });
    try {
      const { ok, error: connErr } = await connectRemote(url, syncKey.trim(), syncEmail.trim(), syncPassword);
      if (ok) {
        saveSyncUrlHistory(url);
        setSyncUrlHistory(getSyncUrlHistory());
        setSyncStatus('connected');
        setSyncConnected(true);
        setSyncFailCount(0);
        dispatchSyncEvent({ status: 'pushing', message: 'Pushing local data to cloud…' });
        await pushAllToPouch();
        const { ok: synced, pushed, pulled } = await manualSync();
        if (synced) {
          await processRemoteChanges();
          if (pushed > 0 || pulled > 0) {
            setSyncError(`Pushed ${pushed} item(s) · Pulled ${pulled} change(s)`);
          } else {
            setSyncError('');
          }
          dispatchSyncEvent({ status: 'complete', message: `Connected & synced — pushed ${pushed}, pulled ${pulled}`, pushed, pulled });
        } else {
          dispatchSyncEvent({ status: 'error', message: 'Connected but sync failed', error: 'Replication error' });
          failSync('Connected to server but data replication failed. Try again.');
        }
      } else {
        const detail = connErr ? ` — ${connErr}` : '';
        dispatchSyncEvent({ status: 'error', message: 'Connection failed', error: connErr || 'Unknown' });
        failSync(`Could not connect.${detail}`);
      }
    } catch {
      dispatchSyncEvent({ status: 'error', message: 'Connection failed', error: 'Connection error' });
      failSync('Connection failed. Check the URL and try again.');
    }
  };

  const handleCreateAccount = async () => {
    const url = syncUrl.trim().replace(/\/+$/, '');
    if (!/^https:\/\/[a-zA-Z0-9.-]+\.supabase\.co$/.test(url)) { setSyncError('Enter a valid Supabase project URL (e.g. https://xxxx.supabase.co)'); return; }
    if (!syncKey.trim() || !syncEmail.trim() || syncPassword.length < 6) { setSyncError('Enter your anon key, email, and a password (min 6 characters)'); return; }
    setSyncStatus('connecting');
    setSyncError('');
    dispatchSyncEvent({ status: 'started', message: 'Creating account…' });
    try {
      const { ok, needsConfirmation, error: signUpErr } = await signUpUser(url, syncKey.trim(), syncEmail.trim(), syncPassword);
      if (!ok) {
        failSync(signUpErr || 'Account creation failed');
        return;
      }
      if (needsConfirmation) {
        setSyncStatus('idle');
        setSyncError('Account created! Check your email to confirm, then tap Connect.');
        return;
      }
      const { ok: connectedOk, error: connErr } = await connectRemote(url, syncKey.trim(), syncEmail.trim(), syncPassword);
      if (connectedOk) {
        saveSyncUrlHistory(url);
        setSyncUrlHistory(getSyncUrlHistory());
        setSyncStatus('connected');
        setSyncConnected(true);
        setSyncFailCount(0);
        dispatchSyncEvent({ status: 'pushing', message: 'Pushing local data to cloud…' });
        await pushAllToPouch();
        const { ok: synced, pushed, pulled } = await manualSync();
        if (synced) {
          await processRemoteChanges();
          setSyncError(pushed > 0 || pulled > 0 ? `Pushed ${pushed} item(s) · Pulled ${pulled} change(s)` : '');
        }
      } else {
        failSync(connErr || 'Connection failed after sign-up');
      }
    } catch {
      failSync('Account creation failed.');
    }
  };

  const handleDisconnect = () => {
    disconnectRemote();
    localStorage.removeItem('mm_pouch_url');
    localStorage.removeItem('mm_sync_key');
    setSyncStatus('idle');
    setSyncConnected(false);
    setSyncFailCount(0);
  };

  const handleSyncNow = async () => {
    setSyncing(true);
    setSyncError('');
    dispatchSyncEvent({ status: 'started', message: 'Manual sync started…' });
    try {
      dispatchSyncEvent({ status: 'pushing', message: 'Pushing local changes…' });
      const localCount = await pushAllToPouch();
      dispatchSyncEvent({ status: 'pushing', message: `Pulled remote changes…` });
      const { ok, pushed, pulled, pushErr } = await manualSync();
      if (ok) {
        dispatchSyncEvent({ status: 'processing', message: 'Applying remote changes…' });
        await processRemoteChanges();
        setSyncStatus('connected');
        setSyncConnected(true);
        setSyncFailCount(0);
        const msg = pushErr ? `Push error: ${pushErr}` : pushed > 0 || pulled > 0 ? `Pushed ${pushed} · Pulled ${pulled}` : localCount > 0 ? `Wrote ${localCount} local items — 0 pushed to cloud` : 'Synced — no local changes found';
        setSyncError(msg);
        dispatchSyncEvent({ status: 'complete', message: `Sync complete — pushed ${pushed}, pulled ${pulled}`, pushed, pulled });
        setTimeout(() => { setSyncError(''); }, 4000);
      } else {
        dispatchSyncEvent({ status: 'error', message: 'Sync failed during replication', error: 'Replication failed' });
        failSync('Sync failed. Ensure you are connected first.');
      }
    } catch {
      dispatchSyncEvent({ status: 'error', message: 'Sync failed', error: 'Unknown error' });
      failSync('Sync failed.');
    } finally {
      setSyncing(false);
    }
  };

  const failSync = (msg: string) => {
    setSyncStatus('error');
    setSyncError(msg);
    setSyncFailCount(c => {
      const next = c + 1;
      if (next >= 2) setShowSyncFailPopup(true);
      return next;
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <Reveal>
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 hidden md:block">Settings</h1>
          <p className="text-slate-500 dark:text-slate-400 text-base font-semibold md:font-normal md:text-sm block md:hidden">{"Import, export, and manage your data".split(' ').slice(0, 5).join(' ')}{"Import, export, and manage your data".split(' ').length > 5 ? '...' : ''}</p>
          <p className="text-slate-500 dark:text-slate-400 hidden md:block">Import, export, and manage your data</p>
        </div>
        </Reveal>

        {/* Visit Landing Page */}
        <Reveal delay={100}>
        <div className="bg-gradient-to-r from-orange-50 to-amber-50 dark:from-brand-muted/30 dark:to-amber-900/10 border border-orange-200 dark:border-orange-800 rounded-2xl p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-gradient-to-br from-brand to-orange-600 rounded-xl shadow-sm">
              <ExternalLink className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Visit Landing Page</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                Preview how your app looks to new visitors. Edit your profile from the landing page.
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                <span className="px-2 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 text-xs rounded-full font-medium">Landing Preview</span>
                <span className="px-2 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 text-xs rounded-full font-medium">Edit Profile</span>
              </div>
              <Link href="/?from=dashboard">
                <Button size="sm" className="mt-3 bg-brand hover:bg-orange-600 gap-2">
                  <ExternalLink className="h-3.5 w-3.5" /> Open Landing Page
                </Button>
              </Link>
            </div>
          </div>
        </div>
        </Reveal>

        {/* Language */}
        <Reveal delay={150}>
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border border-purple-200 dark:border-purple-800 rounded-2xl p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl">
              <Globe className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Language</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">Choose your app language</p>
              <div className="mt-4">
                <LanguageSelector />
              </div>
            </div>
          </div>
        </div>
        </Reveal>

        {/* User Account */}
        <Reveal delay={180}>
        <Link href="/dashboard/account">
        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-6 hover:shadow-md transition-shadow cursor-pointer">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl">
              <User className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">User Account</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">Change password, logout, manage account</p>
            </div>
            <ArrowRight className="h-5 w-5 text-slate-400 shrink-0" />
          </div>
        </div>
        </Link>
        </Reveal>

        {/* Multi-Device Sync */}
        <Reveal delay={200}>
        <div className="bg-gradient-to-r from-sky-50 to-blue-50 dark:from-sky-900/20 dark:to-blue-900/20 border border-sky-200 dark:border-sky-800 rounded-2xl p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-gradient-to-br from-sky-500 to-blue-600 rounded-xl">
              <Cloud className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Multi-Device Sync</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Supabase cloud sync ·{' '}
                    <button onClick={() => setSetupOpen(true)} className="text-sky-600 dark:text-sky-400 font-medium hover:underline">
                      Setup Guide
                    </button>
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className={cn("w-2 h-2 rounded-full", syncing ? 'bg-amber-500 animate-pulse' : syncStatus === 'connected' ? 'bg-green-500' : syncStatus === 'connecting' ? 'bg-amber-500 animate-pulse' : syncStatus === 'error' ? 'bg-red-500' : 'bg-slate-300')} />
                  <span className={cn("text-xs font-medium", syncing ? 'text-amber-600' : syncStatus === 'connected' ? 'text-green-600' : syncStatus === 'connecting' ? 'text-amber-600' : syncStatus === 'error' ? 'text-red-600' : 'text-slate-400')}>
                    {syncing ? 'Syncing…' : syncStatus === 'connected' ? 'Connected' : syncStatus === 'connecting' ? 'Connecting...' : syncStatus === 'error' ? 'Offline' : 'Offline'}
                  </span>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {/* URL row */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 flex items-center gap-1.5 bg-white dark:bg-brand-dark rounded-lg border border-slate-200 dark:border-brand-muted px-3 py-2 text-sm min-w-0">
                    {syncConnected ? (
                      <span className="text-slate-600 dark:text-slate-300 truncate flex-1">{syncUrl}</span>
                    ) : (
                      <input
                        value={syncUrl}
                        onChange={e => { setSyncUrl(e.target.value); setSyncError(''); }}
                        placeholder="Supabase URL (https://xxx.supabase.co)"
                        className="bg-transparent outline-none text-slate-600 dark:text-slate-300 flex-1 min-w-0"
                      />
                    )}
                    <button onClick={() => { copyText(syncUrl); }} className="p-1 text-slate-400 hover:text-sky-600 shrink-0" title="Copy URL">
                      <Copy className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Anon key row */}
                {!syncConnected && (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 flex items-center gap-1.5 bg-white dark:bg-brand-dark rounded-lg border border-slate-200 dark:border-brand-muted px-3 py-2 text-sm min-w-0">
                      <input
                        type="password"
                        value={syncKey}
                        onChange={e => { setSyncKey(e.target.value); setSyncError(''); }}
                        placeholder="Anon key (eyJ…)"
                        className="bg-transparent outline-none text-slate-600 dark:text-slate-300 flex-1 min-w-0"
                      />
                    </div>
                  </div>
                )}

                {/* Email + password rows */}
                {!syncConnected && (
                  <>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 flex items-center gap-1.5 bg-white dark:bg-brand-dark rounded-lg border border-slate-200 dark:border-brand-muted px-3 py-2 text-sm min-w-0">
                        <input
                          type="email"
                          value={syncEmail}
                          onChange={e => { setSyncEmail(e.target.value); setSyncError(''); }}
                          placeholder="Your sync email"
                          className="bg-transparent outline-none text-slate-600 dark:text-slate-300 flex-1 min-w-0"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 flex items-center gap-1.5 bg-white dark:bg-brand-dark rounded-lg border border-slate-200 dark:border-brand-muted px-3 py-2 text-sm min-w-0">
                        <input
                          type="password"
                          value={syncPassword}
                          onChange={e => { setSyncPassword(e.target.value); setSyncError(''); }}
                          placeholder="Password (min 6 characters)"
                          className="bg-transparent outline-none text-slate-600 dark:text-slate-300 flex-1 min-w-0"
                        />
                      </div>
                    </div>
                    <p className="text-[11px] leading-snug text-slate-500 dark:text-slate-400">
                      This is your <strong>cloud account password</strong> — you choose it yourself (min 6 characters) and
                      reuse it on every device. It is <strong>not</strong> your app unlock password, and <strong>not</strong>{' '}
                      your Google password. Signed in with Google? Tap <strong>Create account &amp; sync</strong> with the
                      same Google email to get cloud credentials.
                    </p>
                  </>
                )}

                {/* Saved URLs */}
                {syncUrlHistory.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[10px] text-slate-400 font-medium">Saved URLs</p>
                    <div className="space-y-0.5">
                      {syncUrlHistory.map((u, i) => (
                        <button
                          key={i}
                          type="button"
                          className="w-full text-left px-2.5 py-1.5 rounded-md text-xs text-slate-500 dark:text-slate-400 hover:bg-sky-50 dark:hover:bg-sky-900/20 truncate border border-transparent hover:border-sky-200 dark:hover:border-sky-800 transition-colors"
                          onClick={() => { setSyncUrl(u); setSyncError(''); }}
                        >
                          {u}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex flex-wrap items-center gap-2">
                  {syncStatus === 'connected' ? (
                    <>
                      <Button size="sm" className="bg-sky-600 hover:bg-sky-700 gap-1.5" onClick={handleSyncNow}>
                        <RefreshCw className="h-3.5 w-3.5" /> Sync Now
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleDisconnect} className="text-red-600 border-red-200 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20">
                        Disconnect
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button size="sm" className="bg-sky-600 hover:bg-sky-700 gap-1.5" onClick={handleConnect} disabled={syncStatus === 'connecting' || !syncUrl.trim() || !syncKey.trim() || !syncEmail.trim() || !syncPassword.trim()}>
                        <RefreshCw className={cn("h-3.5 w-3.5", syncStatus === 'connecting' && 'animate-spin')} /> Connect
                      </Button>
                      <Button size="sm" variant="outline" onClick={handleCreateAccount} disabled={syncStatus === 'connecting'}>
                        Create account &amp; sync
                      </Button>
                    </>
                  )}
                </div>

                {syncError && <p className="text-xs text-red-500">{syncError}</p>}
              </div>
            </div>
          </div>
        </div>
        </Reveal>

        {/* Sync Info */}
        <Reveal delay={300}>
          <div className="bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-800 rounded-2xl p-4 space-y-2">
            <p className="text-xs text-sky-700 dark:text-sky-400 leading-relaxed">
              Enter the same Supabase project URL, anon key, and your email + password on each device to sync all your data across devices. Each account gets its own private data space. First time here? Tap <strong>Create account &amp; sync</strong> — you pick the email + password (min 6 characters); that is your cloud account. Run <code className="font-mono">supabase/schema.sql</code> in your project&apos;s SQL Editor once before connecting. Data syncs in real-time once connected.
            </p>
          </div>
        </Reveal>

        {/* CSV Import / Export */}
        <Reveal delay={200}>
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-4">CSV Import / Export</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-[#2A2522] p-8 rounded-2xl border-2 border-dashed border-slate-200 dark:border-brand-muted shadow-sm text-center space-y-4">
            <Upload className="h-12 w-12 text-brand mx-auto" />
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Import CSV</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">Upload transactions from a CSV file</p>
            <label className="inline-flex cursor-pointer items-center justify-center rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-600">
              Choose CSV File
              <input type="file" accept=".csv" className="hidden" name="csv-import" onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => {
                  const text = reader.result as string;
                  const lines = text.split('\n').filter(l => l.trim());
                  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
                  const dateIdx = headers.findIndex(h => h === 'date');
                  const amountIdx = headers.findIndex(h => h === 'amount');
                  const catIdx = headers.findIndex(h => h === 'category');
                  const descIdx = headers.findIndex(h => h === 'description' || h === 'desc' || h === 'note' || h === 'notes');
                  const typeIdx = headers.findIndex(h => h === 'type');
                  const partnerIdx = headers.findIndex(h => h === 'partnerid' || h === 'partner');
                  const csvUnesc = (v: string) => { const t = v.trim(); if (t.startsWith('"') && t.endsWith('"')) return t.slice(1, -1).replace(/""/g, '"'); return t; };
                  let imported = 0;
                  const overlay = createProgressOverlay('Importing CSV…');
                  setTimeout(async () => {
                    try {
                      const total = Math.max(lines.length - 1, 1);
                      const partners = getPartners();
                      for (let i = 1; i < lines.length; i++) {
                        const cols = lines[i].split(',').map(c => csvUnesc(c));
                        const date = dateIdx >= 0 ? cols[dateIdx] : todayStr();
                        const amount = parseFloat(amountIdx >= 0 ? cols[amountIdx] : '0');
                        const category = catIdx >= 0 ? cols[catIdx] : 'Other';
                        const description = descIdx >= 0 ? cols[descIdx] : '';
                        let type = typeIdx >= 0 ? cols[typeIdx].toLowerCase() : 'expense';
                        type = ['income', 'expense', 'investment'].includes(type) ? type : 'expense';
                        if (!amount || isNaN(amount)) continue;
                        const partnerAccountId = partnerIdx >= 0 && cols[partnerIdx] ? partners.find((p: any) => p.id === cols[partnerIdx])?.id : undefined;
                        addTransaction({ amount, type: type as any, category, description, date, partnerAccountId, isRecurring: false });
                        imported++;
                        if (i % 25 === 0) overlay.update(`Importing transactions… ${imported} added`, i, total);
                      }
                      overlay.finish(`CSV import complete — ${imported.toLocaleString()} transactions added`, () => overlay.close());
                      toast(`Imported ${imported} transaction(s) from CSV.`, 'success');
                    } catch {
                      overlay.error('CSV import failed', () => overlay.close());
                    }
                    e.target.value = '';
                  }, 50);
                };
                reader.readAsText(file);
              }} />
            </label>
            <p className="text-xs text-slate-400 dark:text-slate-500 pt-2">Headers: date, amount, category, description, type (income/expense/investment)</p>
              <Button variant="ghost" size="sm" className="text-xs text-brand dark:text-brand-secondary" onClick={() => {
                const csv = 'date,amount,category,description,type\n2026-01-15,5000,Salary,January salary,income\n2026-01-16,200,Groceries,Weekly groceries,expense';
                downloadFile(csv, 'money-meva-template.csv', 'text/csv');
              }}>Download Template</Button>
          </div>
          <div className="bg-white dark:bg-[#2A2522] p-8 rounded-2xl border-2 border-dashed border-slate-200 dark:border-brand-muted shadow-sm text-center space-y-4">
            <Download className="h-12 w-12 text-brand mx-auto" />
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Export CSV</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">Download all transactions as CSV</p>
            <div className="flex flex-wrap gap-2 justify-center">
              <Button variant="primary" size="sm" className="gap-2" onClick={() => {
                const txs = getTransactions();
                const csvEsc = (v: any) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
                const csv = ['date,type,category,description,amount,partnerId'];
                txs.forEach(t => csv.push([csvEsc(t.date), csvEsc(t.type), csvEsc(t.category), csvEsc(t.description), csvEsc(t.amount), csvEsc(t.partnerAccountId || '')].join(',')));
                downloadFile(csv.join('\n'), 'money-meva-export.csv', 'text/csv');
              }}>
                <Download className="h-4 w-4" /> CSV
              </Button>
              <Button variant="primary" size="sm" className="gap-2" onClick={handlePdfExport}>
                <Download className="h-4 w-4" /> PDF
              </Button>
              <Button variant="primary" size="sm" className="gap-2" onClick={handleExcelExport}>
                <Download className="h-4 w-4" /> Excel
              </Button>
            </div>
          </div>
        </div>
        </Reveal>

        {/* Full JSON Backup */}
        <Reveal delay={400}>
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Full Data Backup</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 mb-6">Export or restore all your data including profile, transactions, budgets, goals, partners, audit trail, and activity log</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-[#2A2522] p-8 rounded-2xl border-2 border-dashed border-emerald-200 dark:border-emerald-800 shadow-sm text-center space-y-4">
            <Download className="h-12 w-12 text-emerald-500 mx-auto" />
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Export Full Backup (JSON)</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">Download everything — profile, transactions, budgets, goals, partners, reminders, recurring, adjustments, works, partnerships, audit trail, activity log</p>
              <Button variant="primary" className="gap-2 bg-emerald-600 hover:bg-emerald-700" onClick={() => {
                if (hasPins()) { setPinAction('export'); } else { setShowPinSetup('export your data'); }
            }}><Download className="h-4 w-4" /> Export JSON</Button>
          </div>
          <div className="bg-white dark:bg-[#2A2522] p-8 rounded-2xl border-2 border-dashed border-amber-200 dark:border-amber-800 shadow-sm text-center space-y-4">
            <Upload className="h-12 w-12 text-amber-500 mx-auto" />
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Import Full Backup (JSON)</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">Restore everything from a backup file. Duplicates are skipped, cross-user data reassigned.</p>
            <label className="inline-flex cursor-pointer items-center justify-center rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-700">
              <Upload className="mr-2 h-4 w-4" /> Choose Backup File
              <input type="file" accept=".json,application/json" className="hidden" name="json-import" onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (hasPins()) {
                  setPendingImportFile(file);
                  setPinAction('import');
                } else {
                  setShowPinSetup('import a backup');
                }
                e.target.value = '';
              }} />
            </label>
            <p className="text-xs text-slate-400 dark:text-slate-500 pt-2">Only import files exported from Money Meva</p>
          </div>
        </div>
        </Reveal>

        {/* Brand Theme */}
        <Reveal delay={500}>
        <div className="border-t border-slate-200 dark:border-brand-muted pt-6">
          <div className="bg-white dark:bg-[#2A2522] rounded-2xl border border-slate-200 dark:border-brand-muted shadow-sm p-6 space-y-4">
            <div className="flex items-center gap-3">
              <PaintBucket className="h-5 w-5 text-brand shrink-0" />
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">App Color</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Choose your palette</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {getBrands().map((b) => (
                  <button key={b.key} onClick={() => { setLoading('Applying…'); setTimeout(() => { setBrand(b.key); setLoading(null); }, 400); }}
                  className={cn(
                    "flex flex-col items-center gap-2 sm:gap-3 p-3 sm:p-4 rounded-xl border-2 transition-all",
                    brand === b.key
                      ? "border-brand ring-2 ring-brand/20"
                      : "border-slate-200 dark:border-brand-muted hover:border-slate-300 dark:hover:border-slate-600"
                  )}
                >
                  <div className="relative">
                    <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full shadow-sm" style={{ backgroundColor: b.color }} />
                    {brand === b.key && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Check className="h-5 w-5 text-white drop-shadow" />
                      </div>
                    )}
                  </div>
                  <div className="hidden sm:flex items-center gap-1.5">
                    {b.colors.map((c, i) => (
                      <div key={i} className="h-3 w-3 rounded-full border border-slate-200 dark:border-brand-muted shadow-sm" style={{ backgroundColor: c }} />
                    ))}
                  </div>
                  <span className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300">{b.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
        </Reveal>

        {/* Security: PIN & Session Lock */}
        <Reveal delay={600}>
        <div className="border-t border-slate-200 dark:border-brand-muted pt-6">
          <div className="bg-white dark:bg-[#2A2522] rounded-2xl border border-slate-200 dark:border-brand-muted shadow-sm p-6 space-y-6">
            <div className="flex items-center gap-3">
              <Shield className="h-6 w-6 text-brand shrink-0" />
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Security</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">Manage PINs and session auto-lock</p>
              </div>
            </div>

            {/* PIN Generation */}
            <div className="bg-slate-50 dark:bg-brand-muted/30 rounded-xl p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Key className="h-5 w-5 text-brand shrink-0" />
                <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm">Access PINs</h4>
              </div>

              {!pinsGenerated ? (
                <div className="space-y-3">
                  <p className="text-sm text-slate-600 dark:text-slate-400">Generate a set of one-time PINs for sensitive actions (archiving, restoring, editing entries).</p>
                  <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-4 text-sm space-y-1">
                    <p className="font-medium text-amber-800 dark:text-amber-300">⚠ Important</p>
                    <ul className="list-disc list-inside text-amber-700 dark:text-amber-400 text-xs space-y-1">
                      <li>PINs are shown <strong>only once</strong> after generation</li>
                      <li><strong>Save, write down, or print</strong> your PINs before closing</li>
                      <li>Each PIN is one-time use — after all are used, the cycle restarts</li>
                      <li>There is no recovery option if you lose all PINs</li>
                    </ul>
                  </div>
                  <Button onClick={() => {
                    const newPins = generatePins(10);
                    setPins(newPins);
                    setPinsGenerated(true);
                    setPinsShown(false);
                    setShowPins(true);
                    setRemaining(10);
                  }} className="gap-2"><Key className="h-4 w-4" /> Generate PINs</Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      {pinsShown ? 'PINs have been viewed. Cycle restarts when all are used.' : 'Your PINs have not been viewed yet.'}
                    </p>
                    <span className="text-xs font-medium px-2 py-1 rounded-full bg-brand-secondary dark:bg-brand-muted/30 text-brand dark:text-brand-secondary">{remaining} remaining</span>
                  </div>

                  {showPins && (
                    <div className="bg-white dark:bg-brand-dark rounded-xl border border-slate-200 dark:border-brand-muted p-4">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Your PINs — save these now</p>
                        <button onClick={() => setShowPins(!showPins)} className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                          {showPins ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                        {pins.map((pin, i) => (
                          <div key={i} className="text-center font-mono font-bold text-lg text-slate-900 dark:text-slate-100 bg-slate-50 dark:bg-brand-muted/30 rounded-lg py-2 px-1">
                            {showPins ? pin : '••••'}
                            <span className="block text-[10px] text-slate-400 font-normal">#{i + 1}</span>
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2 mt-3">
                        <Button size="sm" variant="outline" onClick={() => {
                          const text = pins.map((p, i) => `#${i + 1}: ${p}`).join('\n');
                          downloadFile(text, 'money-meva-pins.txt', 'text/plain');
                        }} className="text-xs">Download as Text</Button>
                        <Button size="sm" variant="outline" onClick={() => {
                          printHtml('Money Meva PINs', `<div style="font-family:monospace;padding:40px;text-align:center"><h2>Money Meva — Access PINs</h2><p style="color:#888;margin-bottom:24px">Keep these safe. Each PIN can be used once.</p>${pins.map((p, i) => `<div style="display:inline-block;margin:8px;padding:12px 20px;border:2px solid #ccc;border-radius:8px;font-size:24px;letter-spacing:4px">${p}<span style="display:block;font-size:12px;color:#888">#${i + 1}</span></div>`).join('')}<p style="margin-top:40px;color:#aaa;font-size:12px">Generated: ${new Date().toLocaleString()}</p></div>`);
                        }} className="text-xs">Print</Button>
                      </div>
                      {!pinsShown && (
                        <Button size="sm" className="mt-3 w-full" onClick={() => setShowPinsConfirm(true)}>I have saved my PINs</Button>
                      )}
                    </div>
                  )}

                  {!showPins && !pinsShown && (
                    <Button variant="outline" size="sm" onClick={() => setShowPins(true)} className="gap-2">
                      <Eye className="h-4 w-4" /> View & Save PINs
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* Auto-Lock Timer */}
            <div className="bg-slate-50 dark:bg-brand-muted/30 rounded-xl p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-brand shrink-0" />
                <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm">Session Auto-Lock</h4>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Automatically lock the app after inactivity. A valid PIN is required to unlock.</p>
              <select value={autoLock} onChange={e => {
                const val = Number(e.target.value);
                if (val === 0 && autoLock > 0) {
                  setPendingAutoLockVal(val);
                  setPinAction('autolock');
                } else {
                  setAutoLock(val);
                  setAutoLockMinutes(val);
                }
              }} disabled={!pinsGenerated || !pinsShown}
                className={cn("w-full max-w-xs px-4 py-2 rounded-lg border outline-none focus:ring-2 focus:ring-brand",
                  !pinsGenerated || !pinsShown
                    ? "bg-slate-100 dark:bg-brand-muted/20 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-brand-muted cursor-not-allowed"
                    : "border-slate-200 dark:border-brand-muted"
                )}>
                <option value={0}>Never</option>
                <option value={60}>After 1 hour</option>
                <option value={120}>After 2 hours</option>
                <option value={240}>After 4 hours</option>
                <option value={360}>After 6 hours</option>
                <option value={720}>After 12 hours</option>
                <option value={1440}>After 24 hours</option>
              </select>
              {!pinsGenerated && (
                <p className="text-xs text-amber-600 dark:text-amber-400">Generate PINs above to enable auto-lock</p>
              )}
              {pinsGenerated && !pinsShown && (
                <p className="text-xs text-amber-600 dark:text-amber-400">View and confirm your PINs above to enable auto-lock</p>
              )}
            </div>
          </div>
        </div>
        </Reveal>

        {/* Danger Zone */}
        <div className="border-t border-red-200 dark:border-red-800 pt-6">
          <div className="bg-red-50 dark:bg-red-900/20 rounded-2xl border border-red-200 dark:border-red-800 p-6 space-y-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-6 w-6 text-red-500 shrink-0" />
              <div>
                <h3 className="text-lg font-bold text-red-700 dark:text-red-400">Danger Zone</h3>
                <p className="text-sm text-red-600 dark:text-red-300">Destructive actions that cannot be undone</p>
              </div>
            </div>

            {clearStep === 'idle' && (
              <div className="space-y-4">
                <div className="bg-white dark:bg-red-900/30 rounded-xl p-4 text-sm space-y-2 border border-red-100 dark:border-red-800">
                  <p className="font-medium text-red-700 dark:text-red-300">Before proceeding:</p>
                  <ul className="list-disc list-inside text-red-600 dark:text-red-400 space-y-1">
                    <li>All actions <strong>cannot be reversed</strong></li>
                    <li>Make sure to <strong>export your data</strong> first</li>
                    <li><strong>Disable cloud sync</strong> first to avoid conflicts</li>
                  </ul>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button variant="danger" onClick={() => startClearData('user-data')} className="gap-2">
                    <Trash2 className="h-4 w-4" /> Clear User Data
                  </Button>
                  <Button variant="danger" onClick={() => startClearData('all-data')} className="gap-2">
                    <Trash2 className="h-4 w-4" /> All data
                  </Button>
                </div>
              </div>
            )}

            {clearStep === 'captcha' && (
              <div className="space-y-4">
                <div className="bg-white dark:bg-red-900/30 rounded-xl p-4 border border-red-100 dark:border-red-800 space-y-4">
                  <div className="flex items-start gap-3 p-3 bg-red-50 dark:bg-red-950/50 rounded-lg border border-red-200 dark:border-red-800">
                    <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                    <div className="text-xs text-red-700 dark:text-red-300 leading-relaxed">
                      This action <strong>cannot be undone</strong> — make sure you have a backup.
                    </div>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                    {clearMode === 'user-data'
                      ? 'This removes all your transactions, goals, partners, and settings. Your login account stays — you can log back in and set up fresh.'
                      : 'This removes everything — all data, accounts, and settings. The app returns to factory state. You will need to create a new account.'}
                  </p>
                  <div className="border-t border-slate-200 dark:border-red-800 pt-4">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                      Verify you understand by solving:
                    </p>
                    <div className="flex items-center gap-3">
                      <span className="text-xl font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/50 px-3 py-1.5 rounded-lg">{captchaA} + {captchaB} = ?</span>
                      <input autoFocus value={captchaAnswer} onChange={e => { setCaptchaAnswer(e.target.value); setCaptchaError(false); }}
                        className={cn("w-24 px-3 py-2 rounded-lg border text-center text-lg font-bold outline-none focus:ring-2",
                          captchaError ? "border-red-500 focus:ring-red-500 bg-red-50" : "border-slate-200 dark:border-brand-muted dark:bg-brand-dark dark:text-slate-100 focus:ring-brand"
                        )} placeholder="?" />
                    </div>
                    {captchaError && <p className="text-xs text-red-500 font-medium mt-2">Incorrect answer. Try again.</p>}
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button variant="ghost" onClick={() => setClearStep('idle')}>Cancel</Button>
                  <Button variant="danger" onClick={handleCaptchaSubmit} disabled={!captchaAnswer} className="gap-2">
                    Continue
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>



      {/* Final Confirmation Modal */}
      {clearStep === 'confirm' && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md overflow-y-auto flex items-start sm:items-center justify-center z-[130] p-4">
          <div className="bg-white dark:bg-[#2A2522] rounded-2xl max-w-md w-full shadow-2xl border-2 border-red-400 dark:border-red-600 overflow-hidden my-4">
            <div className="bg-gradient-to-r from-red-600 to-red-700 px-6 py-5 text-center">
              <div className="mx-auto w-14 h-14 rounded-full bg-white/20 flex items-center justify-center mb-3">
                <Trash2 className="h-7 w-7 text-white" />
              </div>
              <h3 className="text-xl font-bold text-white">
                {clearMode === 'user-data' ? 'Clear User Data' : 'Clear All Data'}
              </h3>
              <p className="text-sm text-red-100 mt-1">This action cannot be undone</p>
            </div>
            <div className="p-6 space-y-5">
              <div className="bg-red-50 dark:bg-red-950/40 rounded-xl p-4 border border-red-200 dark:border-red-800 space-y-3">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-sm font-semibold text-red-700 dark:text-red-300">
                    You are about to permanently delete all your financial data.
                  </p>
                </div>
                <ul className="space-y-2 text-xs text-red-600 dark:text-red-400 ml-8">
                  <li className="flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />
                    <span><strong>You will be logged out</strong> and must log in again</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />
                    <span><strong>All data is permanently gone</strong> — no recovery possible</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />
                    <span><strong>Export a backup first</strong> if you want to keep your data</span>
                  </li>
                  {clearMode === 'all-data' && (
                    <li className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />
                      <span><strong>Your account will be deleted</strong> — you must create a new one</span>
                    </li>
                  )}
                </ul>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setClearStep('captcha')}>Cancel</Button>
                <Button variant="danger" size="sm" className="gap-1.5" onClick={handleFinalClear} disabled={clearing}>
                  <Trash2 className="h-3.5 w-3.5" />
                  {clearing ? 'Deleting...' : 'Yes, Delete Everything'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PIN Confirmation Modal */}
      {showPinsConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm overflow-y-auto flex items-start sm:items-center justify-center z-[130] p-4">
          <div className="bg-white dark:bg-[#2A2522] rounded-2xl max-w-md w-full shadow-2xl border border-amber-300 dark:border-amber-700 overflow-hidden my-4">
            <div className="bg-gradient-to-r from-amber-500 to-orange-600 px-6 py-5 text-center">
              <div className="mx-auto w-14 h-14 rounded-full bg-white/20 flex items-center justify-center mb-3">
                <Key className="h-7 w-7 text-white" />
              </div>
              <h3 className="text-xl font-bold text-white">Confirm PIN Backup</h3>
              <p className="text-sm text-amber-100 mt-1">This is your last chance to save your PINs</p>
            </div>
            <div className="p-6 space-y-5">
              <div className="bg-amber-50 dark:bg-amber-950/40 rounded-xl p-4 border border-amber-200 dark:border-amber-800 space-y-3">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                    After confirming, your PINs will no longer be accessible.
                  </p>
                </div>
                <ul className="space-y-2 text-xs text-amber-700 dark:text-amber-400 ml-8">
                  <li className="flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                    <span><strong>PINs are hidden permanently</strong> — you cannot view or recover them</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                    <span><strong>They still work silently</strong> for unlocking and sensitive actions</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                    <span>Make sure you have <strong>saved, written down, or printed</strong> your PINs</span>
                  </li>
                </ul>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowPinsConfirm(false)}>No, Go Back</Button>
                <Button size="sm" className="bg-amber-600 hover:bg-amber-700 gap-1.5" onClick={() => {
                  markPinsShown();
                  setPinsShown(true);
                  setShowPins(false);
                  setShowPinsConfirm(false);
                }}>
                  <Key className="h-3.5 w-3.5" /> Yes, I Have a Backup
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <PinPrompt
        open={pinAction !== null}
        onClose={() => { setPinAction(null); setPinClearMode(null); setPendingImportFile(null); setPendingAutoLockVal(0); setLoading(null); }}
        onSuccess={() => {
          if (pinAction === 'danger' && pinClearMode) { doClearData(pinClearMode); }
          else if (pinAction === 'export') { setLoading('Exporting…'); setTimeout(() => { doExportBackup(); setLoading(null); }, 300); }
          else if (pinAction === 'import' && pendingImportFile) { setTimeout(() => { processImportFile(pendingImportFile); }, 300); }
          else if (pinAction === 'autolock') { setAutoLock(pendingAutoLockVal); setAutoLockMinutes(pendingAutoLockVal); logActivity('auto_lock_off', 'turned off in settings'); }
          setPinAction(null);
          setPinClearMode(null);
          setPendingImportFile(null);
        }}
        title="Confirm Action"
        message={pinAction === 'danger' ? 'Enter a PIN to access the danger zone' : pinAction === 'export' ? 'Enter a PIN to export your data' : pinAction === 'import' ? 'Enter a PIN to import a backup' : 'Enter a PIN to turn off session auto-lock'}
      />

      {loading && <LoadingOverlay message={loading} />}

      <PinSetupGuide
        open={showPinSetup !== null}
        onClose={() => setShowPinSetup(null)}
        action={showPinSetup || ''}
      />

      <CloudSetupWizard open={setupOpen} onClose={() => setSetupOpen(false)} />

      {/* Sync Failure Popup */}
      {showSyncFailPopup && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[130] p-4">
          <div className="bg-white dark:bg-[#2A2522] rounded-2xl max-w-sm w-full shadow-2xl overflow-hidden">
            <div className="p-6 text-center">
              <div className="mx-auto w-14 h-14 rounded-full bg-sky-50 dark:bg-sky-900/30 flex items-center justify-center mb-4">
                <Cloud className="h-7 w-7 text-sky-500" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">Sync Unavailable</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                We were unable to establish a connection to the sync server. This may be due to a temporary network issue, incorrect credentials, or your Supabase project's free tier limits.
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-3 leading-relaxed">
                Please verify your server credentials or try again later. <Link href="/dashboard/support" className="text-sky-600 font-medium hover:underline">Contact support</Link> if the issue persists.
              </p>
              <div className="mt-6 flex justify-center gap-2">
                <Button size="sm" className="bg-sky-600 hover:bg-sky-700" onClick={() => { setShowSyncFailPopup(false); setSyncFailCount(0); }}>
                  Try Again
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowSyncFailPopup(false)}>
                  Dismiss
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Import Warning Modal */}
      {importConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm overflow-y-auto flex items-start sm:items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#2A2522] rounded-2xl max-w-lg w-full shadow-2xl my-4">
            <div className="p-6 border-b border-slate-200 dark:border-brand-muted">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-amber-50 dark:bg-amber-900/30">
                  <AlertCircle className="h-6 w-6 text-amber-500" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Different User Backup</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">This backup belongs to another user</p>
                </div>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 space-y-2 text-sm border border-amber-100 dark:border-amber-800">
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Backup owner:</span>
                  <span className="font-medium text-slate-900 dark:text-slate-100">{importConfirm.backupUser}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Current user:</span>
                  <span className="font-medium text-slate-900 dark:text-slate-100">{importConfirm.currentUser}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Items in backup:</span>
                  <span className="font-medium text-slate-900 dark:text-slate-100">{importConfirm.itemCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Your account:</span>
                  <span className={cn("font-medium", importConfirm.isFresh ? "text-green-600" : "text-amber-600")}>
                    {importConfirm.isFresh ? 'Fresh (no data yet)' : 'Has existing data'}
                  </span>
                </div>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 text-sm text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-800">
                <p className="font-medium mb-1">What will happen:</p>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  <li>All items will be <strong>reassigned to your user ID</strong></li>
                  <li>Duplicate IDs will be <strong>skipped</strong> (existing data preserved)</li>
                  <li>Your existing data <strong>will not be removed</strong></li>
                  {importConfirm.isFresh && <li>Since you have no data, this will be like starting with the backup</li>}
                </ul>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button variant="ghost" size="sm" onClick={() => setImportConfirm(null)}>Cancel</Button>
                <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={() => {
                  if (switchUser(importConfirm.backupId)) {
                    window.location.reload();
                  } else {
                    toast('This user does not have a local account. Use "Import & Reassign" instead.', 'warning');
                  }
                }}>
                  Switch to This User
                </Button>
                <Button size="sm" className="bg-amber-600 hover:bg-amber-700" onClick={() => {
                  doImport(importConfirm.data, importConfirm.currentId);
                  setImportConfirm(null);
                }}>
                  Import & Reassign
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

async function doImport(data: any, currentUserId: string) {
  const overlay = createProgressOverlay('Preparing import…');
  let imported = 0;
  try {
    const tables: { key: string; table: string; entityType: string; label: string }[] = [
      { key: 'transactions', table: 'mm_transactions', entityType: 'transaction', label: 'Importing transactions…' },
      { key: 'budgets', table: 'mm_budgets', entityType: 'budget', label: 'Importing budgets…' },
      { key: 'goals', table: 'mm_goals', entityType: 'goal', label: 'Importing goals…' },
      { key: 'reminders', table: 'mm_reminders', entityType: 'reminder', label: 'Importing reminders…' },
      { key: 'recurring', table: 'mm_recurring', entityType: 'recurring', label: 'Importing recurring…' },
      { key: 'partners', table: 'mm_partners', entityType: 'partner', label: 'Importing partners…' },
      { key: 'adjustments', table: 'mm_adjustments', entityType: 'adjustment', label: 'Importing adjustments…' },
      { key: 'works', table: 'mm_works', entityType: 'work', label: 'Importing works…' },
      { key: 'partnerships', table: 'mm_partnerships', entityType: 'partnership', label: 'Importing partnerships…' },
      { key: 'partnershipEntries', table: 'mm_partnership_entries', entityType: 'partnership_entry', label: 'Importing partnership entries…' },
    ];
    const total = tables.reduce((n, t) => n + (Array.isArray(data[t.key]) ? data[t.key].length : 0), 0);
    let processed = 0;

    const remap = (items: any[]) => {
      if (!items || !Array.isArray(items)) return [];
      return items.map(item => {
        if (item.userId && item.userId !== currentUserId) {
          return { ...item, userId: currentUserId };
        }
        return item;
      });
    };

    const merge = async (table: string, items: any[], entityType: string, label: string) => {
      const remapped = remap(items);
      if (!remapped.length) return;
      processed += remapped.length;
      overlay.update(label, processed, total);
      const existing = JSON.parse(localStorage.getItem(table) || '[]');
      const existingIds = new Set(existing.map((x: any) => x.id));
      const newItems = remapped.filter((x: any) => !existingIds.has(x.id));
      if (newItems.length > 0) {
        try {
          localStorage.setItem(table, JSON.stringify([...existing, ...newItems]));
        } catch {
          throw new Error(`Browser storage is full — couldn't save ${newItems.length} ${entityType}(s). Free space (Developer Zone → Clear Data) and try again.`);
        }
        imported += newItems.length;
        const withTid = newItems.filter((x: any) => x.transitionId);
        for (let i = 0; i < withTid.length; i++) {
          const item = withTid[i];
          await logMutation(entityType, item.id, item.transitionId, 'created', item.name || item.title || item.description || 'Unknown');
          if (i % 50 === 0) overlay.update(label, processed, total);
        }
      }
    };

    for (const t of tables) {
      await merge(t.table, data[t.key], t.entityType, t.label);
    }

    if (Array.isArray(data._audit_log) && data._audit_log.length > 0) {
      overlay.update('Merging audit trail…', processed, total);
      const existingIds = new Set((await db.mutation_log.toArray()).map((e: any) => e.id));
      const newEntries = data._audit_log.filter((e: any) => e.id && !existingIds.has(e.id));
      if (newEntries.length > 0) {
        try { await db.mutation_log.bulkPut(newEntries); imported += newEntries.length; } catch {}
      }
    }

    if (Array.isArray(data._activity_log) && data._activity_log.length > 0) {
      const existing: any[] = JSON.parse(localStorage.getItem('mm_activity_log') || '[]');
      const existingTs = new Set(existing.map((e: any) => e.timestamp + (e.detail || '')));
      const merged = [...data._activity_log.filter((e: any) => !existingTs.has(e.timestamp + (e.detail || ''))), ...existing];
      merged.sort((a: any, b: any) => (b.timestamp || '').localeCompare(a.timestamp || ''));
      if (merged.length > 200) merged.length = 200;
      localStorage.setItem('mm_activity_log', JSON.stringify(merged));
    }

    logActivity('entry_imported', `Full JSON backup — ${imported} items`);
    overlay.finish(`Import complete — ${imported.toLocaleString()} items restored`, () => window.location.reload());
  } catch (err: any) {
    const msg = err?.message || 'Import failed';
    overlay.error(msg.length > 90 ? msg.slice(0, 90) + '…' : msg, () => window.location.reload());
  }
}
