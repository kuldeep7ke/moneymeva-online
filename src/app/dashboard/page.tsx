'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowUpCircle, ArrowDownCircle, PiggyBank, TrendingUp, Users, Bell, RotateCcw, CalendarArrowUp, Repeat, CheckCircle2, Plus, Trash2, X, Wallet, Undo2, Gauge, Lock, Cloud, RefreshCw } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { formatCurrency, cn, useSortedCategories } from '@/lib/utils';
import DashboardLayout from '@/components/DashboardLayout';
import NotificationPanel from '@/components/NotificationPanel';
import { Button } from '@/components/ui/button';
import { getTransactions, getMonthlySummary, getAggregates, getCarryForward, getReminders, getRecurring, addReminder, completeAndRescheduleReminder, deleteReminder, getGoals, getPartners, addTransaction, addGoal, updateGoal, deleteGoal, isStoreReady } from '@/lib/store';
import { useAuth } from '@/components/AuthProvider';
import { hasPins } from '@/lib/pinStore';
import { ReminderFrequency } from '@/types';
import Reveal from '@/components/Reveal';
import { checkConnection, getConfig, connected as pouchConnected } from '@/lib/pouchdb';

function CardSkeleton({ className = "" }: { className?: string }) {
  return (
    <div className={cn("bg-white dark:bg-[#2A2522] p-6 rounded-2xl border border-slate-200 dark:border-brand-muted shadow-sm animate-pulse", className)}>
      <div className="h-4 bg-slate-200 dark:bg-brand-muted rounded w-1/3 mb-6"></div>
      <div className="space-y-3">
        <div className="h-3 bg-slate-200 dark:bg-brand-muted rounded w-full"></div>
        <div className="h-3 bg-slate-200 dark:bg-brand-muted rounded w-5/6"></div>
        <div className="h-3 bg-slate-200 dark:bg-brand-muted rounded w-4/6"></div>
      </div>
    </div>
  );
}

