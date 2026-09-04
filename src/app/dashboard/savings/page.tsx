'use client';

import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Target, Plus, Trash2 } from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { getGoals, addGoal, deleteGoal, isStoreReady } from '@/lib/store';
import { useTranslation } from '@/lib/i18n';
import Reveal from '@/components/Reveal';

export default function GoalsPage() {
  const { t } = useTranslation();
  const [goals, setGoals] = useState<any[]>([]);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [goalForm, setGoalForm] = useState({ name: '', target: '', saved: '' });
  const [confirmDel, setConfirmDel] = useState<{ type: string; id: string } | null>(null);

  const refreshGoals = () => { setGoals(getGoals()); };

  useEffect(() => {
    const tryRefresh = () => {
      if (isStoreReady()) { refreshGoals(); }
      else { setTimeout(tryRefresh, 200); }
    };
    tryRefresh();
    const handler = () => refreshGoals();
    window.addEventListener('store-ready', handler);
    return () => window.removeEventListener('store-ready', handler);
  }, []);

  const handleAddGoal = (e: React.FormEvent) => {
    e.preventDefault();
    addGoal({ name: goalForm.name, target: Number(goalForm.target), saved: Number(goalForm.saved) || 0 });
    setShowGoalModal(false);
    setGoalForm({ name: '', target: '', saved: '' });
    refreshGoals();
  };

  const handleDeleteGoal = (id: string) => {
    deleteGoal(id);
    setConfirmDel(null);
    refreshGoals();
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <Reveal><div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 hidden md:block">{t('savings.title')}</h1>
          <p className="text-slate-500 dark:text-slate-400 text-base font-semibold md:font-normal md:text-sm block md:hidden">{t('savings.allGoals')}</p>
          <p className="text-slate-500 dark:text-slate-400 hidden md:block">{t('savings.subtitle')}</p>
        </div></Reveal>

        <Reveal delay={100}><div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">{t('savings.allGoals')}</h2>
          <button onClick={() => setShowGoalModal(true)} className="h-9 w-9 rounded-xl bg-brand text-white flex items-center justify-center hover:bg-orange-600 transition-colors active:scale-95 shrink-0" title={t('savings.newGoal')}><Plus className="h-4 w-4" /></button>
        </div></Reveal>

        <Reveal delay={200}>
          {goals.length === 0 ? (
            <div className="bg-white dark:bg-[#2A2522] rounded-2xl border border-slate-200 dark:border-brand-muted shadow-sm p-12 text-center">
              <Target className="h-12 w-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300 mb-2">{t('savings.noGoals')}</h3>
              <p className="text-slate-400 dark:text-slate-500 mb-6">{t('savings.subtitle')}</p>
              <Button onClick={() => setShowGoalModal(true)}>{t('savings.createFirst')}</Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {goals.map(g => {
                const pct = g.target > 0 ? Math.min(Math.round((g.saved / g.target) * 100), 100) : 0;
                return (
                  <div key={g.id} className="bg-white dark:bg-[#2A2522] p-5 rounded-2xl border border-slate-200 dark:border-brand-muted shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-bold text-slate-900 dark:text-slate-100">{g.name}</h3>
                      <div className="flex items-center gap-2">
                        {confirmDel?.type === 'goal' && confirmDel.id === g.id ? (
                          <div className="flex items-center gap-1">
                            <Button size="sm" variant="danger" className="h-7 px-2 text-xs" onClick={() => handleDeleteGoal(g.id)}>{t('common.yes')}</Button>
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setConfirmDel(null)}>{t('common.no')}</Button>
                          </div>
                        ) : (
                          <Button variant="ghost" size="sm" className="p-1 text-slate-400 hover:text-red-600 dark:hover:text-red-400 gap-1" onClick={() => setConfirmDel({ type: 'goal', id: g.id })}>
                            <Trash2 className="h-4 w-4" />
                            <span className="hidden md:inline text-xs">{t('common.delete')}</span>
                          </Button>
                        )}
                        <Target className="h-4 w-4 text-brand-secondary" />
                      </div>
                    </div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-slate-500 dark:text-slate-400">{t('savings.saved')}: {formatCurrency(g.saved)}</span>
                      <span className="text-slate-700 dark:text-slate-300 font-medium">{t('savings.target')}: {formatCurrency(g.target)}</span>
                    </div>
                    <div className="h-2 bg-slate-200 dark:bg-brand-muted rounded-full overflow-hidden">
                      <div className={cn("h-full rounded-full", pct >= 75 ? "bg-green-500" : pct >= 50 ? "bg-amber-500" : "bg-brand")} style={{ width: `${pct}%` }}></div>
                    </div>
                    <p className="text-xs text-right mt-1 text-slate-400 dark:text-slate-500">{t('savings.achieved', { pct })}</p>
                  </div>
                );
              })}
            </div>
          )}
        </Reveal>
      </div>

      {/* Goal Modal */}
      {showGoalModal && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm flex items-start sm:items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white dark:bg-[#2A2522] rounded-2xl max-w-lg w-full p-8 shadow-2xl my-4">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-6">{t('savings.newGoal')}</h2>
            <form onSubmit={handleAddGoal} className="space-y-4">
              <div className="space-y-2"><label className="text-sm font-medium text-slate-700 dark:text-slate-300 block">{t('savings.goalName')}</label>
                <input required value={goalForm.name} onChange={e => setGoalForm({ ...goalForm, name: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-brand-muted outline-none focus:ring-2 focus:ring-brand" placeholder={t('savings.goalName')} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><label className="text-sm font-medium text-slate-700 dark:text-slate-300 block">{t('savings.target')}</label>
                  <input required type="number" min="0" value={goalForm.target} onChange={e => setGoalForm({ ...goalForm, target: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-brand-muted outline-none focus:ring-2 focus:ring-brand" placeholder="₹" /></div>
                <div className="space-y-2"><label className="text-sm font-medium text-slate-700 dark:text-slate-300 block">{t('savings.savedSoFar')}</label>
                  <input type="number" min="0" value={goalForm.saved} onChange={e => setGoalForm({ ...goalForm, saved: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-brand-muted outline-none focus:ring-2 focus:ring-brand" placeholder="₹ 0" /></div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-6">
                <Button variant="ghost" size="sm" onClick={() => setShowGoalModal(false)}>{t('common.cancel')}</Button>
                <Button type="submit" size="sm">{t('savings.createGoal')}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
