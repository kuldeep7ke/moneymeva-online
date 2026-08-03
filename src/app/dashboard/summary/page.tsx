'use client';

import React, { useEffect, useState, useMemo } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { ArrowUpCircle, ArrowDownCircle, TrendingUp, Target, Download, Clock, Trash2, X } from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { getMonthlySummary, getTransactions, getGoals, getAllArchivedItems } from '@/lib/store';
import { exportSummaryPDF, exportSummaryExcel } from '@/lib/export';
import { getActivityLog, clearActivityLog, type ActivityEntry } from '@/lib/activityLog';
import Reveal from '@/components/Reveal';
import PinPrompt from '@/components/PinPrompt';
import PinSetupGuide from '@/components/PinSetupGuide';
import { hasPins } from '@/lib/pinStore';

export default function SummaryPage() {
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [goals, setGoals] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [systemActivity, setSystemActivity] = useState<ActivityEntry[]>([]);
  const [totals, setTotals] = useState({ income: 0, expense: 0, investment: 0 });
  const [pinAction, setPinAction] = useState<string | null>(null);
  const [showPinSetup, setShowPinSetup] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [showFullModal, setShowFullModal] = useState(false);

  const sysActivity = useMemo(() => systemActivity.map(e => ({
    _type: 'system' as const, _key: `sys-${e.timestamp}-${e.type}`, _ts: e.timestamp,
    type: e.type, detail: e.detail,
  })), [systemActivity]);

  const mergedAll = useMemo(() => {
    const txEntries = history.map(h => ({
      _type: 'tx' as const, _key: h.id, _ts: h.date,
      action: h.action, label: h.label, subtitle: h.subtitle, amount: h.amount,
    }));
    return [...sysActivity, ...txEntries].sort((a, b) => new Date(b._ts).getTime() - new Date(a._ts).getTime());
  }, [sysActivity, history]);

  const groupedDays = useMemo(() => {
    const map = new Map<string, typeof mergedAll>();
    const fmt = (d: Date) => {
      const today = new Date();
      const isToday = d.toDateString() === today.toDateString();
      const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
      const isYesterday = d.toDateString() === yesterday.toDateString();
      if (isToday) return 'Today';
      if (isYesterday) return 'Yesterday';
      return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    };
    for (const item of mergedAll) {
      const key = fmt(new Date(item._ts));
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    return Array.from(map.entries()).map(([dateLabel, entries]) => ({ dateLabel, entries }));
  }, [mergedAll]);

  useEffect(() => {
    const now = new Date();
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const sm = getMonthlySummary(d.getFullYear(), d.getMonth());
      months.push({ month: d.toLocaleString('default', { month: 'short' }), ...sm });
    }
    setMonthlyData(months);
    setGoals(getGoals());

    const all = getTransactions();
    setTotals({
      income: all.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0),
      expense: all.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
      investment: all.filter(t => t.type === 'investment').reduce((s, t) => s + t.amount, 0),
    });

    const transactionHistory = all.map(t => ({
      id: `tx-${t.id}`,
      date: t.createdAt || t.date,
      action: 'Added transaction',
      label: t.description || t.category,
      subtitle: `${t.type} · ${t.category}`,
      amount: t.amount,
    }));
    const archiveHistory = getAllArchivedItems().map(item => ({
      id: `archive-${item.type}-${item.id}`,
      date: item.deletedAt,
      action: 'Archived item',
      label: item.label,
      subtitle: item.subtitle,
      amount: item.amount,
    }));
    setHistory([...transactionHistory, ...archiveHistory]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 12));
    setSystemActivity(getActivityLog());
  }, []);

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <Reveal>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg md:text-3xl font-bold text-slate-900 dark:text-slate-100">Monthly Summary</h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm hidden md:block">Your P&L, goals, and savings at a glance.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-1" onClick={() => exportSummaryPDF(monthlyData)}><Download className="h-4 w-4" /> PDF</Button>
            <Button variant="outline" size="sm" className="gap-1" onClick={() => exportSummaryExcel(monthlyData)}><Download className="h-4 w-4" /> Excel</Button>
          </div>
        </div>
        </Reveal>

        <Reveal delay={100}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Income', value: totals.income, icon: ArrowUpCircle, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/30' },
            { label: 'Total Expenses', value: totals.expense, icon: ArrowDownCircle, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/30' },
            { label: 'Investments', value: totals.investment, icon: TrendingUp, color: 'text-brand dark:text-brand-secondary', bg: 'bg-brand-secondary dark:bg-brand-muted/30' },
          ].map(item => (
            <div key={item.label} className="bg-white dark:bg-[#2A2522] p-5 rounded-2xl border border-slate-200 dark:border-brand-muted shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                <div className={cn("p-2 rounded-lg", item.bg)}><item.icon className={cn("h-5 w-5", item.color)} /></div>
                <p className="text-sm text-slate-500 dark:text-slate-400">{item.label}</p>
              </div>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{formatCurrency(item.value)}</p>
            </div>
          ))}
        </div>

        </Reveal>

        <Reveal delay={200}>
        <div className="bg-white dark:bg-[#2A2522] p-6 rounded-2xl border border-slate-200 dark:border-brand-muted shadow-sm">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-6">Profit & Loss Trend</h2>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} tickFormatter={(v) => `₹${v/1000}k`} />
                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                <Bar dataKey="income" fill="#22c55e" radius={[4, 4, 0, 0]} name="Income" />
                <Bar dataKey="expense" fill="#ef4444" radius={[4, 4, 0, 0]} name="Expense" />
                <Bar dataKey="investment" fill="#6366f1" radius={[4, 4, 0, 0]} name="Investments" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        </Reveal>

        <Reveal delay={300}>
        <div className="bg-white dark:bg-[#2A2522] p-6 rounded-2xl border border-slate-200 dark:border-brand-muted shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Goal Progress</h2>
            <Target className="h-5 w-5 text-brand dark:text-brand-secondary" />
          </div>
          {goals.length === 0 ? (
            <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-8">No goals set yet. Add goals in Settings.</p>
          ) : (
            <div className="space-y-6">
              {goals.map(g => {
                const pct = Math.min(Math.round((g.saved / g.target) * 100), 100);
                return (
                  <div key={g.id}>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{g.name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{formatCurrency(g.saved)} / {formatCurrency(g.target)}</p>
                    </div>
                    <div className="h-2 bg-slate-200 dark:bg-brand-muted rounded-full overflow-hidden">
                      <div className={cn("h-full rounded-full", pct >= 75 ? "bg-green-500" : pct >= 50 ? "bg-amber-500" : "bg-brand")} style={{ width: `${pct}%` }}></div>
                    </div>
                    <p className="text-xs text-right mt-1 text-slate-400 dark:text-slate-500">{pct}% achieved</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        </Reveal>

        <Reveal delay={400}>
        <div className="bg-white dark:bg-[#2A2522] p-6 rounded-2xl border border-slate-200 dark:border-brand-muted shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 hidden md:block">User &amp; System Activity History</h2>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 block md:hidden truncate">System Activity…</h2>
            <div className="flex items-center gap-2 shrink-0">
              {(systemActivity.length > 0 || history.length > 0) && (
                <Button variant="ghost" size="sm" className="text-xs text-red-500 hover:text-red-600 h-7 px-2" onClick={() => { if (hasPins()) setPinAction('clear_history'); else setShowPinSetup('clear activity history'); }}>
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> Clear All
                </Button>
              )}
              <Clock className="h-5 w-5 text-brand dark:text-brand-secondary" />
            </div>
          </div>

          {sysActivity.length === 0 && history.length === 0 ? (
            <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-8">No activity recorded yet.</p>
          ) : (
            <>
              {groupedDays.slice(0, showAll ? groupedDays.length : Math.min(2, groupedDays.length)).map(({ dateLabel, entries }) => (
                <div key={dateLabel} className="mb-4">
                  <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 dark:text-slate-500 mb-2">{dateLabel}</p>
                  <div className="space-y-1">
                    {entries.map(item => {
                      const isSystem = item._type === 'system';
                      return (
                        <div key={item._key} className={cn(
                          "flex items-center gap-3 px-3 py-2 rounded-lg text-xs",
                          isSystem ? 'bg-slate-50 dark:bg-brand-muted/20' : 'bg-white dark:bg-transparent'
                        )}>
                          <span className="text-slate-400 dark:text-slate-500 font-mono w-16 shrink-0">
                            {new Date(item._ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {isSystem ? (
                            <>
                              <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-medium uppercase shrink-0",
                                item.type === 'pin_used' ? 'bg-brand-secondary dark:bg-brand-muted/30 text-brand dark:text-brand-secondary' :
                                item.type === 'login' ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400' :
                                item.type === 'login_failed' ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' :
                                item.type === 'logout' ? 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400' :
                                item.type === 'session_lock' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400' :
                                item.type === 'session_unlock' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' :
                                item.type === 'register' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400' :
                                item.type === 'auto_lock_off' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400' :
                                'bg-slate-100 dark:bg-slate-800 text-slate-500'
                              )}>{item.type.replace(/_/g, ' ')}</span>
                              <span className="text-slate-500 dark:text-slate-400 truncate min-w-0">{item.detail}</span>
                            </>
                          ) : (
                            <>
                              <span className="text-slate-500 dark:text-slate-400 truncate min-w-0">{item.action}: {item.label}</span>
                              <span className="text-slate-500 dark:text-slate-400 shrink-0 font-semibold">{formatCurrency(item.amount || 0)}</span>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
              {groupedDays.length > 2 && !showAll && (
                <Button variant="ghost" size="sm" className="w-full text-xs text-brand" onClick={() => setShowAll(true)}>
                  Show All Data
                </Button>
              )}
            </>
          )}
        </div>
        </Reveal>

        {/* Full History Modal */}
        {showFullModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-start sm:items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-white dark:bg-[#2A2522] rounded-2xl max-w-2xl w-full p-6 shadow-2xl my-4 max-h-[85vh] flex flex-col">
              <div className="flex items-center justify-between mb-4 shrink-0">
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Activity History</h2>
                <Button variant="ghost" size="sm" className="p-1 h-auto" onClick={() => setShowFullModal(false)}><X className="h-5 w-5" /></Button>
              </div>
              <div className="overflow-y-auto flex-1 space-y-4">
                {groupedDays.map(({ dateLabel, entries }) => (
                  <div key={dateLabel}>
                    <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 dark:text-slate-500 mb-2 sticky top-0 bg-white dark:bg-[#2A2522] py-1">{dateLabel}</p>
                    <div className="space-y-1">
                      {entries.map(item => {
                        const isSystem = item._type === 'system';
                        return (
                          <div key={item._key} className={cn(
                            "flex items-center gap-3 px-3 py-2 rounded-lg text-xs",
                            isSystem ? 'bg-slate-50 dark:bg-brand-muted/20' : 'bg-white dark:bg-transparent'
                          )}>
                            <span className="text-slate-400 dark:text-slate-500 font-mono w-16 shrink-0">
                              {new Date(item._ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {isSystem ? (
                              <>
                                <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-medium uppercase shrink-0",
                                  item.type === 'pin_used' ? 'bg-brand-secondary dark:bg-brand-muted/30 text-brand dark:text-brand-secondary' :
                                  item.type === 'login' ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400' :
                                  item.type === 'login_failed' ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' :
                                  item.type === 'logout' ? 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400' :
                                  item.type === 'session_lock' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400' :
                                  item.type === 'session_unlock' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' :
                                  item.type === 'register' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400' :
                                  item.type === 'auto_lock_off' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400' :
                                  'bg-slate-100 dark:bg-slate-800 text-slate-500'
                                )}>{item.type.replace(/_/g, ' ')}</span>
                                <span className="text-slate-500 dark:text-slate-400 truncate min-w-0">{item.detail}</span>
                              </>
                            ) : (
                              <>
                                <span className="text-slate-500 dark:text-slate-400 truncate min-w-0">{item.action}: {item.label}</span>
                                <span className="text-slate-500 dark:text-slate-400 shrink-0 font-semibold">{formatCurrency(item.amount || 0)}</span>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <PinPrompt
          open={pinAction !== null}
          onClose={() => setPinAction(null)}
          onSuccess={() => { clearActivityLog(); setSystemActivity([]); setPinAction(null); }}
          title="Clear History"
          message="Enter a PIN to clear system activity history"
        />
        <PinSetupGuide open={showPinSetup !== null} onClose={() => setShowPinSetup(null)} action={showPinSetup || ''} />
      </div>
    </DashboardLayout>
  );
}
