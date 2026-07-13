'use client';

import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Archive, Undo2, Trash2, Shield, ShieldOff } from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { initDB, getAllArchivedItems, restoreArchivedItem, permanentDeleteArchivedItem, permanentDeleteAllArchived, getDaysUntilDelete, isKeepForever, toggleKeepForever } from '@/lib/store';
import { ArchivedItem, ArchiveItemType } from '@/types';
import PinPrompt from '@/components/PinPrompt';
import PinSetupGuide from '@/components/PinSetupGuide';
import { hasPins } from '@/lib/pinStore';
import { logActivity } from '@/lib/activityLog';
import Reveal from '@/components/Reveal';

export default function ArchivePage() {
  const [items, setItems] = useState<ArchivedItem[]>([]);
  const [confirmClear, setConfirmClear] = useState(false);
  const [pinAction, setPinAction] = useState<{ type: 'restore' | 'delete' | 'clear'; item?: ArchivedItem } | null>(null);
  const [showPinSetup, setShowPinSetup] = useState<string | null>(null);

  const refresh = async () => {
    await initDB();
    setItems(getAllArchivedItems());
  };

  useEffect(() => { refresh(); }, []);

  const requirePin = (action: 'restore' | 'delete' | 'clear', item?: ArchivedItem) => {
    if (hasPins()) {
      setPinAction({ type: action, item });
    } else {
      const label = action === 'clear' ? 'empty the archive' : action === 'restore' ? 'restore an item' : 'permanently delete an item';
      setShowPinSetup(label);
    }
  };

  const executeAction = async (actionType: string, item?: ArchivedItem) => {
    if (actionType === 'restore' && item) {
      restoreArchivedItem(item.type as ArchiveItemType, item.id);
      logActivity('entry_restored', `${item.type} — ${item.label}`);
    } else if (actionType === 'delete' && item) {
      permanentDeleteArchivedItem(item.type as ArchiveItemType, item.id);
      logActivity('entry_deleted', `${item.type} — ${item.label}`);
    } else if (actionType === 'clear') {
      await permanentDeleteAllArchived();
      logActivity('entry_deleted', 'Archive cleared — all items');
      setConfirmClear(false);
    }
    refresh();
  };

  const handleRestore = (item: ArchivedItem) => requirePin('restore', item);
  const handleDelete = (item: ArchivedItem) => requirePin('delete', item);
  const handleClearAll = () => requirePin('clear');

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <Reveal>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 hidden md:block">Archive</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 text-base font-semibold md:font-normal md:text-sm block md:hidden">{"Restore or permanently delete archived items".split(' ').slice(0, 5).join(' ')}{"Restore or permanently delete archived items".split(' ').length > 5 ? '...' : ''}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 hidden md:block">Restore or permanently delete archived items</p>
            </div>
            {items.length > 0 && (
              <div className="flex gap-2">
                {confirmClear ? (
                  <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/30 px-4 py-2 rounded-xl border border-red-200 dark:border-red-700">
                    <span className="text-sm text-red-600 dark:text-red-400 font-medium">Delete all {items.length} items?</span>
                    <Button size="sm" variant="danger" onClick={handleClearAll} className="h-8">Yes</Button>
                    <Button size="sm" variant="ghost" onClick={() => setConfirmClear(false)} className="h-8">No</Button>
                  </div>
                ) : (
                  <Button variant="outline" className="gap-2 text-red-600 dark:text-red-400 border-red-200 dark:border-red-700" onClick={() => setConfirmClear(true)}>
                    <Trash2 className="h-4 w-4" /> Empty Archive
                  </Button>
                )}
              </div>
            )}
          </div>
        </Reveal>

        <Reveal delay={100}>
          {items.length === 0 ? (
            <div className="bg-brand-light dark:bg-[#2A2522] rounded-2xl border border-slate-200 dark:border-brand-muted shadow-sm p-12 text-center">
              <Archive className="h-12 w-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300 mb-2">Archive is empty</h3>
              <p className="text-slate-400 dark:text-slate-500">Deleted items will appear here</p>
            </div>
          ) : (
            <div className="bg-brand-light dark:bg-[#2A2522] rounded-2xl border border-slate-200 dark:border-brand-muted shadow-sm overflow-hidden">
              {/* Mobile Card View */}
              <div className="md:hidden divide-y divide-slate-200 dark:divide-brand-muted">
                {items.map(item => {
                  const daysLeft = getDaysUntilDelete(item.deletedAt);
                  const kept = isKeepForever(item.id);
                  return (
                  <div key={`${item.type}-${item.id}`} className="px-4 py-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{item.label}</p>
                        {item.subtitle && <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">{item.subtitle}</p>}
                      </div>
                      <p className={cn("text-sm font-bold shrink-0", item.amount > 0 ? "text-green-600 dark:text-green-400" : "text-slate-700 dark:text-slate-300")}>
                        {item.amount ? formatCurrency(item.amount) : '-'}
                      </p>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <p className="text-xs text-slate-400 dark:text-slate-500">{new Date(item.deletedAt).toLocaleDateString('en-IN')}</p>
                        {!kept && daysLeft > 0 && <span className="text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-1.5 py-0.5 rounded">{daysLeft}d left</span>}
                        {!kept && daysLeft <= 0 && <span className="text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-1.5 py-0.5 rounded">Expiring today</span>}
                        {kept && <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-1.5 py-0.5 rounded">Kept</span>}
                      </div>
                      <div className="flex items-center gap-1">
                        <button className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors" onClick={() => { toggleKeepForever(item.id); refresh(); }} title={kept ? 'Allow auto-delete' : 'Keep forever'}>
                          {kept ? <ShieldOff className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
                        </button>
                        <button className="p-1.5 rounded-lg text-brand hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors" onClick={() => handleRestore(item)} title="Restore">
                          <Undo2 className="h-4 w-4" />
                        </button>
                        <button className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors" onClick={() => handleDelete(item)} title="Delete permanently">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left table-fixed">
                  <thead className="bg-slate-100 dark:bg-brand-muted border-b border-slate-200 dark:border-brand-muted">
                    <tr>
                      <th className="px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-400" style={{width:'16.67%'}}>Item</th>
                      <th className="px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-400" style={{width:'33.33%'}}>Details</th>
                      <th className="px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-400 text-right" style={{width:'11.11%'}}>Amount</th>
                      <th className="px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-400" style={{width:'11.11%'}}>Archived</th>
                      <th className="px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-400" style={{width:'11.11%'}}>Auto-Delete</th>
                      <th className="px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-400 text-right" style={{width:'16.67%'}}>Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-brand-muted">
                    {items.map(item => {
                      const daysLeft = getDaysUntilDelete(item.deletedAt);
                      const kept = isKeepForever(item.id);
                      return (
                      <tr key={`${item.type}-${item.id}`} className="hover:bg-slate-50 dark:hover:bg-brand-muted/50 transition-colors">
                        <td className="px-6 py-4 text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{item.label}</td>
                        <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400 truncate">{item.subtitle}</td>
                        <td className={cn("px-6 py-4 text-sm font-bold text-right", item.amount > 0 ? "text-green-600 dark:text-green-400" : "text-slate-700 dark:text-slate-300")}>
                          {item.amount ? formatCurrency(item.amount) : '-'}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-500">{new Date(item.deletedAt).toLocaleDateString('en-IN')}</td>
                        <td className="px-6 py-4">
                          {kept ? (
                            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded">Kept</span>
                          ) : daysLeft > 0 ? (
                            <span className="text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded">{daysLeft}d left</span>
                          ) : (
                            <span className="text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded">Today</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-slate-400 hover:text-amber-600" onClick={() => { toggleKeepForever(item.id); refresh(); }} title={kept ? 'Allow auto-delete' : 'Keep forever'}>
                              {kept ? <ShieldOff className="h-3.5 w-3.5" /> : <Shield className="h-3.5 w-3.5" />}
                              <span className="ml-1">{kept ? 'Unprotect' : 'Protect'}</span>
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-brand hover:text-green-600" onClick={() => handleRestore(item)}>
                              <Undo2 className="h-3 w-3 mr-1" /> Restore
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-slate-400 hover:text-red-600 dark:hover:text-red-400" onClick={() => handleDelete(item)}>
                              <Trash2 className="h-3 w-3 mr-1" /> Delete
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </Reveal>
      </div>

      <PinPrompt
        open={pinAction !== null}
        onClose={() => setPinAction(null)}
        onSuccess={() => {
          if (pinAction) { const a = pinAction; setPinAction(null); executeAction(a.type, a.item); }
        }}
        title={pinAction?.type === 'clear' ? 'Clear All Archive' : pinAction?.type === 'restore' ? 'Restore Item' : 'Delete Item'}
        message={pinAction?.type === 'clear' ? 'Enter a PIN to permanently delete all archived items' : `Enter a PIN to ${pinAction?.type === 'restore' ? 'restore' : 'permanently delete'} this item`}
      />

      <PinSetupGuide
        open={showPinSetup !== null}
        onClose={() => setShowPinSetup(null)}
        action={showPinSetup || ''}
      />
    </DashboardLayout>
  );
}