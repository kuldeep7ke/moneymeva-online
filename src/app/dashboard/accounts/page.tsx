'use client';

import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Wallet, Landmark, ArrowUpRight, ArrowDownRight, RefreshCw, TrendingUp, TrendingDown, PiggyBank, Plus, X, ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { formatCurrency, cn, todayStr } from '@/lib/utils';
import { getTransactions, isStoreReady, addTransaction } from '@/lib/store';
import Reveal from '@/components/Reveal';
import { useToast } from '@/components/Toast';

const NON_OP = ['Transfer', 'Capital', 'Drawings'];

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function currentYM(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthRange(ym: string): { start: string; end: string } {
  const [y, m] = ym.split('-').map(Number);
  const start = `${y}-${String(m).padStart(2, '0')}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const end = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { start, end };
}

interface CardTx {
  id: string;
  type: string;
  amount: number;
  date: string;
  description: string;
  category: string;
}

function AccountCard({ icon: Icon, accentCls, title, subtitle, balance, balanceCls, txs, expanded, onToggle, action }: {
  icon: React.ComponentType<{ className?: string }>;
  accentCls: string;
  title: string;
  subtitle: string;
  balance: number | null;
  balanceCls?: string;
  txs: CardTx[];
  expanded: boolean;
  onToggle: () => void;
  action?: React.ReactNode;
}) {
  return (
    <div className="bg-white dark:bg-[#2A2522] rounded-2xl border border-slate-200 dark:border-brand-muted shadow-sm overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center justify-between p-5 hover:bg-slate-50 dark:hover:bg-brand-muted/20 transition-colors">
        <div className="flex items-center gap-4">
          <div className={cn("p-3 rounded-xl", accentCls)}>
            <Icon className="h-6 w-6" />
          </div>
          <div className="text-left">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">{title}</h2>
            <p className="text-xs text-slate-400">{subtitle}</p>
          </div>
        </div>
        <div className="text-right">
          {balance !== null && (
            <p className={cn("text-xl font-bold", balanceCls || (balance >= 0 ? "text-slate-900 dark:text-slate-100" : "text-red-600"))}>{formatCurrency(balance)}</p>
          )}
          <p className="text-xs text-slate-400">{txs.length} recent transactions</p>
        </div>
      </button>
      {(action || expanded) && (
        <>
          {action}
          {expanded && (
            <div className="border-t border-slate-100 dark:border-brand-muted divide-y divide-slate-100 dark:divide-brand-muted/50">
              {txs.length === 0 ? (
                <p className="px-5 py-4 text-sm text-slate-400 text-center">No transactions yet.</p>
              ) : txs.map(t => (
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
        </>
      )}
    </div>
  );
}

export default function AccountsPage() {
  const toast = useToast();
  const [selectedMonth, setSelectedMonth] = useState(currentYM());
  const [cashBalance, setCashBalance] = useState(0);
  const [bankBalance, setBankBalance] = useState(0);
  const [cashTxs, setCashTxs] = useState<CardTx[]>([]);
  const [bankTxs, setBankTxs] = useState<CardTx[]>([]);
  const [revenueTotal, setRevenueTotal] = useState(0);
  const [expenseTotal, setExpenseTotal] = useState(0);
  const [incomeTxs, setIncomeTxs] = useState<CardTx[]>([]);
  const [expenseTxs, setExpenseTxs] = useState<CardTx[]>([]);
  const [capitalNet, setCapitalNet] = useState(0);
  const [capitalTxs, setCapitalTxs] = useState<CardTx[]>([]);
  const [expanded, setExpanded] = useState<'cash' | 'bank' | 'capital' | 'revenue' | 'expenses' | null>(null);
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferForm, setTransferForm] = useState({ amount: '', from: 'cash', to: 'bank' });
  const [showCapital, setShowCapital] = useState(false);
  const [capitalForm, setCapitalForm] = useState({ direction: 'in' as 'in' | 'out', amount: '', date: todayStr(), note: '', account: 'bank' as 'cash' | 'bank' });

  const refresh = () => {
    if (!isStoreReady()) return;
    const active = getTransactions().filter(t => !t.deletedAt);

    const cash = active.filter(t => !t.account || t.account === 'cash');
    const bank = active.filter(t => t.account === 'bank' || t.account === 'upi');
    setCashBalance(cash.reduce((s, t) => s + (t.type === 'income' ? t.amount : -t.amount), 0));
    setBankBalance(bank.reduce((s, t) => s + (t.type === 'income' ? t.amount : -t.amount), 0));
    setCashTxs([...cash].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10));
    setBankTxs([...bank].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10));

    const { start, end } = monthRange(selectedMonth);
    const ptxs = active.filter(t => t.date >= start && t.date <= end);
    const revTxs = ptxs.filter(t => t.type === 'income' && !NON_OP.includes(t.category));
    const expTxs = ptxs.filter(t => t.type === 'expense' && !NON_OP.includes(t.category));
    setRevenueTotal(revTxs.reduce((s, t) => s + t.amount, 0));
    setExpenseTotal(expTxs.reduce((s, t) => s + t.amount, 0));
    setIncomeTxs([...revTxs].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10));
    setExpenseTxs([...expTxs].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10));

    const capIn = active.filter(t => t.type === 'income' && t.category === 'Capital');
    const capOut = active.filter(t => t.type === 'expense' && t.category === 'Drawings');
    setCapitalNet(capIn.reduce((s, t) => s + t.amount, 0) - capOut.reduce((s, t) => s + t.amount, 0));
    setCapitalTxs([...capIn, ...capOut].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10));
  };

  useEffect(() => {
    refresh();
    const tryRefresh = () => { if (isStoreReady()) refresh(); else setTimeout(tryRefresh, 200); };
    tryRefresh();
    window.addEventListener('store-ready', refresh);
    return () => window.removeEventListener('store-ready', refresh);
  }, []);

  useEffect(() => { refresh(); }, [selectedMonth]);

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

  const handleSaveCapital = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(capitalForm.amount);
    if (!(amount > 0)) return;
    if (capitalForm.date > todayStr()) return;
    addTransaction({
      amount,
      type: capitalForm.direction === 'in' ? 'income' : 'expense',
      category: capitalForm.direction === 'in' ? 'Capital' : 'Drawings',
      description: capitalForm.note.trim() || (capitalForm.direction === 'in' ? 'Capital added' : 'Drawings'),
      date: capitalForm.date,
      account: capitalForm.account,
      partnerAccountId: undefined,
      isRecurring: false,
    });
    toast(capitalForm.direction === 'in'
      ? `Capital added · ${formatCurrency(amount)}`
      : `Drawings recorded · ${formatCurrency(amount)}`, 'success');
    setShowCapital(false);
    setCapitalForm({ direction: 'in', amount: '', date: todayStr(), note: '', account: 'bank' });
    refresh();
  };

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <Reveal>
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Accounts</h1>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" className="gap-2" onClick={() => setShowCapital(true)}><PiggyBank className="h-4 w-4" /> Capital</Button>
              <Button size="sm" variant="outline" className="gap-2" onClick={() => setShowTransfer(v => !v)}>
                <RefreshCw className="h-4 w-4" /> Transfer
              </Button>
            </div>
          </div>
        </Reveal>

        {/* Month selector for Revenue / Expenses */}
        <Reveal delay={50}>
          <div className="flex items-center gap-1.5">
            <CalendarDays className="h-4 w-4 text-slate-400 mr-1" />
            <button onClick={() => {
              const [y, m] = selectedMonth.split('-').map(Number);
              const prev = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
              setSelectedMonth(prev);
            }} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-brand-muted/30 text-slate-500 dark:text-slate-400 transition-colors">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-bold text-slate-700 dark:text-slate-200 min-w-[100px] text-center">
              {MONTH_NAMES[Number(selectedMonth.split('-')[1]) - 1]} {selectedMonth.split('-')[0]}
            </span>
            <button onClick={() => {
              const [y, m] = selectedMonth.split('-').map(Number);
              const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
              setSelectedMonth(next);
            }} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-brand-muted/30 text-slate-500 dark:text-slate-400 transition-colors">
              <ChevronRight className="h-4 w-4" />
            </button>
            {selectedMonth !== currentYM() && (
              <button onClick={() => setSelectedMonth(currentYM())}
                className="px-2.5 py-1 rounded-full text-xs font-medium bg-brand/10 text-brand hover:bg-brand/20 transition-colors ml-1">
                Today
              </button>
            )}
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

        <Reveal delay={50}>
          <AccountCard
            icon={Wallet}
            accentCls="bg-emerald-50 dark:bg-emerald-900/20 [&_svg]:text-emerald-600"
            title="Cash"
            subtitle="Cash in hand"
            balance={cashBalance}
            txs={cashTxs}
            expanded={expanded === 'cash'}
            onToggle={() => setExpanded(expanded === 'cash' ? null : 'cash')}
          />
        </Reveal>

        <Reveal delay={100}>
          <AccountCard
            icon={Landmark}
            accentCls="bg-blue-50 dark:bg-blue-900/20 [&_svg]:text-blue-600"
            title="Bank"
            subtitle="Bank account"
            balance={bankBalance}
            txs={bankTxs}
            expanded={expanded === 'bank'}
            onToggle={() => setExpanded(expanded === 'bank' ? null : 'bank')}
          />
        </Reveal>

        <Reveal delay={150}>
          <AccountCard
            icon={PiggyBank}
            accentCls="bg-amber-50 dark:bg-amber-900/20 [&_svg]:text-amber-600"
            title="Capital"
            subtitle="Money you put in or took out"
            balance={capitalNet}
            txs={capitalTxs}
            expanded={expanded === 'capital'}
            onToggle={() => setExpanded(expanded === 'capital' ? null : 'capital')}
          />
        </Reveal>

        <Reveal delay={200}>
          <AccountCard
            icon={TrendingUp}
            accentCls="bg-green-50 dark:bg-green-900/20 [&_svg]:text-green-600"
            title="Revenue"
            subtitle={`Income in ${MONTH_NAMES[Number(selectedMonth.split('-')[1]) - 1]} ${selectedMonth.split('-')[0]}`}
            balance={revenueTotal}
            balanceCls="text-slate-900 dark:text-slate-100"
            txs={incomeTxs}
            expanded={expanded === 'revenue'}
            onToggle={() => setExpanded(expanded === 'revenue' ? null : 'revenue')}
          />
        </Reveal>

        <Reveal delay={250}>
          <AccountCard
            icon={TrendingDown}
            accentCls="bg-red-50 dark:bg-red-900/20 [&_svg]:text-red-600"
            title="Expenses"
            subtitle={`Spending in ${MONTH_NAMES[Number(selectedMonth.split('-')[1]) - 1]} ${selectedMonth.split('-')[0]}`}
            balance={expenseTotal}
            balanceCls="text-slate-900 dark:text-slate-100"
            txs={expenseTxs}
            expanded={expanded === 'expenses'}
            onToggle={() => setExpanded(expanded === 'expenses' ? null : 'expenses')}
          />
        </Reveal>
      </div>

      {showCapital && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm flex items-start sm:items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white dark:bg-[#2A2522] rounded-2xl max-w-md w-full p-6 shadow-2xl my-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Add Capital / Drawings</h2>
              <button onClick={() => setShowCapital(false)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleSaveCapital} className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setCapitalForm({ ...capitalForm, direction: 'in' })}
                  className={cn("px-4 py-2.5 rounded-xl text-sm font-medium border transition-colors",
                    capitalForm.direction === 'in' ? "bg-green-50 dark:bg-green-900/30 border-green-400 text-green-700 dark:text-green-400" : "border-slate-200 dark:border-brand-muted text-slate-500")}>
                  Money In (Capital)
                </button>
                <button type="button" onClick={() => setCapitalForm({ ...capitalForm, direction: 'out' })}
                  className={cn("px-4 py-2.5 rounded-xl text-sm font-medium border transition-colors",
                    capitalForm.direction === 'out' ? "bg-red-50 dark:bg-red-900/30 border-red-400 text-red-700 dark:text-red-400" : "border-slate-200 dark:border-brand-muted text-slate-500")}>
                  Money Out (Drawings)
                </button>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1">Amount (₹)</label>
                <input required type="number" min="0" step="0.01" value={capitalForm.amount} onChange={e => setCapitalForm({ ...capitalForm, amount: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-brand-muted dark:bg-brand-dark outline-none focus:ring-2 focus:ring-brand text-sm" placeholder="0" autoFocus />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-500 block mb-1">Date</label>
                  <input required type="date" max={todayStr()} value={capitalForm.date} onChange={e => setCapitalForm({ ...capitalForm, date: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-brand-muted dark:bg-brand-dark outline-none focus:ring-2 focus:ring-brand text-sm" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 block mb-1">Account</label>
                  <select value={capitalForm.account} onChange={e => setCapitalForm({ ...capitalForm, account: e.target.value as 'cash' | 'bank' })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-brand-muted dark:bg-brand-dark outline-none focus:ring-2 focus:ring-brand text-sm">
                    <option value="cash">Cash</option>
                    <option value="bank">Bank</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1">Note (optional)</label>
                <input value={capitalForm.note} onChange={e => setCapitalForm({ ...capitalForm, note: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-brand-muted dark:bg-brand-dark outline-none focus:ring-2 focus:ring-brand text-sm" placeholder="e.g. Added savings to business" />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <Button variant="ghost" size="sm" onClick={() => setShowCapital(false)}>Cancel</Button>
                <Button type="submit" size="sm">Save</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
