'use client';

import React, { useState, useEffect, useMemo } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Plus, Repeat, Calendar, Play, Pause, Trash2 } from 'lucide-react';
import { formatCurrency, cn, getSortedCategories, useSortedCategories } from '@/lib/utils';
import { getRecurring, addRecurring, updateRecurring, deleteRecurring } from '@/lib/store';
import PinPrompt from '@/components/PinPrompt';
import PinSetupGuide from '@/components/PinSetupGuide';
import { hasPins } from '@/lib/pinStore';
import { logActivity } from '@/lib/activityLog';
import Reveal from '@/components/Reveal';

export default function RecurringPage() {
  const [items, setItems] = useState<any[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [pinDeleteId, setPinDeleteId] = useState<string | null>(null);
  const [showPinSetup, setShowPinSetup] = useState<string | null>(null);

  useEffect(() => { setItems(getRecurring()); }, []);

  const [form, setForm] = useState({
    title: '', amount: '', category: '', txType: 'expense' as const, frequency: 'monthly' as const,
    startDate: new Date().toISOString().split('T')[0], endDate: '', reminderDays: '3',
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
      reminderDays: Number(form.reminderDays),
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
    const today = new Date().toISOString().split('T')[0];
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
          <div className="bg-white dark:bg-[#2A2522] rounded-2xl border border-slate-200 dark:border-brand-muted shadow-sm overflow-x-auto">
            <table className="w-full text-left table-fixed">
              <thead className="bg-slate-50 dark:bg-brand-muted border-b border-slate-200 dark:border-brand-muted">
                <tr>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-400 w-[30%]">Transaction</th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-400 w-[15%]">Amount</th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-400 w-[15%]">Frequency</th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-400 w-[15%]">Next Date</th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-400 w-[10%]">Status</th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-400 text-right w-[15%]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {items.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{item.title}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{item.category}</p>
                    </td>
                    <td className="px-6 py-4"><p className="text-sm font-bold text-slate-700 dark:text-slate-300">{formatCurrency(item.amount)}</p></td>
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
                            <span className="hidden md:inline text-xs">Delete</span>
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Reveal>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm overflow-y-auto flex items-start sm:items-center justify-center z-50 p-4" onClick={() => setShowAddModal(false)}>
          <div className="bg-white dark:bg-[#2A2522] rounded-2xl max-w-lg w-full p-8 shadow-2xl my-4" onClick={e => e.stopPropagation()}>
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
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block">Category</label>
                <input required list="recurring-category-options" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-brand-muted outline-none focus:ring-2 focus:ring-brand" placeholder="Select or type a category" />
                <datalist id="recurring-category-options">
                  {categories.map(c => <option key={c} value={c} />)}
                </datalist>
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
                  <input required type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })}
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
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block">Reminder (days before)</label>
                  <input type="number" value={form.reminderDays} onChange={e => setForm({ ...form, reminderDays: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-brand-muted outline-none focus:ring-2 focus:ring-brand" />
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