function ChartSkeleton({ className = "" }: { className?: string }) {
  return (
    <div className={cn("bg-white dark:bg-[#2A2522] p-6 rounded-2xl border border-slate-200 dark:border-brand-muted shadow-sm animate-pulse", className)}>
      <div className="h-4 bg-slate-200 dark:bg-brand-muted rounded w-1/4 mb-6"></div>
      <div className="h-64 bg-slate-100 dark:bg-brand-muted/50 rounded-xl"></div>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const { profile } = useAuth();
  const lockSession = () => window.dispatchEvent(new Event('request-lock-session'));
  const [isLoading, setIsLoading] = useState(true);
  const [aggregates, setAggregates] = useState({ balance: 0, income: 0, expense: 0, saving: 0, investment: 0, cashBankBalance: 0 });
  const [carryFwd, setCarryFwd] = useState({ lastMonthCarry: 0, currentStart: 0, currentBalance: 0 });
  const [reminders, setReminders] = useState<any[]>([]);
  const [allReminders, setAllReminders] = useState<any[]>([]);
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [goals, setGoals] = useState<any[]>([]);
  const [partnerInvest, setPartnerInvest] = useState(0);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [showAddReminder, setShowAddReminder] = useState(false);
  const [reminderForm, setReminderForm] = useState({ title: '', description: '', amount: '', category: 'Other', dueDate: new Date().toISOString().split('T')[0], frequency: 'once' as ReminderFrequency });
  const [toast, setToast] = useState<string | null>(null);
  const [lastDeleted, setLastDeleted] = useState<any>(null);
  const [editGoal, setEditGoal] = useState<any | null>(null);
  const [editGoalForm, setEditGoalForm] = useState({ name: '', target: '', saved: '' });
  const [confirmDeleteGoal, setConfirmDeleteGoal] = useState<string | null>(null);
  const [showAddMoney, setShowAddMoney] = useState(false);
  const [addMoneyAmount, setAddMoneyAmount] = useState('');
  const [addMoneyDest, setAddMoneyDest] = useState('cash');
  const [addMoneyMode, setAddMoneyMode] = useState<'add' | 'transfer'>('add');
  const [addMoneySource, setAddMoneySource] = useState('bank');
  const [partnersList, setPartnersList] = useState<any[]>([]);
  const [expenseQuota, setExpenseQuota] = useState(15);
  const [investQuota, setInvestQuota] = useState(35);
  const [editingQuota, setEditingQuota] = useState<'expense' | 'invest' | null>(null);
  const [syncConnected, setSyncConnected] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const refreshGoals = () => { setGoals(getGoals()); };

  const loadReminders = () => {
    const today = new Date().toISOString().split('T')[0];
    const manual = getReminders().filter(r => r.status === 'pending' && r.dueDate <= today).map(r => ({
      ...r,
      _type: 'reminder',
      _icon: Bell,
    }));
    const now = new Date();
    const recurring = getRecurring().filter(r => r.status === 'active').map(r => {
      const nextDate = new Date(r.nextDate);
      const diffDays = Math.ceil((nextDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return { ...r, _type: 'recurring', _icon: Repeat, _diffDays: diffDays };
    }).filter(r => r._diffDays >= 0 && r._diffDays <= r.reminderDays).slice(0, 3);
    setReminders([...recurring, ...manual].slice(0, 5));
    setAllReminders(getReminders().filter(r => r.status === 'pending'));
  };

  const refreshDashboard = async () => {
    if (!isStoreReady()) return;
    setIsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 100));
    
    setAggregates(getAggregates());
    setCarryFwd(getCarryForward());
    loadReminders();
    setGoals(getGoals());
    setPartnersList(getPartners());
    setPartnerInvest(getPartners().reduce((s, p) => s + (p.initialInvestment || 0), 0));

    const months = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const sm = getMonthlySummary(d.getFullYear(), d.getMonth());
      months.push({
        name: d.toLocaleString('default', { month: 'short' }),
        income: sm.income,
        expense: sm.expense,
        saving: sm.saving,
        investment: sm.investment,
      });
    }
    setMonthlyData(months);
    
    setTimeout(() => setIsLoading(false), 200);
  };

  useEffect(() => {
    refreshDashboard();
    const onReady = () => refreshDashboard();
    window.addEventListener('store-ready', onReady);
    return () => window.removeEventListener('store-ready', onReady);
  }, []);

  useEffect(() => {
    const cfg = getConfig();
    if (cfg.url) {
      checkConnection().then(setSyncConnected);
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const expenseQuotaFromStorage = localStorage.getItem('mm_quota_expense');
      const investQuotaFromStorage = localStorage.getItem('mm_quota_invest');
      if (expenseQuotaFromStorage) setExpenseQuota(Number(expenseQuotaFromStorage));
      if (investQuotaFromStorage) setInvestQuota(Number(investQuotaFromStorage));
    }
  }, []);

  const handleDone = (id: string) => {
    const rem = allReminders.find(r => r.id === id);
    if (!rem) return;
    addTransaction({
      amount: rem.amount || 0,
      type: 'expense',
      category: rem.category || 'Other',
      description: `Paid: ${rem.title}`,
      date: new Date().toISOString().split('T')[0],
      partnerAccountId: undefined,
      isRecurring: false,
    });
    completeAndRescheduleReminder(rem.id);
    loadReminders();
    refreshDashboard();
    setToast(`"${rem.title}" added to expenses`);
    setTimeout(() => setToast(null), 3500);
  };

  const handleDeleteReminder = (id: string) => {
    const deleted = allReminders.find(r => r.id === id);
    deleteReminder(id);
    if (deleted) {
      setLastDeleted({ ...deleted, _restoreType: 'reminder' });
      setToast(`Deleted "${deleted.title}"`);
      setTimeout(() => { setToast(null); setLastDeleted(null); }, 5000);
    }
    loadReminders();
  };

  const handleAddReminder = (e: React.FormEvent) => {
    e.preventDefault();
    addReminder({
      title: reminderForm.title,
      description: reminderForm.description,
      amount: Number(reminderForm.amount) || 0,
      category: reminderForm.category,
      dueDate: reminderForm.dueDate,
      frequency: reminderForm.frequency,
      status: 'pending',
    });
    setShowAddReminder(false);
    setReminderForm({ title: '', description: '', amount: '', category: 'Other', dueDate: new Date().toISOString().split('T')[0], frequency: 'once' as ReminderFrequency });
    loadReminders();
  };

  const frequencyOptions = [
    { value: 'once', label: 'Once' },
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' },
    { value: 'quarterly', label: 'Quarterly' },
    { value: 'half-yearly', label: 'Half Yearly' },
    { value: 'yearly', label: 'Yearly' },
  ];

  const pendingReminders = allReminders.filter(r => r.status === 'pending');

  const expenseLimit = Math.round(aggregates.income * expenseQuota / 100);
  const investLimit = Math.round(aggregates.income * investQuota / 100);
  const availableToSpend = aggregates.income - expenseLimit - investLimit - aggregates.saving;

  const CATEGORY_COLORS: Record<string, string> = {
    'Food': '#FF6384', 'Transport': '#36A2EB', 'Shopping': '#FFCE56',
    'Bills': '#4BC0C0', 'Entertainment': '#9966FF', 'Health': '#FF9F40',
    'Education': '#C9CBCF', 'Dining': '#FF6384', 'Groceries': '#36A2EB',
    'Rent': '#FFCE56', 'Salary': '#4BC0C0', 'Other': '#9966FF',
  };

  const recentTransactions = getTransactions().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5);

  const sortedReminderCategories = useSortedCategories(['Other', 'Bills', 'Insurance', 'Rent', 'Subscription', 'Tax', 'EMI', 'Health'], 'expense');

  const categoryTotals = getTransactions()
    .filter(t => t.type === 'expense')
    .reduce((acc: Record<string, number>, t) => {
      acc[t.category] = (acc[t.category] || 0) + t.amount;
      return acc;
    }, {});
  const pieData = Object.entries(categoryTotals)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  const summaryCards = [
    { title: 'Available to Spend', amount: availableToSpend, icon: Wallet, color: availableToSpend >= 0 ? 'text-emerald-600' : 'text-red-600', bgColor: availableToSpend >= 0 ? 'bg-emerald-50' : 'bg-red-50' },
    { title: 'Total Balance', amount: aggregates.cashBankBalance, icon: PiggyBank, color: 'text-blue-600', bgColor: 'bg-blue-50' },
    { title: 'Total Income', amount: aggregates.income, icon: ArrowUpCircle, color: 'text-green-600', bgColor: 'bg-green-50' },
    { title: 'Total Expenses', amount: aggregates.expense, icon: ArrowDownCircle, color: 'text-red-600', bgColor: 'bg-red-50' },
    { title: 'Investments', amount: aggregates.investment, icon: TrendingUp, color: 'text-brand', bgColor: 'bg-brand-secondary' },
    { title: 'Partners', amount: partnerInvest, icon: Users, color: 'text-purple-600', bgColor: 'bg-purple-50' },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div>
              <p className="hidden md:inline-flex items-center px-1 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                <span className="font-bold uppercase tracking-wider text-brand">At a glance</span>
                <span className="mx-3 text-slate-300 dark:text-slate-600">|</span>
                <span>Your money, simplified.</span>
              </p>
              <div className="md:hidden">
                <p className="px-1 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                  <span className="font-bold uppercase tracking-wider text-brand">At a glance</span>
                </p>
                <p className="px-1 text-xs text-slate-500 dark:text-slate-400 -mt-1">Your money, simplified.</p>
              </div>
            </div>
          </div>
          <NotificationPanel />
        </div>

        <Reveal>
        <div className="bg-white dark:bg-[#2A2522] rounded-2xl border border-slate-200 dark:border-brand-muted shadow-sm p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-brand">Welcome back</p>
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-1">{profile?.full_name || 'User'}, you’re set to move fast today.</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-2xl">Your dashboard is ready with live balances, alerts, goals, and quick actions.</p>
              <div className="flex items-center gap-2 mt-4">
                <div className="flex items-center gap-2 rounded-xl bg-brand-light dark:bg-brand-muted/30 px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-300">
                  <Gauge className="h-4 w-4 text-brand" /> Fast mode
                </div>
                {hasPins() && (
                  <button onClick={lockSession} title="Lock session"
                    className="flex items-center justify-center gap-2 rounded-xl bg-amber-50 dark:bg-amber-900/20 p-2 text-xs font-medium text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors"
                  >
                    <Lock className="h-4 w-4" />
                    <span>Lock Session</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
        </Reveal>

        <Reveal delay={100}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {summaryCards.map((card) => {
            const isExpense = card.title === 'Total Expenses';
            const isInvest = card.title === 'Investments';
            const isTotalBalance = card.title === 'Total Balance';
            const quota = isExpense ? expenseQuota : isInvest ? investQuota : null;
            const limit = quota != null ? Math.round(aggregates.income * quota / 100) : 0;
            const spent = isExpense ? aggregates.expense : isInvest ? aggregates.investment : 0;
            const pct = limit > 0 ? Math.min(Math.round((spent / limit) * 100), 100) : 0;
            const overLimit = limit > 0 && pct >= 100;
            const nearLimit = limit > 0 && pct >= 80 && pct < 100;
            
            const cashBalance = getTransactions().reduce((sum, t) => {
              if (t.account === 'cash') return sum + (t.type === 'income' ? t.amount : -t.amount);
              return sum;
            }, 0);
            const bankBalance = getTransactions().reduce((sum, t) => {
              if (t.account === 'bank' || t.account === 'upi') return sum + (t.type === 'income' ? t.amount : -t.amount);
              return sum;
            }, 0);
            
            return (
            <div key={card.title} className={cn(
              "bg-white dark:bg-[#2A2522] p-6 rounded-2xl shadow-sm hover:shadow-md transition-all",
              overLimit ? "border-2 border-red-400 dark:border-red-500 animate-pulse" : 
              nearLimit ? "border-2 border-amber-400 dark:border-amber-500" : 
              "border border-slate-200 dark:border-brand-muted"
            )}>
              <div className="flex items-center justify-between mb-4">
                <div className={cn("p-3 rounded-xl", card.bgColor)}>
                  <card.icon className={cn("h-6 w-6", card.color)} />
                </div>
                {overLimit && <span className="text-xs font-bold text-red-500">OVER</span>}
                {nearLimit && <span className="text-xs font-bold text-amber-500">NEAR</span>}
              </div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{card.title}</p>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{formatCurrency(card.amount)}</h3>
              
              {isTotalBalance && (
                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-brand-muted/50 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" /> Cash
                    </span>
                    <span className="font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(cashBalance)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-medium">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-500" /> Bank
                    </span>
                    <span className="font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(bankBalance)}</span>
                  </div>
                </div>
              )}
              
              {quota != null && (
                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-brand-muted/50">
                  <div className="h-1.5 bg-slate-200 dark:bg-brand-muted rounded-full overflow-hidden mb-2">
                    <div className={cn("h-full rounded-full transition-all", overLimit ? "bg-red-500" : nearLimit ? "bg-amber-500" : "bg-brand")} style={{ width: `${pct}%` }}></div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500 dark:text-slate-400">{pct}% of limit</span>
                    {editingQuota === (isExpense ? 'expense' : 'invest') ? (
                      <form onSubmit={(e) => {
                        e.preventDefault();
                        const input = e.currentTarget.querySelector('input');
                        if (!input) return;
                        const val = Math.max(1, Math.min(100, Number(input.value)));
                        if (isExpense) {
                          setExpenseQuota(val);
                          localStorage.setItem('mm_quota_expense', String(val));
                        } else {
                          setInvestQuota(val);
                          localStorage.setItem('mm_quota_invest', String(val));
                        }
                        setEditingQuota(null);
                      }} className="flex items-center gap-1">
                        <input type="number" min="1" max="100" defaultValue={quota} autoFocus
                          className="w-12 px-1 py-0.5 rounded border border-slate-200 dark:border-brand-muted dark:bg-brand-dark text-xs text-center outline-none focus:ring-1 focus:ring-brand" />
                        <button type="submit" className="text-xs text-brand font-medium">Save</button>
                      </form>
                    ) : (
                      <button onClick={() => setEditingQuota(isExpense ? 'expense' : 'invest')}
                        className="text-[10px] text-slate-400 hover:text-brand transition-colors font-medium">
                        {quota}% of income
                      </button>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">Limit: {formatCurrency(limit)} (from {formatCurrency(aggregates.income)})</p>
                </div>
              )}
              
              {card.title === 'Partners' && (
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{partnersList.length} partner{partnersList.length !== 1 ? 's' : ''}</p>
              )}
            </div>
          )})}
        </div>
        </Reveal>

        {/* Cloud Sync Status */}
        <Reveal delay={150}>
        <div className="bg-white dark:bg-[#2A2522] rounded-2xl border border-slate-200 dark:border-brand-muted shadow-sm p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn("p-2.5 rounded-xl", syncConnected ? "bg-green-50 dark:bg-green-900/20" : "bg-slate-50 dark:bg-brand-muted/30")}>
                <Cloud className={cn("h-5 w-5", syncConnected ? "text-green-600" : "text-slate-400")} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Cloud Sync</p>
                  <div className={cn("w-1.5 h-1.5 rounded-full", syncConnected ? "bg-green-500" : syncing ? "bg-amber-500 animate-pulse" : "bg-slate-300")} />
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {syncing ? 'Syncing...' : syncConnected ? 'Connected — real-time sync active' : 'Offline — set up sync'}
                </p>
              </div>
            </div>
            {syncConnected ? (
              <Button variant="outline" size="sm" className="text-xs gap-1.5 border-sky-200 text-sky-700 dark:border-sky-800 dark:text-sky-400" onClick={async () => {
                if (syncing) return;
                setSyncing(true);
                const cfg = getConfig();
                if (cfg.url) {
                  const ok = await checkConnection();
                  setSyncConnected(ok);
                }
                setTimeout(() => setSyncing(false), 1000);
              }} disabled={syncing}>
                <RefreshCw className={cn("h-3.5 w-3.5", syncing && "animate-spin")} /> {syncing ? 'Syncing' : 'Sync Now'}
              </Button>
            ) : (
              <Button variant="primary" size="sm" className="text-xs gap-1.5" onClick={() => router.push('/dashboard/settings')}>
                <Cloud className="h-3.5 w-3.5" /> Set Up
              </Button>
            )}
          </div>
        </div>
        </Reveal>

        <Reveal delay={200}>
        <div className="bg-gradient-to-r from-brand to-purple-600 p-6 rounded-2xl shadow-lg text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <RotateCcw className="h-8 w-8 opacity-80" />
               <div>
                 <h3 className="text-lg font-bold">Balance Carry Forward</h3>
                 <p className="text-sm opacity-80">Unspent balance rolls over automatically.</p>
               </div>
            </div>
            <CalendarArrowUp className="h-6 w-6 opacity-60" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-6">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
              <p className="text-sm opacity-80 mb-1">Last Month Carry</p>
              <p className="text-2xl font-bold">{formatCurrency(carryFwd.lastMonthCarry)}</p>
              <p className="text-xs opacity-60">Carried forward</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
              <p className="text-sm opacity-80 mb-1">This Month Start</p>
              <p className="text-2xl font-bold">{formatCurrency(carryFwd.currentStart)}</p>
              <p className="text-xs opacity-60">Opening balance</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
              <p className="text-sm opacity-80 mb-1">Current Balance</p>
              <p className="text-2xl font-bold">{formatCurrency(carryFwd.currentBalance)}</p>
              <p className="text-xs opacity-60">Running balance</p>
            </div>
          </div>
        </div>
        </Reveal>

        {/* Loading Skeletons */}
        {isLoading && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <ChartSkeleton className="lg:col-span-2" />
            <CardSkeleton />
          </div>
        )}

        {/* Loaded Content with Animation */}
        {!isLoading && (monthlyData.length > 0 || reminders.length > 0) && (
        <Reveal delay={300}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 transition-all duration-500 ease-in-out">
          {monthlyData.length > 0 && (
          <div className={cn("bg-white dark:bg-[#2A2522] p-6 rounded-2xl border border-slate-200 dark:border-brand-muted shadow-sm transition-all duration-500", reminders.length === 0 && "lg:col-span-3")}>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-6">Cash Flow Analysis</h2>
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyData}>
                  <defs>
                    <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1}/><stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/></linearGradient>
                    <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#ef4444" stopOpacity={0.1}/><stop offset="95%" stopColor="#ef4444" stopOpacity={0}/></linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} tickFormatter={(v) => `₹${v/1000}k`} />
                  <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                  <Area type="monotone" dataKey="income" stroke="#4f46e5" fillOpacity={1} fill="url(#colorIncome)" strokeWidth={2} />
                  <Area type="monotone" dataKey="expense" stroke="#ef4444" fillOpacity={1} fill="url(#colorExpense)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
          )}

          {reminders.length > 0 && (
          <div className={cn("bg-white dark:bg-[#2A2522] p-6 rounded-2xl border border-slate-200 dark:border-brand-muted shadow-sm", monthlyData.length === 0 && "lg:col-span-3")}>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-6">Upcoming Reminders</h2>
            <div className="space-y-4">
              {reminders.map((r: any) => (
                <div key={r.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 dark:border-brand-muted hover:bg-slate-50 dark:hover:bg-brand-muted/30 transition-colors">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={cn("p-1.5 rounded-full shrink-0", r._type === 'recurring' ? 'bg-brand-secondary dark:bg-brand-muted/30' : 'bg-amber-50 dark:bg-amber-900/30')}>
                      {r._type === 'recurring' ? <Repeat className="h-3 w-3 text-brand" /> : <Bell className="h-3 w-3 text-amber-500" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{r.title}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {r._type === 'recurring'
                          ? r._diffDays === 0 ? 'Due today' : `In ${r._diffDays} day${r._diffDays > 1 ? 's' : ''}`
                          : `Due: ${r.dueDate}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{formatCurrency(r.amount)}</p>
                    {r._type === 'reminder' && (
                      <button onClick={() => handleDone(r.id)} className="p-1.5 rounded-full text-green-500 hover:bg-green-50 dark:hover:bg-green-900/30 transition-colors" title="Mark done">
                        <CheckCircle2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <Button variant="ghost" className="w-full mt-6 text-brand dark:text-brand-secondary hover:text-brand dark:hover:text-brand-secondary hover:bg-brand-secondary dark:hover:bg-brand-muted/30" onClick={() => { setShowReminderModal(true); setShowAddReminder(false); }}>
              Manage Reminders
            </Button>
          </div>
          )}
        </div>
        </Reveal>
        )}

        {/* Reminder Modal */}
        {showReminderModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm overflow-y-auto flex items-start sm:items-center justify-center z-50 p-4" onClick={() => setShowReminderModal(false)}>
            <div className="bg-white dark:bg-[#2A2522] rounded-2xl max-w-lg w-full max-h-[80vh] flex flex-col shadow-2xl my-4" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-brand-muted">
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  {showAddReminder ? 'New Reminder' : `Reminders (${pendingReminders.length})`}
                </h3>
                <div className="flex items-center gap-2">
                  {!showAddReminder && (
                    <Button size="sm" variant="ghost" onClick={() => setShowAddReminder(true)} className="gap-1 text-brand">
                      <Plus className="h-4 w-4" /> Add
                    </Button>
                  )}
                  <button onClick={() => setShowReminderModal(false)} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-brand-muted">
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                {showAddReminder ? (
                  <form onSubmit={handleAddReminder} className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-1">Title</label>
                      <input required value={reminderForm.title} onChange={e => setReminderForm({ ...reminderForm, title: e.target.value })}
                        className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-brand-muted dark:bg-brand-dark dark:text-slate-100 outline-none focus:ring-2 focus:ring-brand" placeholder="e.g. Insurance Renewal" />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-1">Description</label>
                      <input value={reminderForm.description} onChange={e => setReminderForm({ ...reminderForm, description: e.target.value })}
                        className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-brand-muted dark:bg-brand-dark dark:text-slate-100 outline-none focus:ring-2 focus:ring-brand" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-1">Amount (₹)</label>
                         <input type="number" min="0" value={reminderForm.amount} onChange={e => setReminderForm({ ...reminderForm, amount: e.target.value })}
                          className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-brand-muted dark:bg-brand-dark dark:text-slate-100 outline-none focus:ring-2 focus:ring-brand" />
                      </div>
                      <div>
                       <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-1">Category</label>
                       <input required list="reminder-category-options" value={reminderForm.category} onChange={e => setReminderForm({ ...reminderForm, category: e.target.value })}
                         className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-brand-muted dark:bg-brand-dark dark:text-slate-100 outline-none focus:ring-2 focus:ring-brand" placeholder="Select or type a category" />
                       <datalist id="reminder-category-options">
                         {sortedReminderCategories.map(c => <option key={c} value={c} />)}
                       </datalist>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-1">Due Date</label>
                        <input required type="date" value={reminderForm.dueDate} onChange={e => setReminderForm({ ...reminderForm, dueDate: e.target.value })}
                          className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-brand-muted dark:bg-brand-dark dark:text-slate-100 outline-none focus:ring-2 focus:ring-brand" />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-1">Repeat</label>
                        <select value={reminderForm.frequency} onChange={e => setReminderForm({ ...reminderForm, frequency: e.target.value as ReminderFrequency })}
                          className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-brand-muted dark:bg-brand-dark dark:text-slate-100 outline-none focus:ring-2 focus:ring-brand">
                          {frequencyOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="flex items-center justify-end gap-2 pt-2">
                      <Button variant="ghost" size="sm" onClick={() => setShowAddReminder(false)}>Cancel</Button>
                      <Button type="submit" size="sm">Create Reminder</Button>
                    </div>
                  </form>
                ) : pendingReminders.length === 0 ? (
                  <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-8">No reminders. Click "Add" to create one.</p>
                ) : (
                  <div className="space-y-3">
                    {pendingReminders.map(r => (
                      <div key={r.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 dark:border-brand-muted hover:bg-slate-50 dark:hover:bg-brand-muted/30 transition-colors">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{r.title}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">Due: {r.dueDate} {r.frequency !== 'once' && `· ${r.frequency}`}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{formatCurrency(r.amount)}</p>
                          <button onClick={() => handleDone(r.id)} className="p-1.5 rounded-full text-green-500 hover:bg-green-50 dark:hover:bg-green-900/30 transition-colors" title="Mark done & reschedule">
                            <CheckCircle2 className="h-4 w-4" />
                          </button>
                          <button onClick={() => { if (confirm('Delete this reminder?')) handleDeleteReminder(r.id); }} className="p-1.5 rounded-full text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors gap-1" title="Delete">
                            <Trash2 className="h-3.5 w-3.5" />
                            <span className="hidden md:inline text-[10px]">Delete</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Spending Breakdown + Recent Transactions */}
        {isLoading && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <CardSkeleton />
            <CardSkeleton className="lg:col-span-2" />
          </div>
        )}
        {!isLoading && (pieData.length > 0 || recentTransactions.length > 0) && (
        <Reveal delay={400}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 transition-all duration-500 ease-in-out">
          {pieData.length > 0 && (
          <div className={cn("bg-white dark:bg-[#2A2522] p-6 rounded-2xl border border-slate-200 dark:border-brand-muted shadow-sm transition-all duration-500", recentTransactions.length === 0 && "lg:col-span-3")}>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4">Spending Breakdown</h2>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={3} dataKey="value">
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={CATEGORY_COLORS[entry.name] || '#CBD5E1'} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} formatter={(v: any) => formatCurrency(Number(v) || 0)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2 mt-4">
              {pieData.map((item, i) => (
                <div key={item.name} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[item.name] || '#CBD5E1' }} />
                    <span className="text-slate-600 dark:text-slate-400">{item.name}</span>
                  </div>
                  <span className="font-medium text-slate-900 dark:text-slate-100">{formatCurrency(item.value)}</span>
                </div>
              ))}
            </div>
          </div>
          )}

          {recentTransactions.length > 0 && (
          <div className={cn("bg-white dark:bg-[#2A2522] p-6 rounded-2xl border border-slate-200 dark:border-brand-muted shadow-sm", pieData.length === 0 && "lg:col-span-3")}>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4">Recent Transactions</h2>
            <div className="space-y-2">
              {recentTransactions.map((t: any) => (
                <div key={t.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-brand-muted/30 transition-colors">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={cn("p-1.5 rounded-full shrink-0", t.type === 'income' ? 'bg-green-50 dark:bg-green-900/30' : 'bg-red-50 dark:bg-red-900/30')}>
                      {t.type === 'income' ? <ArrowUpCircle className="h-4 w-4 text-green-500" /> : <ArrowDownCircle className="h-4 w-4 text-red-500" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{t.description || t.category}</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500">{t.date} {t.category !== 'Other' && `· ${t.category}`}</p>
                    </div>
                  </div>
                  <p className={cn("text-sm font-bold shrink-0", t.type === 'income' ? 'text-green-600' : 'text-red-600')}>
                    {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                  </p>
                </div>
              ))}
            </div>
          </div>
          )}
        </div>
        </Reveal>
        )}

        {/* Goals */}
        {isLoading && (
          <CardSkeleton />
        )}
        {!isLoading && goals.length > 0 && (
        <Reveal delay={500}>
        <div className="bg-white dark:bg-[#2A2522] p-6 rounded-2xl border border-slate-200 dark:border-brand-muted shadow-sm transition-all duration-500">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Goals</h2>
            <button onClick={() => {
              setEditGoal({ _new: true });
              setEditGoalForm({ name: '', target: '', saved: '' });
            }} className="h-8 w-8 rounded-lg bg-brand/10 text-brand flex items-center justify-center hover:bg-brand/20 transition-colors shrink-0" title="Add Goal">
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {goals.map(g => {
                const pct = g.target > 0 ? Math.min(Math.round((g.saved / g.target) * 100), 100) : 0;
                return (
                  <div key={g.id} className="p-4 rounded-xl bg-slate-50 dark:bg-brand-muted/30 border border-slate-100 dark:border-brand-muted group">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <span className="font-medium text-slate-900 dark:text-slate-100">{g.name}</span>
                        <button onClick={() => {
                          setEditGoal(g);
                          setEditGoalForm({ name: g.name, target: String(g.target), saved: String(g.saved) });
                        }} className="ml-2 opacity-0 group-hover:opacity-100 inline-flex text-xs text-brand hover:underline transition-opacity">
                          Edit
                        </button>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-sm font-bold text-brand">{pct}%</span>
                        {confirmDeleteGoal === g.id ? (
                          <div className="flex items-center gap-1">
                            <button onClick={() => { deleteGoal(g.id); refreshGoals(); setConfirmDeleteGoal(null); setToast(`Goal deleted`); setTimeout(() => setToast(null), 3000); }} className="p-1 rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30"><Trash2 className="h-3.5 w-3.5" /></button>
                            <button onClick={() => setConfirmDeleteGoal(null)} className="p-1 rounded text-slate-400 hover:bg-slate-100 dark:hover:bg-brand-muted"><X className="h-3.5 w-3.5" /></button>
                          </div>
                        ) : (
                          <button onClick={() => setConfirmDeleteGoal(g.id)} className="p-1 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 opacity-0 group-hover:opacity-100 transition-all"><Trash2 className="h-3.5 w-3.5" /></button>
                        )}
                      </div>
                    </div>
                    <div className="h-2 bg-slate-200 dark:bg-brand-muted rounded-full overflow-hidden mb-2">
                      <div className={cn("h-full rounded-full", pct >= 75 ? "bg-green-500" : pct >= 50 ? "bg-amber-500" : "bg-brand")} style={{ width: `${pct}%` }}></div>
                    </div>
                    <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mb-3">
                      <span>Saved: {formatCurrency(g.saved)}</span>
                      <span>Target: {formatCurrency(g.target)}</span>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => {
                        const amt = prompt('Contribute amount (₹):');
                        if (amt && Number(amt) > 0) {
                          addTransaction({ amount: Number(amt), type: 'saving', category: g.name, description: `Contribute to ${g.name}`, date: new Date().toISOString().split('T')[0], partnerAccountId: undefined, isRecurring: false });
                          updateGoal(g.id, { saved: g.saved + Number(amt) });
                          refreshGoals();
                          setAggregates(getAggregates());
                          setToast(`₹${Number(amt).toLocaleString()} contributed to "${g.name}"`);
                          setTimeout(() => setToast(null), 3000);
                        }
                      }} className="flex-1 text-xs py-1.5 rounded-lg bg-brand text-white hover:bg-brand-dark transition-colors font-medium">
                        + Contribute
                      </button>
                      <button onClick={() => {
                        const amt = prompt('Withdraw amount (₹):');
                        if (amt && Number(amt) > 0 && Number(amt) <= g.saved) {
                          addTransaction({ amount: Number(amt), type: 'income', category: 'Savings Withdrawal', description: `Withdraw from ${g.name}`, date: new Date().toISOString().split('T')[0], partnerAccountId: undefined, isRecurring: false });
                          updateGoal(g.id, { saved: g.saved - Number(amt) });
                          refreshGoals();
                          setAggregates(getAggregates());
                          setToast(`₹${Number(amt).toLocaleString()} withdrawn from "${g.name}"`);
                          setTimeout(() => setToast(null), 3000);
                        } else if (amt) {
                          alert('Amount exceeds saved balance');
                        }
                      }} className="flex-1 text-xs py-1.5 rounded-lg border border-slate-200 dark:border-brand-muted hover:bg-slate-100 dark:hover:bg-brand-muted/50 transition-colors font-medium text-slate-600 dark:text-slate-400">
                        - Withdraw
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
        </div>
        </Reveal>
        )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-5 py-3 rounded-xl shadow-2xl text-sm font-medium animate-in slide-in-from-bottom-2">
          <span>{toast}</span>
          {lastDeleted && (
            <button onClick={() => {
              if (lastDeleted._restoreType === 'reminder') {
                addReminder({ title: lastDeleted.title, description: lastDeleted.description || '', amount: lastDeleted.amount, category: lastDeleted.category || 'Other', dueDate: lastDeleted.dueDate, frequency: lastDeleted.frequency, status: 'pending' });
                loadReminders();
              } else {
                addTransaction(lastDeleted);
              }
              setLastDeleted(null);
              setToast('Restored');
              setTimeout(() => setToast(null), 2000);
            }} className="flex items-center gap-1 text-brand-secondary dark:text-brand hover:underline font-bold">
              <Undo2 className="h-3.5 w-3.5" /> Undo
            </button>
          )}
        </div>
      )}

      {/* Add Money & Transfer */}
      {showAddMoney && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm overflow-y-auto flex items-start sm:items-center justify-center z-50 p-4" onClick={() => setShowAddMoney(false)}>
          <div className="bg-white dark:bg-[#2A2522] rounded-2xl max-w-md w-full p-6 shadow-2xl my-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">{addMoneyMode === 'transfer' ? 'Transfer Between Accounts' : 'Add Money'}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">
              {addMoneyMode === 'transfer' ? 'Move money between Cash and Bank. Both accounts will be updated.' : 'Add funds to your Cash or Bank account.'}
            </p>

            {/* Mode toggle */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-brand-muted rounded-lg p-0.5 mb-4">
              {(['add', 'transfer'] as const).map(m => (
                <button key={m} onClick={() => { setAddMoneyMode(m); setAddMoneyDest(m === 'transfer' ? 'cash' : 'cash'); }}
                  className={cn("px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex-1 text-center",
                    addMoneyMode === m ? "bg-white dark:bg-[#2A2522] text-slate-900 dark:text-slate-100 shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700"
                  )}>{m === 'transfer' ? 'Transfer' : 'Add Money'}</button>
              ))}
            </div>

            <form onSubmit={(e) => {
              e.preventDefault();
              const amount = Number(addMoneyAmount);
              if (!amount || amount <= 0) return;
              const today = new Date().toISOString().split('T')[0];

              if (addMoneyMode === 'transfer') {
                const from = addMoneySource as 'cash' | 'bank' | 'upi';
                const to = addMoneyDest as 'cash' | 'bank' | 'upi';
                if (from === to) { setToast('Source and destination must be different'); setTimeout(() => setToast(null), 3000); return; }
                const transferId = Date.now().toString(36);
                addTransaction({ amount, type: 'expense', category: 'Transfer', description: `Transfer to ${to === 'cash' ? 'Cash' : to === 'bank' ? 'Bank' : 'UPI'}`, date: today, account: from, transferId, partnerAccountId: undefined, isRecurring: false });
                addTransaction({ amount, type: 'income', category: 'Transfer', description: `Transfer from ${from === 'cash' ? 'Cash' : from === 'bank' ? 'Bank' : 'UPI'}`, date: today, account: to, transferId, partnerAccountId: undefined, isRecurring: false });
                setToast(`₹${amount.toLocaleString()} transferred from ${from === 'cash' ? 'Cash' : from === 'bank' ? 'Bank' : 'UPI'} to ${to === 'cash' ? 'Cash' : to === 'bank' ? 'Bank' : 'UPI'}`);
              } else {
                const account = addMoneyDest as 'cash' | 'bank' | 'upi';
                addTransaction({ amount, type: 'income', category: 'Other', description: `Added to ${account === 'cash' ? 'Cash' : account === 'bank' ? 'Bank' : 'UPI'}`, date: today, account, partnerAccountId: undefined, isRecurring: false });
                setToast(`₹${amount.toLocaleString()} added to ${account === 'cash' ? 'Cash' : account === 'bank' ? 'Bank' : 'UPI'}`);
              }

              setShowAddMoney(false);
              setAddMoneyAmount('');
              setAddMoneyDest('cash');
              setAddMoneyMode('add');
              refreshDashboard();
              setTimeout(() => setToast(null), 4000);
            }} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1">Amount (₹)</label>
                 <input required type="number" min="0" step="0.01" value={addMoneyAmount} onChange={e => setAddMoneyAmount(e.target.value)} autoFocus
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-brand-muted dark:bg-brand-dark dark:text-slate-100 outline-none focus:ring-2 focus:ring-brand text-sm" placeholder="0" />
              </div>

              {addMoneyMode === 'transfer' ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1">From</label>
                    <select value={addMoneySource} onChange={e => setAddMoneySource(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-brand-muted dark:bg-brand-dark dark:text-slate-100 outline-none focus:ring-2 focus:ring-brand text-sm">
                      <option value="cash">Cash</option>
                      <option value="bank">Bank</option>
                      <option value="upi">UPI</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1">To</label>
                    <select value={addMoneyDest} onChange={e => setAddMoneyDest(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-brand-muted dark:bg-brand-dark dark:text-slate-100 outline-none focus:ring-2 focus:ring-brand text-sm">
                      <option value="cash">Cash</option>
                      <option value="bank">Bank</option>
                      <option value="upi">UPI</option>
                    </select>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1">Account</label>
                  <select value={addMoneyDest} onChange={e => setAddMoneyDest(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-brand-muted dark:bg-brand-dark dark:text-slate-100 outline-none focus:ring-2 focus:ring-brand text-sm">
                    <option value="cash">Cash</option>
                    <option value="bank">Bank</option>
                    <option value="upi">UPI</option>
                  </select>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button variant="ghost" size="sm" onClick={() => setShowAddMoney(false)}>Cancel</Button>
                <Button type="submit" size="sm">{addMoneyMode === 'transfer' ? 'Transfer' : 'Add Money'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add/Edit Goal Modal */}
      {editGoal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm overflow-y-auto flex items-start sm:items-center justify-center z-50 p-4" onClick={() => setEditGoal(null)}>
          <div className="bg-white dark:bg-[#2A2522] rounded-2xl max-w-md w-full p-6 shadow-2xl my-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">{editGoal._new ? 'New Goal' : 'Edit Goal'}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">{editGoal._new ? 'Set a savings target' : `Edit "${editGoal.name}"`}</p>
            <form onSubmit={(e) => {
              e.preventDefault();
              if (editGoal._new) {
                addGoal({ name: editGoalForm.name, target: Number(editGoalForm.target), saved: Number(editGoalForm.saved) || 0 });
              } else {
                updateGoal(editGoal.id, { name: editGoalForm.name, target: Number(editGoalForm.target), saved: Number(editGoalForm.saved) });
              }
              refreshGoals();
              setEditGoal(null);
              setToast(editGoal._new ? 'Goal created' : 'Goal updated');
              setTimeout(() => setToast(null), 3000);
            }} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1">Goal Name</label>
                <input required value={editGoalForm.name} onChange={e => setEditGoalForm({ ...editGoalForm, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-brand-muted dark:bg-brand-dark dark:text-slate-100 outline-none focus:ring-2 focus:ring-brand text-sm" placeholder="e.g. New Laptop" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1">Target (₹)</label>
                   <input required type="number" min="0" value={editGoalForm.target} onChange={e => setEditGoalForm({ ...editGoalForm, target: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-brand-muted dark:bg-brand-dark dark:text-slate-100 outline-none focus:ring-2 focus:ring-brand text-sm" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1">Saved (₹)</label>
                   <input type="number" min="0" value={editGoalForm.saved} onChange={e => setEditGoalForm({ ...editGoalForm, saved: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-brand-muted dark:bg-brand-dark dark:text-slate-100 outline-none focus:ring-2 focus:ring-brand text-sm" />
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <Button variant="ghost" size="sm" onClick={() => setEditGoal(null)}>Cancel</Button>
                <Button type="submit" size="sm">{editGoal._new ? 'Create Goal' : 'Save Changes'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
      </div>
    </DashboardLayout>
  );
}
