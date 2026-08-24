'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { initDB } from '@/lib/store';
import { 
  LayoutDashboard, 
  ArrowUpCircle, 
  ArrowDownCircle, 
  PiggyBank, 
  TrendingUp, 
  Users, 
  Calendar, 
  SlidersHorizontal,
  Tag,
  Landmark,
  BarChart3,
  Settings,
  Info,
  Sun,
  Moon,
  Menu,
  X,
  Archive,
  Lock,
  Unlock,
  Share2,
  ScrollText,
  Sprout,
} from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { useTheme } from '@/components/ThemeProvider';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { updateLastActivity, getAutoLockMinutes, isLocked, setLocked, checkAndLock, validatePin, hasPins, getRemainingPins, getLastActivity } from '@/lib/pinStore';
import { logActivity } from '@/lib/activityLog';
import DataSafetyNotice from '@/components/DataSafetyNotice';
import SecurityTipNotice from '@/components/SecurityTipNotice';
import InstallPrompt from '@/components/InstallPrompt';
import WhatsNewModal from '@/components/WhatsNewModal';
import BroadcastBanner from '@/components/BroadcastBanner';
import BannerModal from '@/components/BannerModal';
import LoadingOverlay from '@/components/LoadingOverlay';
import { StatusBar, Style as StatusBarStyle } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import SyncStatusBar from '@/components/SyncStatusBar';
import { useTranslation } from '@/lib/i18n';
import { copyText } from '@/lib/download';
import { pausePopups, resumePopups } from '@/lib/popup-queue';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, profile, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
    } else if (!profile?.onboarding_completed) {
      router.replace('/onboarding');
    }
  }, [loading, user, profile, router]);
  const { theme, toggle: toggleTheme } = useTheme();
  const { t } = useTranslation();

  const navItems = React.useMemo(() => [
    { name: t('nav.dashboard'), href: '/dashboard', icon: LayoutDashboard },
    { name: t('nav.income'), href: '/dashboard/income', icon: ArrowUpCircle },
    { name: t('nav.expenses'), href: '/dashboard/expenses', icon: ArrowDownCircle },
    { name: t('nav.savings'), href: '/dashboard/savings', icon: PiggyBank },
    { name: t('nav.investments'), href: '/dashboard/investments', icon: TrendingUp },
    { name: t('nav.partners'), href: '/dashboard/partners', icon: Users },
    { name: t('nav.works'), href: '/dashboard/works', icon: Sprout },
    { name: t('nav.recurring'), href: '/dashboard/recurring', icon: Calendar },
    { name: t('nav.accounts'), href: '/dashboard/accounts', icon: Landmark },
    { name: t('nav.categories'), href: '/dashboard/categories', icon: Tag },
    { name: t('nav.adjustments'), href: '/dashboard/adjustments', icon: SlidersHorizontal },
    { name: t('nav.summary'), href: '/dashboard/summary', icon: BarChart3 },
    { name: t('nav.ledger'), href: '/dashboard/ledger', icon: ScrollText },
    { name: t('nav.archive'), href: '/dashboard/archive', icon: Archive },
    { name: t('nav.settings'), href: '/dashboard/settings', icon: Settings },
    { name: t('nav.about'), href: '/dashboard/about', icon: Info },
  ], [t]);

  const FLOATING_NAV_NAMES = React.useMemo(() => new Set([
    t('nav.dashboard'), t('nav.income'), t('nav.expenses'), t('nav.savings'),
    t('nav.investments'), t('nav.partners'), t('nav.works'), t('nav.accounts'), t('nav.settings'), t('nav.ledger'),
  ]), [t]);

  const [ready, setReady] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [locked, setLockedState] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const [showLockConfirm, setShowLockConfirm] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    initDB()
      .catch(() => {})
      .then(() => {
        setReady(true);
        setTimeout(() => window.dispatchEvent(new CustomEvent('store-ready')), 0);
      });
  }, []);

  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      StatusBar.setStyle({ style: StatusBarStyle.Dark });
      StatusBar.setBackgroundColor({ color: '#1e1b4b' });
      StatusBar.setOverlaysWebView({ overlay: false });
    }
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const handler = App.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) {
        window.history.back();
      } else {
        App.exitApp();
      }
    });
    return () => { handler.then(h => h.remove()); };
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Popup queue: nothing new pops while the session is locked
  useEffect(() => {
    if (locked) pausePopups();
    else resumePopups();
  }, [locked]);

  // Session lock: check periodically and track activity
  useEffect(() => {
    setLockedState(isLocked());
    setRemaining(hasPins() ? getRemainingPins() : 0);

    const handleLockRequest = () => setShowLockConfirm(true);
    window.addEventListener('request-lock-session', handleLockRequest);

    // Immediately check if auto-lock should be active
    const timeout = getAutoLockMinutes();
    if (timeout > 0 && hasPins()) {
      const last = new Date(getLastActivity()).getTime();
      const elapsed = (Date.now() - last) / 60000;
      if (!isLocked() && elapsed >= timeout) {
        logActivity('session_lock', 'auto-lock on page load');
        setLocked(true);
        setLockedState(true);
      }
    }

    const activity = () => {
      updateLastActivity();
    };
    window.addEventListener('mousedown', activity);
    window.addEventListener('keydown', activity);
    window.addEventListener('touchstart', activity);
    window.addEventListener('scroll', activity);
    activity();

    const lockInterval = setInterval(() => {
      if (!hasPins()) return;
      if (checkAndLock()) {
        logActivity('session_lock', 'auto-lock timeout');
        setLockedState(true);
        setRemaining(getRemainingPins());
      }
    }, 10000);

    return () => {
      window.removeEventListener('request-lock-session', handleLockRequest);
      window.removeEventListener('mousedown', activity);
      window.removeEventListener('keydown', activity);
      window.removeEventListener('touchstart', activity);
      window.removeEventListener('scroll', activity);
      clearInterval(lockInterval);
    };
  }, []);

  const handleUnlock = () => {
    if (validatePin(pinInput)) {
      setUnlocking(true);
      setTimeout(() => {
        logActivity('session_unlock', 'PIN unlock');
        setLocked(false);
        setLockedState(false);
        setPinInput('');
        setPinError(false);
        updateLastActivity();
        setRemaining(getRemainingPins());
        setUnlocking(false);
      }, 600);
    } else {
      setPinError(true);
    }
  };

  const handleInstantLock = () => {
    logActivity('session_lock', 'instant lock');
    setLocked(true);
    setLockedState(true);
    setShowLockConfirm(false);
    setRemaining(getRemainingPins());
  };

  const sidebar = (
    <>
      <div className="p-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-brand">Money Meva</h1>
        <div className="flex items-center gap-1">
          <button onClick={toggleTheme} className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-brand-muted transition-colors">
            {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          </button>
          <button onClick={() => setMobileOpen(false)} className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-brand-muted transition-colors md:hidden">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors font-medium",
                pathname === item.href 
                  ? "bg-brand-secondary dark:bg-brand-muted/30 text-brand dark:text-brand-secondary" 
                  : "text-slate-600 dark:text-slate-400 hover:bg-brand-light dark:hover:bg-brand-muted/50 hover:text-slate-900 dark:hover:text-slate-200"
              )}
          >
            <item.icon className="h-5 w-5" />
            {item.name}
          </Link>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-200 dark:border-brand-muted">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="h-8 w-8 rounded-full bg-brand-secondary dark:bg-brand-muted flex items-center justify-center text-brand dark:text-brand-secondary font-bold text-xs">
            {profile?.full_name?.[0] || 'U'}
          </div>
          <div className="overflow-hidden flex-1">
            <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{profile?.full_name || 'User'}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{profile?.email || ''}</p>
          </div>
        </div>
        <div className="px-3 mt-2 space-y-2">
          <button onClick={async () => {
            const url = window.location.origin;
            if (navigator.share) {
              try { await navigator.share({ title: 'Money Meva', text: 'Track expenses, watch savings grow, and see where your investments are headed — all wrapped in a minimalist canvas. Built for Indian wallets.', url }); return; } catch { /* */ }
            }
            try { copyText(url); } catch { /* */ }
          }} className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-brand-muted text-xs font-medium text-slate-500 dark:text-slate-400 hover:bg-brand-secondary dark:hover:bg-brand-muted/50 hover:text-brand transition-colors cursor-pointer active:scale-[0.98]">
            <Share2 className="h-3.5 w-3.5" /> {t('common.share')} Money Meva
          </button>
        </div>
      </div>
    </>
  );

  if (!ready) return (
    <div className="flex h-screen items-center justify-center bg-brand-light dark:bg-brand-dark">
      <div className="text-center">
        <div className="animate-spin h-8 w-8 border-4 border-brand border-t-transparent rounded-full mx-auto mb-4"></div>
        <p className="text-slate-500 dark:text-slate-400">{t('common.loading')}</p>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-brand-light dark:bg-brand-dark">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 bg-white dark:bg-[#2A2522] border-r border-slate-200 dark:border-brand-muted flex-col">
        {sidebar}
      </aside>

      {/* Mobile Sidebar Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-white dark:bg-[#2A2522] flex flex-col shadow-2xl">
            {sidebar}
          </aside>
        </div>
      )}

      {/* Floating Nav Button */}
      <div className="fixed bottom-6 right-6 z-40 md:hidden">
        {navOpen && <div className="fixed inset-0" onClick={() => setNavOpen(false)} />}
        <div className="relative">
          <button onClick={() => setNavOpen(v => !v)}
            className="h-14 w-14 rounded-full bg-brand text-white shadow-lg flex items-center justify-center hover:bg-orange-600 transition-colors active:scale-95">
            <LayoutDashboard className="h-6 w-6" />
          </button>
          {navOpen && (
            <div className="absolute bottom-full right-0 mb-3">
              <div className="bg-white dark:bg-[#2A2522] rounded-2xl border border-slate-200 dark:border-brand-muted shadow-xl p-2 min-w-48 max-h-[60vh] overflow-y-auto">
                {navItems.filter(i => FLOATING_NAV_NAMES.has(i.name)).map(item => {
                  const Icon = item.icon;
                  return (
                    <Link key={item.href} href={item.href} onClick={() => setNavOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors",
                        pathname === item.href
                          ? "bg-brand-secondary text-brand-dark"
                          : "text-slate-600 dark:text-slate-400 hover:bg-brand-secondary dark:hover:bg-brand-muted"
                      )}
                    >
                      <Icon className="h-5 w-5" /> {item.name}
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Session Lock Overlay — topmost: security gate outranks every popup */}
      {locked && !unlocking && (
        <div className="fixed inset-0 z-[10001] bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#2A2522] rounded-2xl max-w-sm w-full p-8 shadow-2xl text-center space-y-6">
            <div className="mx-auto w-16 h-16 rounded-full bg-brand-secondary dark:bg-brand-muted/30 flex items-center justify-center">
              <Lock className="h-8 w-8 text-brand dark:text-brand-secondary" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">{t('common.lockSession')}</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t('common.enterPin')}</p>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); handleUnlock(); }} className="space-y-4">
              <input type="password" inputMode="numeric" autoFocus maxLength={4} value={pinInput}
                onChange={e => { setPinInput(e.target.value.replace(/\D/g, '').slice(0, 4)); setPinError(false); }}
                className={cn("w-full text-center text-2xl tracking-[0.5em] px-4 py-3 rounded-lg border outline-none focus:ring-2",
                  pinError ? "border-red-500 focus:ring-red-500 bg-red-50" : "border-slate-200 dark:border-brand-muted dark:bg-brand-dark dark:text-slate-100 focus:ring-brand"
                )} placeholder="••••" />
              {pinError && <p className="text-xs text-red-500 font-medium">Invalid PIN. Try another one.</p>}
              {remaining > 0 && <p className="text-xs text-slate-400 dark:text-slate-500">{remaining} PIN{remaining > 1 ? 's' : ''} remaining</p>}
              <Button type="submit" className="w-full py-3" disabled={pinInput.length < 4}>
                <Unlock className="h-4 w-4 mr-2" /> {t('common.unlock')}
              </Button>
            </form>
          </div>
        </div>
      )}

      {/* Unlocking Overlay */}
      {unlocking && <LoadingOverlay message="Unlocking…" />}

      {/* Instant Lock Confirmation */}
      {showLockConfirm && (
        <div className="fixed inset-0 z-[90] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#2A2522] rounded-2xl max-w-sm w-full p-6 shadow-2xl text-center space-y-4">
            <div className="mx-auto w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <Lock className="h-6 w-6 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Lock Session?</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Your session will be locked immediately. You'll need your PIN to unlock it.
              </p>
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowLockConfirm(false)}>Cancel</Button>
              <Button className="flex-1" onClick={handleInstantLock}>
                <Lock className="h-4 w-4 mr-2" /> {t('common.lockNow')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8 dark:bg-brand-dark">
        <div className="flex items-center justify-between mb-6 md:hidden">
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileOpen(true)} className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-[#2A2522] transition-colors">
              <Menu className="h-5 w-5" />
            </button>
            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{navItems.find(i => pathname === i.href || (i.href !== '/dashboard' && pathname.startsWith(i.href + '/')))?.name || t('nav.dashboard')}</span>
          </div>
        </div>
        {ready && children}
      </main>

      <BroadcastBanner />
      <SyncStatusBar />
      <DataSafetyNotice />
      <SecurityTipNotice />
      <InstallPrompt />
      <WhatsNewModal />
      <BannerModal />
    </div>
  );
}
