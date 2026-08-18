'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowUpCircle, ArrowDownCircle, PiggyBank, TrendingUp, Plus, Users, Search, Trash2, Undo2, Archive, SlidersHorizontal, CalendarDays, Pencil, TrendingDown, Bell, RotateCcw, CalendarArrowUp, Repeat, CheckCircle2, X, Wallet, Gauge, Lock, Cloud, RefreshCw, Calculator } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { formatCurrency, cn, useSortedCategories, getSortedCategories, todayStr } from '@/lib/utils';
import DashboardLayout from '@/components/DashboardLayout';
import NotificationPanel from '@/components/NotificationPanel';
import { Button } from '@/components/ui/button';
import { getTransactions, getMonthlySummary, getAggregates, getCarryForward, getReminders, getRecurring, addReminder, completeAndRescheduleReminder, deleteReminder, getGoals, getPartners, addTransaction, addGoal, updateGoal, deleteGoal, addPartner, isStoreReady, getTodos, completeTodo, advanceRecurring } from '@/lib/store';
import { useAuth } from '@/components/AuthProvider';
import { hasPins } from '@/lib/pinStore';
import Reveal from '@/components/Reveal';
import { checkConnection, getConfig, manualSync, connected as pouchConnected } from '@/lib/pouchdb';
import { pushAllToPouch, processRemoteChanges } from '@/lib/store';
import { useTranslation } from '@/lib/i18n';
import { logActivity } from '@/lib/activityLog';
import InvestmentCalculator from '@/components/InvestmentCalculator';
import { useToast } from '@/components/Toast';

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
  const showToast = useToast();
  const { profile } = useAuth();
  const { t } = useTranslation();
  const lockSession = () => window.dispatchEvent(new Event('request-lock-session'));
  const [isLoading, setIsLoading] = useState(true);
  const [period, setPeriod] = useState(() => (typeof window !== 'undefined' ? (localStorage.getItem('mm_dash_period') as any) || '1M' : '1M'));
  const [aggregates, setAggregates] = useState({ balance: 0, income: 0, expense: 0, investment: 0, cashBankBalance: 0 });
  const [carryFwd, setCarryFwd] = useState({ lastMonthCarry: 0, currentStart: 0, currentBalance: 0 });
  const [reminders, setReminders] = useState<any[]>([]);
  const [allReminders, setAllReminders] = useState<any[]>([]);
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [goals, setGoals] = useState<any[]>([]);
  const [partnerInvest, setPartnerInvest] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [showTaskForm, setShowTaskForm] = useState<any>(null);
  const [taskForm, setTaskForm] = useState({ type: 'expense', amount: '', account: 'cash' as 'cash' | 'bank' | 'upi', date: todayStr(), description: '' });
  const [showRecurringForm, setShowRecurringForm] = useState<any>(null);
  const [recurringForm, setRecurringForm] = useState({ type: 'expense', amount: '', account: 'cash' as 'cash' | 'bank' | 'upi', date: '', description: '', category: 'Other' });
  const [lastDeleted, setLastDeleted] = useState<any>(null);
  const [editGoal, setEditGoal] = useState<any | null>(null);
  const [editGoalForm, setEditGoalForm] = useState({ name: '', target: '', saved: '' });
  const [confirmDeleteGoal, setConfirmDeleteGoal] = useState<string | null>(null);
  const [showGoalTx, setShowGoalTx] = useState<{ goal: any; type: 'contribute' | 'withdraw' } | null>(null);
  const [goalTxForm, setGoalTxForm] = useState({ amount: '', account: 'cash' as 'cash' | 'bank' | 'upi' });
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
  const [showWelcome, setShowWelcome] = useState(() => {
    if (typeof window !== 'undefined') return !sessionStorage.getItem('mm_welcome_seen');
    return true;
  });
  const [welcomeFading, setWelcomeFading] = useState(false);

  // Inline add modals
  const [showAddTx, setShowAddTx] = useState<'income' | 'expense' | 'investment' | null>(null);
  const [txForm, setTxForm] = useState({ amount: '', category: '', date: todayStr(), description: '', account: 'cash' as 'cash' | 'bank' | 'upi' });
  const [txCatSearch, setTxCatSearch] = useState('');
  const [txShowCatDropdown, setTxShowCatDropdown] = useState(false);
  const [txCatHighlight, setTxCatHighlight] = useState(-1);
  const catRef = useRef<HTMLDivElement>(null);
  const [showAddParty, setShowAddParty] = useState(false);
  const [partyForm, setPartyForm] = useState({ name: '', group: 'contact' as 'customer' | 'vendor' | 'contact', type: 'individual', description: '' });
  const [showCalculator, setShowCalculator] = useState(false);
  const [todos, setTodos] = useState<any[]>([]);
  const [recurringList, setRecurringList] = useState<any[]>([]);
  const [confirmTx, setConfirmTx] = useState<any>(null);

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

  const getPeriodSince = (p: string) => {
    if (p === 'ALL') return undefined;
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    const map: Record<string, number> = { '1W': 7, '1M': 30, '3M': 90, '6M': 180, '1Y': 365 };
    d.setDate(d.getDate() - (map[p] || 30));
    return d;
  };

  const refreshDashboard = async () => {
    if (!isStoreReady()) return;
    setIsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 100));
    const since = getPeriodSince(periodRef.current);
    setAggregates(getAggregates(since));
    setCarryFwd(getCarryForward());
    loadReminders();
    setGoals(getGoals());
    setTodos(getTodos().filter((t: any) => t.status === 'pending' && !t.deletedAt));
    setRecurringList(getRecurring().filter((r: any) => r.status === 'active' && !r.deletedAt));
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
        investment: sm.investment,
      });
    }
    setMonthlyData(months);
    
    setTimeout(() => setIsLoading(false), 200);
  };

  const periodRef = useRef(period);
  periodRef.current = period;

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
    const since = getPeriodSince(period);
    setAggregates(getAggregates(since));
  }, [period]);

  useEffect(() => {
    if (!showWelcome) return;
    const fadeTimer = setTimeout(() => setWelcomeFading(true), 5000);
    const hideTimer = setTimeout(() => {
      setShowWelcome(false);
      sessionStorage.setItem('mm_welcome_seen', '1');
    }, 6000);
    return () => { clearTimeout(fadeTimer); clearTimeout(hideTimer); };
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
    const amount = rem.amount || 0;
    if (!(amount > 0)) return;
    addTransaction({
      amount,
      type: 'expense',
      category: rem.category || 'Other',
      description: `Paid: ${rem.title}`,
      date: todayStr(),
      partnerAccountId: undefined,
      isRecurring: false,
    });
    completeAndRescheduleReminder(rem.id);
    loadReminders();
    refreshDashboard();
    setToast(`"${rem.title}" added to expenses`);
    setTimeout(() => setToast(null), 3500);
  };

  const BASE_CATEGORIES: Record<string, string[]> = {
    income: ['Salary', 'Freelance', 'Business', 'Interest', 'Dividends', 'Rental', 'Other'],
    expense: ['Food', 'Transport', 'Shopping', 'Bills', 'Entertainment', 'Health', 'Education', 'Rent', 'Groceries', 'Dining', 'Other'],
    investment: ['Stocks', 'Mutual Funds', 'FD', 'PPF', 'NPS', 'Gold', 'Real Estate', 'Crypto', 'Other'],
  };

  const getRecentCategories = (type: string): string[] => {
    const all = getTransactions().filter(t => t.type === type && !t.deletedAt);
    const freq = new Map<string, number>();
    all.forEach(t => freq.set(t.category, (freq.get(t.category) || 0) + 1));
    const sorted = Array.from(freq.entries()).sort((a, b) => b[1] - a[1]).map(e => e[0]);
    const base = BASE_CATEGORIES[type] || BASE_CATEGORIES.expense;
    return [...new Set([...sorted, ...base])];
  };

  const getFilteredCategories = (type: string, search: string): string[] => {
    const recent = getRecentCategories(type);
    if (!search) return recent.slice(0, 3);
    const s = search.toLowerCase();
    const matched = recent.filter(c => c.toLowerCase().includes(s));
    const base = (BASE_CATEGORIES[type] || BASE_CATEGORIES.expense).filter(c => c.toLowerCase().includes(s) && !matched.includes(c));
    return [...matched, ...base].slice(0, 10);
  };

  const showConfirmTx = (data: any) => {
    setConfirmTx({
      type: data.type,
      amount: data.amount,
      category: data.category,
      date: data.date,
      account: data.account,
      description: data.description,
      partnerAccountId: data.partnerAccountId,
    });
  };

  const handleQuickAddTx = (e: React.FormEvent) => {
    e.preventDefault();
    if (!showAddTx) return;
    const amount = Number(txForm.amount);
    if (!amount || amount <= 0 || !txForm.category) return;
    if (txForm.date > todayStr()) { showToast('Cannot add entries with future dates.', 'warning'); return; }
    const account = showAddTx === 'investment' ? 'invest' : txForm.account;
    addTransaction({ amount, type: showAddTx, category: txForm.category, description: txForm.description, date: txForm.date, partnerAccountId: undefined, account, isRecurring: false });
    logActivity('entry_created', `${showAddTx} — ${txForm.category}`);
    showConfirmTx({ type: showAddTx, amount, category: txForm.category, date: txForm.date, account, description: txForm.description });
    setShowAddTx(null);
    setTxForm({ amount: '', category: '', date: todayStr(), description: '', account: 'cash' });
    setTxCatSearch('');
    refreshDashboard();
  };

  const handleQuickAddParty = (e: React.FormEvent) => {
    e.preventDefault();
    if (!partyForm.name.trim()) return;
    const existing = getPartners().find((p: any) => !p.deletedAt && p.name.toLowerCase() === partyForm.name.trim().toLowerCase());
    if (existing) {
      setShowAddParty(false);
      setPartyForm({ name: '', group: 'contact', type: 'individual', description: '' });
      setToast(`"${existing.name}" already exists`);
      setTimeout(() => setToast(null), 3000);
      return;
    }
    addPartner({ name: partyForm.name, type: partyForm.type, group: partyForm.group, description: partyForm.description, budgetWindowStart: '', budgetWindowEnd: '', initialInvestment: 0 });
    setShowAddParty(false);
    setPartyForm({ name: '', group: 'contact', type: 'individual', description: '' });
    refreshDashboard();
  };

  const handleTxCatKeyDown = (e: React.KeyboardEvent) => {
    if (!showAddTx) return;
    const cats = getFilteredCategories(showAddTx, txCatSearch);
    if (e.key === 'ArrowDown') { e.preventDefault(); setTxShowCatDropdown(true); setTxCatHighlight(i => Math.min(i + 1, cats.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setTxCatHighlight(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && txShowCatDropdown && txCatHighlight >= 0) { e.preventDefault(); setTxForm({ ...txForm, category: cats[txCatHighlight] }); setTxShowCatDropdown(false); setTxCatSearch(''); setTxCatHighlight(-1); }
    else if (e.key === 'Escape') { setTxShowCatDropdown(false); setTxCatHighlight(-1); }
  };

  const expenseLimit = Math.round(aggregates.income * expenseQuota / 100);
  const investLimit = Math.round(aggregates.income * investQuota / 100);
  const availableToSpend = aggregates.income - expenseLimit - investLimit;

  const CATEGORY_COLORS: Record<string, string> = {
    'Food': '#FF6384', 'Transport': '#36A2EB', 'Shopping': '#FFCE56',
    'Bills': '#4BC0C0', 'Entertainment': '#9966FF', 'Health': '#FF9F40',
    'Education': '#C9CBCF', 'Dining': '#FF6384', 'Groceries': '#36A2EB',
    'Rent': '#FFCE56', 'Salary': '#4BC0C0', 'Other': '#9966FF',
  };

  const pSince = getPeriodSince(period);
  const periodFiltered = (txs: any[]) => pSince ? txs.filter((t: any) => new Date(t.date) >= pSince) : txs;
  const recentTransactions = periodFiltered(getTransactions()).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5);
  const categoryTotals = periodFiltered(getTransactions())
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
    { key: 'available', title: t('dashboard.available'), amount: availableToSpend, icon: Wallet, color: availableToSpend >= 0 ? 'text-emerald-600' : 'text-red-600', bgColor: availableToSpend >= 0 ? 'bg-emerald-50' : 'bg-red-50' },
    { key: 'balance', title: t('dashboard.balance'), amount: aggregates.cashBankBalance, icon: PiggyBank, color: 'text-blue-600', bgColor: 'bg-blue-50' },
    { key: 'income', title: t('dashboard.totalIncome'), amount: aggregates.income, icon: ArrowUpCircle, color: 'text-green-600', bgColor: 'bg-green-50', addPath: '/dashboard/income' },
    { key: 'expenses', title: t('dashboard.totalExpenses'), amount: aggregates.expense, icon: ArrowDownCircle, color: 'text-red-600', bgColor: 'bg-red-50', addPath: '/dashboard/expenses' },
    { key: 'investments', title: t('dashboard.investments'), amount: aggregates.investment, icon: TrendingUp, color: 'text-brand', bgColor: 'bg-brand-secondary', addPath: '/dashboard/investments' },
    { key: 'partners', title: t('dashboard.partners'), amount: partnerInvest, icon: Users, color: 'text-purple-600', bgColor: 'bg-purple-50', addPath: '/dashboard/partners' },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="hidden md:inline-flex items-center text-sm font-semibold text-slate-700 dark:text-slate-200">
              <span className="font-bold uppercase tracking-wider text-brand">At a glance</span>
              <span className="mx-2 text-slate-300 dark:text-slate-600">|</span>
              <span>Your money, simplified.</span>
            </p>
            <div className="md:hidden">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                <span className="font-bold uppercase tracking-wider text-brand">At a glance</span>
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Your money, simplified.</p>
            </div>
          </div>
          <NotificationPanel />
        </div>

        {/* Period Filter Pills */}
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
          {['1W', '1M', '3M', '6M', '1Y', 'ALL'].map((p, i) => (
            <button key={p} onClick={() => { setPeriod(p); localStorage.setItem('mm_dash_period', p); }}
              style={{ animation: `slideUp 0.6s ease-out ${i * 0.1}s both` }}
              className={cn("px-3 py-1.5 text-xs font-medium rounded-full border transition-colors whitespace-nowrap",
                period === p
                  ? "bg-brand text-white border-brand"
                  : "bg-white dark:bg-[#2A2522] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-brand-muted hover:border-brand"
              )}
            >
              {p}
            </button>
          ))}
        </div>

        <Reveal>
        <div className={cn(
          "rounded-2xl border border-slate-200 dark:border-brand-muted shadow-sm overflow-hidden transition-all duration-700 ease-in-out",
          showWelcome ? (welcomeFading ? "opacity-0 max-h-0 border-0 mb-0" : "opacity-100 max-h-96 bg-white dark:bg-[#2A2522] p-5 mb-0") : "max-h-0 border-0 mb-0 p-0"
        )}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-brand">Welcome back</p>
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-1">{profile?.full_name || 'User'}, you're set to move fast today.</h2>
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
            const isExpense = card.key === 'expenses';
            const isInvest = card.key === 'investments';
            const isTotalBalance = card.key === 'balance';
            const quota = isExpense ? expenseQuota : isInvest ? investQuota : null;
            const limit = quota != null ? Math.round(aggregates.income * quota / 100) : 0;
            const spent = isExpense ? aggregates.expense : isInvest ? aggregates.investment : 0;
            const pct = limit > 0 ? Math.min(Math.round((spent / limit) * 100), 100) : 0;
            const overLimit = limit > 0 && pct >= 100;
            const nearLimit = limit > 0 && pct >= 80 && pct < 100;
            
            const periodTxs = periodFiltered(getTransactions());
            const cashBalance = periodTxs.reduce((sum, t: any) => {
              if (t.account === 'cash') return sum + (t.type === 'income' ? t.amount : -t.amount);
              return sum;
            }, 0);
            const bankBalance = periodTxs.reduce((sum, t: any) => {
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
                <div className="flex items-center gap-1">
                  {overLimit && <span className="text-xs font-bold text-red-500">OVER</span>}
                  {nearLimit && <span className="text-xs font-bold text-amber-500">NEAR</span>}
                  {(card as any).addPath && (
                    <button onClick={(e) => {
                      e.stopPropagation();
                      const path = (card as any).addPath as string;
                      if (path === '/dashboard/partners') setShowAddParty(true);
                      else if (path === '/dashboard/income') setShowAddTx('income');
                      else if (path === '/dashboard/expenses') setShowAddTx('expense');
                      else if (path === '/dashboard/investments') setShowAddTx('investment');
                    }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-brand hover:bg-brand-secondary dark:hover:bg-brand-muted/30 transition-colors" title={`Add ${card.title}`}>
                      <Plus className="h-4 w-4" />
                    </button>
                  )}
                </div>
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
              
              {card.key === 'partners' && (
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{partnersList.length} partner{partnersList.length !== 1 ? 's' : ''}</p>
              )}
            </div>
          )})}
        </div>
        </Reveal>

        {/* Cloud Sync Status — only when configured AND connected */}
        {getConfig().url && syncConnected && (
        <Reveal delay={150}>
        <div className="bg-white dark:bg-[#2A2522] rounded-2xl border border-slate-200 dark:border-brand-muted shadow-sm p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-green-50 dark:bg-green-900/20">
                <Cloud className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Cloud Sync</p>
                  <div className={cn("w-1.5 h-1.5 rounded-full", syncing ? "bg-amber-500 animate-pulse" : "bg-green-500")} />
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {syncing ? 'Syncing...' : 'Connected — real-time sync active'}
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" className="text-xs gap-1.5 border-sky-200 text-sky-700 dark:border-sky-800 dark:text-sky-400" onClick={async () => {
              if (syncing) return;
              setSyncing(true);
              try {
                const cfg = getConfig();
                if (cfg.url) {
                  await pushAllToPouch();
                  const { ok } = await manualSync();
                  setSyncConnected(ok);
                  if (ok) await processRemoteChanges();
                  refreshDashboard();
                }
              } catch (e: any) {
                showToast(e?.message || 'Sync failed', 'error');
              } finally {
                setSyncing(false);
              }
            }} disabled={syncing}>
              <RefreshCw className={cn("h-3.5 w-3.5", syncing && "animate-spin")} /> {syncing ? 'Syncing' : 'Sync Now'}
            </Button>
          </div>
        </div>
        </Reveal>
        )}

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

        {/* Cash Flow */}
        {!isLoading && (
        <Reveal delay={300}>
        <div className="bg-white dark:bg-[#2A2522] p-6 rounded-2xl border border-slate-200 dark:border-brand-muted shadow-sm transition-all duration-500">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-6">Cash Flow Analysis</h2>
          {monthlyData.length > 0 ? (
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
          ) : (
            <div className="text-center py-16">
              <TrendingUp className="h-10 w-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">No transaction data yet</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Add income or expenses to see the chart.</p>
            </div>
          )}
        </div>
        </Reveal>
        )}

        {/* Spending + Recent */}
        {!isLoading && (
        <Reveal delay={400}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 transition-all duration-500 ease-in-out">
          <div className="bg-white dark:bg-[#2A2522] p-6 rounded-2xl border border-slate-200 dark:border-brand-muted shadow-sm transition-all duration-500">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4">Spending Breakdown</h2>
            {pieData.length > 0 ? (
            <>
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
            </>
            ) : (
              <div className="text-center py-8">
                <ArrowDownCircle className="h-8 w-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">No expenses yet</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Add expenses to see the breakdown.</p>
              </div>
            )}
          </div>

          <div className={cn("bg-white dark:bg-[#2A2522] p-6 rounded-2xl border border-slate-200 dark:border-brand-muted shadow-sm lg:col-span-2")}>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4">Recent Transactions</h2>
            {recentTransactions.length > 0 ? (
            <div className="space-y-2">
              {recentTransactions.map((t: any) => (
                <div key={t.id} className="flex items-center p-3 gap-3 rounded-xl hover:bg-slate-50 dark:hover:bg-brand-muted/30 transition-colors">
                  <div className={cn("p-1.5 rounded-full shrink-0", t.type === 'income' ? 'bg-green-50 dark:bg-green-900/30' : t.type === 'investment' ? 'bg-violet-50 dark:bg-violet-900/30' : 'bg-red-50 dark:bg-red-900/30')}>
                    {t.type === 'income' ? <ArrowUpCircle className="h-4 w-4 text-green-500" /> : t.type === 'investment' ? <TrendingUp className="h-4 w-4 text-violet-500" /> : <ArrowDownCircle className="h-4 w-4 text-red-500" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{(() => { const d = t.description || t.category; return d.length > 21 ? d.slice(0, 21) + '...' : d; })()}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">{t.date} {t.category !== 'Other' && `· ${t.category}`}</p>
                  </div>
                  <p className={cn("text-sm font-bold shrink-0 whitespace-nowrap ml-auto", t.type === 'income' ? 'text-green-600' : t.type === 'investment' ? 'text-violet-600' : 'text-red-600')}>
                    {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                  </p>
                </div>
              ))}
            </div>
            ) : (
              <div className="text-center py-8">
                <Repeat className="h-8 w-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">No transactions yet</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Your recent activity will appear here.</p>
              </div>
            )}
          </div>
        </div>
        </Reveal>
        )}

        {/* Tasks + Recurring */}
        {!isLoading && (
        <Reveal delay={500}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-white dark:bg-[#2A2522] p-6 rounded-2xl border border-slate-200 dark:border-brand-muted shadow-sm transition-all duration-500">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-6">Tasks</h2>
            {todos.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {todos.slice(0, 5).map((t: any) => (
                <div key={t.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 dark:border-brand-muted hover:bg-slate-50 dark:hover:bg-brand-muted/30 transition-colors">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={cn("w-2 h-2 rounded-full shrink-0", t.priority === 'high' ? 'bg-red-500' : t.priority === 'medium' ? 'bg-amber-500' : 'bg-slate-300')} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{t.title}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{t.dueDate} {t.category && `· ${t.category}`}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {t.important && <span className="text-[10px] font-bold text-amber-500">★</span>}
                    {t.amount ? <span className="text-sm font-bold text-slate-700 dark:text-slate-300 mr-1">{formatCurrency(t.amount)}</span> : null}
                    <button onClick={() => { setTaskForm({ type: 'expense', amount: String(t.amount || ''), account: 'cash', date: todayStr(), description: t.title }); setShowTaskForm(t); }} className="p-1.5 rounded-full text-green-500 hover:bg-green-50 dark:hover:bg-green-900/30 transition-colors" title="Mark complete">
                      <CheckCircle2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            ) : (
              <div className="text-center py-8">
                <CheckCircle2 className="h-8 w-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">No tasks yet</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Add tasks from the Savings page.</p>
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-[#2A2522] p-6 rounded-2xl border border-slate-200 dark:border-brand-muted shadow-sm transition-all duration-500">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Recurring</h2>
              <button onClick={() => router.push('/dashboard/recurring')} className="text-xs text-brand hover:underline font-medium">
                View All
              </button>
            </div>
            {recurringList.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {recurringList.slice(0, 5).map((r: any) => (
                <div key={r.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 dark:border-brand-muted hover:bg-slate-50 dark:hover:bg-brand-muted/30 transition-colors">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={cn("p-1.5 rounded-full shrink-0", r.txType === 'income' ? 'bg-green-50 dark:bg-green-900/30' : 'bg-red-50 dark:bg-red-900/30')}>
                      {r.txType === 'income' ? <ArrowUpCircle className="h-4 w-4 text-green-500" /> : <ArrowDownCircle className="h-4 w-4 text-red-500" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{r.title}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Next: {r.nextDate} · {r.frequency}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <p className={cn("text-sm font-bold", r.txType === 'income' ? 'text-green-600' : 'text-red-600')}>{formatCurrency(r.amount)}</p>
                    <button onClick={() => { setRecurringForm({ type: r.txType, amount: String(r.amount), account: 'cash', date: r.nextDate, description: r.title, category: r.category }); setShowRecurringForm(r); }} className="p-1.5 rounded-full text-brand hover:bg-brand-secondary dark:hover:bg-brand-muted/30 transition-colors" title="Advance (create transaction)">
                      <RotateCcw className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            ) : (
              <div className="text-center py-8">
                <Repeat className="h-8 w-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">No recurring transactions yet</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Set up recurring income or expenses.</p>
              </div>
            )}
          </div>
        </div>
        </Reveal>
        )}

        {/* Goals */}
        {!isLoading && (
        <Reveal delay={600}>
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
          {goals.length > 0 ? (
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
                      <button onClick={() => { setShowGoalTx({ goal: g, type: 'contribute' }); setGoalTxForm({ amount: '', account: 'cash' }); }} className="flex-1 text-xs py-1.5 rounded-lg bg-brand text-white hover:bg-brand-dark transition-colors font-medium">
                        + Contribute
                      </button>
                      <button onClick={() => { setShowGoalTx({ goal: g, type: 'withdraw' }); setGoalTxForm({ amount: '', account: 'cash' }); }} className="flex-1 text-xs py-1.5 rounded-lg border border-slate-200 dark:border-brand-muted hover:bg-slate-100 dark:hover:bg-brand-muted/50 transition-colors font-medium text-slate-600 dark:text-slate-400">
                        - Withdraw
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <PiggyBank className="h-8 w-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">No goals yet</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Click + to create a savings goal.</p>
            </div>
          )}
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm overflow-y-auto flex items-start sm:items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#2A2522] rounded-2xl max-w-md w-full p-6 shadow-2xl my-4">
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
              const today = todayStr();

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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm overflow-y-auto flex items-start sm:items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#2A2522] rounded-2xl max-w-md w-full p-6 shadow-2xl my-4">
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

      {/* Goal Transaction Modal */}
      {showGoalTx && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-start sm:items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white dark:bg-[#2A2522] rounded-2xl max-w-md w-full p-6 shadow-2xl my-4">
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-1">
              {showGoalTx.type === 'contribute' ? 'Contribute' : 'Withdraw'}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">
              {showGoalTx.type === 'contribute' ? `Add money to "${showGoalTx.goal.name}"` : `Take money from "${showGoalTx.goal.name}"`}
              {showGoalTx.type === 'withdraw' && <span className="block text-xs mt-1 text-amber-600">Saved: ₹{Number(showGoalTx.goal.saved).toLocaleString()}</span>}
            </p>
            <form onSubmit={(e) => {
              e.preventDefault();
              const g = showGoalTx.goal;
              const amt = Number(goalTxForm.amount);
              if (!amt || amt <= 0) return;
              if (showGoalTx.type === 'withdraw' && amt > g.saved) { setToast(`Amount exceeds saved balance`); setTimeout(() => setToast(null), 3000); return; }
              const isContribute = showGoalTx.type === 'contribute';
              addTransaction({ amount: amt, type: isContribute ? 'expense' : 'income', category: isContribute ? g.name : 'Savings Withdrawal', description: isContribute ? `Contribute to ${g.name}` : `Withdraw from ${g.name}`, date: todayStr(), partnerAccountId: undefined, account: goalTxForm.account, isRecurring: false });
              updateGoal(g.id, { saved: g.saved + (isContribute ? amt : -amt) });
              refreshGoals();
              setAggregates(getAggregates(getPeriodSince(periodRef.current)));
              setShowGoalTx(null);
              setToast(`₹${amt.toLocaleString()} ${isContribute ? 'contributed to' : 'withdrawn from'} "${g.name}"`);
              setTimeout(() => setToast(null), 3000);
            }} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1">Amount (₹)</label>
                <input required type="number" min="0" step="0.01" value={goalTxForm.amount} onChange={e => setGoalTxForm({ ...goalTxForm, amount: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-brand-muted dark:bg-brand-dark dark:text-slate-100 outline-none focus:ring-2 focus:ring-brand text-sm" placeholder="0" autoFocus />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1">Account</label>
                <select value={goalTxForm.account} onChange={e => setGoalTxForm({ ...goalTxForm, account: e.target.value as 'cash' | 'bank' | 'upi' })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-brand-muted dark:bg-brand-dark dark:text-slate-100 outline-none focus:ring-2 focus:ring-brand text-sm">
                  <option value="cash">Cash</option>
                  <option value="bank">Bank</option>
                  <option value="upi">UPI</option>
                </select>
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <Button variant="ghost" size="sm" onClick={() => setShowGoalTx(null)} type="button">Cancel</Button>
                <Button type="submit" size="sm">{showGoalTx.type === 'contribute' ? 'Contribute' : 'Withdraw'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Task Transaction Modal */}
      {showTaskForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-start sm:items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#2A2522] rounded-2xl max-w-md w-full p-6 shadow-2xl my-4">
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">Complete Task</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">Record transaction for "{showTaskForm.title}"</p>
            <form onSubmit={(e) => {
              e.preventDefault();
              const amount = Number(taskForm.amount);
              if (!amount) return;
              const account = taskForm.account;
              addTransaction({ amount, type: taskForm.type as 'income' | 'expense', category: showTaskForm.category || 'Other', description: taskForm.description, date: taskForm.date, partnerAccountId: undefined, account, isRecurring: false });
              completeTodo(showTaskForm.id);
              showConfirmTx({ type: taskForm.type, amount, category: showTaskForm.category || 'Other', date: taskForm.date, account, description: taskForm.description });
              refreshDashboard();
              setShowTaskForm(null);
              setToast(`"${showTaskForm.title}" completed`);
              setTimeout(() => setToast(null), 3000);
            }} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1">Type</label>
                  <select value={taskForm.type} onChange={e => setTaskForm({ ...taskForm, type: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-brand-muted dark:bg-brand-dark dark:text-slate-100 outline-none focus:ring-2 focus:ring-brand text-sm">
                    <option value="expense">Expense</option>
                    <option value="income">Income</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1">Amount (₹)</label>
                  <input required type="number" min="0" step="0.01" value={taskForm.amount} onChange={e => setTaskForm({ ...taskForm, amount: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-brand-muted dark:bg-brand-dark dark:text-slate-100 outline-none focus:ring-2 focus:ring-brand text-sm" autoFocus />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1">Account</label>
                <select value={taskForm.account} onChange={e => setTaskForm({ ...taskForm, account: e.target.value as 'cash' | 'bank' | 'upi' })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-brand-muted dark:bg-brand-dark dark:text-slate-100 outline-none focus:ring-2 focus:ring-brand text-sm">
                  <option value="cash">Cash</option>
                  <option value="bank">Bank</option>
                  <option value="upi">UPI</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1">Date</label>
                <input required type="date" value={taskForm.date} onChange={e => setTaskForm({ ...taskForm, date: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-brand-muted dark:bg-brand-dark dark:text-slate-100 outline-none focus:ring-2 focus:ring-brand text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1">Description</label>
                <input value={taskForm.description} onChange={e => setTaskForm({ ...taskForm, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-brand-muted dark:bg-brand-dark dark:text-slate-100 outline-none focus:ring-2 focus:ring-brand text-sm" placeholder="What was this for?" />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <Button variant="ghost" size="sm" onClick={() => setShowTaskForm(null)} type="button">Cancel</Button>
                <Button type="submit" size="sm">Save & Complete</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Recurring Transaction Modal */}
      {showRecurringForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-start sm:items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#2A2522] rounded-2xl max-w-md w-full p-6 shadow-2xl my-4">
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">Advance Recurring</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">Record transaction for "{showRecurringForm.title}"</p>
            <form onSubmit={(e) => {
              e.preventDefault();
              const amount = Number(recurringForm.amount);
              if (!amount) return;
              const tx = advanceRecurring(showRecurringForm.id, { amount, date: recurringForm.date, account: recurringForm.account, description: recurringForm.description });
              if (tx) showConfirmTx({ type: tx.type, amount, category: recurringForm.category, date: recurringForm.date, account: recurringForm.account, description: recurringForm.description });
              refreshDashboard();
              setShowRecurringForm(null);
              setToast(`"${showRecurringForm.title}" advanced`);
              setTimeout(() => setToast(null), 3000);
            }} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1">Type</label>
                  <select value={recurringForm.type} onChange={e => setRecurringForm({ ...recurringForm, type: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-brand-muted dark:bg-brand-dark dark:text-slate-100 outline-none focus:ring-2 focus:ring-brand text-sm">
                    <option value="expense">Expense</option>
                    <option value="income">Income</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1">Amount (₹)</label>
                  <input required type="number" min="0" step="0.01" value={recurringForm.amount} onChange={e => setRecurringForm({ ...recurringForm, amount: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-brand-muted dark:bg-brand-dark dark:text-slate-100 outline-none focus:ring-2 focus:ring-brand text-sm" autoFocus />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1">Account</label>
                <select value={recurringForm.account} onChange={e => setRecurringForm({ ...recurringForm, account: e.target.value as 'cash' | 'bank' | 'upi' })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-brand-muted dark:bg-brand-dark dark:text-slate-100 outline-none focus:ring-2 focus:ring-brand text-sm">
                  <option value="cash">Cash</option>
                  <option value="bank">Bank</option>
                  <option value="upi">UPI</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1">Date</label>
                <input required type="date" value={recurringForm.date} onChange={e => setRecurringForm({ ...recurringForm, date: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-brand-muted dark:bg-brand-dark dark:text-slate-100 outline-none focus:ring-2 focus:ring-brand text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1">Description</label>
                <input value={recurringForm.description} onChange={e => setRecurringForm({ ...recurringForm, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-brand-muted dark:bg-brand-dark dark:text-slate-100 outline-none focus:ring-2 focus:ring-brand text-sm" />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <Button variant="ghost" size="sm" onClick={() => setShowRecurringForm(null)} type="button">Cancel</Button>
                <Button type="submit" size="sm">Save & Advance</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Add Transaction Modal */}
      {showAddTx && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-start sm:items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white dark:bg-[#2A2522] rounded-2xl max-w-md w-full p-6 shadow-2xl my-4">
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-1">Add {showAddTx === 'income' ? 'Income' : showAddTx === 'expense' ? 'Expense' : 'Investment'}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">Quick entry from dashboard — recent categories shown first</p>
            <form onSubmit={handleQuickAddTx} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1">Amount (₹)</label>
                <input required type="number" min="0" step="0.01" value={txForm.amount} onChange={e => setTxForm({ ...txForm, amount: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-brand-muted dark:bg-brand-dark dark:text-slate-100 outline-none focus:ring-2 focus:ring-brand text-sm" placeholder="0" autoFocus />
              </div>
              <div className="relative" ref={catRef}>
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1">Category</label>
                <input required value={txForm.category}
                  onChange={e => { setTxForm({ ...txForm, category: e.target.value }); setTxCatSearch(e.target.value); setTxShowCatDropdown(true); setTxCatHighlight(-1); }}
                  onFocus={() => setTxShowCatDropdown(true)}
                  onKeyDown={handleTxCatKeyDown}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-brand-muted dark:bg-brand-dark dark:text-slate-100 outline-none focus:ring-2 focus:ring-brand text-sm" placeholder="Search or type" />
                {txShowCatDropdown && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white dark:bg-[#2A2522] border border-slate-200 dark:border-brand-muted rounded-lg shadow-lg max-h-40 overflow-y-auto">
                    {getFilteredCategories(showAddTx, txCatSearch).map((c, i) => (
                      <button key={c} type="button"
                        onClick={() => { setTxForm({ ...txForm, category: c }); setTxShowCatDropdown(false); setTxCatSearch(''); setTxCatHighlight(-1); }}
                        onMouseEnter={() => setTxCatHighlight(i)}
                        className={cn("w-full px-4 py-2 text-left text-sm transition-colors", txCatHighlight === i ? "bg-brand-secondary dark:bg-brand-muted/30" : "hover:bg-brand-secondary dark:hover:bg-brand-muted/30", txForm.category === c && "font-medium")}>
                        {c}
                      </button>
                    ))}
                    {txCatSearch && !getFilteredCategories(showAddTx, txCatSearch).includes(txCatSearch) && (
                      <button type="button"
                        onClick={() => { setTxForm({ ...txForm, category: txCatSearch }); setTxShowCatDropdown(false); setTxCatSearch(''); setTxCatHighlight(-1); }}
                        className="w-full px-4 py-2 text-left text-sm text-brand font-medium hover:bg-brand-secondary dark:hover:bg-brand-muted/30">
                        + Create "{txCatSearch}"
                      </button>
                    )}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1">Date</label>
                  <input required type="date" max={todayStr()} value={txForm.date} onChange={e => setTxForm({ ...txForm, date: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-brand-muted dark:bg-brand-dark dark:text-slate-100 outline-none focus:ring-2 focus:ring-brand text-sm" />
                </div>
                {showAddTx !== 'investment' && (
                  <div>
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1">Account</label>
                    <select value={txForm.account} onChange={e => setTxForm({ ...txForm, account: e.target.value as 'cash' | 'bank' | 'upi' })}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-brand-muted dark:bg-brand-dark dark:text-slate-100 outline-none focus:ring-2 focus:ring-brand text-sm">
                      <option value="cash">Cash</option>
                      <option value="bank">Bank</option>
                      <option value="upi">UPI</option>
                    </select>
                  </div>
                )}
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1">Description</label>
                <input value={txForm.description} onChange={e => setTxForm({ ...txForm, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-brand-muted dark:bg-brand-dark dark:text-slate-100 outline-none focus:ring-2 focus:ring-brand text-sm" placeholder="Add a note..." />
              </div>
              {showAddTx === 'investment' && (
                <button type="button" onClick={() => setShowCalculator(true)}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-dashed border-sky-300 dark:border-sky-700 text-xs text-sky-600 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-900/20 transition-colors">
                  <Calculator className="h-3.5 w-3.5" /> Calculate Returns First
                </button>
              )}
              <div className="flex items-center justify-end gap-2 pt-2">
                <Button variant="ghost" size="sm" onClick={() => setShowAddTx(null)} type="button">Cancel</Button>
                <Button type="submit" size="sm">Save</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCalculator && (
        <InvestmentCalculator onClose={() => setShowCalculator(false)} onApply={(amount) => { setTxForm({ ...txForm, amount: String(amount) }); setShowCalculator(false); }} />
      )}

      {/* Quick Add Party Modal */}
      {showAddParty && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-start sm:items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#2A2522] rounded-2xl max-w-md w-full p-6 shadow-2xl my-4">
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-1">New Party</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">Add a person or business</p>
            <form onSubmit={handleQuickAddParty} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1">Name</label>
                <input required value={partyForm.name} onChange={e => setPartyForm({ ...partyForm, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-brand-muted dark:bg-brand-dark dark:text-slate-100 outline-none focus:ring-2 focus:ring-brand text-sm" placeholder="Party name" autoFocus />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1">Group</label>
                  <select value={partyForm.group} onChange={e => setPartyForm({ ...partyForm, group: e.target.value as 'customer' | 'vendor' | 'contact' })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-brand-muted dark:bg-brand-dark dark:text-slate-100 outline-none focus:ring-2 focus:ring-brand text-sm">
                    <option value="contact">Contact</option>
                    <option value="customer">Customer</option>
                    <option value="vendor">Vendor</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1">Type</label>
                  <select value={partyForm.type} onChange={e => setPartyForm({ ...partyForm, type: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-brand-muted dark:bg-brand-dark dark:text-slate-100 outline-none focus:ring-2 focus:ring-brand text-sm">
                    <option value="individual">Individual</option>
                    <option value="friend">Friend / Family</option>
                    <option value="client">Client</option>
                    <option value="supplier">Supplier</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1">Description</label>
                <input value={partyForm.description} onChange={e => setPartyForm({ ...partyForm, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-brand-muted dark:bg-brand-dark dark:text-slate-100 outline-none focus:ring-2 focus:ring-brand text-sm" placeholder="Notes..." />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <Button variant="ghost" size="sm" onClick={() => setShowAddParty(false)} type="button">Cancel</Button>
                <Button type="submit" size="sm">Create Party</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Save Confirmation Modal */}
      {confirmTx && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#2A2522] rounded-2xl max-w-sm w-full p-6 shadow-2xl mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Entry Saved</h3>
              <button onClick={() => setConfirmTx(null)} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-brand-muted/50">
                <span className="text-sm text-slate-500 dark:text-slate-400">Type</span>
                <span className={cn("text-sm font-semibold capitalize", confirmTx.type === 'income' ? 'text-green-600' : confirmTx.type === 'expense' ? 'text-red-600' : 'text-brand')}>{confirmTx.type}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-brand-muted/50">
                <span className="text-sm text-slate-500 dark:text-slate-400">Amount</span>
                <span className="text-sm font-bold text-slate-900 dark:text-slate-100">₹{Number(confirmTx.amount).toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-brand-muted/50">
                <span className="text-sm text-slate-500 dark:text-slate-400">Category</span>
                <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{confirmTx.category}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-brand-muted/50">
                <span className="text-sm text-slate-500 dark:text-slate-400">Account</span>
                <span className="text-sm font-medium capitalize text-slate-900 dark:text-slate-100">{confirmTx.account}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-brand-muted/50">
                <span className="text-sm text-slate-500 dark:text-slate-400">Date</span>
                <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{new Date(confirmTx.date).toLocaleDateString()}</span>
              </div>
              {confirmTx.description && (
                <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-brand-muted/50">
                  <span className="text-sm text-slate-500 dark:text-slate-400">Note</span>
                  <span className="text-sm font-medium text-slate-900 dark:text-slate-100 text-right max-w-[50%] truncate">{confirmTx.description}</span>
                </div>
              )}
              {confirmTx.partnerAccountId && (
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-slate-500 dark:text-slate-400">Double Entry</span>
                  <span className="text-xs font-medium text-purple-600 dark:text-purple-400">Reflected in partner account</span>
                </div>
              )}
              {!confirmTx.partnerAccountId && confirmTx.type !== 'investment' && (
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-slate-500 dark:text-slate-400">Double Entry</span>
                  <span className="text-xs text-slate-400">Single entry only</span>
                </div>
              )}
            </div>
            <Button className="w-full mt-5" onClick={() => setConfirmTx(null)}>Done</Button>
          </div>
        </div>
      )}
      </div>
    </DashboardLayout>
  );
}
