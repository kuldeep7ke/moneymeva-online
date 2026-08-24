'use client';

import { useState, useEffect, useRef, Suspense, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { LogIn, Mail, Lock, UserPlus, X, ArrowLeft, ShieldQuestion, KeyRound, Eye, EyeOff } from 'lucide-react';
import Link from 'next/link';
import LoadingOverlay from '@/components/LoadingOverlay';
import { useRouter } from 'next/navigation';
import { loginUser, registerUser, getAllUsers, switchUser, removeUser, getSession, LocalUser, updatePassword, resetPassword, registerGoogleUser } from '@/lib/localAuth';
import { signInWithGoogle, getOAuthSessionUser, getConfig, connectRemote, manualSync } from '@/lib/pouchdb';
import { BASE_PATH } from '@/lib/env';
import CloudSetupWizard from '@/components/CloudSetupWizard';
import { validatePin, getRemainingPins, hasPins } from '@/lib/pinStore';
import { useAuth } from '@/components/AuthProvider';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';

function getPasswordStrength(password: string, name: string, email: string): { score: number; label: string; color: string; error?: string } {
  let error: string | undefined;

  if (password.length < 6) error = 'At least 6 characters';
  else if (!/[a-zA-Z]/.test(password)) error = 'Must contain letters';
  else if (!/\d/.test(password)) error = 'Must contain a number';

  const lower = password.toLowerCase();
  const nameParts = name.toLowerCase().split(/\s+/).filter(Boolean);
  for (const part of nameParts) {
    if (part.length > 1 && lower.includes(part)) { error = 'Should not contain your name'; break; }
  }
  if (!error && email && lower.includes(email.split('@')[0].toLowerCase())) {
    error = 'Should not contain your email';
  }

  let score = 0;
  if (password.length >= 6) score += 30;
  if (password.length >= 10) score += 10;
  if (/[a-zA-Z]/.test(password)) score += 25;
  if (/\d/.test(password)) score += 25;
  if (/[!@#$%^&*(),.?":{}|<>_\-]/.test(password)) score += 10;
  if (error) score = Math.max(0, Math.min(score, 19));
  if (password.length < 6) score = 0;

  score = Math.max(0, Math.min(100, score));

  let label: string, color: string;
  if (score < 20) { label = 'Weak'; color = 'bg-red-500'; }
  else if (score < 50) { label = 'Basic'; color = 'bg-orange-500'; }
  else if (score < 75) { label = 'Good'; color = 'bg-yellow-500'; }
  else { label = 'Strong'; color = 'bg-emerald-500'; }

  return { score, label, color, error };
}

function LoginForm() {
  const { refreshAuth } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<'login' | 'register'>(() => {
    const m = searchParams.get('mode');
    return m === 'register' ? 'register' : 'login';
  });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [forgotStep, setForgotStep] = useState<'idle' | 'email' | 'pin' | 'reset'>('idle');
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotPin, setForgotPin] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showForgotConfirmPassword, setShowForgotConfirmPassword] = useState(false);
  const [appVersion, setAppVersion] = useState('');
  const [serverHost, setServerHost] = useState('');

  // Already signed in (locally or via a persisted cloud session)? Skip the form.
  useEffect(() => {
    let cancelled = false;
    if (getSession().user) {
      router.replace('/dashboard');
      return;
    }
    (async () => {
      try {
        const { getStoredCloudUser } = await import('@/lib/pouchdb');
        const cloudUser = await getStoredCloudUser();
        if (!cloudUser || cancelled) return;
        const { user } = registerGoogleUser(cloudUser.email, cloudUser.fullName);
        if (!user || cancelled) return;
        refreshAuth();
        router.replace(user.onboarding_completed ? '/dashboard' : '/onboarding');
      } catch {}
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const meta = document.querySelector('meta[name="app-version"]');
    if (meta) setAppVersion((meta.getAttribute('content') || '').replace(/^v/, ''));
    try {
      const cfg = getConfig();
      if (cfg.url) setServerHost(cfg.url.replace(/^https?:\/\//, '').replace(/\/$/, ''));
    } catch {}
  }, []);

  const strength = mode === 'register' && password ? getPasswordStrength(password, '', email) : null;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (/([#&])access_token=/.test(window.location.hash)) return;
    const session = getSession().user;
    if (session) {
      if (!session.onboarding_completed) {
        removeUser(session.id);
        localStorage.removeItem('money_meva_session');
        refreshAuth();
        return;
      }
      refreshAuth();
      router.replace('/dashboard');
    }
  }, [router, refreshAuth]);

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

  const processOAuthUrl = useCallback(async (url: string) => {
    try {
      console.log('[OAuth] processing return URL', url.slice(0, 60));
      const fragment = url.split('#')[1];
      const params = new URLSearchParams(fragment || url.split('?')[1] || '');
      const oauthError = params.get('error') || params.get('error_description');
      if (oauthError) {
        setError('Google sign-in was cancelled or failed. Please try again.');
        setSubmitting(false);
        return;
      }
      const sessionUser = await getOAuthSessionUser(url);
      if (!Capacitor.isNativePlatform()) {
        window.history.replaceState(null, '', window.location.pathname);
      }
      if (!sessionUser) {
        setError('Google sign-in did not return a session. Please try again.');
        setSubmitting(false);
        return;
      }
      console.log('[OAuth] session user', sessionUser.email);
      const { user } = registerGoogleUser(sessionUser.email, sessionUser.fullName);
      if (!user) {
        setError('Could not create your profile. Please try again.');
        setSubmitting(false);
        return;
      }
      const cfg = getConfig();
      if (cfg.url && cfg.key) {
        const { ok } = await connectRemote(cfg.url, cfg.key);
        if (ok) { try { await manualSync(); } catch {} }
      }
      setSubmitting(false);
      refreshAuth();
      router.replace(user.onboarding_completed ? '/dashboard' : '/onboarding');
    } catch (e) {
      console.error('[OAuth] flow error', e);
      setError('Google sign-in could not be completed. Please try again.');
      setSubmitting(false);
    }
  }, [router, refreshAuth]);

  useEffect(() => {
    if (typeof window === 'undefined' || Capacitor.isNativePlatform()) return;
    const hash = window.location.hash;
    if (!/([#&])access_token=|([#&])error=/.test(hash)) return;
    processOAuthUrl(window.location.href);
  }, [processOAuthUrl]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const handler = App.addListener('appUrlOpen', (event) => {
      const u = event.url;
      if (!/^moneymeva:\/\/login/.test(u)) return;
      setError('');
      setSubmitting(true);
      processOAuthUrl(u);
    });
    return () => { handler.then(h => h.remove()); };
  }, [processOAuthUrl]);

  const handleGoogleLogin = async () => {
    setError('');
    const cfg = getConfig();
    if (!cfg.url || !cfg.key) {
      setWizardOpen(true);
      return;
    }
    setSubmitting(true);
    const { ok, error, url } = await signInWithGoogle();
    if (!ok) {
      setError(error || 'Google sign-in failed');
      if (/provider is not enabled|not configured/i.test(error || '')) setWizardOpen(true);
      setSubmitting(false);
      return;
    }
    if (url) {
      try {
        await Browser.open({ url });
      } catch (e) {
        setError('Could not open the browser for Google sign-in.');
        setSubmitting(false);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (mode === 'register') {
      const s = getPasswordStrength(password, '', email);
      if (s.error) { setError(s.error); return; }
      if (password !== confirmPassword) { setError('Passwords do not match'); return; }
    }

    setSubmitting(true);

    if (mode === 'login') {
      const result = loginUser(email, password);
      if (result.error) { setError(result.error); setSubmitting(false); return; }
      refreshAuth();
      setTimeout(() => router.push(result.user?.onboarding_completed ? '/dashboard' : '/onboarding'), 400);
    } else {
      const result = registerUser(email, password, '');
      if (result.error) { setError(result.error); setSubmitting(false); return; }
      refreshAuth();
      setTimeout(() => router.push('/onboarding'), 400);
    }
  };

  const handleForgotPassword = () => {
    setForgotStep('email');
    setForgotEmail('');
    setForgotPin('');
    setForgotNewPassword('');
    setForgotConfirmPassword('');
    setError('');
  };

  const handleForgotNext = () => {
    setError('');
    if (forgotStep === 'email') {
      const users = getAllUsers();
      if (!users.find(u => u.email === forgotEmail)) { setError('Email not found'); return; }
      if (!hasPins()) { setError('No PINs available. Contact support to reset your account.'); return; }
      if (getRemainingPins() <= 0) { setError('All PINs used. Generate new PINs from Settings → Security.'); return; }
      setForgotStep('pin');
    } else if (forgotStep === 'pin') {
      if (!validatePin(forgotPin)) { setError('Invalid or already used PIN'); return; }
      setForgotStep('reset');
    } else if (forgotStep === 'reset') {
      if (forgotNewPassword.length < 6) { setError('Password must be at least 6 characters'); return; }
      if (forgotNewPassword !== forgotConfirmPassword) { setError('Passwords do not match'); return; }
      const result = resetPassword(forgotEmail, forgotNewPassword);
      if (result.error) { setError(result.error); return; }
      setForgotStep('idle');
      setEmail(forgotEmail);
      setPassword('');
      setError('Password reset successful. Sign in with your new password.');
    }
  };

  const handleForgotCancel = () => {
    setForgotStep('idle');
    setError('');
  };

  return (
    <div className="contents">
      {submitting && <LoadingOverlay message={mode === 'login' ? 'Signing in…' : 'Creating account…'} />}
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-secondary via-white to-purple-50 dark:from-brand-dark dark:via-[#2A2522] dark:to-brand-dark px-4">
      <div className="max-w-md w-full bg-white dark:bg-[#2A2522] rounded-2xl shadow-xl border border-slate-100 dark:border-brand-muted">
        <div className="relative flex items-center justify-center p-6 pb-0">
          <Link href="/" className="absolute left-1/2 -translate-x-1/2 top-6 h-8 w-8 rounded-full border border-slate-200 dark:border-brand-muted flex items-center justify-center text-slate-400 hover:text-brand hover:border-brand/30 transition-colors" title="Back to home">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="text-center space-y-2 pt-12">
            <div className="flex items-center justify-center gap-2">
              <img src={`${BASE_PATH}/logo.png`} alt="Money Meva" className="h-9 w-auto" />
              <span className="font-bold text-lg text-slate-900 dark:text-slate-100">Money Meva</span>
            </div>
          </div>
        </div>

        <div className="p-10 pt-6 space-y-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500" />
              <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 dark:border-brand-muted outline-none focus:ring-2 focus:ring-brand" placeholder="you@example.com" />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500" />
              <input required type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => setPasswordFocused(false)}
                className="w-full pl-10 pr-10 py-2.5 rounded-lg border border-slate-200 dark:border-brand-muted outline-none focus:ring-2 focus:ring-brand" placeholder="••••••••" />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {/* Strength Bar */}
            {mode === 'register' && password && strength && (
              <div className="space-y-1.5">
                <div className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-300 ${strength.color}`} style={{ width: `${strength.score}%` }} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500">{strength.label}</span>
                </div>
                {strength.error && (
                  <p className="text-[11px] text-red-500">{strength.error}</p>
                )}
              </div>
            )}
          </div>
          {mode === 'login' && (
            <button type="button" onClick={handleForgotPassword} className="text-xs text-brand hover:text-brand-secondary dark:text-brand-secondary dark:hover:text-brand font-medium -mt-2">
              Forgot Password?
            </button>
          )}
          {mode === 'register' && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block">Confirm Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500" />
                <input required type={showConfirmPassword ? 'text' : 'password'} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-2.5 rounded-lg border border-slate-200 dark:border-brand-muted outline-none focus:ring-2 focus:ring-brand" placeholder="••••••••" />
                <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          )}
          {error && <p className="text-sm text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/30 px-3 py-2 rounded-lg">{error}</p>}
          <Button type="submit" className="w-full py-3 gap-2">
            {mode === 'login' ? <LogIn className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
            {mode === 'login' ? 'Sign In' : 'Create Account'}
          </Button>
          <p className="text-center text-sm text-slate-500 dark:text-slate-400">
            {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}
            {' '}
            <button type="button" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); setPassword(''); }} className="text-brand dark:text-brand-secondary hover:text-brand dark:hover:text-brand-secondary font-medium">
              {mode === 'login' ? 'Register' : 'Sign In'}
            </button>
          </p>
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-slate-200 dark:border-brand-muted" /></div>
          <div className="relative flex justify-center text-xs uppercase"><span className="bg-white dark:bg-[#2A2522] px-2 text-slate-400 dark:text-slate-500">or continue with</span></div>
        </div>

        <Button onClick={handleGoogleLogin} variant="outline" className="w-full py-3 gap-2" disabled={submitting}>
          <svg viewBox="0 0 24 24" className="h-5 w-5">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
          {submitting ? 'Redirecting to Google…' : 'Continue with Google'}
        </Button>

        {/* Existing Users Quick Switch */}
        {mode === 'login' && <ExistingUsers onRefresh={refreshAuth} />}

        <div className="text-center space-y-0.5">
          <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">v{appVersion} · {Capacitor.isNativePlatform() ? 'Android' : 'Web'}</p>
          {serverHost && <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">Cloud: {serverHost}</p>}
        </div>
        </div>
      </div>

      {/* Cloud Setup Wizard */}
      <CloudSetupWizard open={wizardOpen} onClose={() => setWizardOpen(false)} />

      {/* Forgot Password Modal */}
      {forgotStep !== 'idle' && (
        <div className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={handleForgotCancel}>
          <div className="bg-white dark:bg-[#2A2522] rounded-2xl max-w-sm w-full shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-amber-500 to-orange-600 px-6 py-8 text-center">
              <div className="mx-auto w-16 h-16 rounded-full bg-white/20 flex items-center justify-center mb-4">
                {forgotStep === 'email' ? <Mail className="h-8 w-8 text-white" /> : forgotStep === 'pin' ? <ShieldQuestion className="h-8 w-8 text-white" /> : <KeyRound className="h-8 w-8 text-white" />}
              </div>
              <h3 className="text-2xl font-bold text-white">
                {forgotStep === 'email' ? 'Reset Password' : forgotStep === 'pin' ? 'Enter PIN' : 'New Password'}
              </h3>
              <p className="text-amber-100 text-sm mt-2">
                {forgotStep === 'email' ? 'Enter your registered email' : forgotStep === 'pin' ? `Enter an unused PIN (${getRemainingPins()} remaining)` : 'Choose a new password'}
              </p>
            </div>
            <div className="p-6 space-y-4">
              {forgotStep === 'email' && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Email</label>
                  <input type="email" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-200 dark:border-brand-muted outline-none focus:ring-2 focus:ring-brand bg-transparent text-slate-700 dark:text-slate-300"
                    placeholder="you@example.com" />
                </div>
              )}
              {forgotStep === 'pin' && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">PIN</label>
                  <input type="text" value={forgotPin} onChange={e => setForgotPin(e.target.value.replace(/\D/g, '').slice(0, 4))} maxLength={4}
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-200 dark:border-brand-muted outline-none focus:ring-2 focus:ring-brand bg-transparent text-slate-700 dark:text-slate-300 text-center text-2xl tracking-[0.5em]"
                    placeholder="• • • •" />
                </div>
              )}
              {forgotStep === 'reset' && (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">New Password</label>
                    <div className="relative">
                      <input type={showForgotPassword ? 'text' : 'password'} value={forgotNewPassword} onChange={e => setForgotNewPassword(e.target.value)}
                        className="w-full px-4 py-2.5 pr-10 rounded-lg border border-slate-200 dark:border-brand-muted outline-none focus:ring-2 focus:ring-brand bg-transparent text-slate-700 dark:text-slate-300" />
                      <button type="button" onClick={() => setShowForgotPassword(!showForgotPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                        {showForgotPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Confirm New Password</label>
                    <div className="relative">
                      <input type={showForgotConfirmPassword ? 'text' : 'password'} value={forgotConfirmPassword} onChange={e => setForgotConfirmPassword(e.target.value)}
                        className="w-full px-4 py-2.5 pr-10 rounded-lg border border-slate-200 dark:border-brand-muted outline-none focus:ring-2 focus:ring-brand bg-transparent text-slate-700 dark:text-slate-300" />
                      <button type="button" onClick={() => setShowForgotConfirmPassword(!showForgotConfirmPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                        {showForgotConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              )}
              {error && <p className="text-sm text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/30 px-3 py-2 rounded-lg">{error}</p>}
              <div className="flex gap-2">
                <button onClick={handleForgotCancel} className="flex-1 px-4 py-2.5 rounded-lg border border-slate-200 dark:border-brand-muted text-slate-600 dark:text-slate-400 font-medium hover:bg-slate-50 dark:hover:bg-brand-muted/30 transition-colors text-sm">
                  Cancel
                </button>
                <button onClick={handleForgotNext} className="flex-1 px-4 py-2.5 rounded-lg bg-slate-900 text-white font-semibold hover:bg-slate-800 transition-colors text-sm">
                  {forgotStep === 'reset' ? 'Reset Password' : 'Next'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      </div>
    </div>
  );
}

function ExistingUsers({ onRefresh }: { onRefresh: () => void }) {
  const [users, setUsers] = useState<Omit<LocalUser, 'password'>[]>([]);

  useEffect(() => {
    setUsers(getAllUsers()
      .sort((a, b) => new Date(b.lastLoginAt || b.createdAt).getTime() - new Date(a.lastLoginAt || a.createdAt).getTime())
      .slice(0, 2));
  }, []);

  if (users.length === 0) return null;

  const handleRemove = (userId: string) => {
    removeUser(userId);
    setUsers(current => current.filter(u => u.id !== userId));
  };

  return (
    <div>
      <div className="relative">
        <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-slate-200 dark:border-brand-muted" /></div>
        <div className="relative flex justify-center text-xs uppercase"><span className="bg-white dark:bg-[#2A2522] px-2 text-slate-400 dark:text-slate-500">quick login</span></div>
      </div>
      <div className="mt-3 space-y-1.5">
        <p className="text-[10px] text-slate-400 text-center">Showing your two most recent local accounts</p>
        {users.map(u => (
          <div key={u.id}
            className="flex items-center gap-2 rounded-lg border border-slate-100 px-3 py-2.5 transition-colors hover:bg-brand-light dark:border-brand-muted dark:hover:bg-brand-muted/50">
                            <button type="button" onClick={() => { switchUser(u.id); onRefresh(); window.location.href = u.onboarding_completed ? '/dashboard' : '/onboarding'; }}
              className="flex min-w-0 flex-1 items-center gap-3 text-left">
              <div className="h-8 w-8 shrink-0 rounded-full bg-brand-secondary dark:bg-brand-muted flex items-center justify-center text-brand dark:text-brand-secondary font-bold text-sm">
                {(u.full_name || u.email)?.[0] || '?'}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-700 dark:text-slate-300">{u.full_name || 'User'}</p>
                <p className="truncate text-xs text-slate-400">{u.email}</p>
              </div>
            </button>
            <button type="button" onClick={() => handleRemove(u.id)} aria-label={`Remove ${u.full_name || u.email} from quick login`}
              className="rounded-full p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20">
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
