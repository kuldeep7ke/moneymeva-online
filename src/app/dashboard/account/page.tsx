'use client';

import { useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import Reveal from '@/components/Reveal';
import PinPrompt from '@/components/PinPrompt';
import { AlertTriangle, User, Mail, Lock, LogOut, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import Link from 'next/link';
import { getSession, logoutUser, updatePassword, resetPassword } from '@/lib/localAuth';
import { connected as isConnected, disconnectRemote } from '@/lib/pouchdb';
import { clearAllDB } from '@/lib/store';

export default function AccountPage() {
  const session = getSession().user;
  const [pinVerified, setPinVerified] = useState(!session);

  // Change Password state
  const [changePwCurrent, setChangePwCurrent] = useState('');
  const [changePwNew, setChangePwNew] = useState('');
  const [changePwConfirm, setChangePwConfirm] = useState('');
  const [changePwError, setChangePwError] = useState('');
  const [changePwSuccess, setChangePwSuccess] = useState('');

  // Reset Password state
  const [resetEmail, setResetEmail] = useState(session?.email || '');
  const [resetPwNew, setResetPwNew] = useState('');
  const [resetPwConfirm, setResetPwConfirm] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetSuccess, setResetSuccess] = useState('');
  const [showResetPinPrompt, setShowResetPinPrompt] = useState(false);

  // Show password toggles
  const [showChangeCurrent, setShowChangeCurrent] = useState(false);
  const [showChangeNew, setShowChangeNew] = useState(false);
  const [showChangeConfirm, setShowChangeConfirm] = useState(false);
  const [showResetNew, setShowResetNew] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const handleChangePassword = () => {
    setChangePwError('');
    setChangePwSuccess('');
    if (changePwNew.length < 6) { setChangePwError('New password must be at least 6 characters'); return; }
    if (changePwNew !== changePwConfirm) { setChangePwError('New passwords do not match'); return; }
    if (!session) { setChangePwError('Not logged in'); return; }
    const result = updatePassword(session.id, changePwCurrent, changePwNew);
    if (result.error) { setChangePwError(result.error); return; }
    setChangePwCurrent(''); setChangePwNew(''); setChangePwConfirm('');
    setChangePwSuccess('Password updated successfully');
  };

  const handleResetPassword = () => {
    setResetError('');
    setResetSuccess('');
    if (resetPwNew.length < 6) { setResetError('Password must be at least 6 characters'); return; }
    if (resetPwNew !== resetPwConfirm) { setResetError('Passwords do not match'); return; }
    setShowResetPinPrompt(true);
  };

  const confirmReset = () => {
    setShowResetPinPrompt(false);
    const result = resetPassword(resetEmail, resetPwNew);
    if (result.error) { setResetError(result.error); return; }
    setResetPwNew(''); setResetPwConfirm('');
    setResetSuccess('Password reset successfully');
  };

  const handleLogout = async (clearData: boolean) => {
    if (isConnected()) {
      if (!confirm('You are connected to cloud sync. Disconnect first to avoid data conflicts?')) return;
      disconnectRemote();
    }
    if (clearData) {
      if (!confirm('⚠️ WARNING: This will clear ALL your local data. Make sure you have a backup and are disconnected from cloud sync.\n\nContinue?')) return;
      await clearAllDB();
    }
    logoutUser();
    window.location.href = '/login';
  };

  if (!session) {
    return (
      <DashboardLayout>
        <div className="max-w-md mx-auto text-center py-20">
          <p className="text-slate-500">Not logged in.</p>
          <Link href="/login" className="text-brand hover:underline mt-2 inline-block">Sign in</Link>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <PinPrompt open={!pinVerified} onClose={() => window.history.back()} onSuccess={() => setPinVerified(true)}
        title="Account Access" message="Enter a PIN to access account settings" />
      <PinPrompt open={showResetPinPrompt} onClose={() => setShowResetPinPrompt(false)} onSuccess={confirmReset}
        title="Confirm Reset" message="Enter a PIN to confirm password reset" />

      <div className="max-w-2xl mx-auto space-y-8">
        <Reveal>
          <Link href="/dashboard/settings" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-brand dark:text-slate-400 dark:hover:text-brand-secondary transition-colors">
            <ArrowLeft className="h-4 w-4" /> Back to Settings
          </Link>
        </Reveal>

        {pinVerified && (
          <>
            <Reveal delay={100}>
              <div className="text-center space-y-4 py-6">
                <div className="bg-emerald-100 dark:bg-emerald-900/30 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto">
                  <User className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
                </div>
                <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">User Account</h1>
                <p className="text-slate-500 dark:text-slate-400">Manage your account, password, and data</p>
              </div>
            </Reveal>

            <Reveal delay={200}>
              <div className="bg-white dark:bg-[#2A2522] p-6 rounded-2xl border border-slate-200 dark:border-brand-muted shadow-sm space-y-6">
                {/* User Info */}
                <div className="flex items-center gap-4 pb-4 border-b border-slate-100 dark:border-brand-muted">
                  <div className="h-14 w-14 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-bold text-xl">
                    {(session.full_name || session.email)?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div>
                    <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{session.full_name || 'User'}</p>
                    <p className="text-sm text-slate-500 flex items-center gap-1"><Mail className="h-3.5 w-3.5" /> {session.email}</p>
                  </div>
                </div>

                {/* Change Password */}
                <div className="space-y-3 pb-6 border-b border-slate-100 dark:border-brand-muted">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <Lock className="h-4 w-4 text-emerald-500" /> Change Password
                  </h3>
                  <p className="text-xs text-slate-400">Know your current password? Update it here.</p>
                  <div className="relative">
                    <input type={showChangeCurrent ? 'text' : 'password'} placeholder="Current password" value={changePwCurrent}
                      onChange={e => setChangePwCurrent(e.target.value)}
                      className="w-full px-4 py-2.5 pr-10 rounded-lg border border-slate-200 dark:border-brand-muted bg-transparent text-sm outline-none focus:ring-2 focus:ring-emerald-500 text-slate-700 dark:text-slate-300 placeholder-slate-400" />
                    <button type="button" onClick={() => setShowChangeCurrent(!showChangeCurrent)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      {showChangeCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <div className="relative">
                    <input type={showChangeNew ? 'text' : 'password'} placeholder="New password" value={changePwNew}
                      onChange={e => setChangePwNew(e.target.value)}
                      className="w-full px-4 py-2.5 pr-10 rounded-lg border border-slate-200 dark:border-brand-muted bg-transparent text-sm outline-none focus:ring-2 focus:ring-emerald-500 text-slate-700 dark:text-slate-300 placeholder-slate-400" />
                    <button type="button" onClick={() => setShowChangeNew(!showChangeNew)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      {showChangeNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <div className="relative">
                    <input type={showChangeConfirm ? 'text' : 'password'} placeholder="Confirm new password" value={changePwConfirm}
                      onChange={e => setChangePwConfirm(e.target.value)}
                      className="w-full px-4 py-2.5 pr-10 rounded-lg border border-slate-200 dark:border-brand-muted bg-transparent text-sm outline-none focus:ring-2 focus:ring-emerald-500 text-slate-700 dark:text-slate-300 placeholder-slate-400" />
                    <button type="button" onClick={() => setShowChangeConfirm(!showChangeConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      {showChangeConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {changePwError && <p className="text-xs text-red-500">{changePwError}</p>}
                  {changePwSuccess && <p className="text-xs text-emerald-600">{changePwSuccess}</p>}
                  <button onClick={handleChangePassword} disabled={!changePwCurrent || !changePwNew || !changePwConfirm}
                    className="px-5 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                    Update Password
                  </button>
                </div>

                {/* Reset Password */}
                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <Lock className="h-4 w-4 text-amber-500" /> Reset Password
                  </h3>
                  <p className="text-xs text-slate-400">Forgot your password? Set a new one directly (no old password needed).</p>
                  <input type="email" placeholder="Email" value={resetEmail} readOnly
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-200 dark:border-brand-muted bg-slate-50 dark:bg-brand-muted/20 text-sm text-slate-500 dark:text-slate-400 cursor-not-allowed" />
                  <div className="relative">
                    <input type={showResetNew ? 'text' : 'password'} placeholder="New password" value={resetPwNew}
                      onChange={e => setResetPwNew(e.target.value)}
                      className="w-full px-4 py-2.5 pr-10 rounded-lg border border-slate-200 dark:border-brand-muted bg-transparent text-sm outline-none focus:ring-2 focus:ring-amber-500 text-slate-700 dark:text-slate-300 placeholder-slate-400" />
                    <button type="button" onClick={() => setShowResetNew(!showResetNew)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      {showResetNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <div className="relative">
                    <input type={showResetConfirm ? 'text' : 'password'} placeholder="Confirm new password" value={resetPwConfirm}
                      onChange={e => setResetPwConfirm(e.target.value)}
                      className="w-full px-4 py-2.5 pr-10 rounded-lg border border-slate-200 dark:border-brand-muted bg-transparent text-sm outline-none focus:ring-2 focus:ring-amber-500 text-slate-700 dark:text-slate-300 placeholder-slate-400" />
                    <button type="button" onClick={() => setShowResetConfirm(!showResetConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      {showResetConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {resetError && <p className="text-xs text-red-500">{resetError}</p>}
                  {resetSuccess && <p className="text-xs text-emerald-600">{resetSuccess}</p>}
                  <button onClick={handleResetPassword} disabled={!resetPwNew || !resetPwConfirm}
                    className="px-5 py-2 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                    Reset Password
                  </button>
                </div>
              </div>
            </Reveal>

            {/* Logout Section */}
            <Reveal delay={300}>
              <div className="bg-white dark:bg-[#2A2522] p-6 rounded-2xl border border-slate-200 dark:border-brand-muted shadow-sm space-y-4">
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 space-y-2">
                  <p className="text-sm font-medium text-amber-700 dark:text-amber-400 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" /> Before you logout
                  </p>
                  <p className="text-xs text-amber-600 dark:text-amber-500 leading-relaxed">
                    Back up your data first if needed. If connected to cloud sync, disconnect before logging out to avoid data conflicts.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button onClick={() => handleLogout(false)}
                    className="flex-1 px-5 py-2.5 rounded-lg border border-slate-200 dark:border-brand-muted text-slate-600 dark:text-slate-400 text-sm font-medium hover:bg-slate-50 dark:hover:bg-brand-muted/30 transition-colors">
                    <LogOut className="h-4 w-4 inline mr-1.5" /> Logout (keep data)
                  </button>
                  <button onClick={() => handleLogout(true)}
                    className="flex-1 px-5 py-2.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors">
                    <LogOut className="h-4 w-4 inline mr-1.5" /> Logout &amp; Clear Data
                  </button>
                </div>
              </div>
            </Reveal>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
