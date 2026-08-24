'use client';

import React, { useState, useEffect, useMemo } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Plus, Pencil, Trash2, X, Check, Tag, Save, ArrowUpCircle, ArrowDownCircle, TrendingUp, Pin, Shield, ReceiptText } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { getTransactions, isStoreReady } from '@/lib/store';
import { useTranslation } from '@/lib/i18n';
import PinPrompt from '@/components/PinPrompt';
import PinSetupGuide from '@/components/PinSetupGuide';
import { hasPins } from '@/lib/pinStore';

type CategoryType = 'income' | 'expense' | 'investment';

const LS_KEYS: Record<CategoryType, string> = {
  income: 'mm_income_categories',
  expense: 'mm_expense_categories',
  investment: 'mm_investment_categories',
};

const TYPE_ICONS: Record<CategoryType, React.ElementType> = {
  income: ArrowUpCircle,
  expense: ArrowDownCircle,
  investment: TrendingUp,
};

const ACCOUNT_BADGE: Record<string, { label: string; cls: string }> = {
  cash: { label: 'Cash', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  bank: { label: 'Bank', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  upi: { label: 'UPI', cls: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
  invest: { label: 'Invest', cls: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400' },
};

const BASE_CATEGORIES: Record<CategoryType, string[]> = {
  income: ['Salary', 'Freelance', 'Business', 'Interest', 'Dividends', 'Rental', 'Other'],
  expense: ['Rent', 'Groceries', 'Utilities', 'Transport', 'Healthcare', 'Entertainment', 'Dining', 'Shopping', 'Bills', 'Insurance', 'Education', 'Other'],
  investment: ['Stocks', 'Mutual Funds', 'Fixed Deposit', 'Real Estate', 'Gold', 'Crypto', 'Other'],
};

function loadCategories(type: CategoryType): string[] {
  try {
    const saved = localStorage.getItem(LS_KEYS[type]);
    if (saved) { const p = JSON.parse(saved); if (Array.isArray(p)) return p; }
  } catch {}
  return [...BASE_CATEGORIES[type]];
}

function saveCategories(type: CategoryType, cats: string[]) {
  localStorage.setItem(LS_KEYS[type], JSON.stringify(cats));
}

export default function CategoriesPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<CategoryType>('income');
  const [incomeCats, setIncomeCats] = useState<string[]>([]);
  const [expenseCats, setExpenseCats] = useState<string[]>([]);
  const [investmentCats, setInvestmentCats] = useState<string[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const [newCat, setNewCat] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [pinAction, setPinAction] = useState<'save' | null>(null);
  const [showPinSetup, setShowPinSetup] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [savedCats, setSavedCats] = useState<{ income: string[]; expense: string[]; investment: string[] } | null>(null);
  const [detailCat, setDetailCat] = useState<string | null>(null);

  const detailTxns = useMemo(() => {
    if (!detailCat) return [];
    return getTransactions()
      .filter(tx => tx.type === tab && tx.category === detailCat && !tx.deletedAt)
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [detailCat, tab]);

  const detailTotal = useMemo(() => detailTxns.reduce((s, tx) => s + (Number(tx.amount) || 0), 0), [detailTxns]);

  const refreshTxCats = () => {
    if (!isStoreReady()) return;
    const txs = getTransactions();
    const incomeTx = [...new Set(txs.filter(t => t.type === 'income').map(t => t.category).filter(Boolean))];
    const expenseTx = [...new Set(txs.filter(t => t.type === 'expense').map(t => t.category).filter(Boolean))];
    const investTx = [...new Set(txs.filter(t => t.type === 'investment').map(t => t.category).filter(Boolean))];

    const loaded = {
      income: [...new Set([...loadCategories('income'), ...incomeTx])],
      expense: [...new Set([...loadCategories('expense'), ...expenseTx])],
      investment: [...new Set([...loadCategories('investment'), ...investTx])],
    };
    setIncomeCats(loaded.income);
    setExpenseCats(loaded.expense);
    setInvestmentCats(loaded.investment);
    setSavedCats({ income: [...loaded.income], expense: [...loaded.expense], investment: [...loaded.investment] });
  };

  useEffect(() => {
    refreshTxCats();
    const onReady = () => refreshTxCats();
    window.addEventListener('store-ready', onReady);
    return () => window.removeEventListener('store-ready', onReady);
  }, []);

  const currentCats = useMemo(() => {
    switch (tab) {
      case 'income': return incomeCats;
      case 'expense': return expenseCats;
      case 'investment': return investmentCats;
    }
  }, [tab, incomeCats, expenseCats, investmentCats]);

  const setCurrentCats = (cats: string[]) => {
    switch (tab) {
      case 'income': setIncomeCats(cats); break;
      case 'expense': setExpenseCats(cats); break;
      case 'investment': setInvestmentCats(cats); break;
    }
    setHasChanges(true);
  };

  const handleAdd = () => {
    const trimmed = newCat.trim();
    if (!trimmed || currentCats.includes(trimmed)) return;
    setCurrentCats([...currentCats, trimmed]);
    setNewCat('');
  };

  const handleEdit = (idx: number) => {
    const trimmed = editValue.trim();
    if (!trimmed) return;
    const updated = [...currentCats];
    updated[idx] = trimmed;
    setCurrentCats(updated);
    setEditingIndex(null);
    setEditValue('');
  };

  const handleDelete = (idx: number) => {
    const updated = currentCats.filter((_, i) => i !== idx);
    setCurrentCats(updated);
    setConfirmDelete(null);
  };

  const handleSave = () => {
    if (!hasPins()) { setShowPinSetup('save category changes'); return; }
    setPinAction('save');
  };

  const doSave = () => {
    saveCategories('income', incomeCats);
    saveCategories('expense', expenseCats);
    saveCategories('investment', investmentCats);
    setSavedCats({ income: [...incomeCats], expense: [...expenseCats], investment: [...investmentCats] });
    setHasChanges(false);
    setPinAction(null);
  };

  const isBase = (cat: string) => BASE_CATEGORIES[tab].includes(cat);

  const catCounts = useMemo(() => {
    const m: Record<string, number> = {};
    if (!isStoreReady()) return m;
    for (const tx of getTransactions()) {
      if (tx.deletedAt) continue;
      const key = `${tx.type}::${tx.category}`;
      m[key] = (m[key] || 0) + 1;
    }
    return m;
  }, [incomeCats, expenseCats, investmentCats, detailCat]);

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Categories</h1>
          {hasChanges && (
            <Button size="sm" className="gap-2" onClick={handleSave}>
              <Save className="h-4 w-4" /> Save Changes
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-brand-muted">
          {(['income', 'expense', 'investment'] as CategoryType[]).map(t => {
            const Icon = TYPE_ICONS[t];
            return (
              <button key={t} onClick={() => { setTab(t); setEditingIndex(null); setNewCat(''); setConfirmDelete(null); }}
                className={cn("flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors capitalize", tab === t ? "border-brand text-slate-900 dark:text-slate-100" : "border-transparent text-slate-400 hover:text-slate-600")}>
                <Icon className="h-4 w-4" />
                {t}
              </button>
            );
          })}
        </div>

        <div className="bg-white dark:bg-[#2A2522] rounded-2xl border border-slate-200 dark:border-brand-muted shadow-sm">
          <div className="p-4 border-b border-slate-100 dark:border-brand-muted flex items-center gap-2">
            <input value={newCat} onChange={e => setNewCat(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAdd(); } }}
              className="flex-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-brand-muted dark:bg-brand-dark outline-none focus:ring-2 focus:ring-brand text-sm"
              placeholder="Add new category..." />
            <button onClick={handleAdd} className="h-9 w-9 rounded-xl bg-brand text-white flex items-center justify-center hover:bg-orange-600 transition-colors active:scale-95 shrink-0">
              <Plus className="h-4 w-4" />
            </button>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-brand-muted">
            {currentCats.length === 0 ? (
              <div className="p-12 text-center text-slate-400 dark:text-slate-500">
                <Tag className="h-12 w-12 mx-auto mb-4 text-slate-300" />
                <p className="font-medium">No categories yet</p>
              </div>
            ) : (
              currentCats.map((cat, i) => (
                <div key={`${cat}-${i}`} onClick={editingIndex === i ? undefined : () => setDetailCat(cat)}
                  className={cn("flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-brand-muted/20 transition-colors group", editingIndex !== i && "cursor-pointer")}>
                  {editingIndex === i ? (
                    <>
                      <input value={editValue} onChange={e => setEditValue(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleEdit(i); if (e.key === 'Escape') { setEditingIndex(null); } }}
                        className="flex-1 px-3 py-1.5 rounded-lg border border-brand outline-none focus:ring-2 focus:ring-brand text-sm dark:bg-brand-dark"
                        autoFocus />
                      <button onClick={() => handleEdit(i)} className="p-1.5 rounded-lg text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20">
                        <Check className="h-4 w-4" />
                      </button>
                      <button onClick={() => setEditingIndex(null)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-brand-muted">
                        <X className="h-4 w-4" />
                      </button>
                    </>
                  ) : (
                    <>
                      <Tag className="h-4 w-4 text-slate-400 shrink-0" />
                      <span className={cn("flex-1 text-sm truncate", isBase(cat) ? "text-slate-500 dark:text-slate-400" : "text-slate-900 dark:text-slate-100 font-medium")}>
                        {cat}
                        {isBase(cat) && <span className="ml-2 text-[10px] text-slate-400">default</span>}
                      </span>
                      {!!catCounts[`${tab}::${cat}`] && (
                        <span className="shrink-0 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-brand-muted/40 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                          {catCounts[`${tab}::${cat}`]}
                        </span>
                      )}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                        <button onClick={() => { setEditingIndex(i); setEditValue(cat); }} className="p-1.5 rounded-lg text-slate-400 hover:text-brand hover:bg-brand/10" title="Edit">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        {confirmDelete === i ? (
                          <div className="flex items-center gap-1">
                            <button onClick={() => handleDelete(i)} className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 text-xs font-semibold">Yes</button>
                            <button onClick={() => setConfirmDelete(null)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-brand-muted text-xs">No</button>
                          </div>
                        ) : (
                          <button onClick={() => setConfirmDelete(i)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20" title="Delete">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {hasChanges && savedCats && (
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button variant="ghost" size="sm" onClick={() => { setIncomeCats(savedCats.income); setExpenseCats(savedCats.expense); setInvestmentCats(savedCats.investment); setHasChanges(false); }}>
              Cancel
            </Button>
            <Button size="sm" className="gap-2" onClick={handleSave}>
              <Save className="h-4 w-4" /> Save Changes
            </Button>
          </div>
        )}
      </div>

      {detailCat && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm flex items-start sm:items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white dark:bg-[#2A2522] rounded-2xl w-full max-w-md shadow-xl my-auto">
            <div className="flex items-center gap-3 p-4 border-b border-slate-100 dark:border-brand-muted">
              <div className="h-9 w-9 rounded-xl bg-brand/10 flex items-center justify-center shrink-0">
                <Tag className="h-4 w-4 text-brand" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{detailCat}</p>
                <p className="text-xs text-slate-400">
                  {detailTxns.length} {t('cat.entries')} · {t('cat.total')} {formatCurrency(detailTotal)}
                </p>
              </div>
              <button onClick={() => setDetailCat(null)} className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-brand-muted transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto divide-y divide-slate-100 dark:divide-brand-muted">
              {detailTxns.length === 0 ? (
                <div className="p-10 text-center">
                  <ReceiptText className="h-10 w-10 mx-auto mb-3 text-slate-300" />
                  <p className="text-sm text-slate-400">{t('cat.noEntries')}</p>
                </div>
              ) : (
                detailTxns.map(tx => {
                  const badge = tx.account ? ACCOUNT_BADGE[tx.account] : undefined;
                  return (
                    <div key={tx.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-slate-900 dark:text-slate-100 truncate">{tx.description || tx.category}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[11px] text-slate-400">{new Date(tx.date).toLocaleDateString('en-IN')}</span>
                          {badge && (
                            <span className={cn("px-1.5 py-0.5 rounded-full text-[10px] font-semibold", badge.cls)}>{badge.label}</span>
                          )}
                        </div>
                      </div>
                      <p className={cn("text-sm font-bold shrink-0",
                        tab === 'income' ? "text-emerald-600 dark:text-emerald-400" : tab === 'expense' ? "text-red-500 dark:text-red-400" : "text-violet-500 dark:text-violet-400")}>
                        {tab === 'income' ? '+' : tab === 'expense' ? '\u2212' : ''}{formatCurrency(Number(tx.amount) || 0)}
                      </p>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      <PinPrompt
        open={pinAction === 'save'}
        onClose={() => setPinAction(null)}
        onSuccess={doSave}
        title="Save Categories"
        message="Enter your PIN to save all category changes"
      />
      <PinSetupGuide open={showPinSetup !== null} action={showPinSetup || ''} onClose={() => setShowPinSetup(null)} />
    </DashboardLayout>
  );
}