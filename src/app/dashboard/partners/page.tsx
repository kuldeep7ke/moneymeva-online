'use client';

import React, { useState, useEffect, useMemo } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Plus, Wallet, TrendingUp, TrendingDown, Trash2, X, AlertTriangle, Pencil } from 'lucide-react';
import { formatCurrency, cn, todayStr } from '@/lib/utils';
import { getPartners, addPartner, deletePartner, updatePartner, getPartnerPnL, getTransactions, addTransaction, checkDuplicateTransaction, isStoreReady } from '@/lib/store';
import PinPrompt from '@/components/PinPrompt';
import PinSetupGuide from '@/components/PinSetupGuide';
import { hasPins } from '@/lib/pinStore';
import { logActivity } from '@/lib/activityLog';
import Reveal from '@/components/Reveal';
import { useToast } from '@/components/Toast';
import PartnershipTab from '@/components/PartnershipTab';
import { useTranslation } from '@/lib/i18n';

const PARTY_TYPES_BY_GROUP: Record<string, { value: string; label: string }[]> = {
  vendor: [
    { value: 'supplier', label: 'Supplier' },
    { value: 'wholesaler', label: 'Wholesaler' },
    { value: 'contractor', label: 'Contractor' },
    { value: 'service_provider', label: 'Service Provider' },
    { value: 'manufacturer', label: 'Manufacturer' },
    { value: 'freelancer', label: 'Freelancer' },
    { value: 'shop', label: 'Shop / Retailer' },
    { value: 'other', label: 'Other' },
  ],
  customer: [
    { value: 'client', label: 'Client' },
    { value: 'retail', label: 'Retail Customer' },
    { value: 'wholesale_buyer', label: 'Wholesale Buyer' },
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
    { value: 'partner', label: 'Joint Venture Partner' },
    { value: 'consultant', label: 'Consultant' },
    { value: 'other', label: 'Other' },
  ],
};

