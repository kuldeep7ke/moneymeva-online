'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import { ArrowRight, ArrowUpCircle, ArrowDownCircle, PiggyBank, Wallet, Clock, TrendingUp, Share2, Pencil, Lock, Unlock } from 'lucide-react';
import ShareButton from '@/components/ShareButton';
import Reveal from '@/components/Reveal';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useInView } from '@/lib/utils';
import { getSession } from '@/lib/localAuth';
import { hasPins, getRemainingPins, validatePin } from '@/lib/pinStore';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';

const chartData = [
  { m: 'Jan', i: 4200, e: 2800 }, { m: 'Feb', i: 4800, e: 3100 },
  { m: 'Mar', i: 5100, e: 2900 }, { m: 'Apr', i: 5600, e: 3400 },
  { m: 'May', i: 6200, e: 3200 }, { m: 'Jun', i: 5900, e: 3600 },
  { m: 'Jul', i: 6800, e: 3100 }, { m: 'Aug', i: 7200, e: 3800 },
];

const features = [
  { icon: Clock, label: 'Spend', mobileLabel: 'Spend Smart', mobileDesc: 'Track every rupee you spend', desc: 'Track daily expenses effortlessly' },
  { icon: TrendingUp, label: 'Save', mobileLabel: 'Save Big', mobileDesc: 'Save for things that matter', desc: 'Set savings goals and watch progress' },
  { icon: Wallet, label: 'Wealth', mobileLabel: 'Wealth Up', mobileDesc: 'Grow your net worth daily', desc: 'Manage investments and build wealth' },
];

const stats = [
  { label: 'Income', sub: 'Feb', value: '₹85,000', bg: 'bg-emerald-50/80' },
  { label: 'Expense', sub: 'Feb', value: '₹42,300', bg: 'bg-sky-50/80' },
  { label: 'Savings', sub: 'Feb', value: '₹1,20,000', bg: 'bg-emerald-50/80' },
  { label: 'Investments', sub: 'Feb', value: '₹2,60,000', bg: 'bg-rose-50/80' },
];

