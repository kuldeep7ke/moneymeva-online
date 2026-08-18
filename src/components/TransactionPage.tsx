'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Plus, Search, Trash2, Undo2, AlertTriangle, ArrowUpDown, X, Archive, SlidersHorizontal, Pencil, TrendingUp, TrendingDown, Calculator } from 'lucide-react';
import { formatCurrency, cn, getSortedCategories, todayStr } from '@/lib/utils';
import { TransactionType, Transaction } from '@/types';
import { getTransactions, addTransaction, updateTransaction, deleteTransaction, restoreTransaction, permanentDeleteTransaction, getArchivedTransactions, getPartners, addPartner, checkDuplicateTransaction, addAdjustment, isStoreReady } from '@/lib/store';
import InvestmentCalculator from '@/components/InvestmentCalculator';
import PinPrompt from '@/components/PinPrompt';
import PinSetupGuide from '@/components/PinSetupGuide';
import { hasPins } from '@/lib/pinStore';
import { getSession } from '@/lib/localAuth';
import { logActivity } from '@/lib/activityLog';
import Reveal from '@/components/Reveal';
import { useToast } from '@/components/Toast';

interface TransactionPageProps {
  type: TransactionType;
  title: string;
  description: string;
}

export default function TransactionPage({ type, title, description }: TransactionPageProps) {
  const toast = useToast();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [pinArchiveAction, setPinArchiveAction] = useState<{ id: string; action: 'restore' | 'delete' } | null>(null);
  const [pinEditAction, setPinEditAction] = useState<Transaction | null>(null);
  const [pinDeleteId, setPinDeleteId] = useState<string | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [showPinSetup, setShowPinSetup] = useState<string | null>(null);
  const [dupWarning, setDupWarning] = useState<any | null>(null);
  const [showDetail, setShowDetail] = useState<Transaction | null>(null);
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filterCategory, setFilterCategory] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
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

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (categoryRef.current && !categoryRef.current.contains(e.target as Node)) setShowCategoryDropdown(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (editCategoryRef.current && !editCategoryRef.current.contains(e.target as Node)) setShowEditCategoryDropdown(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const [editCategorySearch, setEditCategorySearch] = useState('');
  const [showEditCategoryDropdown, setShowEditCategoryDropdown] = useState(false);
  const [catHighlightIndex, setCatHighlightIndex] = useState(-1);
  const [editCatHighlightIndex, setEditCatHighlightIndex] = useState(-1);
  const categoryRef = useRef<HTMLDivElement>(null);
  const editCategoryRef = useRef<HTMLDivElement>(null);
  const [partySearch, setPartySearch] = useState('');
  const [showPartyDropdown, setShowPartyDropdown] = useState(false);
  const [partyFocused, setPartyFocused] = useState(false);
  const [partyHighlightIndex, setPartyHighlightIndex] = useState(-1);
  const partyRef = useRef<HTMLDivElement>(null);
  const [showCreateParty, setShowCreateParty] = useState<string | null>(null);
  const [createPartyForm, setCreatePartyForm] = useState({ group: 'contact' as 'customer' | 'vendor' | 'contact', type: 'individual', description: '' });

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (partyRef.current && !partyRef.current.contains(e.target as Node)) setShowPartyDropdown(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (!editingTransaction) {
      setEditCategorySearch('');
      setEditCatHighlightIndex(-1);
      setPartySearch('');
      setShowPartyDropdown(false);
      setPartyHighlightIndex(-1);
    }
  }, [editingTransaction]);

  const [form, setForm] = useState({ amount: '', category: '', description: '', date: todayStr(), partnerAccountId: '', investSource: 'bank', account: 'cash' as 'cash' | 'bank' | 'upi', party: '' });

  const openEdit = (tx: Transaction) => {
    setEditingTransaction(tx);
    setEditForm({ amount: String(tx.amount), category: tx.category, description: tx.description, date: tx.date, partnerAccountId: tx.partnerAccountId || '', party: tx.partnerAccountId ? (partners.find(p => p.id === tx.partnerAccountId)?.name || '') : '' });
    parseEditMeta(tx.description);
  };

  const [editForm, setEditForm] = useState({ amount: '', category: '', description: '', date: '', partnerAccountId: '', party: '' });
  const [editInvestMeta, setEditInvestMeta] = useState({ fundName: '', nav: '', units: '', mode: 'lumpsum' as string, institution: '', fdNumber: '', interestRate: '', tenure: '', maturityDate: '', payout: 'cumulative' as string, fdType: 'cumulative' as string, company: '', quantity: '', buyPrice: '', exchange: 'NSE' as string, stockMode: 'delivery' as string });

  const parseEditMeta = (desc: string) => {
    const reset = () => setEditInvestMeta({ fundName: '', nav: '', units: '', mode: 'lumpsum', institution: '', fdNumber: '', interestRate: '', tenure: '', maturityDate: '', payout: 'cumulative', fdType: 'cumulative', company: '', quantity: '', buyPrice: '', exchange: 'NSE', stockMode: 'delivery' });
    if (!desc) { reset(); return; }
    const parts = desc.split(' | ');
    const d: any = {};
    parts.forEach(p => {
      if (p.startsWith('Mode:')) d.mode = p.replace('Mode:', '');
      else if (p.startsWith('NAV:')) d.nav = p.replace('NAV:', '');
      else if (p.startsWith('Units:')) d.units = p.replace('Units:', '');
      else if (p.startsWith('Rate:')) d.interestRate = p.replace('Rate:', '').replace('%', '');
      else if (p.startsWith('Tenure:')) d.tenure = p.replace('Tenure:', '').replace('m', '');
      else if (p.startsWith('Type:')) d.fdType = p.replace('Type:', '');
      else if (p.startsWith('FD#')) d.fdNumber = p.replace('FD#:', '');
      else if (p.startsWith('Mat:')) d.maturityDate = p.replace('Mat:', '');
      else if (p.startsWith('Qty:')) d.quantity = p.replace('Qty:', '');
      else if (p.startsWith('Buy@')) d.buyPrice = p.replace('Buy@:', '');
      else if (p === 'NSE' || p === 'BSE') d.exchange = p;
      else if (p === 'delivery' || p === 'intraday') d.stockMode = p;
      else if (!p.startsWith('Mode:') && !p.startsWith('NAV:') && !p.startsWith('Units:') && !p.startsWith('Rate:') && !p.startsWith('Tenure:') && !p.startsWith('Type:') && !p.startsWith('FD#') && !p.startsWith('Mat:') && !p.startsWith('Qty:') && !p.startsWith('Buy@') && p !== 'NSE' && p !== 'BSE' && p !== 'delivery' && p !== 'intraday') d.fundName = p;
    });
    setEditInvestMeta({
      fundName: d.fundName || '', nav: d.nav || '', units: d.units || '', mode: d.mode || 'lumpsum',
      institution: d.institution || '', fdNumber: d.fdNumber || '', interestRate: d.interestRate || '', tenure: d.tenure || '', maturityDate: d.maturityDate || '', payout: d.payout || 'cumulative', fdType: d.fdType || 'cumulative',
      company: d.company || '', quantity: d.quantity || '', buyPrice: d.buyPrice || '', exchange: d.exchange || 'NSE', stockMode: d.stockMode || 'delivery',
    });
  };

  const [partyWarn, setPartyWarn] = useState<string | null>(null);
  const [investMeta, setInvestMeta] = useState({ fundName: '', nav: '', units: '', mode: 'lumpsum' as string, institution: '', fdNumber: '', interestRate: '', tenure: '', maturityDate: '', payout: 'cumulative' as string, fdType: 'cumulative' as string, company: '', quantity: '', buyPrice: '', exchange: 'NSE' as string, stockMode: 'delivery' as string });
  const [showInvestDetails, setShowInvestDetails] = useState(false);
  const [showEditInvestDetails, setShowEditInvestDetails] = useState(false);

  const PARTY_TYPES: Record<string, { value: string; label: string }[]> = {
    vendor: [
      { value: 'supplier', label: 'Supplier' },
      { value: 'wholesaler', label: 'Wholesaler' },
      { value: 'contractor', label: 'Contractor' },
      { value: 'service_provider', label: 'Service Provider' },
      { value: 'freelancer', label: 'Freelancer' },
      { value: 'shop', label: 'Shop / Retailer' },
      { value: 'other', label: 'Other' },
    ],
    customer: [
      { value: 'client', label: 'Client' },
      { value: 'retail', label: 'Retail Customer' },
      { value: 'regular', label: 'Regular' },
      { value: 'corporate', label: 'Corporate' },
      { value: 'other', label: 'Other' },
    ],
    contact: [
      { value: 'individual', label: 'Individual / Person' },
      { value: 'friend', label: 'Friend / Family' },
      { value: 'employee', label: 'Employee' },
      { value: 'landlord', label: 'Landlord / Tenant' },
      { value: 'investor', label: 'Investor' },
      { value: 'consultant', label: 'Consultant' },
      { value: 'other', label: 'Other' },
    ],
  };

  const handleCreateParty = () => {
    if (!showCreateParty) return;
    const existing = getPartners().find((p: any) => !p.deletedAt && p.name.toLowerCase() === showCreateParty.trim().toLowerCase());
    if (existing) {
      setPartyWarn(`"${existing.name}" already exists`);
      setTimeout(() => setPartyWarn(null), 3000);
      if (editingTransaction) {
        setEditForm({ ...editForm, partnerAccountId: existing.id, party: existing.name });
      } else {
        setForm({ ...form, partnerAccountId: existing.id, party: existing.name });
        setPartySearch(existing.name);
      }
      setShowCreateParty(null);
      setCreatePartyForm({ group: 'contact', type: 'individual', description: '' });
      return;
    }
    const result = addPartner({ name: showCreateParty, type: createPartyForm.type, group: createPartyForm.group, description: createPartyForm.description, budgetWindowStart: '', budgetWindowEnd: '', initialInvestment: 0 });
    if (result) {
      refresh();
      if (editingTransaction) {
        setEditForm({ ...editForm, partnerAccountId: result.id, party: result.name });
      } else {
        setForm({ ...form, partnerAccountId: result.id, party: result.name });
        setPartySearch(result.name);
      }
    }
    setShowCreateParty(null);
    setCreatePartyForm({ group: 'contact', type: 'individual', description: '' });
  };

  const handleEdit = () => {
    if (!editingTransaction) return;
    const amount = Number(editForm.amount);
    if (!(amount > 0)) { toast('Amount must be greater than zero.', 'warning'); return; }
    const createdToday = editingTransaction.createdAt?.split('T')[0] === todayStr();
    if (createdToday) {
      doEdit(editingTransaction.id);
    } else if (hasPins()) {
      setPinEditAction(editingTransaction);
    } else {
      setShowPinSetup('edit this entry');
      setEditingTransaction(null);
    }
  };

  const buildEditDescription = () => {
    if (type === 'investment') {
      if (editForm.category === 'Mutual Funds' && editInvestMeta.fundName) {
        const parts = [editInvestMeta.fundName, `Mode:${editInvestMeta.mode}`];
        if (editInvestMeta.nav) parts.push(`NAV:${editInvestMeta.nav}`);
        if (editInvestMeta.units) parts.push(`Units:${editInvestMeta.units}`);
        if (editForm.description) parts.push(editForm.description);
        return parts.join(' | ');
      }
      if ((editForm.category === 'FD' || editForm.category === 'Fixed Deposit') && (editInvestMeta.institution || editInvestMeta.interestRate || editInvestMeta.fdType)) {
        const parts: string[] = [];
        if (editInvestMeta.institution) parts.push(editInvestMeta.institution);
        if (editInvestMeta.interestRate) parts.push(`Rate:${editInvestMeta.interestRate}%`);
        if (editInvestMeta.tenure) parts.push(`Tenure:${editInvestMeta.tenure}m`);
        if (editInvestMeta.fdType) parts.push(`Type:${editInvestMeta.fdType}`);
        if (editInvestMeta.fdNumber) parts.push(`FD#:${editInvestMeta.fdNumber}`);
        if (editInvestMeta.maturityDate) parts.push(`Mat:${editInvestMeta.maturityDate}`);
        if (editForm.description) parts.push(editForm.description);
        return parts.join(' | ');
      }
      if (editForm.category === 'Stocks' && (editInvestMeta.company || editInvestMeta.quantity)) {
        const parts: string[] = [];
        if (editInvestMeta.company) parts.push(editInvestMeta.company);
        if (editInvestMeta.quantity) parts.push(`Qty:${editInvestMeta.quantity}`);
        if (editInvestMeta.buyPrice) parts.push(`Buy@:${editInvestMeta.buyPrice}`);
        if (editInvestMeta.exchange) parts.push(editInvestMeta.exchange);
        if (editInvestMeta.stockMode) parts.push(editInvestMeta.stockMode);
        if (editForm.description) parts.push(editForm.description);
        return parts.join(' | ');
      }
    }
    return editForm.description;
  };

  const doEdit = (id: string) => {
    if (editForm.date > todayStr()) { toast('Cannot set entries to future dates.', 'warning'); return; }
    const desc = buildEditDescription();
    updateTransaction(id, { amount: Number(editForm.amount), category: editForm.category, description: desc, date: editForm.date, partnerAccountId: editForm.partnerAccountId || undefined });
    saveCategoryToLocalStorage(editForm.category);
    logActivity('entry_edited', `${type} — ${editForm.category}`);
    setEditingTransaction(null);
    setEditCategorySearch('');
    setEditCatHighlightIndex(-1);
    setEditInvestMeta({ fundName: '', nav: '', units: '', mode: 'lumpsum', institution: '', fdNumber: '', interestRate: '', tenure: '', maturityDate: '', payout: 'cumulative', fdType: 'cumulative', company: '', quantity: '', buyPrice: '', exchange: 'NSE', stockMode: 'delivery' });
    refresh();
  };

  const buildDescription = () => {
    if (type === 'investment') {
      if (form.category === 'Mutual Funds' && investMeta.fundName) {
        const parts = [investMeta.fundName, `Mode:${investMeta.mode}`];
        if (investMeta.nav) parts.push(`NAV:${investMeta.nav}`);
        if (investMeta.units) parts.push(`Units:${investMeta.units}`);
        if (form.description) parts.push(form.description);
        return parts.join(' | ');
      }
      if ((form.category === 'FD' || form.category === 'Fixed Deposit') && (investMeta.institution || investMeta.interestRate || investMeta.fdType)) {
        const parts: string[] = [];
        if (investMeta.institution) parts.push(investMeta.institution);
        if (investMeta.interestRate) parts.push(`Rate:${investMeta.interestRate}%`);
        if (investMeta.tenure) parts.push(`Tenure:${investMeta.tenure}m`);
        if (investMeta.fdType) parts.push(`Type:${investMeta.fdType}`);
        if (investMeta.fdNumber) parts.push(`FD#:${investMeta.fdNumber}`);
        if (investMeta.maturityDate) parts.push(`Mat:${investMeta.maturityDate}`);
        if (form.description) parts.push(form.description);
        return parts.join(' | ');
      }
      if (form.category === 'Stocks' && (investMeta.company || investMeta.quantity)) {
        const parts: string[] = [];
        if (investMeta.company) parts.push(investMeta.company);
        if (investMeta.quantity) parts.push(`Qty:${investMeta.quantity}`);
        if (investMeta.buyPrice) parts.push(`Buy@:${investMeta.buyPrice}`);
        if (investMeta.exchange) parts.push(investMeta.exchange);
        if (investMeta.stockMode) parts.push(investMeta.stockMode);
        if (form.description) parts.push(form.description);
        return parts.join(' | ');
      }
    }
    return form.description;
  };

  const saveCategoryToLocalStorage = (cat: string) => {
    if (!cat) return;
    const typeKey = type === 'income' ? 'mm_income_categories' : type === 'expense' ? 'mm_expense_categories' : type === 'investment' ? 'mm_investment_categories' : null;
    if (!typeKey) return;
    try {
      const saved = localStorage.getItem(typeKey);
      let cats: string[] = saved ? JSON.parse(saved) : [];
      if (Array.isArray(cats) && !cats.includes(cat)) {
        cats.push(cat);
        localStorage.setItem(typeKey, JSON.stringify(cats));
      }
    } catch {}
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(form.amount);
    if (!(amount > 0)) { toast('Amount must be greater than zero.', 'warning'); return; }
    const desc = buildDescription();
    const tx = { amount, type, category: form.category, description: desc, date: form.date, partnerAccountId: form.partnerAccountId || undefined };
    if (form.date > todayStr()) { toast('Cannot add entries with future dates.', 'warning'); return; }
    const dup = checkDuplicateTransaction(tx);
    if (dup) {
      setDupWarning({ ...tx, existing: dup, investSource: form.investSource, account: form.account });
      return;
    }
    let account: Transaction['account'];
    if (type === 'income' || type === 'expense') {
      account = form.account;
    } else if (type === 'investment') {
      account = form.investSource === 'cash' ? form.account : 'invest';
    }
    addTransaction({ ...tx, account, isRecurring: false });
    saveCategoryToLocalStorage(form.category);
    logActivity('entry_created', `${type} — ${form.category}`);

    if (type === 'investment' && form.investSource === 'bank') {
      addTransaction({ amount, type: 'expense', category: 'Investment Outflow', description: `Fund source for ${form.description || form.category}`, date: form.date, partnerAccountId: undefined, isRecurring: false, account: 'bank' });
    } else if (type === 'investment' && form.investSource === 'adjustment') {
      addAdjustment({ amount: -amount, accountType: 'personal', notes: `Fund source for ${form.description || form.category}`, date: form.date });
    }

    setShowAddModal(false);
    setForm({ amount: '', category: '', description: '', date: todayStr(), partnerAccountId: '', investSource: 'bank', account: 'cash', party: '' });
    setInvestMeta({ fundName: '', nav: '', units: '', mode: 'lumpsum', institution: '', fdNumber: '', interestRate: '', tenure: '', maturityDate: '', payout: 'cumulative', fdType: 'cumulative', company: '', quantity: '', buyPrice: '', exchange: 'NSE', stockMode: 'delivery' });
    setPartySearch('');
    setShowPartyDropdown(false);
    setPartyHighlightIndex(-1);
    refresh();
  };

  const handleDupConfirm = () => {
    if (!dupWarning) return;
    const amount = dupWarning.amount;
    if (!(amount > 0)) return;
    const account = dupWarning.type === 'investment' ? (dupWarning.investSource === 'cash' ? dupWarning.account : 'invest') : dupWarning.account;
    addTransaction({ amount, type: dupWarning.type, category: dupWarning.category, description: dupWarning.description, date: dupWarning.date, partnerAccountId: dupWarning.partnerAccountId, isRecurring: false, account });

    if (type === 'investment' && dupWarning.investSource === 'bank') {
      addTransaction({ amount, type: 'expense', category: 'Investment Outflow', description: `Fund source for ${dupWarning.description || dupWarning.category}`, date: dupWarning.date, partnerAccountId: undefined, isRecurring: false, account: 'bank' });
    } else if (type === 'investment' && dupWarning.investSource === 'adjustment') {
      addAdjustment({ amount: -amount, accountType: 'personal', notes: `Fund source for ${dupWarning.description || dupWarning.category}`, date: dupWarning.date });
    }

    setDupWarning(null);
    setShowAddModal(false);
    setForm({ amount: '', category: '', description: '', date: todayStr(), partnerAccountId: '', investSource: 'bank', account: 'cash', party: '' });
    setInvestMeta({ fundName: '', nav: '', units: '', mode: 'lumpsum', institution: '', fdNumber: '', interestRate: '', tenure: '', maturityDate: '', payout: 'cumulative', fdType: 'cumulative', company: '', quantity: '', buyPrice: '', exchange: 'NSE', stockMode: 'delivery' });
    setPartySearch('');
    setShowPartyDropdown(false);
    setPartyHighlightIndex(-1);
    refresh();
  };

  const handleDelete = (id: string) => {
    const tx = transactions.find(t => t.id === id);
    const createdToday = tx && tx.createdAt?.split('T')[0] === todayStr();
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
    : type === 'investment' ? ['Stocks', 'Mutual Funds', 'Fixed Deposit', 'Real Estate', 'Gold', 'Crypto', 'Other']
    : ['Rent', 'Groceries', 'Utilities', 'Transport', 'Healthcare', 'Entertainment', 'Dining', 'Shopping', 'Bills', 'Insurance', 'Education', 'Other'];
  
  const recentCategories = useMemo(() => {
    const typeKey = type === 'income' ? 'mm_income_categories' : type === 'expense' ? 'mm_expense_categories' : type === 'investment' ? 'mm_investment_categories' : null;
    if (!typeKey) return getSortedCategories(baseCategories, type);
    let customCats: string[] = [];
    try {
      const saved = localStorage.getItem(typeKey);
      if (saved) { const parsed = JSON.parse(saved); if (Array.isArray(parsed)) customCats = parsed; }
    } catch {}
    const userCats = new Map<string, number>();
    transactions.forEach(t => { if (t.category) userCats.set(t.category, (userCats.get(t.category) || 0) + 1); });
    const freqSorted = Array.from(userCats.entries()).sort((a, b) => b[1] - a[1]).map(([cat]) => cat);
    const merged = [...freqSorted];
    for (const cat of customCats) { if (!merged.includes(cat)) merged.push(cat); }
    for (const cat of baseCategories) { if (!merged.includes(cat)) merged.push(cat); }
    return merged.length > 0 ? merged : getSortedCategories(baseCategories, type);
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

  const filteredEditCategories = useMemo(() => {
    if (!editCategorySearch) return recentCategories.slice(0, 3);
    const search = editCategorySearch.toLowerCase();
    const matched = recentCategories.filter(c => c.toLowerCase().includes(search));
    const baseMatches = baseCategories.filter(c => c.toLowerCase().includes(search) && !matched.includes(c));
    return [...matched, ...baseMatches].slice(0, 10);
  }, [editCategorySearch, recentCategories]);

  const recentParties = useMemo(() => {
    const txPartners = transactions
      .filter(t => t.partnerAccountId)
      .reduce((acc, t) => {
        const p = partners.find(p => p.id === t.partnerAccountId);
        if (p) acc.set(p.id, (acc.get(p.id) || 0) + 1);
        return acc;
      }, new Map<string, number>());
    return Array.from(txPartners.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => partners.find(p => p.id === id))
      .filter(Boolean);
  }, [transactions, partners]);

  const filteredParties = useMemo(() => {
    if (!partySearch) return recentParties.slice(0, 3);
    const search = partySearch.toLowerCase();
    return partners.filter(p => p.name.toLowerCase().includes(search));
  }, [partySearch, recentParties, partners]);

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
              {type === 'investment' && (
                <button onClick={() => setShowCalculator(true)} className="h-10 w-10 md:w-auto md:px-3 rounded-xl border border-brand/30 dark:border-brand/40 flex items-center justify-center text-brand hover:bg-brand/10 transition-colors gap-1.5" type="button" title="Investment Calculator">
                  <Calculator className="h-4 w-4" />
                  <span className="hidden md:inline text-xs font-medium">Calculator</span>
                </button>
              )}
              <button onClick={() => setShowAddModal(true)} className="h-10 w-10 rounded-xl bg-brand text-white flex items-center justify-center hover:bg-orange-600 transition-colors active:scale-95" type="button" title="Add">
                <Plus className="h-5 w-5 icon-bounce" />
              </button>
            </div>
          </div>
        </Reveal>

        <Reveal delay={100}>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 dark:border-brand-muted dark:bg-[#2A2522] dark:text-slate-100 outline-none focus:ring-2 focus:ring-brand text-sm"
                placeholder={type === 'income' ? 'Search income...' : type === 'investment' ? 'Search investments...' : 'Search expenses...'} />
            </div>
            <button onClick={() => {
                const count = [filterCategory, filterDateFrom, filterDateTo, filterMinAmount, filterMaxAmount, search].filter(Boolean).length;
                if (count > 0) {
                  setSearch(''); setFilterCategory(''); setFilterDateFrom(''); setFilterDateTo(''); setFilterMinAmount(''); setFilterMaxAmount(''); setSortField('date'); setSortDir('desc');
                  setShowFilters(false);
                } else {
                  setShowFilters(!showFilters);
                }
              }} className="relative h-9 px-3 rounded-lg border border-slate-200 dark:border-brand-muted flex items-center justify-center text-slate-500 hover:text-slate-700 hover:bg-slate-50 dark:hover:bg-brand-muted/50 transition-colors text-xs gap-1.5" type="button">
              <SlidersHorizontal className="h-3.5 w-3.5" /> {[filterCategory, filterDateFrom, filterDateTo, filterMinAmount, filterMaxAmount, search].filter(Boolean).length > 0 ? 'Clear Filters' : 'Filters'}
              {(() => {
                const count = [filterCategory, filterDateFrom, filterDateTo, filterMinAmount, filterMaxAmount, search].filter(Boolean).length;
                return count > 0 ? <span className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">{count}</span> : null;
              })()}
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
          <div className="bg-white dark:bg-[#2A2522] p-4 rounded-2xl border border-slate-200 dark:border-brand-muted shadow-sm grid grid-cols-2 md:grid-cols-5 gap-4 relative">
            <button onClick={() => setShowFilters(false)} className="absolute top-2 right-2 p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-brand-muted transition-colors md:hidden" type="button" aria-label="Close filters">
              <X className="h-4 w-4" />
            </button>
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
                    const now = new Date();
                    const to = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                    let from: Date;
                    if (p.label === 'This Week') {
                      const dow = (to.getDay() + 6) % 7;
                      from = new Date(to);
                      from.setDate(to.getDate() - dow);
                    } else if (p.label === 'This Month') {
                      from = new Date(to.getFullYear(), to.getMonth(), 1);
                    } else if (p.label === 'Last Month') {
                      from = new Date(to.getFullYear(), to.getMonth() - 1, 1);
                      to.setDate(0);
                    } else {
                      from = new Date(to.getFullYear(), Math.floor(to.getMonth() / 3) * 3, 1);
                    }
                    const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                    setFilterDateFrom(fmt(from));
                    setFilterDateTo(fmt(to));
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
              <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setFilterCategory(''); setFilterDateFrom(''); setFilterDateTo(''); setFilterMinAmount(''); setFilterMaxAmount(''); setSortField('date'); setSortDir('desc'); }} className="text-xs text-red-500 px-1.5">
                Clear All Filters
              </Button>
            </div>
          </div>
        )}
        </Reveal>

        <Reveal delay={300}>
        {/* Main List - Cards on mobile, Table on desktop */}
        <div className="bg-white dark:bg-[#2A2522] rounded-2xl border border-slate-200 dark:border-brand-muted shadow-sm">
          {/* Mobile List View */}
          <div className="md:hidden divide-y divide-slate-100 dark:divide-brand-muted">
            {filtered.length === 0 && (
              <div className="px-6 py-16 text-center">
                <TrendingUp className="h-10 w-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">No transactions yet</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Tap &ldquo;+ Add&rdquo; to record your first {type === 'income' ? 'income' : type === 'expense' ? 'expense' : 'investment'}.</p>
              </div>
            )}
            {groups.map(([groupKey, txns]) => (
              <div key={groupKey}>
                <div className="px-4 py-2 bg-slate-50 dark:bg-brand-muted/50 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  {getGroupLabel(groupKey, groupBy)}
                </div>
                {txns.map((t, idx) => (
                  <div key={t.id} className="px-4 py-2.5 flex items-center justify-between active:bg-slate-50 dark:active:bg-brand-muted/20 cursor-pointer" onClick={() => setShowDetail(t)}>
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className={cn("shrink-0", type === 'income' ? "text-green-500" : "text-red-500")}>
                        {type === 'income' ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm text-slate-900 dark:text-slate-100 truncate">{t.description || t.category}</p>
                        <p className="text-[11px] text-slate-400">{t.date}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      <p className={cn("text-sm font-semibold", type === 'income' ? "text-green-600" : "text-red-600")}>
                        {formatCurrency(t.amount)}
                      </p>
                      {confirmDelete === t.id ? (
                        <div className="flex gap-1 ml-1">
                          <button className="w-10 h-8 rounded bg-red-500 text-white text-xs font-medium" onClick={() => handleDelete(t.id)}>Y</button>
                          <button className="w-10 h-8 rounded bg-slate-200 dark:bg-brand-muted text-xs font-medium" onClick={() => setConfirmDelete(null)}>N</button>
                        </div>
                      ) : (
                        <>
                          <button className="p-2 rounded text-slate-300 hover:text-blue-500 active:scale-95 transition-transform" onClick={e => { e.stopPropagation(); openEdit(t); }} aria-label="Edit"><Pencil className="h-3.5 w-3.5" /></button>
                          <button className="p-2 rounded text-slate-300 hover:text-red-500 active:scale-95 transition-transform" onClick={e => { e.stopPropagation(); setConfirmDelete(t.id); }} aria-label="Delete"><Trash2 className="h-3.5 w-3.5" /></button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ))}
            {filtered.length > 0 && (
              <div className="px-4 py-3 bg-slate-50 dark:bg-brand-muted border-t border-slate-200 dark:border-slate-600 flex items-center justify-between text-sm">
                <span className="font-semibold text-slate-700 dark:text-slate-300">Total · {filtered.length} entries</span>
                <span className={cn("font-bold", type === 'income' ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400")}>
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
                <tr><td colSpan={5} className="px-6 py-16 text-center">
                  <TrendingUp className="h-10 w-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                  <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">No transactions yet</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Click &ldquo;+ Add&rdquo; to record your first {type === 'income' ? 'income' : type === 'expense' ? 'expense' : 'investment'}.</p>
                </td></tr>
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
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-700 dark:text-slate-300">
                        <div className="flex items-center gap-2">
                          <span>{t.description}</span>
                          {t.partnerAccountId && <span className="px-2 py-0.5 rounded-full bg-brand-secondary/20 dark:bg-brand-muted/30 text-brand dark:text-brand-secondary text-[11px] font-medium shrink-0">{partners.find(p => p.id === t.partnerAccountId)?.name || 'Party'}</span>}
                        </div>
                      </td>
                      <td className={cn("px-6 py-4 text-sm font-bold text-right", type === 'income' ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400")}>
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
                  <td className={cn("px-6 py-4 text-sm font-bold text-right", type === 'income' ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400")}>
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
              <div className="px-6 py-10 text-center">
                <Archive className="h-8 w-8 text-amber-300 dark:text-amber-600 mx-auto mb-2" />
                <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">Archive is empty</p>
                <p className="text-xs text-amber-500 dark:text-amber-500 mt-1">Deleted items will appear here.</p>
              </div>
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
                      <button className="p-1.5 rounded-lg text-amber-600 hover:text-green-600 hover:bg-amber-100 dark:hover:bg-amber-800/50 transition-colors gap-1" onClick={() => { if (hasPins()) setPinArchiveAction({ id: t.id, action: 'restore' }); else handleRestore(t.id); }}>
                        <Undo2 className="h-3.5 w-3.5" />
                        <span className="hidden md:inline text-xs">Restore</span>
                      </button>
                      <button className="p-1.5 rounded-lg text-amber-600 hover:text-red-600 hover:bg-amber-100 dark:hover:bg-amber-800/50 transition-colors gap-1" onClick={() => { if (hasPins()) setPinArchiveAction({ id: t.id, action: 'delete' }); else handlePermanentDelete(t.id); }}>
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
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm flex items-start sm:items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white dark:bg-[#2A2522] rounded-2xl max-w-lg w-full p-8 shadow-2xl my-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-6">Add {title === 'Income' ? 'Income' : title.replace(/s$/, '')}</h2>
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block">Amount (₹)</label>
                <input required type="number" min="0" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-brand-muted outline-none focus:ring-2 focus:ring-brand" placeholder="0" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 relative" ref={categoryRef}>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block">Category</label>
                  <input
                    required
                    value={form.category}
                    onChange={e => { setForm({ ...form, category: e.target.value }); setCategorySearch(e.target.value); setShowCategoryDropdown(true); setCatHighlightIndex(-1); }}
                    onFocus={() => setShowCategoryDropdown(true)}
                    onKeyDown={e => {
                      const totalItems = filteredCategories.length + (categorySearch && !filteredCategories.includes(categorySearch) ? 1 : 0);
                      if (e.key === 'ArrowDown') { e.preventDefault(); setShowCategoryDropdown(true); setCatHighlightIndex(i => Math.min(i + 1, totalItems - 1)); }
                      else if (e.key === 'ArrowUp') { e.preventDefault(); setCatHighlightIndex(i => Math.max(i - 1, 0)); }
                      else if (e.key === 'Enter' && showCategoryDropdown && catHighlightIndex >= 0) { e.preventDefault(); if (catHighlightIndex < filteredCategories.length) { setForm({ ...form, category: filteredCategories[catHighlightIndex] }); } else { setForm({ ...form, category: categorySearch }); } setShowCategoryDropdown(false); setCategorySearch(''); setCatHighlightIndex(-1); }
                      else if (e.key === 'Escape') { setShowCategoryDropdown(false); setCatHighlightIndex(-1); }
                    }}
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-brand-muted outline-none focus:ring-2 focus:ring-brand"
                    placeholder="Search or type new category"
                  />
                  {showCategoryDropdown && (
                    <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white dark:bg-[#2A2522] border border-slate-200 dark:border-brand-muted rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {filteredCategories.map((c, i) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => { setForm({ ...form, category: c }); setShowCategoryDropdown(false); setCategorySearch(''); setCatHighlightIndex(-1); }}
                          onMouseEnter={() => setCatHighlightIndex(i)}
                          className={cn("w-full px-4 py-2 text-left text-sm transition-colors", catHighlightIndex === i ? "bg-brand-secondary dark:bg-brand-muted/30" : "hover:bg-brand-secondary dark:hover:bg-brand-muted/30", form.category === c && "font-medium")}
                        >
                          {c}
                        </button>
                      ))}
                      {categorySearch && !filteredCategories.includes(categorySearch) && (
                        <button
                          type="button"
                          onClick={() => { setForm({ ...form, category: categorySearch }); setShowCategoryDropdown(false); setCategorySearch(''); setCatHighlightIndex(-1); }}
                          onMouseEnter={() => setCatHighlightIndex(filteredCategories.length)}
                          className={cn("w-full px-4 py-2 text-left text-sm text-brand font-medium transition-colors", catHighlightIndex === filteredCategories.length ? "bg-brand-secondary dark:bg-brand-muted/30" : "hover:bg-brand-secondary dark:hover:bg-brand-muted/30")}
                        >
                          + Create "{categorySearch}"
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block">Date</label>
                  <input required type="date" max={todayStr()} value={form.date} onChange={e => setForm({ ...form, date: e.target.value })}
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
                <>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block">Source of Funds</label>
                  <select value={form.investSource} onChange={e => setForm({ ...form, investSource: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-brand-muted outline-none focus:ring-2 focus:ring-brand">
                    <option value="bank">Bank</option>
                    <option value="adjustment">Adjustment</option>
                  </select>
                  <p className="text-xs text-slate-400 dark:text-slate-500">A corresponding outflow entry will be created from this source</p>
                </div>
                {(form.category === 'Mutual Funds' || form.category === 'FD' || form.category === 'Fixed Deposit' || form.category === 'Stocks') && (
                  <div className="space-y-4 p-4 bg-slate-50 dark:bg-brand-muted/20 rounded-xl border border-slate-200 dark:border-brand-muted">
                    <button type="button" onClick={() => setShowInvestDetails(!showInvestDetails)}
                      className="w-full flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-brand">
                      <span>{form.category} Details</span>
                      <svg className={cn("h-4 w-4 transition-transform", showInvestDetails && "rotate-180")} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </button>
                    {showInvestDetails && (
                    <>
                    {form.category === 'Mutual Funds' && (
                      <>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block">Fund Name</label>
                        <input value={investMeta.fundName} onChange={e => setInvestMeta({ ...investMeta, fundName: e.target.value })}
                          className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-brand-muted outline-none focus:ring-2 focus:ring-brand" placeholder="e.g. HDFC Mid-Cap Opportunities Fund" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block">NAV (₹)</label>
                          <input type="number" step="0.001" min="0" value={investMeta.nav} onChange={e => setInvestMeta({ ...investMeta, nav: e.target.value })}
                            className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-brand-muted outline-none focus:ring-2 focus:ring-brand" placeholder="0.00" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block">Units</label>
                          <input type="number" step="0.001" min="0" value={investMeta.units} onChange={e => setInvestMeta({ ...investMeta, units: e.target.value })}
                            className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-brand-muted outline-none focus:ring-2 focus:ring-brand" placeholder="Auto" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block">Mode</label>
                        <div className="grid grid-cols-2 gap-2">
                          <button type="button" onClick={() => setInvestMeta({ ...investMeta, mode: 'lumpsum' })}
                            className={cn("px-4 py-2 rounded-lg text-sm font-medium border transition-colors", investMeta.mode === 'lumpsum' ? "bg-brand text-white border-brand" : "bg-white dark:bg-brand-dark text-slate-600 dark:text-slate-300 border-slate-200 dark:border-brand-muted")}>
                            Lumpsum
                          </button>
                          <button type="button" onClick={() => setInvestMeta({ ...investMeta, mode: 'sip' })}
                            className={cn("px-4 py-2 rounded-lg text-sm font-medium border transition-colors", investMeta.mode === 'sip' ? "bg-brand text-white border-brand" : "bg-white dark:bg-brand-dark text-slate-600 dark:text-slate-300 border-slate-200 dark:border-brand-muted")}>
                            SIP
                          </button>
                        </div>
                      </div>
                      </>
                    )}

                    {(form.category === 'FD' || form.category === 'Fixed Deposit') && (
                      <>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block">Type of FD</label>
                        <select value={investMeta.fdType} onChange={e => setInvestMeta({ ...investMeta, fdType: e.target.value })}
                          className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-brand-muted outline-none focus:ring-2 focus:ring-brand">
                          <option value="cumulative">Cumulative</option>
                          <option value="quarterly">Quarterly Payout</option>
                          <option value="monthly">Monthly Payout</option>
                          <option value="tax_saver">Tax Saver</option>
                          <option value="senior">Senior Citizen</option>
                          <option value="corporate">Corporate FD</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block">Institution / Bank</label>
                        <input value={investMeta.institution} onChange={e => setInvestMeta({ ...investMeta, institution: e.target.value })}
                          className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-brand-muted outline-none focus:ring-2 focus:ring-brand" placeholder="e.g. SBI, HDFC Bank" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block">Interest Rate (%)</label>
                          <input type="number" step="0.1" min="0" value={investMeta.interestRate} onChange={e => setInvestMeta({ ...investMeta, interestRate: e.target.value })}
                            className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-brand-muted outline-none focus:ring-2 focus:ring-brand" placeholder="e.g. 7.5" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block">Tenure (months)</label>
                          <input type="number" min="0" value={investMeta.tenure} onChange={e => setInvestMeta({ ...investMeta, tenure: e.target.value })}
                            className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-brand-muted outline-none focus:ring-2 focus:ring-brand" placeholder="e.g. 12" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block">FD Number</label>
                          <input value={investMeta.fdNumber} onChange={e => setInvestMeta({ ...investMeta, fdNumber: e.target.value })}
                            className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-brand-muted outline-none focus:ring-2 focus:ring-brand" placeholder="Receipt/ref number" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block">Maturity Date</label>
                          <input type="date" value={investMeta.maturityDate} onChange={e => setInvestMeta({ ...investMeta, maturityDate: e.target.value })}
                            className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-brand-muted outline-none focus:ring-2 focus:ring-brand" />
                        </div>
                      </div>
                      {Number(form.amount) > 0 && Number(investMeta.interestRate) > 0 && Number(investMeta.tenure) > 0 && (
                        <div className="bg-brand-light dark:bg-brand-muted/20 rounded-lg p-3 text-sm">
                          <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                            <span>Maturity Amount (approx)</span>
                            <span className="font-bold text-slate-900 dark:text-slate-100">
                              ₹{Math.round(Number(form.amount) * Math.pow(1 + (Number(investMeta.interestRate) / 100) / 4, (Number(investMeta.tenure) / 12) * 4)).toLocaleString()}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-xs text-slate-400 mt-1">
                            <span>Interest earned</span>
                            <span className="text-green-600">+₹{Math.round(Number(form.amount) * Math.pow(1 + (Number(investMeta.interestRate) / 100) / 4, (Number(investMeta.tenure) / 12) * 4) - Number(form.amount)).toLocaleString()}</span>
                          </div>
                        </div>
                      )}
                      </>
                    )}

                    {form.category === 'Stocks' && (
                      <>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block">Company / Script</label>
                        <input value={investMeta.company} onChange={e => setInvestMeta({ ...investMeta, company: e.target.value })}
                          className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-brand-muted outline-none focus:ring-2 focus:ring-brand" placeholder="e.g. Reliance Industries" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block">Quantity</label>
                          <input type="number" min="0" value={investMeta.quantity} onChange={e => setInvestMeta({ ...investMeta, quantity: e.target.value })}
                            className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-brand-muted outline-none focus:ring-2 focus:ring-brand" placeholder="e.g. 10" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block">Buy Price (₹)</label>
                          <input type="number" step="0.01" min="0" value={investMeta.buyPrice} onChange={e => setInvestMeta({ ...investMeta, buyPrice: e.target.value })}
                            className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-brand-muted outline-none focus:ring-2 focus:ring-brand" placeholder="e.g. 2500.50" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block">Exchange</label>
                          <div className="grid grid-cols-2 gap-2">
                            <button type="button" onClick={() => setInvestMeta({ ...investMeta, exchange: 'NSE' })}
                              className={cn("px-4 py-2 rounded-lg text-sm font-medium border transition-colors", investMeta.exchange === 'NSE' ? "bg-brand text-white border-brand" : "bg-white dark:bg-brand-dark text-slate-600 dark:text-slate-300 border-slate-200 dark:border-brand-muted")}>
                              NSE
                            </button>
                            <button type="button" onClick={() => setInvestMeta({ ...investMeta, exchange: 'BSE' })}
                              className={cn("px-4 py-2 rounded-lg text-sm font-medium border transition-colors", investMeta.exchange === 'BSE' ? "bg-brand text-white border-brand" : "bg-white dark:bg-brand-dark text-slate-600 dark:text-slate-300 border-slate-200 dark:border-brand-muted")}>
                              BSE
                            </button>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block">Mode</label>
                          <div className="grid grid-cols-2 gap-2">
                            <button type="button" onClick={() => setInvestMeta({ ...investMeta, stockMode: 'delivery' })}
                              className={cn("px-4 py-2 rounded-lg text-sm font-medium border transition-colors", investMeta.stockMode === 'delivery' ? "bg-brand text-white border-brand" : "bg-white dark:bg-brand-dark text-slate-600 dark:text-slate-300 border-slate-200 dark:border-brand-muted")}>
                              Delivery
                            </button>
                            <button type="button" onClick={() => setInvestMeta({ ...investMeta, stockMode: 'intraday' })}
                              className={cn("px-4 py-2 rounded-lg text-sm font-medium border transition-colors", investMeta.stockMode === 'intraday' ? "bg-brand text-white border-brand" : "bg-white dark:bg-brand-dark text-slate-600 dark:text-slate-300 border-slate-200 dark:border-brand-muted")}>
                              Intraday
                            </button>
                          </div>
                        </div>
                      </div>
                      </>
                    )}
                    </>
                    )}
                  </div>
                )}
                </>
              )}
              <div className="space-y-2 relative" ref={partyRef}>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block">Party (Optional)</label>
                <input value={partyFocused && !form.party && !partySearch ? '' : (partySearch || form.party || 'None')} onChange={e => { setPartySearch(e.target.value); setShowPartyDropdown(true); setPartyHighlightIndex(-1); }}
                  onFocus={() => { setPartyFocused(true); setShowPartyDropdown(true); }}
                  onBlur={() => { if (!partySearch && !form.party) setPartyFocused(false); }}
                  onKeyDown={e => {
                    const totalItems = 1 + filteredParties.length + (partySearch && !filteredParties.some(p => p.name.toLowerCase() === partySearch.toLowerCase()) ? 1 : 0);
                    if (e.key === 'ArrowDown') { e.preventDefault(); setShowPartyDropdown(true); setPartyHighlightIndex(i => Math.min(i + 1, totalItems - 1)); }
                    else if (e.key === 'ArrowUp') { e.preventDefault(); setPartyHighlightIndex(i => Math.max(i - 1, 0)); }
                    else if (e.key === 'Enter' && showPartyDropdown && partyHighlightIndex >= 0) { e.preventDefault(); if (partyHighlightIndex === 0) { setForm({ ...form, partnerAccountId: '', party: '' }); setPartySearch(''); } else if (partyHighlightIndex - 1 < filteredParties.length) { const p = filteredParties[partyHighlightIndex - 1]; if (p) { setForm({ ...form, partnerAccountId: p.id, party: p.name }); setPartySearch(p.name); } } else { setShowCreateParty(partySearch); setPartySearch(''); } setShowPartyDropdown(false); setPartyHighlightIndex(-1); }
                    else if (e.key === 'Escape') { setShowPartyDropdown(false); setPartyHighlightIndex(-1); }
                  }}
                  placeholder="Search or type party name"
                  className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-brand-muted outline-none focus:ring-2 focus:ring-brand" />
                {showPartyDropdown && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white dark:bg-[#2A2522] border border-slate-200 dark:border-brand-muted rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    <button type="button"
                      onClick={() => { setForm({ ...form, partnerAccountId: '', party: '' }); setPartySearch(''); setShowPartyDropdown(false); setPartyHighlightIndex(-1); }}
                      onMouseEnter={() => setPartyHighlightIndex(0)}
                      className={cn("w-full px-4 py-2 text-left text-sm transition-colors", partyHighlightIndex === 0 ? "bg-brand-secondary dark:bg-brand-muted/30" : "hover:bg-brand-secondary dark:hover:bg-brand-muted/30")}>
                      None
                    </button>
                    {filteredParties.map((p, i) => (
                      <button key={p.id} type="button"
                        onClick={() => { setForm({ ...form, partnerAccountId: p.id, party: p.name }); setPartySearch(p.name); setShowPartyDropdown(false); setPartyHighlightIndex(-1); }}
                        onMouseEnter={() => setPartyHighlightIndex(i + 1)}
                        className={cn("w-full px-4 py-2 text-left text-sm transition-colors", partyHighlightIndex === i + 1 ? "bg-brand-secondary dark:bg-brand-muted/30" : "hover:bg-brand-secondary dark:hover:bg-brand-muted/30")}>
                        {p.name}
                      </button>
                    ))}
                    {partySearch && !filteredParties.some(p => p.name.toLowerCase() === partySearch.toLowerCase()) && (
                      <button type="button"
                        onClick={() => { setShowCreateParty(partySearch); setPartySearch(''); setShowPartyDropdown(false); setPartyHighlightIndex(-1); }}
                        onMouseEnter={() => setPartyHighlightIndex(1 + filteredParties.length)}
                        className={cn("w-full px-4 py-2 text-left text-sm text-brand font-medium transition-colors", partyHighlightIndex === 1 + filteredParties.length ? "bg-brand-secondary dark:bg-brand-muted/30" : "hover:bg-brand-secondary dark:hover:bg-brand-muted/30")}>
                        Create Party "{partySearch}"
                      </button>
                    )}
                  </div>
                )}
              </div>
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
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm flex items-start sm:items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white dark:bg-[#2A2522] rounded-2xl max-w-lg w-full p-8 shadow-2xl my-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-6">Edit {title === 'Income' ? 'Income' : title.replace(/s$/, '')}</h2>
            <form onSubmit={(e) => { e.preventDefault(); handleEdit(); }} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block">Amount (₹)</label>
                <input required type="number" min="0" step="0.01" value={editForm.amount} onChange={e => setEditForm({ ...editForm, amount: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-brand-muted outline-none focus:ring-2 focus:ring-brand" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 relative" ref={editCategoryRef}>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block">Category</label>
                  <input
                    required
                    value={editForm.category}
                    onChange={e => { setEditForm({ ...editForm, category: e.target.value }); setEditCategorySearch(e.target.value); setShowEditCategoryDropdown(true); setEditCatHighlightIndex(-1); }}
                    onFocus={() => setShowEditCategoryDropdown(true)}
                    onKeyDown={e => {
                      const totalItems = filteredEditCategories.length + (editCategorySearch && !filteredEditCategories.includes(editCategorySearch) ? 1 : 0);
                      if (e.key === 'ArrowDown') { e.preventDefault(); setShowEditCategoryDropdown(true); setEditCatHighlightIndex(i => Math.min(i + 1, totalItems - 1)); }
                      else if (e.key === 'ArrowUp') { e.preventDefault(); setEditCatHighlightIndex(i => Math.max(i - 1, 0)); }
                      else if (e.key === 'Enter' && showEditCategoryDropdown && editCatHighlightIndex >= 0) { e.preventDefault(); if (editCatHighlightIndex < filteredEditCategories.length) { setEditForm({ ...editForm, category: filteredEditCategories[editCatHighlightIndex] }); } else { setEditForm({ ...editForm, category: editCategorySearch }); } setShowEditCategoryDropdown(false); setEditCategorySearch(''); setEditCatHighlightIndex(-1); }
                      else if (e.key === 'Escape') { setShowEditCategoryDropdown(false); setEditCatHighlightIndex(-1); }
                    }}
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-brand-muted outline-none focus:ring-2 focus:ring-brand"
                    placeholder="Search or type new"
                  />
                  {showEditCategoryDropdown && (
                    <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white dark:bg-[#2A2522] border border-slate-200 dark:border-brand-muted rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {filteredEditCategories.map((c, i) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => { setEditForm({ ...editForm, category: c }); setShowEditCategoryDropdown(false); setEditCategorySearch(''); setEditCatHighlightIndex(-1); }}
                          onMouseEnter={() => setEditCatHighlightIndex(i)}
                          className={cn("w-full px-4 py-2 text-left text-sm transition-colors", editCatHighlightIndex === i ? "bg-brand-secondary dark:bg-brand-muted/30" : "hover:bg-brand-secondary dark:hover:bg-brand-muted/30", editForm.category === c && "font-medium")}
                        >
                          {c}
                        </button>
                      ))}
                      {editCategorySearch && !filteredEditCategories.includes(editCategorySearch) && (
                        <button
                          type="button"
                          onClick={() => { setEditForm({ ...editForm, category: editCategorySearch }); setShowEditCategoryDropdown(false); setEditCategorySearch(''); setEditCatHighlightIndex(-1); }}
                          onMouseEnter={() => setEditCatHighlightIndex(filteredEditCategories.length)}
                          className={cn("w-full px-4 py-2 text-left text-sm text-brand font-medium transition-colors", editCatHighlightIndex === filteredEditCategories.length ? "bg-brand-secondary dark:bg-brand-muted/30" : "hover:bg-brand-secondary dark:hover:bg-brand-muted/30")}
                        >
                          + Create "{editCategorySearch}"
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block">Date</label>
                  <input required type="date" max={todayStr()} value={editForm.date} onChange={e => setEditForm({ ...editForm, date: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-brand-muted outline-none focus:ring-2 focus:ring-brand" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block">Description</label>
                <input value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-brand-muted outline-none focus:ring-2 focus:ring-brand" />
              </div>
              {(editForm.category === 'Mutual Funds' || editForm.category === 'FD' || editForm.category === 'Fixed Deposit' || editForm.category === 'Stocks') && type === 'investment' && (
              <div className="space-y-4 p-4 bg-slate-50 dark:bg-brand-muted/20 rounded-xl border border-slate-200 dark:border-brand-muted">
                <button type="button" onClick={() => setShowEditInvestDetails(!showEditInvestDetails)}
                  className="w-full flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-brand">
                  <span>{editForm.category} Details</span>
                  <svg className={cn("h-4 w-4 transition-transform", showEditInvestDetails && "rotate-180")} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>
                {showEditInvestDetails && (
                  <>
                  {editForm.category === 'Mutual Funds' && (
                    <>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block">Fund Name</label>
                      <input value={editInvestMeta.fundName} onChange={e => setEditInvestMeta({ ...editInvestMeta, fundName: e.target.value })}
                        className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-brand-muted outline-none focus:ring-2 focus:ring-brand" placeholder="e.g. HDFC Mid-Cap Opportunities Fund" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block">NAV (₹)</label>
                        <input type="number" step="0.001" min="0" value={editInvestMeta.nav} onChange={e => setEditInvestMeta({ ...editInvestMeta, nav: e.target.value })}
                          className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-brand-muted outline-none focus:ring-2 focus:ring-brand" placeholder="0.00" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block">Units</label>
                        <input type="number" step="0.001" min="0" value={editInvestMeta.units} onChange={e => setEditInvestMeta({ ...editInvestMeta, units: e.target.value })}
                          className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-brand-muted outline-none focus:ring-2 focus:ring-brand" placeholder="Auto" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block">Mode</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button type="button" onClick={() => setEditInvestMeta({ ...editInvestMeta, mode: 'lumpsum' })}
                          className={cn("px-4 py-2 rounded-lg text-sm font-medium border transition-colors", editInvestMeta.mode === 'lumpsum' ? "bg-brand text-white border-brand" : "bg-white dark:bg-brand-dark text-slate-600 dark:text-slate-300 border-slate-200 dark:border-brand-muted")}>
                          Lumpsum
                        </button>
                        <button type="button" onClick={() => setEditInvestMeta({ ...editInvestMeta, mode: 'sip' })}
                          className={cn("px-4 py-2 rounded-lg text-sm font-medium border transition-colors", editInvestMeta.mode === 'sip' ? "bg-brand text-white border-brand" : "bg-white dark:bg-brand-dark text-slate-600 dark:text-slate-300 border-slate-200 dark:border-brand-muted")}>
                          SIP
                        </button>
                      </div>
                    </div>
                    </>
                  )}

                  {(editForm.category === 'FD' || editForm.category === 'Fixed Deposit') && (
                    <>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block">Type of FD</label>
                      <select value={editInvestMeta.fdType} onChange={e => setEditInvestMeta({ ...editInvestMeta, fdType: e.target.value })}
                        className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-brand-muted outline-none focus:ring-2 focus:ring-brand">
                        <option value="cumulative">Cumulative</option>
                        <option value="quarterly">Quarterly Payout</option>
                        <option value="monthly">Monthly Payout</option>
                        <option value="tax_saver">Tax Saver</option>
                        <option value="senior">Senior Citizen</option>
                        <option value="corporate">Corporate FD</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block">Institution / Bank</label>
                      <input value={editInvestMeta.institution} onChange={e => setEditInvestMeta({ ...editInvestMeta, institution: e.target.value })}
                        className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-brand-muted outline-none focus:ring-2 focus:ring-brand" placeholder="e.g. SBI, HDFC Bank" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block">Interest Rate (%)</label>
                        <input type="number" step="0.1" min="0" value={editInvestMeta.interestRate} onChange={e => setEditInvestMeta({ ...editInvestMeta, interestRate: e.target.value })}
                          className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-brand-muted outline-none focus:ring-2 focus:ring-brand" placeholder="e.g. 7.5" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block">Tenure (months)</label>
                        <input type="number" min="0" value={editInvestMeta.tenure} onChange={e => setEditInvestMeta({ ...editInvestMeta, tenure: e.target.value })}
                          className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-brand-muted outline-none focus:ring-2 focus:ring-brand" placeholder="e.g. 12" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block">FD Number</label>
                        <input value={editInvestMeta.fdNumber} onChange={e => setEditInvestMeta({ ...editInvestMeta, fdNumber: e.target.value })}
                          className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-brand-muted outline-none focus:ring-2 focus:ring-brand" placeholder="Receipt/ref number" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block">Maturity Date</label>
                        <input type="date" value={editInvestMeta.maturityDate} onChange={e => setEditInvestMeta({ ...editInvestMeta, maturityDate: e.target.value })}
                          className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-brand-muted outline-none focus:ring-2 focus:ring-brand" />
                      </div>
                    </div>
                    {Number(editForm.amount) > 0 && Number(editInvestMeta.interestRate) > 0 && Number(editInvestMeta.tenure) > 0 && (
                      <div className="bg-brand-light dark:bg-brand-muted/20 rounded-lg p-3 text-sm">
                        <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                          <span>Maturity Amount (approx)</span>
                          <span className="font-bold text-slate-900 dark:text-slate-100">
                            ₹{Math.round(Number(editForm.amount) * Math.pow(1 + (Number(editInvestMeta.interestRate) / 100) / 4, (Number(editInvestMeta.tenure) / 12) * 4)).toLocaleString()}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs text-slate-400 mt-1">
                          <span>Interest earned</span>
                          <span className="text-green-600">+₹{Math.round(Number(editForm.amount) * Math.pow(1 + (Number(editInvestMeta.interestRate) / 100) / 4, (Number(editInvestMeta.tenure) / 12) * 4) - Number(editForm.amount)).toLocaleString()}</span>
                        </div>
                      </div>
                    )}
                    </>
                  )}

                  {editForm.category === 'Stocks' && (
                    <>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block">Company / Script</label>
                      <input value={editInvestMeta.company} onChange={e => setEditInvestMeta({ ...editInvestMeta, company: e.target.value })}
                        className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-brand-muted outline-none focus:ring-2 focus:ring-brand" placeholder="e.g. Reliance Industries" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block">Quantity</label>
                        <input type="number" min="0" value={editInvestMeta.quantity} onChange={e => setEditInvestMeta({ ...editInvestMeta, quantity: e.target.value })}
                          className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-brand-muted outline-none focus:ring-2 focus:ring-brand" placeholder="e.g. 10" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block">Buy Price (₹)</label>
                        <input type="number" step="0.01" min="0" value={editInvestMeta.buyPrice} onChange={e => setEditInvestMeta({ ...editInvestMeta, buyPrice: e.target.value })}
                          className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-brand-muted outline-none focus:ring-2 focus:ring-brand" placeholder="e.g. 2500.50" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block">Exchange</label>
                        <div className="grid grid-cols-2 gap-2">
                          <button type="button" onClick={() => setEditInvestMeta({ ...editInvestMeta, exchange: 'NSE' })}
                            className={cn("px-4 py-2 rounded-lg text-sm font-medium border transition-colors", editInvestMeta.exchange === 'NSE' ? "bg-brand text-white border-brand" : "bg-white dark:bg-brand-dark text-slate-600 dark:text-slate-300 border-slate-200 dark:border-brand-muted")}>
                            NSE
                          </button>
                          <button type="button" onClick={() => setEditInvestMeta({ ...editInvestMeta, exchange: 'BSE' })}
                            className={cn("px-4 py-2 rounded-lg text-sm font-medium border transition-colors", editInvestMeta.exchange === 'BSE' ? "bg-brand text-white border-brand" : "bg-white dark:bg-brand-dark text-slate-600 dark:text-slate-300 border-slate-200 dark:border-brand-muted")}>
                            BSE
                          </button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block">Mode</label>
                        <div className="grid grid-cols-2 gap-2">
                          <button type="button" onClick={() => setEditInvestMeta({ ...editInvestMeta, stockMode: 'delivery' })}
                            className={cn("px-4 py-2 rounded-lg text-sm font-medium border transition-colors", editInvestMeta.stockMode === 'delivery' ? "bg-brand text-white border-brand" : "bg-white dark:bg-brand-dark text-slate-600 dark:text-slate-300 border-slate-200 dark:border-brand-muted")}>
                            Delivery
                          </button>
                          <button type="button" onClick={() => setEditInvestMeta({ ...editInvestMeta, stockMode: 'intraday' })}
                            className={cn("px-4 py-2 rounded-lg text-sm font-medium border transition-colors", editInvestMeta.stockMode === 'intraday' ? "bg-brand text-white border-brand" : "bg-white dark:bg-brand-dark text-slate-600 dark:text-slate-300 border-slate-200 dark:border-brand-muted")}>
                            Intraday
                          </button>
                        </div>
                      </div>
                    </div>
                    </>
                  )}
                  </>
                )}
              </div>
              )}
              <div className="space-y-2 relative">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block">Party (Optional)</label>
                <input value={partyFocused && !editForm.party && !partySearch ? '' : (partySearch || editForm.party || 'None')} onChange={e => { setEditForm({ ...editForm, party: e.target.value, partnerAccountId: '' }); setPartySearch(e.target.value); setShowPartyDropdown(true); setPartyHighlightIndex(-1); }}
                  onFocus={() => { setPartyFocused(true); setShowPartyDropdown(true); }}
                  onBlur={() => { if (!partySearch && !editForm.party) setPartyFocused(false); }}
                  onKeyDown={e => {
                    const totalItems = 1 + filteredParties.length + (editForm.party && !filteredParties.some(p => p.name.toLowerCase() === editForm.party.toLowerCase()) ? 1 : 0);
                    if (e.key === 'ArrowDown') { e.preventDefault(); setShowPartyDropdown(true); setPartyHighlightIndex(i => Math.min(i + 1, totalItems - 1)); }
                    else if (e.key === 'ArrowUp') { e.preventDefault(); setPartyHighlightIndex(i => Math.max(i - 1, 0)); }
                    else if (e.key === 'Enter' && showPartyDropdown && partyHighlightIndex >= 0) { e.preventDefault(); if (partyHighlightIndex === 0) { setEditForm({ ...editForm, partnerAccountId: '', party: '' }); } else if (partyHighlightIndex - 1 < filteredParties.length) { const p = filteredParties[partyHighlightIndex - 1]; if (p) { setEditForm({ ...editForm, partnerAccountId: p.id, party: p.name }); } } else { setShowCreateParty(editForm.party); setEditForm({ ...editForm, party: '' }); } setShowPartyDropdown(false); setPartyHighlightIndex(-1); }
                    else if (e.key === 'Escape') { setShowPartyDropdown(false); setPartyHighlightIndex(-1); }
                  }}
                  placeholder="Search or type party name"
                  className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-brand-muted outline-none focus:ring-2 focus:ring-brand" />
                {showPartyDropdown && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white dark:bg-[#2A2522] border border-slate-200 dark:border-brand-muted rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    <button type="button"
                      onClick={() => { setEditForm({ ...editForm, partnerAccountId: '', party: '' }); setShowPartyDropdown(false); setPartyHighlightIndex(-1); }}
                      onMouseEnter={() => setPartyHighlightIndex(0)}
                      className={cn("w-full px-4 py-2 text-left text-sm transition-colors", partyHighlightIndex === 0 ? "bg-brand-secondary dark:bg-brand-muted/30" : "hover:bg-brand-secondary dark:hover:bg-brand-muted/30")}>
                      None
                    </button>
                    {filteredParties.map((p, i) => (
                      <button key={p.id} type="button"
                        onClick={() => { setEditForm({ ...editForm, partnerAccountId: p.id, party: p.name }); setShowPartyDropdown(false); setPartyHighlightIndex(-1); }}
                        onMouseEnter={() => setPartyHighlightIndex(i + 1)}
                        className={cn("w-full px-4 py-2 text-left text-sm transition-colors", partyHighlightIndex === i + 1 ? "bg-brand-secondary dark:bg-brand-muted/30" : "hover:bg-brand-secondary dark:hover:bg-brand-muted/30")}>
                        {p.name}
                      </button>
                    ))}
                    {editForm.party && !filteredParties.some(p => p.name.toLowerCase() === editForm.party.toLowerCase()) && (
                      <button type="button"
                        onClick={() => { setShowCreateParty(editForm.party); setEditForm({ ...editForm, party: '' }); setShowPartyDropdown(false); setPartyHighlightIndex(-1); }}
                        onMouseEnter={() => setPartyHighlightIndex(1 + filteredParties.length)}
                        className={cn("w-full px-4 py-2 text-left text-sm text-brand font-medium transition-colors", partyHighlightIndex === 1 + filteredParties.length ? "bg-brand-secondary dark:bg-brand-muted/30" : "hover:bg-brand-secondary dark:hover:bg-brand-muted/30")}>
                        Create Party "{editForm.party}"
                      </button>
                    )}
                  </div>
                )}
              </div>
              <div className="flex items-center justify-end gap-2 pt-6">
                <Button variant="ghost" size="sm" type="button" onClick={() => setEditingTransaction(null)}>Cancel</Button>
                <Button type="submit" size="sm">Save Changes</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Party Modal */}
      {showCreateParty && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm flex items-start sm:items-center justify-center z-[60] p-4 overflow-y-auto">
          <div className="bg-white dark:bg-[#2A2522] rounded-2xl max-w-lg w-full p-6 shadow-2xl my-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-1">New Party</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Creating "<span className="font-medium text-slate-700 dark:text-slate-300">{showCreateParty}</span>"</p>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-1">Group</label>
                  <select value={createPartyForm.group} onChange={e => { const g = e.target.value as 'vendor' | 'customer' | 'contact'; setCreatePartyForm({ ...createPartyForm, group: g, type: PARTY_TYPES[g]?.[0]?.value || 'other' }); }}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-brand-muted text-sm outline-none focus:ring-2 focus:ring-brand">
                    <option value="contact">Contact</option>
                    <option value="vendor">Vendor</option>
                    <option value="customer">Customer</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-1">Type</label>
                  <select value={createPartyForm.type} onChange={e => setCreatePartyForm({ ...createPartyForm, type: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-brand-muted text-sm outline-none focus:ring-2 focus:ring-brand">
                    {(PARTY_TYPES[createPartyForm.group] || PARTY_TYPES.contact).map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-1">Description (optional)</label>
                <input value={createPartyForm.description} onChange={e => setCreatePartyForm({ ...createPartyForm, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-brand-muted text-sm outline-none focus:ring-2 focus:ring-brand" placeholder="Optional notes..." />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" size="sm" onClick={() => { setShowCreateParty(null); setCreatePartyForm({ group: 'contact', type: 'individual', description: '' }); }}>Cancel</Button>
                <Button size="sm" onClick={handleCreateParty}>Create & Select</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Duplicate Warning */}
      {dupWarning && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-start sm:items-center justify-center z-50 p-4 overflow-y-auto">
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

      {/* Detail Modal */}
      {showDetail && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#2A2522] w-full max-w-sm rounded-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-brand-muted">
              <h2 className="font-semibold text-slate-900 dark:text-slate-100">Transaction Details</h2>
              <button onClick={() => setShowDetail(null)} className="p-1 text-slate-400"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-4 space-y-3 text-sm">
              <div className={cn("p-3 rounded-xl text-center", type === 'income' ? "bg-green-50 dark:bg-green-900/20" : "bg-red-50 dark:bg-red-900/20")}>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{showDetail.type}</p>
                <p className={cn("text-2xl font-bold", type === 'income' ? "text-green-600" : "text-red-600")}>
                  {type === 'income' ? '+' : '-'}{formatCurrency(showDetail.amount)}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-brand-muted/20">
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Category</p>
                  <p className="font-medium text-slate-900 dark:text-slate-100">{showDetail.category}</p>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-brand-muted/20">
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Date</p>
                  <p className="font-medium text-slate-900 dark:text-slate-100">{showDetail.date}</p>
                </div>
              </div>
              {showDetail.description && (
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-brand-muted/20">
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Description</p>
                  <p className="font-medium text-slate-900 dark:text-slate-100">{showDetail.description}</p>
                </div>
              )}
              {showDetail.partnerAccountId && (
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-brand-muted/20">
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Party</p>
                  <p className="font-medium text-slate-900 dark:text-slate-100">{partners.find(p => p.id === showDetail.partnerAccountId)?.name || 'Unknown'}</p>
                </div>
              )}
              {'account' in showDetail && showDetail.account && (
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-brand-muted/20">
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Source Account</p>
                  <p className="font-medium text-slate-900 dark:text-slate-100 capitalize">{(showDetail as any).account}</p>
                </div>
              )}
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

      {showCalculator && (
        <InvestmentCalculator onClose={() => setShowCalculator(false)} onApply={(amount) => {
          setForm({ ...form, amount: String(amount) });
          setShowCalculator(false);
        }} />
      )}

      {partyWarn && (
        <div className="fixed bottom-6 right-6 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-xl px-4 py-3 shadow-lg z-50 text-sm text-amber-800 dark:text-amber-200 max-w-xs">
          {partyWarn}
        </div>
      )}
    </DashboardLayout>
  );
}