export default function PartnersPage() {
  const toast = useToast();
  const { t } = useTranslation();
  const [pTab, setPTab] = useState<'accounts' | 'partnership'>(() => {
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('tab') === 'partnership') return 'partnership';
    return 'accounts';
  });
  const [partners, setPartners] = useState<any[]>([]);
  
  const refresh = () => {
    if (!isStoreReady()) return;
    setPartners(getPartners().map(p => ({ ...p, ...getPartnerPnL(p.id) })));
  };

  useEffect(() => {
    refresh();
    const onReady = () => refresh();
    window.addEventListener('store-ready', onReady);
    return () => window.removeEventListener('store-ready', onReady);
  }, []);

  const [activeGroup, setActiveGroup] = useState<'all' | 'customer' | 'vendor' | 'contact'>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showTxModal, setShowTxModal] = useState<string | null>(null);
  const [showLedger, setShowLedger] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [pinDeleteId, setPinDeleteId] = useState<string | null>(null);
  const [showPinSetup, setShowPinSetup] = useState<string | null>(null);
  const [dupWarning, setDupWarning] = useState<any | null>(null);

  const [form, setForm] = useState({ name: '', type: 'supplier', group: 'vendor' as 'customer' | 'vendor' | 'contact', description: '', budgetWindowStart: '', budgetWindowEnd: '', initialInvestment: '' });
  const [txForm, setTxForm] = useState({ amount: '', type: 'income' as 'income' | 'expense', category: '', description: '', date: todayStr() });

  const filteredPartners = activeGroup === 'all' ? partners : partners.filter(p => p.group === activeGroup);

  const partnerTransactions = useMemo(() => {
    if (!showLedger) return [];
    return getTransactions().filter(t => t.partnerAccountId === showLedger).sort((a, b) => b.date.localeCompare(a.date));
  }, [showLedger, partners]);

  const partnerSummary = useMemo(() => {
    if (!showLedger) return null;
    const p = partners.find(p => p.id === showLedger);
    if (!p) return null;
    const txs = partnerTransactions;
    const income = txs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const expense = txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    return { ...p, income, expense, net: income - expense, count: txs.length };
  }, [showLedger, partnerTransactions, partners]);

  const [partyWarn, setPartyWarn] = useState<string | null>(null);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const existing = getPartners().find((p: any) => !p.deletedAt && p.id !== editingId && p.name.toLowerCase() === form.name.trim().toLowerCase());
    if (existing) {
      setPartyWarn(`"${existing.name}" already exists`);
      setTimeout(() => setPartyWarn(null), 3000);
      return;
    }
    const partner = {
      name: form.name,
      type: form.type,
      group: form.group,
      description: form.description,
      budgetWindowStart: form.budgetWindowStart,
      budgetWindowEnd: form.budgetWindowEnd,
      initialInvestment: Number(form.initialInvestment) || 0,
    };
    if (editingId) {
      updatePartner(editingId, partner);
      toast('Party updated.', 'success');
    } else {
      addPartner(partner);
    }
    setShowAddModal(false);
    setEditingId(null);
    setForm({ name: '', type: 'supplier', group: 'vendor', description: '', budgetWindowStart: '', budgetWindowEnd: '', initialInvestment: '' });
    refresh();
  };

  const handleEditClick = (p: any) => {
    setEditingId(p.id);
    setForm({ name: p.name, type: p.type || 'supplier', group: p.group || 'vendor', description: p.description || '', budgetWindowStart: p.budgetWindowStart || '', budgetWindowEnd: p.budgetWindowEnd || '', initialInvestment: p.initialInvestment ? String(p.initialInvestment) : '' });
    setShowAddModal(true);
  };

  const handleAddTx = (e: React.FormEvent) => {
    e.preventDefault();
    if (!showTxModal) return;
    const amount = Number(txForm.amount);
    if (!(amount > 0)) { toast('Amount must be greater than zero.', 'warning'); return; }
    const date = txForm.date;
    if (date > todayStr()) { toast('Cannot add entries with future dates.', 'warning'); return; }
    const tx = { amount, type: txForm.type, category: txForm.category, description: txForm.description, date, partnerAccountId: showTxModal };
    const dup = checkDuplicateTransaction(tx);
    if (dup) {
      setDupWarning({ ...tx, existing: dup });
      return;
    }
    addTransaction({ ...tx, isRecurring: false });
    toast(`${txForm.type[0].toUpperCase() + txForm.type.slice(1)} added · ${txForm.category} · ${formatCurrency(amount)}`, 'success');

    setShowTxModal(null);
    setTxForm({ amount: '', type: 'income', category: '', description: '', date: todayStr() });
    refresh();
  };

  const handleDupConfirm = () => {
    if (!dupWarning) return;
    const amount = dupWarning.amount;
    if (!(amount > 0)) return;
    addTransaction({ amount, type: dupWarning.type, category: dupWarning.category, description: dupWarning.description, date: dupWarning.date, partnerAccountId: dupWarning.partnerAccountId, isRecurring: false });
    toast(`${dupWarning.type[0].toUpperCase() + dupWarning.type.slice(1)} added · ${dupWarning.category} · ${formatCurrency(amount)}`, 'success');

    setDupWarning(null);
    setShowTxModal(null);
    setTxForm({ amount: '', type: 'income', category: '', description: '', date: todayStr() });
    refresh();
  };

  const handleDelete = (id: string) => {
    const partner = partners.find(p => p.id === id);
    const createdToday = partner && partner.createdAt?.split('T')[0] === todayStr();
    if (createdToday) {
      doDelete(id);
    } else if (hasPins()) {
      setPinDeleteId(id);
    } else {
      setShowPinSetup('delete a partner account');
    }
  };

  const doDelete = (id: string) => {
    const partner = partners.find(p => p.id === id);
    const linkedCount = getTransactions().filter(t => t.partnerAccountId === id && !t.deletedAt).length;
    deletePartner(id);
    if (linkedCount > 0) toast(`${linkedCount} linked transaction(s) will remain but this party will be removed.`, 'warning');
    setConfirmDelete(null);
    refresh();
  };

  const totalInvested = partners.reduce((s, p) => s + (p.initialInvestment || 0), 0);
  const totalValue = partners.reduce((s, p) => s + ((p.initialInvestment || 0) + (p.net || 0)), 0);

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Accounts / Partnership segmented control */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-brand-muted/40 rounded-xl p-1 w-fit">
          <button type="button" onClick={() => setPTab('accounts')}
            className={cn("px-4 py-2 rounded-lg text-sm font-medium transition-colors", pTab === 'accounts' ? "bg-white dark:bg-[#2A2522] text-slate-900 dark:text-slate-100 shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300")}>
            {t('ps.tabAccounts')}
          </button>
          <button type="button" onClick={() => setPTab('partnership')}
            className={cn("px-4 py-2 rounded-lg text-sm font-medium transition-colors", pTab === 'partnership' ? "bg-white dark:bg-[#2A2522] text-slate-900 dark:text-slate-100 shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300")}>
            {t('ps.tabPartnership')}
          </button>
        </div>

        {pTab === 'accounts' && (<>
        <Reveal>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 hidden md:block">Party Accounts</h1>
              <p className="text-slate-500 dark:text-slate-400 text-base font-semibold md:font-normal md:text-sm block md:hidden">{"Track your joint ventures and project budgets.".split(' ').slice(0, 5).join(' ')}{"Track your joint ventures and project budgets.".split(' ').length > 5 ? '...' : ''}</p>
              <p className="text-slate-500 dark:text-slate-400 hidden md:block">Track your joint ventures and project budgets.</p>
            </div>
            {pTab === 'accounts' && (
              <button onClick={() => { setEditingId(null); setShowAddModal(true); }} className="h-10 w-10 rounded-xl bg-brand text-white flex items-center justify-center hover:bg-orange-600 transition-colors active:scale-95 shrink-0" type="button" title="Add Party Account">
                <Plus className="h-5 w-5" />
              </button>
            )}
          </div>
        </Reveal>

        <Reveal delay={100}>
        {partners.length > 0 && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-gradient-to-br from-brand to-purple-600 p-5 rounded-2xl shadow-lg text-white">
                <p className="text-sm opacity-80 mb-1">Total Invested</p>
                <p className="text-2xl font-bold">{formatCurrency(totalInvested)}</p>
                <p className="text-xs opacity-60 mt-1">Across {partners.length} partner account{partners.length > 1 ? 's' : ''}</p>
              </div>
              <div className="bg-white dark:bg-[#2A2522] p-5 rounded-2xl border border-slate-200 dark:border-brand-muted shadow-sm">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Net P&L</p>
                <p className={cn("text-2xl font-bold", totalValue - totalInvested >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400")}>
                  {formatCurrency(totalValue - totalInvested)}
                </p>
              </div>
              <div className="bg-white dark:bg-[#2A2522] p-5 rounded-2xl border border-slate-200 dark:border-brand-muted shadow-sm">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Total Portfolio Value</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{formatCurrency(totalValue)}</p>
              </div>
            </div>

            {/* Group Tabs */}
            <div className="flex items-center justify-center md:justify-start gap-2 flex-wrap mb-6">
              {[
                { key: 'all', label: 'All' },
                { key: 'vendor', label: 'Vendors' },
                { key: 'customer', label: 'Customers' },
                { key: 'contact', label: 'Contacts' },
              ].map(g => (
                <button key={g.key} onClick={() => setActiveGroup(g.key as any)}
                  className={cn("px-3 py-2 md:px-4 md:py-2 rounded-lg md:rounded-xl text-xs md:text-sm font-medium transition-colors",
                    activeGroup === g.key ? "bg-brand text-white shadow-sm" : "bg-white dark:bg-[#2A2522] border border-slate-200 dark:border-brand-muted text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                  )}>
                  {g.label}
                </button>
              ))}
            </div>
          </>
        )}

        {partners.length === 0 && (
          <div className="bg-white dark:bg-[#2A2522] rounded-2xl border border-slate-200 dark:border-brand-muted shadow-sm p-12 text-center">
            <Wallet className="h-12 w-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300 mb-2">No partner accounts yet</h3>
             <p className="text-slate-400 dark:text-slate-500 mb-6">Create a partnership to track shared budgets and P&L.</p>
            <Button onClick={() => setShowAddModal(true)}>Create First Account</Button>
          </div>
        )}

        <Reveal delay={200}>
        <div className="grid grid-cols-1 gap-6">
          {filteredPartners.length === 0 && partners.length > 0 && (
            <div className="bg-white dark:bg-[#2A2522] rounded-2xl border border-slate-200 dark:border-brand-muted shadow-sm p-8 text-center">
              <p className="text-slate-400 dark:text-slate-500">No {activeGroup}s found in this group.</p>
            </div>
          )}
          {filteredPartners.map((partner) => (
            <div key={partner.id} className="bg-white dark:bg-[#2A2522] p-6 rounded-2xl border border-slate-200 dark:border-brand-muted shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-brand-secondary dark:bg-brand-muted/30 rounded-xl text-brand dark:text-brand-secondary"><Wallet className="h-6 w-6" /></div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">{partner.name}</h3>
                    <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                      <span className="capitalize px-2 py-0.5 bg-slate-100 dark:bg-brand-muted rounded-full text-xs font-medium">{partner.type}</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" className="p-2 text-slate-400 dark:text-slate-500 hover:text-brand gap-1" onClick={() => handleEditClick(partner)}>
                    <Pencil className="h-4 w-4" />
                    <span className="hidden md:inline text-xs">Edit</span>
                  </Button>
                  {confirmDelete === partner.id ? (
                    <div className="flex gap-1 items-center">
                      <Button size="sm" variant="danger" className="h-6 px-1.5 text-xs min-w-0" onClick={() => handleDelete(partner.id)}>Yes</Button>
                      <Button size="sm" variant="ghost" className="h-6 px-1.5 text-xs min-w-0" onClick={() => setConfirmDelete(null)}>No</Button>
                    </div>
                  ) : (
                    <Button variant="ghost" size="sm" className="p-2 text-slate-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400 gap-1" onClick={() => setConfirmDelete(partner.id)}>
                      <Trash2 className="h-4 w-4" />
                      <span className="hidden md:inline text-xs">Delete</span>
                    </Button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div className="p-4 bg-slate-50 dark:bg-brand-muted rounded-xl border border-slate-100 dark:border-brand-muted">
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-1">Investment</p>
                  <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{formatCurrency(partner.initialInvestment)}</p>
                </div>
                <div className="p-4 bg-slate-50 dark:bg-brand-muted rounded-xl border border-slate-100 dark:border-brand-muted">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Net P&L</p>
                    {partner.net >= 0 ? <TrendingUp className="h-3 w-3 text-green-500" /> : <TrendingDown className="h-3 w-3 text-red-500" />}
                  </div>
                  <p className={cn("text-xl font-bold", partner.net >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400")}>{formatCurrency(partner.net)}</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">Income: {formatCurrency(partner.income)} / Expense: {formatCurrency(partner.expense)}</p>
                </div>
                <div className="p-4 bg-slate-50 dark:bg-brand-muted rounded-xl border border-slate-100 dark:border-brand-muted">
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-1">Total Value</p>
                  <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{formatCurrency(partner.initialInvestment + partner.net)}</p>
                </div>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" size="sm" className="gap-2" onClick={() => setShowTxModal(partner.id)}>
                  Add Transaction
                </Button>
                <Button variant="ghost" size="sm" className="ml-auto text-slate-500 dark:text-slate-400" onClick={() => setShowLedger(partner.id)}>
                  View History
                </Button>
              </div>
            </div>
          ))}
        </div>
        </Reveal>
        </Reveal>
        </>)}

        {pTab === 'partnership' && <PartnershipTab />}
      </div>

      {/* Add Partner Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm flex items-start sm:items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white dark:bg-[#2A2522] rounded-2xl max-w-lg w-full p-6 shadow-2xl my-4">
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-4">{editingId ? 'Edit Party' : 'New Party'}</h2>
            <form onSubmit={handleAdd} className="space-y-4">
              <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-brand-muted outline-none focus:ring-2 focus:ring-brand text-base" placeholder="Account name" />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 block mb-1">Group</label>
                  <select value={form.group} onChange={e => { const newGroup = e.target.value as 'vendor' | 'customer' | 'contact'; setForm({ ...form, group: newGroup, type: PARTY_TYPES_BY_GROUP[newGroup]?.[0]?.value || 'other' }); }}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-brand-muted outline-none focus:ring-2 focus:ring-brand text-sm">
                    <option value="contact">Contact</option>
                    <option value="vendor">Vendor</option>
                    <option value="customer">Customer</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 block mb-1">Type</label>
                  <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-brand-muted outline-none focus:ring-2 focus:ring-brand text-sm">
                    {(PARTY_TYPES_BY_GROUP[form.group] || PARTY_TYPES_BY_GROUP.contact).map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 block mb-1">Initial Investment</label>
                <input type="number" min="0" value={form.initialInvestment} onChange={e => setForm({ ...form, initialInvestment: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-brand-muted outline-none focus:ring-2 focus:ring-brand text-sm" placeholder="₹0" />
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 block mb-1">Description</label>
                <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-brand-muted outline-none focus:ring-2 focus:ring-brand text-sm" placeholder="Optional notes..." />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <Button variant="ghost" size="sm" onClick={() => { setShowAddModal(false); setEditingId(null); setForm({ name: '', type: 'supplier', group: 'vendor', description: '', budgetWindowStart: '', budgetWindowEnd: '', initialInvestment: '' }); }}>Cancel</Button>
                <Button type="submit" size="sm">{editingId ? 'Save' : 'Create'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Transaction Modal */}
      {showTxModal && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm flex items-start sm:items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white dark:bg-[#2A2522] rounded-2xl max-w-lg w-full p-8 shadow-2xl my-4">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-6">Add Partner Transaction</h2>
            <form onSubmit={handleAddTx} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block">Type</label>
                  <select value={txForm.type} onChange={e => setTxForm({ ...txForm, type: e.target.value as any })}
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-brand-muted outline-none focus:ring-2 focus:ring-brand">
                    <option value="income">Income</option>
                    <option value="expense">Expense</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block">Amount</label>
                  <input required type="number" min="0" step="0.01" value={txForm.amount} onChange={e => setTxForm({ ...txForm, amount: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-brand-muted outline-none focus:ring-2 focus:ring-brand" placeholder="₹ 0" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block">Custom Category</label>
                  <input required value={txForm.category} onChange={e => setTxForm({ ...txForm, category: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-brand-muted outline-none focus:ring-2 focus:ring-brand" placeholder="Enter category" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block">Date</label>
                  <input required type="date" max={todayStr()} value={txForm.date} onChange={e => setTxForm({ ...txForm, date: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-brand-muted outline-none focus:ring-2 focus:ring-brand" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block">Description</label>
                <input required value={txForm.description} onChange={e => setTxForm({ ...txForm, description: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-brand-muted outline-none focus:ring-2 focus:ring-brand" placeholder="Transaction details" />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <Button variant="ghost" size="sm" onClick={() => setShowTxModal(null)}>Cancel</Button>
                <Button type="submit" size="sm">Save</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Duplicate Warning */}
      {partyWarn && (
        <div className="fixed bottom-6 right-6 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-xl px-4 py-3 shadow-lg z-50 text-sm text-amber-800 dark:text-amber-200 max-w-xs">
          {partyWarn}
        </div>
      )}

      {dupWarning && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-start sm:items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white dark:bg-[#2A2522] rounded-2xl max-w-md w-full p-6 shadow-2xl border-l-4 border-amber-500 my-4">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="h-6 w-6 text-amber-500" />
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Possible Duplicate</h3>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">A similar entry already exists:</p>
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
        open={pinDeleteId !== null}
        onClose={() => setPinDeleteId(null)}
        onSuccess={() => { if (pinDeleteId) doDelete(pinDeleteId); setPinDeleteId(null); }}
        title="Delete Partner"
        message="Enter a PIN to delete this partner account"
      />

      <PinSetupGuide
        open={showPinSetup !== null}
        onClose={() => setShowPinSetup(null)}
        action={showPinSetup || ''}
      />

      {/* Party Ledger Modal */}
      {showLedger && partnerSummary && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#2A2522] w-full max-w-sm rounded-2xl max-h-[80vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-brand-muted">
              <h2 className="font-semibold text-slate-900 dark:text-slate-100">{partnerSummary.name}</h2>
              <button onClick={() => setShowLedger(null)} className="p-1 text-slate-400"><X className="h-5 w-5" /></button>
            </div>
            <div className="flex items-center gap-4 px-4 py-3 bg-slate-50 dark:bg-brand-muted/20 text-sm border-b border-slate-100 dark:border-brand-muted">
              <span className="text-green-600 font-medium">+{formatCurrency(partnerSummary.income)}</span>
              <span className="text-red-600 font-medium">-{formatCurrency(partnerSummary.expense)}</span>
              <span className={cn("font-semibold ml-auto", partnerSummary.net >= 0 ? "text-green-600" : "text-red-600")}>
                Net {formatCurrency(partnerSummary.net)}
              </span>
            </div>
            <div className="flex-1 overflow-y-auto">
              {partnerTransactions.length === 0 ? (
                <div className="p-6 text-center text-sm text-slate-400">No transactions</div>
              ) : (
                <div className="divide-y divide-slate-50 dark:divide-brand-muted">
                  {partnerTransactions.map(t => (
                    <div key={t.id} className="px-4 py-2.5 flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className={cn("shrink-0", t.type === 'income' ? "text-green-500" : "text-red-500")}>
                          {t.type === 'income' ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm text-slate-900 dark:text-slate-100 truncate">{t.description || t.category}</p>
                          <p className="text-[11px] text-slate-400">{t.date}</p>
                        </div>
                      </div>
                      <p className={cn("text-sm font-medium ml-2", t.type === 'income' ? "text-green-600" : "text-red-600")}>
                        {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
