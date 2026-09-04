'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Plus, Repeat, Calendar, Play, Pause, Trash2 } from 'lucide-react';
import { formatCurrency, cn, getSortedCategories, useSortedCategories, todayStr } from '@/lib/utils';
import { getRecurring, addRecurring, updateRecurring, deleteRecurring } from '@/lib/store';
import PinPrompt from '@/components/PinPrompt';
import PinSetupGuide from '@/components/PinSetupGuide';
import { hasPins } from '@/lib/pinStore';
import { logActivity } from '@/lib/activityLog';
import Reveal from '@/components/Reveal';
import SwipeCard from '@/components/SwipeCard';

export default function RecurringPage() {
  const [items, setItems] = useState<any[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [pinDeleteId, setPinDeleteId] = useState<string | null>(null);
  const [showPinSetup, setShowPinSetup] = useState<string | null>(null);

  useEffect(() => { setItems(getRecurring()); }, []);

  const [catSearch, setCatSearch] = useState('');
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [catHighlightIdx, setCatHighlightIdx] = useState(-1);
  const categoryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (categoryRef.current && !categoryRef.current.contains(e.target as Node)) setShowCategoryDropdown(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const [form, setForm] = useState({
    title: '', amount: '', category: '', txType: 'expense' as const, frequency: 'monthly' as const,
    startDate: todayStr(), endDate: '', reminderDays: '3 days',
  });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const next = new Date(form.startDate);
    addRecurring({
      title: form.title,
      amount: Number(form.amount),
      category: form.category,
      txType: form.txType,
      frequency: form.frequency,
      startDate: form.startDate,
      endDate: form.endDate || undefined,
      reminderDays: Number(form.reminderDays.replace(/\D/g, '')) || 0,
      status: 'active',
      nextDate: next.toISOString().split('T')[0],
    });
    setShowAddModal(false);
    setItems(getRecurring());
  };

  const toggleStatus = (id: string, current: string) => {
    updateRecurring(id, { status: current === 'active' ? 'stopped' : 'active' });
    setItems(getRecurring());
  };

  const handleDelete = (id: string) => {
    const item = items.find(i => i.id === id);
    const today = todayStr();
    const createdToday = item && item.createdAt?.split('T')[0] === today;
    if (createdToday) {
      doDelete(id);
    } else if (hasPins()) {
      setPinDeleteId(id);
    } else {
      setShowPinSetup('delete a recurring transaction');
    }
  };

  const doDelete = (id: string) => {
    const item = items.find(i => i.id === id);
    deleteRecurring(id);
    logActivity('entry_deleted', `Recurring — ${item?.title || 'Unknown'}`);
    setConfirmDelete(null);
    setItems(getRecurring());
  };

  const categories = useSortedCategories(['Bills', 'Premium', 'Prepaid', 'Add-ons', 'Subscription', 'Shopping', 'Credit Card', 'Rent', 'Insurance'], 'expense');

  const filteredCategories = useMemo(() => {
    if (!catSearch) return categories.slice(0, 3);
    return categories.filter(c => c.toLowerCase().includes(catSearch.toLowerCase()));
  }, [categories, catSearch]);

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <Reveal><div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 hidden md:block">Recurring Transactions</h1>
            <p className="text-slate-500 dark:text-slate-400 text-base font-semibold md:font-normal md:text-sm block md:hidden">{"Automate your bills, premiums, and subscriptions".split(' ').slice(0, 5).join(' ')}{"Automate your bills, premiums, and subscriptions".split(' ').length > 5 ? '...' : ''}</p>
            <p className="text-slate-500 dark:text-slate-400 hidden md:block">Automate your bills, premiums, and subscriptions</p>
          </div>
          <button onClick={() => setShowAddModal(true)} className="h-10 w-10 rounded-xl bg-brand text-white flex items-center justify-center hover:bg-orange-600 transition-colors active:scale-95 shrink-0" type="button" title="New Automation"><Plus className="h-5 w-5" /></button>
        </div></Reveal>

        <Reveal delay={100}>{items.length === 0 ? (
          <div className="bg-white dark:bg-[#2A2522] rounded-2xl border border-slate-200 dark:border-brand-muted shadow-sm p-12 text-center">
            <Repeat className="h-12 w-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300 mb-2">No recurring transactions</h3>
            <p className="text-slate-400 dark:text-slate-500 mb-6">Automate bills, subscriptions, and regular payments</p>
            <Button onClick={() => setShowAddModal(true)}>Create First Automation</Button>
          </div>
        ) : (
          <>
            {/* Mobile: Swipe Cards */}
            <div className="md:hidden space-y-3">
              {items.map(item => (
                <SwipeCard
                  key={item.id}
                  actions={
                    <>
                      <button
                        onClick={() => toggleStatus(item.id, item.status)}
                        className="flex-1 flex items-center justify-center bg-amber-500 text-white active:bg-amber-600 transition-colors"
                      >
                        {item.status === 'active' ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="flex-1 flex items-center justify-center bg-red-500 text-white active:bg-red-600 transition-colors"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </>
                  }
                >
                  <div className="p-4 border border-slate-200 dark:border-brand-muted">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{item.title}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{item.category}</p>
                      </div>
                      <p className="text-sm font-bold text-slate-700 dark:text-slate-300 shrink-0">{formatCurrency(item.amount)}</p>
                    </div>
                    <div className="flex items-center gap-3 mt-2.5 text-xs text-slate-500 dark:text-slate-400">
                      <span className="flex items-center gap-1"><Repeat className="h-3 w-3" />{item.frequency}</span>
                      <span className="text-slate-300 dark:text-slate-600">·</span>
                      <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{item.nextDate}</span>
                      <span className="text-slate-300 dark:text-slate-600">·</span>
                      <span className={cn("px-1.5 py-0.5 rounded-full text-[10px] font-medium", item.status === 'active' ? "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400" : "bg-slate-100 dark:bg-brand-muted text-slate-600 dark:text-slate-400")}>{item.status}</span>
                    </div>
                    <p className="text-[10px] text-slate-300 dark:text-slate-600 mt-2 italic">swipe left for actions</p>
                  </div>
                </SwipeCard>
              ))}
            </div>

            {/* Desktop: Table */}
            <div className="hidden md:block bg-white dark:bg-[#2A2522] rounded-2xl border border-slate-200 dark:border-brand-muted shadow-sm overflow-x-auto">
              <table className="w-full text-left table-auto">
                <thead className="bg-slate-50 dark:bg-brand-muted border-b border-slate-200 dark:border-brand-muted">
                  <tr>
                    <th className="px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-400">Transaction</th>
                    <th className="px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-400 text-right">Amount</th>
                    <th className="px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-400">Frequency</th>
                    <th className="px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-400">Next Date</th>
                    <th className="px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-400">Status</th>
                    <th className="px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-400 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {items.map(item => (
                    <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                      <td className="px-6 py-4">
                        <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{item.title}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{item.category}</p>
                      </td>
                      <td className="px-6 py-4 text-right"><p className="text-sm font-bold text-slate-700 dark:text-slate-300">{formatCurrency(item.amount)}</p></td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400"><Repeat className="h-4 w-4" />{item.frequency}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400"><Calendar className="h-4 w-4" />{item.nextDate}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn("px-2 py-1 rounded-full text-xs font-medium", item.status === 'active' ? "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400" : "bg-slate-100 dark:bg-brand-muted text-slate-600 dark:text-slate-400")}>{item.status}</span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="sm" className="p-2 text-slate-400 dark:text-slate-500 hover:text-brand dark:hover:text-brand-secondary" onClick={() => toggleStatus(item.id, item.status)}>
                            {item.status === 'active' ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                          </Button>
                          {confirmDelete === item.id ? (
                            <div className="flex gap-0.5 items-center">
                              <Button size="sm" variant="danger" className="h-6 px-1.5 text-xs min-w-0" onClick={() => handleDelete(item.id)}>Yes</Button>
                              <Button size="sm" variant="ghost" className="h-6 px-1.5 text-xs min-w-0" onClick={() => setConfirmDelete(null)}>No</Button>
                            </div>
                          ) : (
                            <Button variant="ghost" size="sm" className="p-2 text-slate-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400 gap-1" onClick={() => setConfirmDelete(item.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Reveal>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm overflow-y-auto flex items-start sm:items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#2A2522] rounded-2xl max-w-lg w-full p-8 shadow-2xl my-4">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-6">New Recurring Transaction</h2>
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block">Title</label>
                <input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-brand-muted outline-none focus:ring-2 focus:ring-brand" placeholder="e.g. Broadband Bill" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block">Type</label>
                  <select value={form.txType} onChange={e => setForm({ ...form, txType: e.target.value as any })}
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-brand-muted outline-none focus:ring-2 focus:ring-brand">
                    <option value="expense">Expense</option>
                    <option value="income">Income</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block">Amount</label>
                  <input required type="number" min="0" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-brand-muted outline-none focus:ring-2 focus:ring-brand" placeholder="₹ 0" />
                </div>
              </div>
              <div className="space-y-2 relative" ref={categoryRef}>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block">Category</label>
                <input required value={form.category} onChange={e => { setForm({ ...form, category: e.target.value }); setCatSearch(e.target.value); setShowCategoryDropdown(true); setCatHighlightIdx(-1); }}
                  onFocus={() => setShowCategoryDropdown(true)}
                  onKeyDown={e => {
                    if (e.key === 'ArrowDown') { e.preventDefault(); setShowCategoryDropdown(true); setCatHighlightIdx(i => Math.min(i + 1, filteredCategories.length - 1)); }
                    else if (e.key === 'ArrowUp') { e.preventDefault(); setCatHighlightIdx(i => Math.max(i - 1, 0)); }
                    else if (e.key === 'Enter' && showCategoryDropdown && catHighlightIdx >= 0) { e.preventDefault(); setForm({ ...form, category: filteredCategories[catHighlightIdx] }); setShowCategoryDropdown(false); setCatHighlightIdx(-1); }
                    else if (e.key === 'Escape') { setShowCategoryDropdown(false); setCatHighlightIdx(-1); }
                  }}
                  className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-brand-muted outline-none focus:ring-2 focus:ring-brand" placeholder="Select or type a category" />
                {showCategoryDropdown && (
                  <div className="absolute z-50 w-full bg-white dark:bg-[#2A2522] border border-slate-200 dark:border-brand-muted rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
                    {filteredCategories.map((c, i) => (
                      <button key={c} type="button" onClick={() => { setForm({ ...form, category: c }); setShowCategoryDropdown(false); setCatHighlightIdx(-1); }}
                        onMouseEnter={() => setCatHighlightIdx(i)}
                        className={cn("w-full px-4 py-2 text-left text-sm transition-colors", catHighlightIdx === i ? "bg-brand-secondary dark:bg-brand-muted/50" : "hover:bg-brand-secondary dark:hover:bg-brand-muted/30", form.category === c && "text-brand font-medium")}>
                        {c}
                      </button>
                    ))}
                    {filteredCategories.length === 0 && (
                      <button type="button" onClick={() => { setForm({ ...form, category: catSearch }); setShowCategoryDropdown(false); setCatHighlightIdx(-1); }}
                        onMouseEnter={() => setCatHighlightIdx(0)}
                        className="w-full px-4 py-2 text-left text-sm text-brand font-medium hover:bg-brand-secondary dark:hover:bg-brand-muted/50 transition-colors">
                        + Create "{catSearch}"
                      </button>
                    )}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block">Frequency</label>
                  <select value={form.frequency} onChange={e => setForm({ ...form, frequency: e.target.value as any })}
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-brand-muted outline-none focus:ring-2 focus:ring-brand">
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block">Start Date</label>
                  <input required type="date" value={form.startDate} onChange={e => {
                      const d = new Date(e.target.value);
                      d.setMonth(d.getMonth() + 1);
                      const endDate = d.toISOString().split('T')[0];
                      setForm({ ...form, startDate: e.target.value, endDate });
                    }}
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-brand-muted outline-none focus:ring-2 focus:ring-brand" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block">End Date (optional)</label>
                  <input type="date" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-brand-muted outline-none focus:ring-2 focus:ring-brand" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block">Reminder</label>
                  <select value={form.reminderDays} onChange={e => setForm({ ...form, reminderDays: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-brand-muted outline-none focus:ring-2 focus:ring-brand">
                    <option value="1 day">1 day</option>
                    <option value="2 days">2 days</option>
                    <option value="3 days">3 days</option>
                    <option value="4 days">4 days</option>
                    <option value="5 days">5 days</option>
                    <option value="6 days">6 days</option>
                    <option value="7 days">7 days</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-6">
                <Button variant="ghost" size="sm" onClick={() => setShowAddModal(false)}>Cancel</Button>
                <Button type="submit" size="sm">Create Automation</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <PinPrompt
        open={pinDeleteId !== null}
        onClose={() => setPinDeleteId(null)}
        onSuccess={() => { if (pinDeleteId) doDelete(pinDeleteId); setPinDeleteId(null); }}
        title="Delete Recurring"
        message="Enter a PIN to delete this recurring transaction"
      />

      <PinSetupGuide
        open={showPinSetup !== null}
        onClose={() => setShowPinSetup(null)}
        action={showPinSetup || ''}
      />
    </DashboardLayout>
  );
}
