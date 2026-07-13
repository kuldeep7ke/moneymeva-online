'use client';

import React, { useState, useEffect, useMemo } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { 
  ScrollText, 
  Search, 
  Download, 
  ChevronDown, 
  ChevronUp, 
  Copy, 
  Check, 
  Filter, 
  ArrowUpCircle,
  Users,
  Calendar,
  Landmark,
  Bell,
  SlidersHorizontal,
  Target,
  ListTodo
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getMutationLog, getMutationLogByTransitionId } from '@/lib/store';
import { MutationAction, MutationLog } from '@/types';
import Reveal from '@/components/Reveal';
import { LucideIcon } from 'lucide-react';

const ENTITY_ICONS: Record<string, LucideIcon> = {
  transaction: ArrowUpCircle,
  party: Users,
  partner: Users,
  recurring: Calendar,
  budget: Landmark,
  reminder: Bell,
  adjustment: SlidersHorizontal,
  goal: Target,
  todo: ListTodo,
};

const ACTION_COLORS: Record<MutationAction, string> = {
  created: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  updated: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  deleted: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  restored: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  toggled: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  completed: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
  permanent_deleted: 'bg-slate-800 text-slate-200 dark:bg-slate-700 dark:text-slate-300',
  advanced: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
};

function formatEntityType(type: string): string {
  if (type === 'partner') return 'Party';
  return type.charAt(0).toUpperCase() + type.slice(1);
}