export default function HomePage() {
  const router = useRouter();
  const [sessionUser, setSessionUser] = useState<any>(() => getSession().user);
  const [showPinPrompt, setShowPinPrompt] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);
  const [pinRemaining, setPinRemaining] = useState(0);

  useEffect(() => {
    const fromDashboard = typeof window !== 'undefined' && window.location.search.includes('from=dashboard');
    if (!fromDashboard) {
      const session = getSession().user;
      if (session) {
        router.replace(session.onboarding_completed ? '/dashboard' : '/onboarding');
      }
    }
  }, [router]);

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

  const handleEditProfile = () => {
    if (hasPins()) {
      setPinRemaining(getRemainingPins());
      setShowPinPrompt(true);
    } else {
      router.push('/onboarding?edit=true');
    }
  };

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validatePin(pinInput)) {
      setShowPinPrompt(false);
      setPinInput('');
      setPinError(false);
      router.push('/onboarding?edit=true');
    } else {
      setPinError(true);
      setPinRemaining(getRemainingPins());
    }
  };

  const { ref: heroRef, inView: heroInView } = useInView();
  const { ref: featureRef, inView: featureInView } = useInView();
  const { ref: chartRef, inView: chartInView } = useInView();
  return (
    <div className="min-h-screen bg-[#F8F6F3]">
      {/* Top Bar */}
      <header className="max-w-7xl mx-auto px-6 sm:px-10 h-[72px] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Money Meva" className="h-9 w-auto" />
            <span className="font-bold text-lg text-slate-900">Money Meva</span>
          </div>
        <div className="flex items-center gap-3">
          {sessionUser ? (
            <Link href="/dashboard" className="flex items-center gap-1 px-5 py-2.5 rounded-full bg-brand text-white text-sm font-semibold hover:bg-orange-600 transition-all shadow-sm">
              Dashboard <ArrowRight className="h-4 w-4" />
            </Link>
          ) : (
            <Link href="/login" className="flex items-center gap-1 px-5 py-2.5 rounded-full bg-brand text-white text-sm font-semibold hover:bg-orange-600 transition-all shadow-sm">
              Get started <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-6 sm:px-10 pt-12 sm:pt-20 pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.1fr] gap-12 lg:gap-16 items-start">
          {/* Left */}
          <div className="order-1 text-center lg:text-left pt-4 lg:pt-8">
            <Reveal>
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand/10 text-brand text-[13px] font-medium mb-6">
                <span className="text-brand/40">✦</span> Built for Indian wallets · ₹
              </div>
            </Reveal>
            <Reveal delay={100}>
              <h1 className="text-[2.8rem] sm:text-5xl lg:text-[3.5rem] font-bold text-slate-900 leading-[1.08] tracking-tight">
                Meet your<br />
                <em className="not-italic text-brand/60">money</em>, deeply.
              </h1>
            </Reveal>
            <Reveal delay={200}>
              <p className="mt-5 text-[15px] text-slate-500 max-w-md mx-auto lg:mx-0 leading-relaxed">
                Track expenses, watch savings grow, and see where your investments are headed — all wrapped in a glass-clear, minimalist canvas.
              </p>
            </Reveal>
            <Reveal delay={300}>
              <div className="mt-8 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3">
                {sessionUser ? (
                  <>
                    <button onClick={handleEditProfile} className="w-full sm:w-auto px-7 py-3.5 rounded-full bg-brand text-white font-semibold hover:bg-orange-600 transition-all shadow-sm text-[15px] cursor-pointer">
                      <Pencil className="inline h-4 w-4 mr-1.5" />Edit Profile
                    </button>
                    <Link href="/dashboard" className="w-full sm:w-auto px-7 py-3.5 rounded-full border border-brand/30 text-brand font-semibold hover:bg-brand/5 transition-all text-[15px]">
                      Dashboard <ArrowRight className="inline h-4 w-4 ml-1" />
                    </Link>
                  </>
                ) : (
                  <>
                    <Link href="/login" className="w-full sm:w-auto px-7 py-3.5 rounded-full bg-brand text-white font-semibold hover:bg-orange-600 transition-all shadow-sm text-[15px]">
                      Start tracking — free <ArrowRight className="inline h-4 w-4 ml-1" />
                    </Link>
                    <Link href="/login" className="w-full sm:w-auto px-7 py-3.5 rounded-full border border-brand/30 text-brand font-semibold hover:bg-brand/5 transition-all text-[15px]">
                      I have an account
                    </Link>
                  </>
                )}
              </div>
            </Reveal>
            {/* Feature Cards - Below buttons, left-aligned */}
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-md mx-auto lg:max-w-none">
              {features.map((f, i) => (
                <Reveal key={f.label} delay={400 + i * 100}>
                  <div className="rounded-2xl bg-white border border-slate-100/80 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-md hover:border-brand/20 transition-all duration-300 overflow-hidden">
                    {/* Mobile: split card */}
                    <div className="grid grid-cols-2 gap-0 sm:hidden">
                      {i === 1 ? (
                        <>
                          <div className="flex items-center justify-end px-4 py-4 border-r border-slate-100">
                            <div className="text-right">
                              <p className="text-sm font-semibold text-slate-800 leading-tight">{f.mobileLabel}</p>
                              <p className="text-xs text-slate-400">{f.mobileDesc}</p>
                            </div>
                          </div>
                          <div className="flex items-center justify-start px-4 py-4">
                            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-brand/20 to-brand/5 flex items-center justify-center">
                              <f.icon className="h-5 w-5 text-brand" />
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex items-center justify-end px-4 py-4 border-r border-slate-100">
                            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-brand/20 to-brand/5 flex items-center justify-center">
                              <f.icon className="h-5 w-5 text-brand" />
                            </div>
                          </div>
                          <div className="flex items-center px-4 py-4">
                            <div className="text-left">
                              <p className="text-sm font-semibold text-slate-800 leading-tight">{f.mobileLabel}</p>
                              <p className="text-xs text-slate-400">{f.mobileDesc}</p>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                    {/* Desktop: original horizontal layout */}
                    <div className="hidden sm:flex items-center gap-2.5 px-4 py-4 border-l-2 border-l-brand/30">
                      <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-brand/20 to-brand/5 flex items-center justify-center shrink-0">
                        <f.icon className="h-5 w-5 text-brand" />
                      </div>
                      <div className="text-left">
                        <p className="text-[13px] font-semibold text-slate-800 leading-tight">{f.label}</p>
                        <p className="text-[11px] text-slate-400">{f.desc}</p>
                      </div>
                    </div>
                </div>
              </Reveal>
              ))}
            </div>
          </div>

          {/* Right: Glass Card */}
          <div className="order-2 lg:order-2">
            <Reveal delay={200}>
              <div className="rounded-3xl bg-white/80 backdrop-blur-sm border border-brand/10 shadow-[0_8px_40px_rgba(0,0,0,0.06)] p-6 sm:p-7">
              {/* Net Worth Header */}
              <div className="flex items-start justify-between mb-6">
                <div>
                  <p className="text-[11px] font-semibold text-slate-400 tracking-wider uppercase">Net Worth</p>
                  <p className="text-3xl sm:text-[2.1rem] font-bold text-slate-900 mt-1 tracking-tight">₹4,82,500</p>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-emerald-600 text-white text-[11px] font-semibold mt-1">+12.4%</span>
              </div>
              {/* Chart */}
              <div className="h-40 sm:h-52 w-full mb-6 relative">
                <div className="absolute top-1 right-2 flex items-center gap-4 z-10">
                  <span className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500">
                    <span className="h-2 w-2 rounded-full bg-blue-500" /> Income
                  </span>
                  <span className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500">
                    <span className="h-2 w-2 rounded-full bg-red-400" /> Expense
                  </span>
                </div>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="gInc" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gExp" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f87171" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#f87171" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="i" stroke="#3b82f6" fill="url(#gInc)" strokeWidth={2.5} />
                    <Area type="monotone" dataKey="e" stroke="#f87171" fill="url(#gExp)" strokeWidth={2.5} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              {/* Stats 2x2 */}
              <div className="grid grid-cols-2 gap-3">
                {stats.map((s) => (
                  <div key={s.label} className={`rounded-2xl ${s.bg} p-4`}>
                    <p className="text-[11px] text-slate-500 font-medium mb-1">{s.label} · {s.sub}</p>
                    <p className="text-[15px] font-bold text-slate-900">{s.value}</p>
                  </div>
                ))}
              </div>
            </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-brand/10 py-10">
        <div className="max-w-7xl mx-auto px-6 sm:px-10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <img src="/logo.png" alt="Money Meva" className="h-7 w-auto" />
            <span className="font-bold text-base text-slate-900">Money Meva</span>
          </div>
          <p className="text-sm text-slate-400">&copy; 2026 Money Meva. All rights reserved.</p>
          <ShareButton />
        </div>
      </footer>

      {/* Edit Profile PIN Prompt */}
      {showPinPrompt && (
        <div className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => { setShowPinPrompt(false); setPinInput(''); setPinError(false); }}>
          <div className="bg-white dark:bg-[#2A2522] rounded-2xl max-w-sm w-full p-6 shadow-2xl text-center space-y-4" onClick={e => e.stopPropagation()}>
            <div className="mx-auto w-12 h-12 rounded-full bg-brand-secondary dark:bg-brand-muted/30 flex items-center justify-center">
              <Lock className="h-6 w-6 text-brand dark:text-brand-secondary" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Enter PIN</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Verify your identity to edit profile</p>
            </div>
            <form onSubmit={handlePinSubmit} className="space-y-4">
              <input type="password" inputMode="numeric" autoFocus maxLength={4} value={pinInput}
                onChange={e => { setPinInput(e.target.value.replace(/\D/g, '').slice(0, 4)); setPinError(false); }}
                className={cn("w-full text-center text-2xl tracking-[0.5em] px-4 py-3 rounded-lg border outline-none focus:ring-2",
                  pinError ? "border-red-500 focus:ring-red-500 bg-red-50" : "border-slate-200 dark:border-brand-muted dark:bg-brand-dark dark:text-slate-100 focus:ring-brand"
                )} placeholder="••••" />
              {pinError && <p className="text-xs text-red-500 font-medium">Invalid PIN. Try another one.</p>}
              {pinRemaining > 0 && <p className="text-xs text-slate-400 dark:text-slate-500">{pinRemaining} PIN{pinRemaining > 1 ? 's' : ''} remaining</p>}
              <div className="flex gap-3">
                <Button type="button" variant="outline" className="flex-1" onClick={() => { setShowPinPrompt(false); setPinInput(''); setPinError(false); }}>Cancel</Button>
                <Button type="submit" className="flex-1" disabled={pinInput.length < 4}>
                  <Unlock className="h-4 w-4 mr-2" /> Verify
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
