'use client';

import React, { useState, useEffect, useMemo } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Plus, Search, Trash2, Undo2, AlertTriangle, ArrowUpDown, X, Archive, SlidersHorizontal, CalendarDays, Pencil } from 'lucide-react';
import { formatCurrency, cn, getSortedCategories, useSortedCategories } from '@/lib/utils';
import { TransactionType, Transaction } from '@/types';
import { getTransactions, addTransaction, updateTransaction, deleteTransaction, restoreTransaction, permanentDeleteTransaction, getArchivedTransactions, getPartners, checkDuplicateTransaction, addAdjustment, isStoreReady } from '@/lib/store';
import PinPrompt from '@/components/PinPrompt';
import PinSetupGuide from '@/components/PinSetupGuide';
import { hasPins } from '@/lib/pinStore';
import { getSession } from '@/lib/localAuth';
import { logActivity } from '@/lib/activityLog';
import Reveal from '@/components/Reveal';

interface TransactionPageProps {
  type: TransactionType;
  title: string;
  description: string;
}

export default function TransactionPage({ type, title, description }: TransactionPageProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [pinArchiveAction, setPinArchiveAction] = useState<{ id: string; action: 'restore' | 'delete' } | null>(null);
  const [pinEditAction, setPinEditAction] = useState<Transaction | null>(null);
  const [pinDeleteId, setPinDeleteId] = useState<string | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [showPinSetup, setShowPinSetup] = useState<string | null>(null);
  const [dupWarning, setDupWarning] = useState<any | null>(null);
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filterCategory, setFilterCategory] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterMinAmount, setFilterMinAmount] = useState('');
  const [filterMaxAmount, setFilterMaxAmount] = useState('');
  const [sortField, setSortField] = useState<'date' | 'amount'>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [groupBy, setGroupBy] = useState<'day' | 'week' | 'month'>('day');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [archived, setArchived] = useState<Transaction[]>([]);
  const [partners, setPartners] = useState<any[]>([]);

  const refresh = () => {
    if (!isStoreReady()) return;
    setTransactions(getTransactions(type));
    setArchived(getArchivedTransactions().filter(t => t.type === type));
    setPartners(getPartners());
  };

  useEffect(() => {
    refresh();
    const onReady = () => refresh();
    window.addEventListener('store-ready', onReady);
    return () => window.removeEventListener('store-ready', onReady);
  }, [type]);

  const [form, setForm] = useState({ amount: '', category: '', description: '', date: new Date().toISOString().split('T')[0], partnerAccountId: '', investSource: 'bank', account: 'cash' as 'cash' | 'bank' | 'upi' });

  const openEdit = (tx: Transaction) => {
    setEditingTransaction(tx);
    setEditForm({ amount: String(tx.amount), category: tx.category, description: tx.description, date: tx.date, partnerAccountId: tx.partnerAccountId || '' });
  };

  const [editForm, setEditForm] = useState({ amount: '', category: '', description: '', date: '', partnerAccountId: '' });
  const [editCategorySearch, setEditCategorySearch] = useState('');
  const [showEditCategoryDropdown, setShowEditCategoryDropdown] = useState(false);

  const handleEdit = () => {
    if (!editingTransaction) return;
    const today = new Date().toISOString().split('T')[0];
    const createdToday = editingTransaction.createdAt?.split('T')[0] === today;
    if (createdToday) {
      doEdit(editingTransaction.id);
    } else if (hasPins()) {
      setPinEditAction(editingTransaction);
    } else {
      setShowPinSetup('edit this entry');
      setEditingTransaction(null);
    }
  };

  const doEdit = (id: string) => {
    updateTransaction(id, { amount: Number(editForm.amount), category: editForm.category, description: editForm.description, date: editForm.date, partnerAccountId: editForm.partnerAccountId || undefined });
    logActivity('entry_edited', `${type} — ${editForm.category}`);
    setEditingTransaction(null);
    refresh();
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(form.amount);
    const tx = { amount, type, category: form.category, description: form.description, date: form.date, partnerAccountId: form.partnerAccountId || undefined };
    const dup = checkDuplicateTransaction(tx);
    if (dup) {
      setDupWarning({ ...tx, existing: dup, investSource: form.investSource });
      return;
    }
    const account = (type === 'income' || type === 'expense') ? form.account : undefined;
    addTransaction({ ...tx, account, isRecurring: false });
    logActivity('entry_created', `${type} — ${form.category}`);

    if (type === 'investment' && form.investSource !== 'cash') {
      if (form.investSource === 'savings') {
        addTransaction({ amount, type: 'expense', category: 'Savings Withdrawal', description: `Fund source for ${form.description || form.category}`, date: form.date, partnerAccountId: undefined, isRecurring: false });
      } else if (form.investSource === 'adjustment') {
        addAdjustment({ amount: -amount, accountType: 'personal', notes: `Fund source for ${form.description || form.category}`, date: form.date });
      } else if (form.investSource.startsWith('partner_')) {
        const pid = form.investSource.replace('partner_', '');
        addTransaction({ amount, type: 'expense', category: 'Partner Investment', description: `Fund source for ${form.description || form.category}`, date: form.date, partnerAccountId: pid, isRecurring: false });
      }
    }

    setShowAddModal(false);
    setForm({ amount: '', category: '', description: '', date: new Date().toISOString().split('T')[0], partnerAccountId: '', investSource: 'cash', account: 'cash' });
    refresh();
  };

  const handleDupConfirm = () => {
    if (!dupWarning) return;
    const amount = dupWarning.amount;
    addTransaction({ amount, type: dupWarning.type, category: dupWarning.category, description: dupWarning.description, date: dupWarning.date, partnerAccountId: dupWarning.partnerAccountId, isRecurring: false });

    if (type === 'investment' && dupWarning.investSource && dupWarning.investSource !== 'cash') {
      if (dupWarning.investSource === 'savings') {
        addTransaction({ amount, type: 'expense', category: 'Savings Withdrawal', description: `Fund source for ${dupWarning.description || dupWarning.category}`, date: dupWarning.date, partnerAccountId: undefined, isRecurring: false });
      } else if (dupWarning.investSource === 'adjustment') {
        addAdjustment({ amount: -amount, accountType: 'personal', notes: `Fund source for ${dupWarning.description || dupWarning.category}`, date: dupWarning.date });
      } else if (dupWarning.investSource.startsWith('partner_')) {
        const pid = dupWarning.investSource.replace('partner_', '');
        addTransaction({ amount, type: 'expense', category: 'Partner Investment', description: `Fund source for ${dupWarning.description || dupWarning.category}`, date: dupWarning.date, partnerAccountId: pid, isRecurring: false });
      }
    }

    setDupWarning(null);
    setShowAddModal(false);
    setForm({ amount: '', category: '', description: '', date: new Date().toISOString().split('T')[0], partnerAccountId: '', investSource: 'cash', account: 'cash' });
    refresh();
  };

  const handleDelete = (id: string) => {
    const tx = transactions.find(t => t.id === id);
    const today = new Date().toISOString().split('T')[0];
    const createdToday = tx && tx.createdAt?.split('T')[0] === today;
    if (createdToday) {
      doDelete(id);
    } else if (hasPins()) {
      setPinDeleteId(id);
    } else {
      setShowPinSetup('delete a transaction');
    }
  };

  const doDelete = (id: string) => {
    const tx = transactions.find(t => t.id === id);
    deleteTransaction(id);
    logActivity('entry_deleted', `${type} — ${tx?.category || 'Unknown'}`);
    setConfirmDelete(null);
    refresh();
  };

  const handleRestore = (id: string) => {
    const tx = archived.find(t => t.id === id);
    restoreTransaction(id);
    logActivity('entry_restored', `${type} — ${tx?.category || 'Unknown'}`);
    refresh();
  };

  const handlePermanentDelete = (id: string) => {
    const tx = archived.find(t => t.id === id);
    permanentDeleteTransaction(id);
    logActivity('entry_deleted', `${type} — ${tx?.category || 'Unknown'}`);
    refresh();
  };

  const filtered = useMemo(() => {
    return transactions
      .filter(t =>
        (!search || t.description.toLowerCase().includes(search.toLowerCase()) || t.category.toLowerCase().includes(search.toLowerCase())) &&
        (!filterCategory || t.category === filterCategory) &&
        (!filterDateFrom || t.date >= filterDateFrom) &&
        (!filterDateTo || t.date <= filterDateTo) &&
        (!filterMinAmount || t.amount >= Number(filterMinAmount)) &&
        (!filterMaxAmount || t.amount <= Number(filterMaxAmount))
      )
      .sort((a, b) => {
        const mul = sortDir === 'asc' ? 1 : -1;
        if (sortField === 'date') {
          const cmp = a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
          return cmp !== 0 ? mul * cmp : mul * (a.amount - b.amount);
        }
        return mul * (a.amount - b.amount);
      });
  }, [transactions, search, filterCategory, filterDateFrom, filterDateTo, filterMinAmount, filterMaxAmount, sortField, sortDir]);

  const getGroupKey = (d: string, g: string) => {
    const dt = new Date(d + 'T00:00:00');
    if (g === 'month') return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
    if (g === 'week') {
      const day = dt.getDay();
      const diff = dt.getDate() - day + (day === 0 ? -6 : 1);
      const mon = new Date(dt.setDate(diff));
      return `${mon.getFullYear()}-${String(mon.getMonth() + 1).padStart(2, '0')}-${String(mon.getDate()).padStart(2, '0')}`;
    }
    return d;
  };

  const getGroupLabel = (key: string, g: string) => {
    if (g === 'month') {
      const [y, m] = key.split('-');
      return new Date(Number(y), Number(m) - 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    }
    if (g === 'week') {
      const d = new Date(key + 'T00:00:00');
      const end = new Date(d);
      end.setDate(end.getDate() + 6);
      const fmt = (dt: Date) => dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
      return `${fmt(d)} - ${fmt(end)}`;
    }
    return new Date(key + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  };

  const groups = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    for (const t of filtered) {
      const key = getGroupKey(t.date, groupBy);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    }
    return Array.from(map.entries()).sort(([a], [b]) => sortDir === 'desc' ? b.localeCompare(a) : a.localeCompare(b));
  }, [filtered, groupBy]);

  const baseCategories = type === 'income' ? ['Salary', 'Freelance', 'Business', 'Interest', 'Dividends', 'Rental', 'Other']
    : type === 'saving' ? ['Emergency Fund', 'Goal Savings', 'Retirement', 'Education', 'Other']
    : type === 'investment' ? ['Stocks', 'Mutual Funds', 'Fixed Deposit', 'Real Estate', 'Gold', 'Crypto', 'Other']
    : ['Rent', 'Groceries', 'Utilities', 'Transport', 'Healthcare', 'Entertainment', 'Dining', 'Shopping', 'Bills', 'Insurance', 'Education', 'Other'];
  
  const recentCategories = useMemo(() => {
    const typeKey = type === 'income' ? 'mm_income_categories' : type === 'expense' ? 'mm_expense_categories' : type === 'investment' ? 'mm_investment_categories' : null;
    if (!typeKey) return getSortedCategories(baseCategories, type);
    try {
      const saved = localStorage.getItem(typeKey);
      if (saved) {
        const customCats = JSON.parse(saved);
        if (Array.isArray(customCats) && customCats.length > 0) {
          return customCats;
        }
      }
    } catch {}
    const userCats = new Map<string, number>();
    transactions.forEach(t => {
      if (t.category) {
        userCats.set(t.category, (userCats.get(t.category) || 0) + 1);
      }
    });
    const sorted = Array.from(userCats.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([cat]) => cat);
    return sorted.length > 0 ? sorted : getSortedCategories(baseCategories, type);
  }, [transactions, type]);

  const [categorySearch, setCategorySearch] = useState('');
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const filteredCategories = useMemo(() => {
    if (!categorySearch) return recentCategories.slice(0, 3);
    const search = categorySearch.toLowerCase();
    const matched = recentCategories.filter(c => c.toLowerCase().includes(search));
    const baseMatches = baseCategories.filter(c => c.toLowerCase().includes(search) && !matched.includes(c));
    return [...matched, ...baseMatches].slice(0, 10);
  }, [categorySearch, recentCategories]);

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <Reveal>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 hidden md:block">{title}</h1>
              <p className="text-slate-500 dark:text-slate-400 text-base font-semibold md:font-normal md:text-sm block md:hidden">{description.split(' ').slice(0, 5).join(' ')}{description.split(' ').length > 5 ? '...' : ''}</p>
              <p className="text-slate-500 dark:text-slate-400 hidden md:block">{description}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowArchive(!showArchive)} className="h-10 w-10 md:w-auto md:px-3 rounded-xl border border-slate-200 dark:border-brand-muted flex items-center justify-center text-slate-400 hover:text-red-500 hover:border-red-200 dark:hover:border-red-800 transition-colors relative gap-1.5" type="button">
                <Archive className="h-4 w-4" />
                <span className="hidden md:inline text-xs font-medium">Archive</span>
                {archived.length > 0 && <span className="absolute -top-1 -right-1 md:static md:ml-0 bg-red-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">{archived.length}</span>}
              </button>
              <button onClick={() => setShowAddModal(true)} className="h-10 w-10 rounded-xl bg-brand text-white flex items-center justify-center hover:bg-orange-600 transition-colors active:scale-95" type="button" title="Add">
                <Plus className="h-5 w-5" />
              </button>
            </div>
          </div>
        </Reveal>

        <Reveal delay={100}>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 max-w-md hidden md:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 dark:border-brand-muted dark:bg-[#2A2522] dark:text-slate-100 outline-none focus:ring-2 focus:ring-brand"
                placeholder="Search by description or category..." />
            </div>
            <button onClick={() => setShowFilters(!showFilters)} className="h-9 px-3 rounded-lg border border-slate-200 dark:border-brand-muted flex items-center justify-center text-slate-500 hover:text-slate-700 hover:bg-slate-50 dark:hover:bg-brand-muted/50 transition-colors text-xs gap-1.5" type="button">
              <SlidersHorizontal className="h-3.5 w-3.5" /> Filters
            </button>
            <button onClick={() => { setSortField('date'); setSortDir(d => d === 'asc' ? 'desc' : 'asc'); }} className="h-9 px-3 rounded-lg border border-slate-200 dark:border-brand-muted flex items-center justify-center text-slate-500 hover:text-slate-700 hover:bg-slate-50 dark:hover:bg-brand-muted/50 transition-colors text-xs gap-1.5" type="button" title={sortDir === 'desc' ? 'Newest first' : 'Oldest first'}>
              <ArrowUpDown className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{sortDir === 'desc' ? 'Newest' : 'Oldest'}</span>
            </button>
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-brand-muted rounded-lg p-0.5">
              {(['day', 'week', 'month'] as const).map(g => (
                <button key={g} onClick={() => setGroupBy(g)}
                  className={cn("px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                    groupBy === g ? "bg-white dark:bg-[#2A2522] text-slate-900 dark:text-slate-100 shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700"
                  )}>{g.charAt(0).toUpperCase() + g.slice(1)}</button>
              ))}
            </div>
          </div>
        </Reveal>

        <Reveal delay={200}>
        {/* Filter Panel */}
        {showFilters && (
          <div className="bg-white dark:bg-[#2A2522] p-4 rounded-2xl border border-slate-200 dark:border-brand-muted shadow-sm grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="col-span-full md:hidden">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 dark:border-brand-muted outline-none focus:ring-2 focus:ring-brand text-sm"
                  placeholder="Description or category..." />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1">Category</label>
              <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-brand-muted outline-none focus:ring-2 focus:ring-brand text-sm">
                <option value="">All</option>
                {recentCategories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1">From Date</label>
              <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-brand-muted outline-none focus:ring-2 focus:ring-brand text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1">To Date</label>
              <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-brand-muted outline-none focus:ring-2 focus:ring-brand text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1">Min Amount</label>
              <input type="number" value={filterMinAmount} onChange={e => setFilterMinAmount(e.target.value)} placeholder="₹0"
                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-brand-muted outline-none focus:ring-2 focus:ring-brand text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1">Max Amount</label>
              <input type="number" value={filterMaxAmount} onChange={e => setFilterMaxAmount(e.target.value)} placeholder="₹99999"
                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-brand-muted outline-none focus:ring-2 focus:ring-brand text-sm" />
            </div>
            <div className="col-span-full">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1.5">Quick Filters</span>
              <div className="grid grid-cols-4 gap-1 sm:gap-2">
                {[
                  { label: 'This Week', days: 7 },
                  { label: 'This Month', days: 30 },
                  { label: 'Last Month', days: 60 },
                  { label: 'This Quarter', days: 90 },
                ].map(p => (
                  <button key={p.label} type="button" onClick={() => {
                    const to = new Date();
                    const from = new Date();
                    if (p.days === 60) {
                      from.setMonth(from.getMonth() - 1);
                      from.setDate(1);
                      to.setDate(0);
                    } else {
                      from.setDate(from.getDate() - p.days);
                    }
                    setFilterDateFrom(from.toISOString().split('T')[0]);
                    setFilterDateTo(to.toISOString().split('T')[0]);
                  }}
                    className="w-full text-xs py-1 sm:py-1.5 rounded-md border border-slate-200 dark:border-brand-muted hover:bg-slate-100 dark:hover:bg-brand-muted/50 text-slate-600 dark:text-slate-400 transition-colors">
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="col-span-full flex items-center gap-2 pt-1 flex-wrap">
              <span className="text-xs text-slate-500 dark:text-slate-400">Sort:</span>
              <select value={sortField} onChange={e => setSortField(e.target.value as 'date' | 'amount')}
                className="px-2 py-1 rounded-lg border border-slate-200 dark:border-brand-muted outline-none focus:ring-2 focus:ring-brand text-xs">
                <option value="date">Date</option>
                <option value="amount">Amount</option>
              </select>
              <select value={sortDir} onChange={e => setSortDir(e.target.value as 'asc' | 'desc')}
                className="px-2 py-1 rounded-lg border border-slate-200 dark:border-brand-muted outline-none focus:ring-2 focus:ring-brand text-xs">
                <option value="desc">Newest / Highest</option>
                <option value="asc">Oldest / Lowest</option>
              </select>
              <Button variant="ghost" size="sm" onClick={() => { setFilterCategory(''); setFilterDateFrom(''); setFilterDateTo(''); setFilterMinAmount(''); setFilterMaxAmount(''); setSortField('date'); setSortDir('desc'); }} className="text-xs text-brand dark:text-brand-secondary px-1.5">
                Clear
              </Button>
            </div>
          </div>
        )}
        </Reveal>

        <Reveal delay={300}>
        {/* Main List - Cards on mobile, Table on desktop */}
        <div className="bg-white dark:bg-[#2A2522] rounded-2xl border border-slate-200 dark:border-brand-muted shadow-sm">
          {/* Mobile Card View */}
          <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-700">
            {filtered.length === 0 && (
              <p className="px-6 py-12 text-center text-slate-400 dark:text-slate-500">No transactions yet. Tap "Add" to create one.</p>
            )}
            {groups.map(([groupKey, txns]) => (
              <div key={groupKey}>
                <div className="px-4 py-2 bg-slate-50 dark:bg-brand-muted/50 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  {getGroupLabel(groupKey, groupBy)}
                </div>
                {txns.map((t, idx) => (
                  <div key={t.id} className="px-4 py-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{t.description || 'No description'}</p>
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{t.date}</p>
                      </div>
                      <p className={cn("text-sm font-bold shrink-0", type === 'income' || type === 'saving' ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400")}>
                        {formatCurrency(t.amount)}
                      </p>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-brand-muted text-slate-600 dark:text-slate-300 text-[11px] font-medium">{t.category}</span>
                        {t.partnerAccountId && <span className="px-2 py-0.5 rounded-full bg-brand-secondary dark:bg-brand-muted/30 text-brand dark:text-brand-secondary text-[11px]">Party</span>}
                      </div>
                      <div className="flex items-center gap-1">
                        {confirmDelete === t.id ? (
                          <div className="flex gap-1">
                            <button className="px-2 py-1 rounded bg-red-500 text-white text-xs font-medium" onClick={() => handleDelete(t.id)}>Yes</button>
                            <button className="px-2 py-1 rounded bg-slate-200 dark:bg-brand-muted text-xs font-medium" onClick={() => setConfirmDelete(null)}>No</button>
                          </div>
                        ) : (
                          <>
                            <button className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-brand-muted/50" onClick={() => openEdit(t)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-slate-100 dark:hover:bg-brand-muted/50" onClick={() => setConfirmDelete(t.id)}>
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ))}
            {filtered.length > 0 && (
              <div className="px-4 py-3 bg-slate-50 dark:bg-brand-muted border-t border-slate-200 dark:border-slate-600 flex items-center justify-between text-sm">
                <span className="font-semibold text-slate-700 dark:text-slate-300">Total · {filtered.length} entries</span>
                <span className={cn("font-bold", type === 'income' || type === 'saving' ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400")}>
                  {formatCurrency(filtered.reduce((s, t) => s + t.amount, 0))}
                </span>
              </div>
            )}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left table-fixed">
            <thead className="bg-slate-50 dark:bg-brand-muted border-b border-slate-200 dark:border-slate-600">
              <tr>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-300 w-[50px] text-center">#</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-300 w-[200px]">Category</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-300">Description</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-300 text-right w-[130px]">
                  <button onClick={() => { if (sortField === 'amount') { setSortDir(d => d === 'asc' ? 'desc' : 'asc'); } else { setSortField('amount'); setSortDir('desc'); } }}
                    className="flex items-center gap-1.5 ml-auto hover:text-slate-900 dark:hover:text-slate-100 transition-colors">
                    Amount <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-300 text-right w-[120px]">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-400 dark:text-slate-500">No transactions yet. Click "Add" to create one.</td></tr>
              )}
              {groups.map(([groupKey, txns]) => (
                <React.Fragment key={groupKey}>
                  <tr className="bg-slate-50 dark:bg-brand-muted/50">
                    <td colSpan={5} className="px-6 py-2 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      {getGroupLabel(groupKey, groupBy)}
                    </td>
                  </tr>
                  {txns.map((t, idx) => (
                    <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                      <td className="px-6 py-4 text-sm text-center text-slate-400 dark:text-slate-500 font-mono">{idx + 1}</td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 rounded-full bg-slate-100 dark:bg-brand-muted text-slate-600 dark:text-slate-300 text-xs font-medium">{t.category}</span>
                        {t.partnerAccountId && <span className="ml-1 px-2 py-1 rounded-full bg-brand-secondary dark:bg-brand-muted/30 text-brand dark:text-brand-secondary text-xs">Party</span>}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-700 dark:text-slate-300">{t.description}</td>
                      <td className={cn("px-6 py-4 text-sm font-bold text-right", type === 'income' || type === 'saving' ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400")}>
                        {formatCurrency(t.amount)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {confirmDelete === t.id ? (
                          <div className="flex justify-end gap-1 items-center">
                            <Button size="sm" variant="danger" className="h-6 px-1.5 text-xs min-w-0" onClick={() => handleDelete(t.id)}>Yes</Button>
                            <Button size="sm" variant="ghost" className="h-6 px-1.5 text-xs min-w-0" onClick={() => setConfirmDelete(null)}>No</Button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="sm" className="p-1.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400" onClick={() => openEdit(t)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="sm" className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 gap-1" onClick={() => setConfirmDelete(t.id)}>
                              <Trash2 className="h-4 w-4" />
                              <span className="hidden md:inline text-xs">Delete</span>
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
            {filtered.length > 0 && (
              <tfoot className="bg-slate-50 dark:bg-brand-muted border-t border-slate-200 dark:border-slate-600">
                <tr>
                  <td colSpan={2} className="px-6 py-4 text-sm font-semibold text-slate-700 dark:text-slate-300">Total</td>
                  <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">{filtered.length} entries</td>
                  <td className={cn("px-6 py-4 text-sm font-bold text-right", type === 'income' || type === 'saving' ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400")}>
                    {formatCurrency(filtered.reduce((s, t) => s + t.amount, 0))}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        </div>
        </Reveal>

        {/* Archive Panel */}
        {showArchive && (
          <div className="bg-amber-50 dark:bg-amber-900/30 rounded-2xl border border-amber-200 dark:border-amber-700 shadow-sm">
            <div className="px-6 py-4 border-b border-amber-200 dark:border-amber-700 flex items-center justify-between">
              <h3 className="font-bold text-amber-800 dark:text-amber-300 flex items-center gap-2">
                <Archive className="h-4 w-4" /> Archive
              </h3>
              <button onClick={() => setShowArchive(false)} className="h-8 w-8 rounded-lg flex items-center justify-center text-amber-600 hover:bg-amber-100 dark:hover:bg-amber-800/50 transition-colors"><X className="h-4 w-4" /></button>
            </div>
            {archived.length === 0 ? (
              <p className="px-6 py-8 text-center text-amber-600 dark:text-amber-400 text-sm">Archive is empty.</p>
            ) : (
              <div className="divide-y divide-amber-200 dark:divide-amber-700">
                {archived.map(t => (
                  <div key={t.id} className="flex items-center justify-between px-4 py-3 hover:bg-amber-100/50 dark:hover:bg-amber-800/30 transition-colors">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <p className="text-xs text-amber-600 dark:text-amber-500 shrink-0">{t.date}</p>
                      <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-800/50 text-amber-700 dark:text-amber-400 text-[11px] font-medium">{t.category}</span>
                    </div>
                    <p className="text-sm font-bold text-amber-700 dark:text-amber-400 shrink-0 mr-3">{formatCurrency(t.amount)}</p>
                    <div className="flex items-center gap-1 shrink-0">
                      <button className="p-1.5 rounded-lg text-amber-600 hover:text-green-600 hover:bg-amber-100 dark:hover:bg-amber-800/50 transition-colors gap-1" onClick={() => { if (hasPins()) setPinArchiveAction({ id: t.id, action: 'restore' }); else setShowPinSetup('restore an item from archive'); }}>
                        <Undo2 className="h-3.5 w-3.5" />
                        <span className="hidden md:inline text-xs">Restore</span>
                      </button>
                      <button className="p-1.5 rounded-lg text-amber-600 hover:text-red-600 hover:bg-amber-100 dark:hover:bg-amber-800/50 transition-colors gap-1" onClick={() => { if (hasPins()) setPinArchiveAction({ id: t.id, action: 'delete' }); else if (confirm('Permanently delete this item?')) setShowPinSetup('permanently delete an item'); }}>
                        <Trash2 className="h-3.5 w-3.5" />
                        <span className="hidden md:inline text-xs">Delete</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm flex items-start sm:items-center justify-center z-50 p-4 overflow-y-auto" onClick={() => setShowAddModal(false)}>
          <div className="bg-white dark:bg-[#2A2522] rounded-2xl max-w-lg w-full p-8 shadow-2xl my-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-6">Add {title.slice(0, -1)}</h2>
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block">Amount (₹)</label>
                <input required type="number" min="0" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-brand-muted outline-none focus:ring-2 focus:ring-brand" placeholder="0" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 relative">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block">Category</label>
                  <input
                    required
                    value={form.category}
                    onChange={e => { setForm({ ...form, category: e.target.value }); setCategorySearch(e.target.value); setShowCategoryDropdown(true); }}
                    onFocus={() => setShowCategoryDropdown(true)}
                    onBlur={() => setTimeout(() => setShowCategoryDropdown(false), 200)}
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-brand-muted outline-none focus:ring-2 focus:ring-brand"
                    placeholder="Search or type new category"
                  />
                  {showCategoryDropdown && (
                    <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white dark:bg-[#2A2522] border border-slate-200 dark:border-brand-muted rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {filteredCategories.map((c: string) => (
                        <button
                          key={c}
                          type="button"
                          onMouseDown={e => { e.preventDefault(); setForm({ ...form, category: c }); setShowCategoryDropdown(false); setCategorySearch(''); }}
                          className={cn("w-full px-4 py-2 text-left text-sm hover:bg-brand-secondary dark:hover:bg-brand-muted/30 transition-colors", form.category === c && "bg-brand-secondary dark:bg-brand-muted/30 font-medium")}
                        >
                          {c}
                        </button>
                      ))}
                      {categorySearch && !filteredCategories.includes(categorySearch) && (
                        <button
                          type="button"
                          onMouseDown={e => { e.preventDefault(); setForm({ ...form, category: categorySearch }); setShowCategoryDropdown(false); setCategorySearch(''); }}
                          className="w-full px-4 py-2 text-left text-sm text-brand font-medium hover:bg-brand-secondary dark:hover:bg-brand-muted/30"
                        >
                          + Create "{categorySearch}"
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block">Date</label>
                  <input required type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-brand-muted outline-none focus:ring-2 focus:ring-brand" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block">Description</label>
                <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-brand-muted outline-none focus:ring-2 focus:ring-brand" placeholder="Add a note..." />
              </div>
              {(type === 'income' || type === 'expense') && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block">Account</label>
                  <select value={form.account} onChange={e => setForm({ ...form, account: e.target.value as 'cash' | 'bank' | 'upi' })}
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-brand-muted outline-none focus:ring-2 focus:ring-brand">
                    <option value="cash">Cash</option>
                    <option value="bank">Bank</option>
                    <option value="upi">UPI</option>
                  </select>
                </div>
              )}
              {type === 'investment' && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block">Source of Funds</label>
                  <select value={form.investSource} onChange={e => setForm({ ...form, investSource: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-brand-muted outline-none focus:ring-2 focus:ring-brand">
                    <option value="bank">Bank</option>
                    <option value="adjustment">Adjustment</option>
                  </select>
                  <p className="text-xs text-slate-400 dark:text-slate-500">A corresponding outflow entry will be created from this source</p>
                </div>
              )}
              <div className="flex items-center justify-end gap-2 pt-6">
                <Button variant="ghost" size="sm" onClick={() => setShowAddModal(false)}>Cancel</Button>
                <Button type="submit" size="sm">Save Transaction</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingTransaction && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm flex items-start sm:items-center justify-center z-50 p-4 overflow-y-auto" onClick={() => setEditingTransaction(null)}>
          <div className="bg-white dark:bg-[#2A2522] rounded-2xl max-w-lg w-full p-8 shadow-2xl my-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-6">Edit {title.slice(0, -1)}</h2>
            <form onSubmit={(e) => { e.preventDefault(); handleEdit(); }} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block">Amount (₹)</label>
                <input required type="number" min="0" step="0.01" value={editForm.amount} onChange={e => setEditForm({ ...editForm, amount: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-brand-muted outline-none focus:ring-2 focus:ring-brand" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 relative">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block">Category</label>
                  <input
                    required
                    value={editForm.category}
                    onChange={e => { setEditForm({ ...editForm, category: e.target.value }); setEditCategorySearch(e.target.value); setShowEditCategoryDropdown(true); }}
                    onFocus={() => setShowEditCategoryDropdown(true)}
                    onBlur={() => setTimeout(() => setShowEditCategoryDropdown(false), 200)}
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-brand-muted outline-none focus:ring-2 focus:ring-brand"
                    placeholder="Search or type new"
                  />
                  {showEditCategoryDropdown && (
                    <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white dark:bg-[#2A2522] border border-slate-200 dark:border-brand-muted rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {filteredCategories.map((c: string) => (
                        <button
                          key={c}
                          type="button"
                          onMouseDown={e => { e.preventDefault(); setEditForm({ ...editForm, category: c }); setShowEditCategoryDropdown(false); setEditCategorySearch(''); }}
                          className={cn("w-full px-4 py-2 text-left text-sm hover:bg-brand-secondary dark:hover:bg-brand-muted/30 transition-colors", editForm.category === c && "bg-brand-secondary dark:bg-brand-muted/30 font-medium")}
                        >
                          {c}
                        </button>
                      ))}
                      {editCategorySearch && !filteredCategories.includes(editCategorySearch) && (
                        <button
                          type="button"
                          onMouseDown={e => { e.preventDefault(); setEditForm({ ...editForm, category: editCategorySearch }); setShowEditCategoryDropdown(false); setEditCategorySearch(''); }}
                          className="w-full px-4 py-2 text-left text-sm text-brand font-medium hover:bg-brand-secondary dark:hover:bg-brand-muted/30"
                        >
                          + Create "{editCategorySearch}"
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block">Date</label>
                  <input required type="date" value={editForm.date} onChange={e => setEditForm({ ...editForm, date: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-brand-muted outline-none focus:ring-2 focus:ring-brand" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block">Description</label>
                <input value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-brand-muted outline-none focus:ring-2 focus:ring-brand" />
              </div>
              <div className="flex items-center justify-end gap-2 pt-6">
                <Button variant="ghost" size="sm" type="button" onClick={() => setEditingTransaction(null)}>Cancel</Button>
                <Button type="submit" size="sm">Save Changes</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Duplicate Warning */}
      {dupWarning && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-start sm:items-center justify-center z-50 p-4 overflow-y-auto" onClick={() => setDupWarning(null)}>
          <div className="bg-white dark:bg-[#2A2522] rounded-2xl max-w-md w-full p-6 shadow-2xl border-l-4 border-amber-500" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="h-6 w-6 text-amber-500" />
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Possible Duplicate</h3>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
              A similar entry already exists on this date:
            </p>
            <div className="bg-slate-50 dark:bg-brand-muted/50 rounded-xl p-4 mb-5 text-sm space-y-1">
              <p><span className="font-medium text-slate-700 dark:text-slate-300">Existing:</span> <span className="text-slate-600 dark:text-slate-400">{dupWarning.existing.description || dupWarning.existing.category} — {formatCurrency(dupWarning.existing.amount)}</span></p>
              <p><span className="font-medium text-slate-700 dark:text-slate-300">New:</span> <span className="text-slate-600 dark:text-slate-400">{dupWarning.description || dupWarning.category} — {formatCurrency(dupWarning.amount)}</span></p>
              <p className="text-slate-400 dark:text-slate-500 text-xs">{dupWarning.date} · {dupWarning.type}</p>
            </div>
            <div className="flex items-center justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setDupWarning(null)}>Cancel</Button>
              <Button variant="primary" size="sm" onClick={handleDupConfirm}>Add Anyway</Button>
            </div>
          </div>
        </div>
      )}

      <PinPrompt
        open={pinArchiveAction !== null}
        onClose={() => setPinArchiveAction(null)}
        onSuccess={() => {
          if (!pinArchiveAction) return;
          if (pinArchiveAction.action === 'restore') handleRestore(pinArchiveAction.id);
          else handlePermanentDelete(pinArchiveAction.id);
          setPinArchiveAction(null);
        }}
        title={pinArchiveAction?.action === 'restore' ? 'Restore Item' : 'Permanently Delete'}
        message={`Enter a PIN to ${pinArchiveAction?.action === 'restore' ? 'restore' : 'permanently delete'} this item from archive`}
      />

      <PinPrompt
        open={pinEditAction !== null}
        onClose={() => { setPinEditAction(null); setEditingTransaction(null); }}
        onSuccess={() => {
          if (pinEditAction) doEdit(pinEditAction.id);
          setPinEditAction(null);
        }}
        title="Edit Entry"
        message="This entry was created on a previous day. Enter a PIN to edit."
      />

      <PinPrompt
        open={pinDeleteId !== null}
        onClose={() => { setPinDeleteId(null); setConfirmDelete(null); }}
        onSuccess={() => { if (pinDeleteId) doDelete(pinDeleteId); setPinDeleteId(null); }}
        title="Delete Transaction"
        message="Enter a PIN to delete this transaction"
      />

      <PinSetupGuide
        open={showPinSetup !== null}
        onClose={() => setShowPinSetup(null)}
        action={showPinSetup || ''}
      />
    </DashboardLayout>
  );
}