export default function LedgerPage() {
  const [logs, setLogs] = useState<MutationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [chain, setChain] = useState<MutationLog[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  // Filters
  const [entityFilter, setEntityFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    async function loadLogs() {
      setLoading(true);
      const data = await getMutationLog(500);
      setLogs(data);
      setLoading(false);
    }
    loadLogs();
  }, []);

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const matchEntity = entityFilter === 'all' || log.entityType === entityFilter;
      const matchAction = actionFilter === 'all' || log.action === actionFilter;
      const matchSearch = searchQuery === '' || 
        log.detail?.toLowerCase().includes(searchQuery.toLowerCase()) || 
        log.transitionId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.entityId.toLowerCase().includes(searchQuery.toLowerCase());
      return matchEntity && matchAction && matchSearch;
    });
  }, [logs, entityFilter, actionFilter, searchQuery]);

  const handleExpand = async (transitionId: string) => {
    if (expandedId === transitionId) {
      setExpandedId(null);
      setChain([]);
    } else {
      setExpandedId(transitionId);
      const history = await getMutationLogByTransitionId(transitionId);
      setChain(history);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const exportToCSV = () => {
    const headers = ['Transition ID', 'Entity', 'ID', 'Action', 'Timestamp', 'User', 'Detail'];
    const rows = filteredLogs.map(l => [
      l.transitionId,
      l.entityType,
      l.entityId,
      l.action,
      l.timestamp,
      l.userId,
      `"${l.detail || ''}"`
    ]);
    
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `money_meva_ledger_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatTimestamp = (ts: string) => {
    const date = new Date(ts);
    const now = new Date();
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <Reveal>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Audit Ledger</h1>
              <p className="text-slate-500 dark:text-slate-400">Full traceability of every data transition</p>
            </div>
            <Button onClick={exportToCSV} className="gap-2 bg-brand hover:bg-brand-dark text-white">
              <Download className="h-4 w-4" /> Export CSV
            </Button>
          </div>
        </Reveal>

        <Reveal delay={100}>
          <div className="bg-white dark:bg-[#2A2522] p-4 rounded-2xl border border-slate-200 dark:border-brand-muted shadow-sm flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 flex-1 min-w-[240px]">
              <Search className="h-4 w-4 text-slate-400 ml-2" />
              <input 
                value={searchQuery} 
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search transitionId, entity, or detail..."
                className="w-full bg-transparent outline-none text-sm text-slate-700 dark:text-slate-200"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-slate-400" />
              <select 
                value={entityFilter} 
                onChange={e => setEntityFilter(e.target.value)}
                className="bg-transparent text-xs font-medium text-slate-500 dark:text-slate-400 outline-none cursor-pointer"
              >
                <option value="all">All Entities</option>
                {Object.keys(ENTITY_ICONS).map(type => <option key={type} value={type}>{formatEntityType(type)}</option>)}
              </select>
              <select 
                value={actionFilter} 
                onChange={e => setActionFilter(e.target.value)}
                className="bg-transparent text-xs font-medium text-slate-500 dark:text-slate-400 outline-none cursor-pointer"
              >
                <option value="all">All Actions</option>
                {Object.keys(ACTION_COLORS).map(action => <option key={action} value={action}>{action.charAt(0).toUpperCase() + action.slice(1)}</option>)}
              </select>
            </div>
          </div>
        </Reveal>

        <Reveal delay={200}>
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin h-6 w-6 border-2 border-brand border-t-transparent rounded-full" />
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="bg-white dark:bg-[#2A2522] rounded-2xl border border-slate-200 dark:border-brand-muted p-12 text-center">
              <ScrollText className="h-12 w-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300">No entries found</h3>
              <p className="text-slate-400 dark:text-slate-500">Try adjusting your filters or search query.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredLogs.map((log) => {
                const Icon = ENTITY_ICONS[log.entityType] || ScrollText;
                return (
                  <div key={log.id} className="bg-white dark:bg-[#2A2522] rounded-xl border border-slate-200 dark:border-brand-muted shadow-sm overflow-hidden transition-all">
                    <div 
                      className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-brand-muted/30 transition-colors"
                      onClick={() => handleExpand(log.transitionId)}
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="p-2 rounded-lg bg-slate-100 dark:bg-brand-muted text-slate-600 dark:text-slate-400">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={cn("text-[10px] font-bold uppercase px-1.5 py-0.5 rounded", ACTION_COLORS[log.action as MutationAction] || 'bg-slate-100 text-slate-600')}>
                              {log.action}
                            </span>
                            <span className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                              {log.detail || `${formatEntityType(log.entityType)} record`}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] text-slate-400 font-mono">{log.transitionId}</span>
                            <span className="text-[10px] text-slate-300">•</span>
                            <span className="text-[10px] text-slate-400">{formatTimestamp(log.timestamp)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button 
                          onClick={(e) => { e.stopPropagation(); copyToClipboard(log.transitionId); }}
                          className="p-1.5 rounded-md text-slate-400 hover:text-brand transition-colors"
                          title="Copy transitionId"
                        >
                          {copiedId === log.transitionId ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                        </button>
                        {expandedId === log.transitionId ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                      </div>
                    </div>
                    {expandedId === log.transitionId && (
                      <div className="border-t border-slate-100 dark:border-brand-muted bg-slate-50/50 dark:bg-brand-muted/20 p-4">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Life Cycle Chain</h4>
                          <span className="text-[10px] font-mono bg-slate-200 dark:bg-brand-muted px-2 py-0.5 rounded text-slate-600 dark:text-slate-300">
                            {log.transitionId}
                          </span>
                        </div>
                        <div className="relative space-y-4 pl-4 border-l-2 border-slate-200 dark:border-brand-muted ml-2">
                          {chain.map((step) => (
                            <div key={step.id} className="relative">
                              <div className="absolute -left-[21px] top-1 h-3 w-3 rounded-full bg-white dark:bg-brand-dark border-2 border-brand" />
                              <div className="flex items-start justify-between gap-4">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className={cn("text-[9px] font-bold uppercase px-1 py-0.5 rounded", ACTION_COLORS[step.action as MutationAction])}>
                                      {step.action}
                                    </span>
                                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{step.detail || 'No detail provided'}</span>
                                  </div>
                                  <span className="text-[10px] text-slate-400">{new Date(step.timestamp).toLocaleString('en-IN')}</span>
                                </div>
                                <span className="text-[10px] font-mono text-slate-400">{step.id}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Reveal>
      </div>
    </DashboardLayout>
  );
}
