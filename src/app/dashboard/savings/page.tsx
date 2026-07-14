'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Target, Plus, Trash2, ListTodo, Star, StarOff, Bell, CheckCircle2, AlertCircle, Clock, X, Minus, ArrowDown, ArrowUpDown } from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { getGoals, addGoal, deleteGoal, getTodos, addTodo, updateTodo, deleteTodo, toggleTodoImportant, completeTodo, isStoreReady, getTransactions, addTransaction, deleteTransaction, restoreTransaction, permanentDeleteTransaction, getArchivedTransactions, getPartners } from '@/lib/store';
import type { TodoPriority } from '@/types';
import Reveal from '@/components/Reveal';

type Tab = 'goals' | 'todos';

const PRIORITY_COLORS: Record<TodoPriority, string> = {
  low: 'text-slate-400',
  medium: 'text-amber-500',
  high: 'text-red-500',
};

const DEFAULT_CATEGORIES = ['Payment', 'Sale', 'Premium', 'Loan', 'Purchase', 'Other'];

export default function GoalsPage() {
  const [tab, setTab] = useState<Tab>('goals');
  const [goals, setGoals] = useState<any[]>([]);
  const [todos, setTodos] = useState<any[]>([]);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [goalForm, setGoalForm] = useState({ name: '', target: '', saved: '' });
  const [confirmDel, setConfirmDel] = useState<{ type: string; id: string } | null>(null);
  const [showTodoModal, setShowTodoModal] = useState(false);
  const [todoForm, setTodoForm] = useState({ title: '', description: '', dueDate: new Date().toISOString().split('T')[0], category: '', amount: '', priority: 'medium' as TodoPriority, important: false });
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [catHighlightIndex, setCatHighlightIndex] = useState(-1);
  const [todoFilter, setTodoFilter] = useState<'all' | 'pending' | 'completed' | 'overdue'>('pending');

  const refreshGoals = () => { setGoals(getGoals()); };
  const refreshTodos = () => { setTodos(getTodos()); };
  const refreshAll = () => { refreshGoals(); refreshTodos(); };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab');
    if (tabParam === 'todos' || tabParam === 'goals') setTab(tabParam);
    const tryRefresh = () => {
      if (isStoreReady()) { refreshAll(); }
      else { setTimeout(tryRefresh, 200); }
    };
    tryRefresh();
    const handler = () => refreshAll();
    window.addEventListener('store-ready', handler);
    return () => window.removeEventListener('store-ready', handler);
  }, []);

  const recentCategories = useMemo(() => {
    const cats = todos.filter(t => t.category).map(t => t.category);
    return [...new Set(cats)];
  }, [todos]);

  const filteredCategoryOptions = useMemo(() => {
    if (!todoForm.category) return recentCategories.slice(0, 3);
    const q = todoForm.category.toLowerCase();
    const matched = recentCategories.filter(c => c.toLowerCase().includes(q));
    const baseMatches = DEFAULT_CATEGORIES.filter(c => c.toLowerCase().includes(q) && !matched.includes(c));
    return [...matched, ...baseMatches].slice(0, 10);
  }, [recentCategories, todoForm.category]);

  const todayStr = new Date().toISOString().split('T')[0];

  const categoryRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (categoryRef.current && !categoryRef.current.contains(e.target as Node)) {
        setShowCategoryDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const filteredTodos = useMemo(() => {
    let list = todos;
    if (todoFilter === 'pending') list = list.filter(t => t.status === 'pending');
    else if (todoFilter === 'completed') list = list.filter(t => t.status === 'completed');
    else if (todoFilter === 'overdue') list = list.filter(t => t.status === 'pending' && t.dueDate && t.dueDate < todayStr);
    return list;
  }, [todos, todoFilter, todayStr]);

  const groupedTodos = useMemo(() => {
    const today = todayStr;
    const pending = filteredTodos.filter(t => t.status === 'pending')
      .sort((a, b) => {
        const aOverdue = a.dueDate && a.dueDate < today ? 1 : 0;
        const bOverdue = b.dueDate && b.dueDate < today ? 1 : 0;
        if (aOverdue !== bOverdue) return bOverdue - aOverdue;
        if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
        if (a.dueDate) return -1;
        if (b.dueDate) return 1;
        return (b.createdAt || '').localeCompare(a.createdAt || '');
      });
    const completed = filteredTodos.filter(t => t.status === 'completed')
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    const groups: Record<string, { pending: any[]; completed: any[] }> = {};
    pending.forEach(t => {
      const cat = t.category || 'Other';
      if (!groups[cat]) groups[cat] = { pending: [], completed: [] };
      groups[cat].pending.push(t);
    });
    completed.forEach(t => {
      const cat = t.category || 'Other';
      if (!groups[cat]) groups[cat] = { pending: [], completed: [] };
      groups[cat].completed.push(t);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredTodos, todayStr]);

  const handleAddGoal = (e: React.FormEvent) => {
    e.preventDefault();
    addGoal({ name: goalForm.name, target: Number(goalForm.target), saved: Number(goalForm.saved) || 0 });
    setShowGoalModal(false);
    setGoalForm({ name: '', target: '', saved: '' });
    refreshGoals();
  };

  const handleDeleteItem = (type: string, id: string) => {
    if (type === 'goal') deleteGoal(id);
    else if (type === 'todo') deleteTodo(id);
    setConfirmDel(null);
    refreshAll();
  };

  const handleAddTodo = (e: React.FormEvent) => {
    e.preventDefault();
    addTodo({
      title: todoForm.title,
      description: todoForm.description,
      dueDate: todoForm.dueDate,
      category: todoForm.category || 'other',
      amount: todoForm.amount ? Number(todoForm.amount) : undefined,
      priority: todoForm.priority,
      important: todoForm.important,
      status: 'pending',
    });
    setShowTodoModal(false);
    setTodoForm({ title: '', description: '', dueDate: new Date().toISOString().split('T')[0], category: '', amount: '', priority: 'medium', important: false });
    refreshTodos();
  };

  const handleToggleImportant = (id: string) => {
    toggleTodoImportant(id);
    refreshTodos();
  };

  const handleCompleteTodo = (id: string) => {
    completeTodo(id);
    refreshTodos();
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <Reveal><div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 hidden md:block">Goals & Tasks</h1>
          <p className="text-slate-500 dark:text-slate-400 text-base font-semibold md:font-normal md:text-sm block md:hidden">Financial goals and to-do list.</p>
          <p className="text-slate-500 dark:text-slate-400 hidden md:block">Track savings goals and manage finance-related tasks.</p>
        </div></Reveal>

        <Reveal delay={50}>
          <div className="flex items-center gap-2 border-b border-slate-200 dark:border-brand-muted">
            <button onClick={() => setTab('goals')} className={cn("px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors", tab === 'goals' ? "border-brand text-slate-900 dark:text-slate-100" : "border-transparent text-slate-400 hover:text-slate-600")}>
              <Target className="h-4 w-4 inline mr-1.5" />Goals
            </button>
            <button onClick={() => setTab('todos')} className={cn("px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors", tab === 'todos' ? "border-brand text-slate-900 dark:text-slate-100" : "border-transparent text-slate-400 hover:text-slate-600")}>
              <ListTodo className="h-4 w-4 inline mr-1.5" />Tasks
              {todos.filter(t => t.status === 'pending').length > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full text-[10px] font-bold bg-brand text-white">{todos.filter(t => t.status === 'pending').length}</span>
              )}
            </button>
          </div>
        </Reveal>

        {tab === 'goals' && (
          <>
            <Reveal delay={100}><div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">All Goals</h2>
              <button onClick={() => setShowGoalModal(true)} className="h-9 w-9 rounded-xl bg-brand text-white flex items-center justify-center hover:bg-orange-600 transition-colors active:scale-95 shrink-0" title="Add Goal"><Plus className="h-4 w-4" /></button>
            </div></Reveal>

            <Reveal delay={200}>
              {goals.length === 0 ? (
                <div className="bg-white dark:bg-[#2A2522] rounded-2xl border border-slate-200 dark:border-brand-muted shadow-sm p-12 text-center">
                  <Target className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300 mb-2">No goals set yet</h3>
                  <p className="text-slate-400 dark:text-slate-500 mb-6">Create a goal to start tracking your savings progress.</p>
                  <Button onClick={() => setShowGoalModal(true)}>Create First Goal</Button>
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
                                <Button size="sm" variant="danger" className="h-7 px-2 text-xs" onClick={() => handleDeleteItem('goal', g.id)}>Yes</Button>
                                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setConfirmDel(null)}>No</Button>
                              </div>
                            ) : (
                              <Button variant="ghost" size="sm" className="p-1 text-slate-400 hover:text-red-600 dark:hover:text-red-400 gap-1" onClick={() => setConfirmDel({ type: 'goal', id: g.id })}>
                                <Trash2 className="h-4 w-4" />
                                <span className="hidden md:inline text-xs">Delete</span>
                              </Button>
                            )}
                            <Target className="h-4 w-4 text-brand-secondary" />
                          </div>
                        </div>
                        <div className="flex justify-between text-sm mb-2">
                          <span className="text-slate-500 dark:text-slate-400">Saved: {formatCurrency(g.saved)}</span>
                          <span className="text-slate-700 dark:text-slate-300 font-medium">Target: {formatCurrency(g.target)}</span>
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
            </Reveal>
          </>
        )}

        {tab === 'todos' && (
          <>
            <Reveal delay={100}>
              <div className="flex items-center justify-center md:justify-start gap-2 flex-wrap">
                {(['all', 'pending', 'completed', 'overdue'] as const).map(f => (
                  <button key={f} onClick={() => setTodoFilter(f)}
                    className={cn("px-3 py-2 rounded-lg text-xs font-semibold transition-colors", todoFilter === f ? "bg-brand text-white" : "bg-slate-100 dark:bg-brand-muted text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-brand-muted/70")}>
                    {f === 'all' ? 'All' : f === 'pending' ? 'Pending' : f === 'completed' ? 'Done' : 'Due'}
                  </button>
                ))}
                <button onClick={() => setShowTodoModal(true)} className="ml-auto h-9 w-9 rounded-xl bg-brand text-white flex items-center justify-center hover:bg-orange-600 transition-colors active:scale-95 shrink-0" title="Add Task"><Plus className="h-4 w-4" /></button>
              </div>
            </Reveal>

            <Reveal delay={200}>
              {filteredTodos.length === 0 ? (
                <div className="bg-white dark:bg-[#2A2522] rounded-2xl border border-slate-200 dark:border-brand-muted shadow-sm p-12 text-center">
                  <ListTodo className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300 mb-2">No tasks found</h3>
                  <p className="text-slate-400 dark:text-slate-500 mb-6">Add finance-related tasks like payments, premiums, purchases, etc.</p>
                  <Button onClick={() => setShowTodoModal(true)}>Add First Task</Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {groupedTodos.map(([category, items]) => {
                    const allItems = [...items.pending, ...items.completed];
                    if (allItems.length === 0) return null;
                    return (
                      <div key={category}>
                        <h3 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 px-1">{category}</h3>
                        <div className="space-y-1.5">
                          {allItems.map(t => {
                            const overdue = t.status === 'pending' && t.dueDate && t.dueDate < todayStr;
                            return (
                              <div key={t.id} className={cn("bg-white dark:bg-[#2A2522] rounded-xl border shadow-sm", t.status === 'completed' ? "border-green-200 dark:border-green-800/50 opacity-60" : overdue ? "border-red-300 dark:border-red-800/50" : "border-slate-200 dark:border-brand-muted")}>
                                <div className="p-3 flex items-start gap-2.5">
                                  <button onClick={() => handleCompleteTodo(t.id)} className={cn("mt-0.5 shrink-0 h-4 w-4 rounded-full border-2 flex items-center justify-center transition-colors", t.status === 'completed' ? "bg-green-500 border-green-500 text-white" : "border-slate-300 dark:border-slate-600")}>
                                    {t.status === 'completed' && <CheckCircle2 className="h-3 w-3" />}
                                  </button>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className={cn("text-sm font-medium text-slate-900 dark:text-slate-100", t.status === 'completed' && "line-through")}>{t.title}</span>
                                      {t.important && <Star className="h-3 w-3 text-amber-500 fill-current" />}
                                      {overdue && <span className="text-[10px] font-semibold text-red-500 bg-red-50 dark:bg-red-900/20 px-1.5 py-0.5 rounded">Overdue</span>}
                                    </div>
                                    <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                                      {t.dueDate && <span>{new Date(t.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>}
                                      {t.amount !== undefined && t.amount > 0 && <span className="font-semibold text-slate-600 dark:text-slate-300">₹{t.amount.toLocaleString()}</span>}
                                      {t.status === 'completed' && (() => {
                                        const doneAt = t.completedAt || t.createdAt;
                                        const msLeft = 30 * 24 * 60 * 60 * 1000 - (Date.now() - new Date(doneAt).getTime());
                                        const daysLeft = Math.ceil(msLeft / (24 * 60 * 60 * 1000));
                                        if (daysLeft <= 0) return <span className="text-red-400 font-medium">Deleting soon</span>;
                                        return <span className="text-slate-400">Deletes in {daysLeft}d</span>;
                                      })()}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0">
                                    <button onClick={() => handleToggleImportant(t.id)} className={cn("p-1 rounded transition-colors", t.important ? "text-amber-500" : "text-slate-300 dark:text-slate-600")}>
                                      <Star className={cn("h-3.5 w-3.5", t.important && "fill-current")} />
                                    </button>
                                    {confirmDel?.type === 'todo' && confirmDel.id === t.id ? (
                                      <div className="flex items-center gap-1">
                                        <button onClick={() => handleDeleteItem('todo', t.id)} className="text-xs font-semibold text-red-500 px-1.5 py-0.5">Yes</button>
                                        <button onClick={() => setConfirmDel(null)} className="text-xs text-slate-400 px-1.5 py-0.5">No</button>
                                      </div>
                                    ) : (
                                      <button onClick={() => setConfirmDel({ type: 'todo', id: t.id })} className="p-1 text-slate-300 dark:text-slate-600 hover:text-red-500 transition-colors">
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Reveal>

            {/* Mobile add button */}
            <button onClick={() => setShowTodoModal(true)} className="sm:hidden fixed bottom-6 right-6 h-12 w-12 rounded-full bg-brand text-white flex items-center justify-center shadow-lg hover:bg-orange-600 transition-colors active:scale-95 z-40" title="Add Task">
              <Plus className="h-5 w-5" />
            </button>
          </>
        )}
      </div>

      {/* Goal Modal */}
      {showGoalModal && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm flex items-start sm:items-center justify-center z-50 p-4 overflow-y-auto" onClick={() => setShowGoalModal(false)}>
          <div className="bg-white dark:bg-[#2A2522] rounded-2xl max-w-lg w-full p-8 shadow-2xl my-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-6">New Goal</h2>
            <form onSubmit={handleAddGoal} className="space-y-4">
              <div className="space-y-2"><label className="text-sm font-medium text-slate-700 dark:text-slate-300 block">Goal Name</label>
                <input required value={goalForm.name} onChange={e => setGoalForm({ ...goalForm, name: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-brand-muted outline-none focus:ring-2 focus:ring-brand" placeholder="e.g. Emergency Fund" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><label className="text-sm font-medium text-slate-700 dark:text-slate-300 block">Target Amount</label>
                  <input required type="number" min="0" value={goalForm.target} onChange={e => setGoalForm({ ...goalForm, target: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-brand-muted outline-none focus:ring-2 focus:ring-brand" placeholder="₹" /></div>
                <div className="space-y-2"><label className="text-sm font-medium text-slate-700 dark:text-slate-300 block">Saved So Far</label>
                  <input type="number" min="0" value={goalForm.saved} onChange={e => setGoalForm({ ...goalForm, saved: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-brand-muted outline-none focus:ring-2 focus:ring-brand" placeholder="₹ 0" /></div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-6">
                <Button variant="ghost" size="sm" onClick={() => setShowGoalModal(false)}>Cancel</Button>
                <Button type="submit" size="sm">Create Goal</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Todo Modal */}
      {showTodoModal && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowTodoModal(false)}>
          <div className="bg-white dark:bg-[#2A2522] rounded-2xl w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="px-4 py-4 border-b border-slate-100 dark:border-brand-muted flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">New Task</h2>
              <button type="button" onClick={() => setShowTodoModal(false)} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-brand-muted transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleAddTodo} className="p-4 space-y-4">
              <input required value={todoForm.title} onChange={e => setTodoForm({ ...todoForm, title: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-brand-muted dark:bg-brand-dark outline-none focus:ring-2 focus:ring-brand text-sm" placeholder="Task title" autoFocus />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1">Due Date</label>
                  <input type="date" value={todoForm.dueDate} onChange={e => setTodoForm({ ...todoForm, dueDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-brand-muted dark:bg-brand-dark outline-none focus:ring-2 focus:ring-brand text-sm" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1">Amount</label>
                  <input type="number" min="0" value={todoForm.amount} onChange={e => setTodoForm({ ...todoForm, amount: e.target.value })} placeholder="₹"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-brand-muted dark:bg-brand-dark outline-none focus:ring-2 focus:ring-brand text-sm" />
                </div>
              </div>

              <div ref={categoryRef} className="relative">
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1">Category</label>
                <input value={todoForm.category} onChange={e => { setTodoForm({ ...todoForm, category: e.target.value }); setShowCategoryDropdown(true); setCatHighlightIndex(-1); }}
                  onFocus={() => setShowCategoryDropdown(true)}
                  onKeyDown={e => {
                    if (e.key === 'ArrowDown') { e.preventDefault(); setShowCategoryDropdown(true); setCatHighlightIndex(i => Math.min(i + 1, filteredCategoryOptions.length - 1)); }
                    else if (e.key === 'ArrowUp') { e.preventDefault(); setCatHighlightIndex(i => Math.max(i - 1, 0)); }
                    else if (e.key === 'Enter' && showCategoryDropdown && catHighlightIndex >= 0) { e.preventDefault(); setTodoForm({ ...todoForm, category: filteredCategoryOptions[catHighlightIndex] }); setShowCategoryDropdown(false); setCatHighlightIndex(-1); }
                    else if (e.key === 'Escape') { setShowCategoryDropdown(false); setCatHighlightIndex(-1); }
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-brand-muted dark:bg-brand-dark outline-none focus:ring-2 focus:ring-brand text-sm" placeholder="Search or type new" />
                {showCategoryDropdown && filteredCategoryOptions.length > 0 && (
                  <div className="absolute z-10 top-full mt-1 left-0 right-0 bg-white dark:bg-[#2A2522] border border-slate-200 dark:border-brand-muted rounded-lg shadow-lg max-h-40 overflow-y-auto">
                    {filteredCategoryOptions.map((c, i) => (
                      <button key={c} type="button" onClick={() => { setTodoForm({ ...todoForm, category: c }); setShowCategoryDropdown(false); setCatHighlightIndex(-1); }}
                        onMouseEnter={() => setCatHighlightIndex(i)}
                        className={cn("w-full text-left px-3 py-2 text-sm transition-colors", i === catHighlightIndex ? "bg-slate-100 dark:bg-brand-muted text-slate-900 dark:text-slate-100" : todoForm.category === c ? "bg-brand/10 text-brand font-semibold" : "text-slate-700 dark:text-slate-300")}>
                        {c}
                        {!DEFAULT_CATEGORIES.includes(c) && <span className="text-[10px] text-slate-400 ml-2">recent</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="flex-1">
                  <label className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1">Weightage</label>
                  <div className="flex bg-slate-100 dark:bg-brand-muted rounded-lg p-0.5">
                    {(['low', 'medium', 'high'] as TodoPriority[]).map(p => (
                      <button key={p} type="button" onClick={() => setTodoForm({ ...todoForm, priority: p })}
                        className={cn("flex-1 px-3 py-1.5 rounded-md text-xs font-semibold capitalize transition-all", todoForm.priority === p ? "bg-white dark:bg-[#2A2522] text-slate-900 dark:text-slate-100 shadow-sm" : "text-slate-400")}>
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
                <button type="button" onClick={() => setTodoForm({ ...todoForm, important: !todoForm.important })}
                  className={cn("px-4 py-2 rounded-lg border text-sm font-medium transition-colors flex items-center gap-2 mt-5", todoForm.important ? "border-amber-400 bg-amber-50 dark:bg-amber-900/20 text-amber-500" : "border-slate-200 dark:border-brand-muted text-slate-400")}>
                  <Star className={cn("h-4 w-4", todoForm.important && "fill-current")} />
                  Star
                </button>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button variant="ghost" size="sm" onClick={() => setShowTodoModal(false)}>Cancel</Button>
                <Button type="submit" size="sm">Add Task</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
