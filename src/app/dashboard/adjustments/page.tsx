'use client';

import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { SlidersHorizontal, Plus, Trash2 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { getAdjustments, addAdjustment, deleteAdjustment, addTransaction } from '@/lib/store';
import PinPrompt from '@/components/PinPrompt';
import PinSetupGuide from '@/components/PinSetupGuide';
import { hasPins } from '@/lib/pinStore';
import { logActivity } from '@/lib/activityLog';
import Reveal from '@/components/Reveal';

export default function AdjustmentsPage() {
  const [adjustments, setAdjustments] = useState<any[]>([]);
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [pinAction, setPinAction] = useState<'add' | null>(null);
  const [showPinSetup, setShowPinSetup] = useState<string | null>(null);

  useEffect(() => { setAdjustments(getAdjustments()); }, []);
  const refreshAdj = () => { setAdjustments(getAdjustments()); };

  const [adjForm, setAdjForm] = useState({ amount: '', accountType: 'personal' as const, notes: '', date: new Date().toISOString().split('T')[0], reflectPersonal: false });

  const handleAddAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(adjForm.amount);
    if (!amount || Math.abs(amount) > 999999999) {
      alert('Invalid amount. Enter a non-zero value between -₹99,99,99,999 and ₹99,99,99,999.');
      return;
    }
    if (hasPins()) {
      setPinAction('add');
    } else {
      setShowPinSetup('create an adjustment');
    }
  };

  const doAddAdjustment = () => {
    const amount = Number(adjForm.amount);
    addAdjustment({ amount, accountType: adjForm.accountType, notes: adjForm.notes, date: adjForm.date });
    logActivity('entry_created', `Adjustment — ${adjForm.accountType}`);

    if (adjForm.reflectPersonal) {
      addTransaction({ amount: Math.abs(amount), type: amount >= 0 ? 'income' : 'expense', category: 'Adjustment', description: adjForm.notes || 'Balance adjustment', date: adjForm.date, partnerAccountId: undefined, isRecurring: false });
    }

    setShowAdjustmentModal(false);
    setAdjForm({ amount: '', accountType: 'personal', notes: '', date: new Date().toISOString().split('T')[0], reflectPersonal: false });
    refreshAdj();
  };

  const handleDeleteAdjustment = (id: string) => {
    const adj = adjustments.find(a => a.id === id);
    deleteAdjustment(id);
    logActivity('entry_deleted', `Adjustment — ${adj?.accountType || 'Unknown'} — ${adj?.notes || 'No notes'}`);
    setConfirmDelete(null);
    refreshAdj();
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <Reveal>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 hidden md:block">Account Adjustments</h1>
            <p className="text-slate-500 dark:text-slate-400 text-base font-semibold md:font-normal md:text-sm block md:hidden">{"Fix balances or reallocate funds between accounts".split(' ').slice(0, 5).join(' ')}{"Fix balances or reallocate funds between accounts".split(' ').length > 5 ? '...' : ''}</p>
            <p className="text-slate-500 dark:text-slate-400 hidden md:block">Fix balances or reallocate funds between accounts</p>
          </div>
          <button onClick={() => setShowAdjustmentModal(true)} className="h-10 w-10 rounded-xl bg-brand text-white flex items-center justify-center hover:bg-orange-600 transition-colors active:scale-95 shrink-0" type="button" title="New Adjustment"><Plus className="h-5 w-5" /></button>
        </div>
        </Reveal>

        <Reveal delay={100}>
        {adjustments.length === 0 ? (
          <div className="bg-white dark:bg-[#2A2522] rounded-2xl border border-slate-200 dark:border-brand-muted shadow-sm p-12 text-center">
            <SlidersHorizontal className="h-12 w-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300 mb-2">No adjustments yet</h3>
            <p className="text-slate-400 dark:text-slate-500 mb-6">Use adjustments to fix balances or reallocate funds between accounts</p>
            <Button onClick={() => setShowAdjustmentModal(true)}>Create First Adjustment</Button>
          </div>
        ) : (
          <div className="bg-white dark:bg-[#2A2522] rounded-2xl border border-slate-200 dark:border-brand-muted shadow-sm overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 dark:bg-brand-muted border-b border-slate-200 dark:border-brand-muted">
                <tr>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-400">Date</th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-400">Amount</th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-400">Account</th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-400">Notes</th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-400 text-right w-[80px]">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {adjustments.map(a => (
                  <tr key={a.id}>
                    <td className="px-6 py-4 text-sm">{a.date}</td>
                    <td className="px-6 py-4 text-sm font-bold">{formatCurrency(a.amount)}</td>
                    <td className="px-6 py-4 text-sm capitalize">{a.accountType}</td>
                    <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">{a.notes}</td>
                    <td className="px-6 py-4 text-right">
                      {confirmDelete === a.id ? (
                        <div className="flex justify-end gap-0.5 items-center">
                          <Button size="sm" variant="danger" className="h-6 px-1.5 text-xs min-w-0" onClick={() => handleDeleteAdjustment(a.id)}>Yes</Button>
                          <Button size="sm" variant="ghost" className="h-6 px-1.5 text-xs min-w-0" onClick={() => setConfirmDelete(null)}>No</Button>
                        </div>
                      ) : (
                        <Button variant="ghost" size="sm" className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 gap-1" onClick={() => setConfirmDelete(a.id)}>
                          <Trash2 className="h-4 w-4" />
                          <span className="hidden md:inline text-xs">Delete</span>
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        </Reveal>
      </div>

      {/* Add Modal */}
      {showAdjustmentModal && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm flex items-start sm:items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white dark:bg-[#2A2522] rounded-2xl max-w-lg w-full p-8 shadow-2xl my-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-6">New Adjustment</h2>
            <form onSubmit={handleAddAdjustment} className="space-y-4">
              <div className="space-y-2"><label className="text-sm font-medium text-slate-700 dark:text-slate-300 block">Amount</label>
                <input required type="number" step="0.01" value={adjForm.amount} onChange={e => setAdjForm({ ...adjForm, amount: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-brand-muted outline-none focus:ring-2 focus:ring-brand" placeholder="₹ 0" /></div>
              <div className="space-y-2"><label className="text-sm font-medium text-slate-700 dark:text-slate-300 block">Account Type</label>
                <select value={adjForm.accountType} onChange={e => setAdjForm({ ...adjForm, accountType: e.target.value as any })}
                  className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-brand-muted outline-none focus:ring-2 focus:ring-brand">
                  <option value="personal">Personal Account</option><option value="partner">Partner Account</option>
                </select></div>
              <div className="space-y-2"><label className="text-sm font-medium text-slate-700 dark:text-slate-300 block">Date</label>
                <input required type="date" value={adjForm.date} onChange={e => setAdjForm({ ...adjForm, date: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-brand-muted outline-none focus:ring-2 focus:ring-brand" /></div>
              <div className="space-y-2"><label className="text-sm font-medium text-slate-700 dark:text-slate-300 block">Notes</label>
                <textarea value={adjForm.notes} onChange={e => setAdjForm({ ...adjForm, notes: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-brand-muted outline-none focus:ring-2 focus:ring-brand resize-none h-24" placeholder="Reason for adjustment..." /></div>
              <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 cursor-pointer">
                <input type="checkbox" checked={adjForm.reflectPersonal} onChange={e => setAdjForm({ ...adjForm, reflectPersonal: e.target.checked })}
                  className="rounded border-slate-300 dark:border-brand-muted text-brand focus:ring-brand" />
                Also reflect in personal account
              </label>
              <div className="flex items-center justify-end gap-2 pt-2">
                <Button variant="ghost" size="sm" onClick={() => setShowAdjustmentModal(false)}>Cancel</Button>
                <Button type="submit" size="sm">Apply Adjustment</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <PinPrompt
        open={pinAction !== null}
        onClose={() => setPinAction(null)}
        onSuccess={() => { doAddAdjustment(); setPinAction(null); }}
        title="Create Adjustment"
        message="Enter a PIN to create this adjustment entry"
      />

      <PinSetupGuide
        open={showPinSetup !== null}
        onClose={() => setShowPinSetup(null)}
        action={showPinSetup || ''}
      />
    </DashboardLayout>
  );
}
