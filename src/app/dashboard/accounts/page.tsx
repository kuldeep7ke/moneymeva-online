'use client';

import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Wallet, Landmark, ArrowUpRight, ArrowDownRight, RefreshCw } from 'lucide-react';
import { formatCurrency, cn, todayStr } from '@/lib/utils';
import { getTransactions, isStoreReady, addTransaction } from '@/lib/store';
import Reveal from '@/components/Reveal';

export default function AccountsPage() {
  const [cashBalance, setCashBalance] = useState(0);
  const [bankBalance, setBankBalance] = useState(0);
  const [cashTxs, setCashTxs] = useState<any[]>([]);
  const [bankTxs, setBankTxs] = useState<any[]>([]);
  const [expanded, setExpanded] = useState<'cash' | 'bank' | null>(null);
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferForm, setTransferForm] = useState({ amount: '', from: 'cash', to: 'bank' });

  const refresh = () => {
    const txs = getTransactions();
    const cash = txs.filter(t => !t.account || t.account === 'cash');
    const bank = txs.filter(t => t.account === 'bank' || t.account === 'upi');
    setCashBalance(cash.reduce((s, t) => s + (t.type === 'income' ? t.amount : -t.amount), 0));
    setBankBalance(bank.reduce((s, t) => s + (t.type === 'income' ? t.amount : -t.amount), 0));
    setCashTxs(cash.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10));
    setBankTxs(bank.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10));
  };

  useEffect(() => {
    const tryRefresh = () => {
      if (isStoreReady()) { refresh(); }
      else { setTimeout(tryRefresh, 200); }
    };
    tryRefresh();
    window.addEventListener('store-ready', refresh);
    return () => window.removeEventListener('store-ready', refresh);
  }, []);

  const handleTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(transferForm.amount);
    if (!amount || amount <= 0) return;
    if (transferForm.from === transferForm.to) return;
    const today = todayStr();
    const transferId = Date.now().toString(36);
    addTransaction({ amount, type: 'expense', category: 'Transfer', description: `Transfer to ${transferForm.to === 'cash' ? 'Cash' : 'Bank'}`, date: today, account: transferForm.from as 'cash' | 'bank', transferId, partnerAccountId: undefined, isRecurring: false });
    addTransaction({ amount, type: 'income', category: 'Transfer', description: `Transfer from ${transferForm.from === 'cash' ? 'Cash' : 'Bank'}`, date: today, account: transferForm.to as 'cash' | 'bank', transferId, partnerAccountId: undefined, isRecurring: false });
    setShowTransfer(false);
    setTransferForm({ amount: '', from: 'cash', to: 'bank' });
    refresh();
  };

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <Reveal>
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Accounts</h1>
            <Button size="sm" variant="outline" className="gap-2" onClick={() => setShowTransfer(v => !v)}>
              <RefreshCw className="h-4 w-4" /> Transfer
            </Button>
          </div>
        </Reveal>

        {showTransfer && (
          <Reveal>
            <div className="bg-white dark:bg-[#2A2522] p-5 rounded-2xl border border-slate-200 dark:border-brand-muted shadow-sm">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-4">Transfer Between Accounts</h3>
              <form onSubmit={handleTransfer} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-slate-500 block mb-1">From</label>
                    <select value={transferForm.from} onChange={e => setTransferForm({ ...transferForm, from: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-brand-muted dark:bg-brand-dark outline-none focus:ring-2 focus:ring-brand text-sm">
                      <option value="cash">Cash</option>
                      <option value="bank">Bank</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-500 block mb-1">To</label>
                    <select value={transferForm.to} onChange={e => setTransferForm({ ...transferForm, to: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-brand-muted dark:bg-brand-dark outline-none focus:ring-2 focus:ring-brand text-sm">
                      <option value="cash">Cash</option>
                      <option value="bank">Bank</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 block mb-1">Amount (₹)</label>
                  <input required type="number" min="0" step="0.01" value={transferForm.amount} onChange={e => setTransferForm({ ...transferForm, amount: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-brand-muted dark:bg-brand-dark outline-none focus:ring-2 focus:ring-brand text-sm" placeholder="0" autoFocus />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setShowTransfer(false)}>Cancel</Button>
                  <Button type="submit" size="sm">Transfer</Button>
                </div>
              </form>
            </div>
          </Reveal>
        )}

        {/* Cash Account */}
        <Reveal delay={50}>
          <div className="bg-white dark:bg-[#2A2522] rounded-2xl border border-slate-200 dark:border-brand-muted shadow-sm overflow-hidden">
            <button onClick={() => setExpanded(expanded === 'cash' ? null : 'cash')} className="w-full flex items-center justify-between p-5 hover:bg-slate-50 dark:hover:bg-brand-muted/20 transition-colors">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20">
                  <Wallet className="h-6 w-6 text-emerald-600" />
                </div>
                <div className="text-left">
                  <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Cash</h2>
                  <p className="text-xs text-slate-400">Cash in hand</p>
                </div>
              </div>
              <div className="text-right">
                <p className={cn("text-xl font-bold", cashBalance >= 0 ? "text-slate-900 dark:text-slate-100" : "text-red-600")}>{formatCurrency(cashBalance)}</p>
                <p className="text-xs text-slate-400">{cashTxs.length} recent transactions</p>
              </div>
            </button>
            {expanded === 'cash' && (
              <div className="border-t border-slate-100 dark:border-brand-muted divide-y divide-slate-100 dark:divide-brand-muted/50">
                {cashTxs.length === 0 ? (
                  <p className="px-5 py-4 text-sm text-slate-400 text-center">No transactions yet.</p>
                ) : cashTxs.map(t => (
                  <div key={t.id} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50 dark:hover:bg-brand-muted/20">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={cn("shrink-0", t.type === 'income' ? "text-green-500" : "text-red-500")}>
                        {t.type === 'income' ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{t.description || t.category}</p>
                        <p className="text-xs text-slate-400">{t.date} · {t.category}</p>
                      </div>
                    </div>
                    <p className={cn("text-sm font-semibold shrink-0 ml-3", t.type === 'income' ? "text-green-600" : "text-red-600")}>
                      {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Reveal>

        {/* Bank Account */}
        <Reveal delay={100}>
          <div className="bg-white dark:bg-[#2A2522] rounded-2xl border border-slate-200 dark:border-brand-muted shadow-sm overflow-hidden">
            <button onClick={() => setExpanded(expanded === 'bank' ? null : 'bank')} className="w-full flex items-center justify-between p-5 hover:bg-slate-50 dark:hover:bg-brand-muted/20 transition-colors">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20">
                  <Landmark className="h-6 w-6 text-blue-600" />
                </div>
                <div className="text-left">
                  <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Bank</h2>
                  <p className="text-xs text-slate-400">Bank account (incl. UPI)</p>
                </div>
              </div>
              <div className="text-right">
                <p className={cn("text-xl font-bold", bankBalance >= 0 ? "text-slate-900 dark:text-slate-100" : "text-red-600")}>{formatCurrency(bankBalance)}</p>
                <p className="text-xs text-slate-400">{bankTxs.length} recent transactions</p>
              </div>
            </button>
            {expanded === 'bank' && (
              <div className="border-t border-slate-100 dark:border-brand-muted divide-y divide-slate-100 dark:divide-brand-muted/50">
                {bankTxs.length === 0 ? (
                  <p className="px-5 py-4 text-sm text-slate-400 text-center">No transactions yet.</p>
                ) : bankTxs.map(t => (
                  <div key={t.id} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50 dark:hover:bg-brand-muted/20">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={cn("shrink-0", t.type === 'income' ? "text-green-500" : "text-red-500")}>
                        {t.type === 'income' ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{t.description || t.category}</p>
                        <p className="text-xs text-slate-400">{t.date} · {t.category}{t.account === 'upi' ? ' · UPI' : ''}</p>
                      </div>
                    </div>
                    <p className={cn("text-sm font-semibold shrink-0 ml-3", t.type === 'income' ? "text-green-600" : "text-red-600")}>
                      {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Reveal>
      </div>
    </DashboardLayout>
  );
}
