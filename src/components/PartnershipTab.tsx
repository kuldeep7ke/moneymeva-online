'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Users, Trash2, Pencil, X, TrendingUp, TrendingDown, IndianRupee } from 'lucide-react';
import { formatCurrency, cn, todayStr } from '@/lib/utils';
import { getPartnerships, addPartnership, updatePartnership, deletePartnership, getPartnershipEntries, addPartnershipEntry, deletePartnershipEntry, getPartnershipSummary, getPartnerNameSafe, getPartners, isStoreReady, getTransactions } from '@/lib/store';
import type { Partnership, PartnershipMember, SeasonType } from '@/types';
import PinPrompt from '@/components/PinPrompt';
import PinSetupGuide from '@/components/PinSetupGuide';
import { hasPins } from '@/lib/pinStore';
import Reveal from '@/components/Reveal';
import { useToast } from '@/components/Toast';
import { useTranslation } from '@/lib/i18n';

const SEASONS = ['kharif', 'rabi', 'summer', 'annual'] as const;

export default function PartnershipTab() {
  const toast = useToast();
  const { t } = useTranslation();
  const [list, setList] = useState<Partnership[]>([]);
  const [partnersList, setPartnersList] = useState<any[]>([]);

  const refresh = () => {
    if (!isStoreReady()) return;
    setList(getPartnerships());
    setPartnersList(getPartners());
  };

  useEffect(() => {
    refresh();
    const onReady = () => refresh();
    window.addEventListener('store-ready', onReady);
    return () => window.removeEventListener('store-ready', onReady);
  }, []);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showPsModal, setShowPsModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [entryFor, setEntryFor] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [pinDeleteId, setPinDeleteId] = useState<string | null>(null);
  const [showPinSetup, setShowPinSetup] = useState<string | null>(null);

  const emptyForm = () => ({
    title: '', crop: '', season: 'kharif', year: String(new Date().getFullYear()), description: '',
    members: [{ id: 'm1', name: '', partyId: '', sharePct: '' }] as { id: string; name: string; partyId: string; sharePct: string }[],
  });
  const [form, setForm] = useState(emptyForm);
  const emptyEntry = { type: 'expense' as 'income' | 'expense', amount: '', date: todayStr(), description: '', paidByPartyId: '', alsoLedger: true };
  const [entryForm, setEntryForm] = useState(emptyEntry);

  const shareTotal = form.members.reduce((s, m) => s + (Number(m.sharePct) || 0), 0);

  const [memberFocusIdx, setMemberFocusIdx] = useState<number | null>(null);

  const recentParties = useMemo(() => {
    const txs = isStoreReady() ? getTransactions() : [];
    const counts = new Map<string, number>();
    for (const tx of txs) {
      if (!tx.partnerAccountId || tx.deletedAt) continue;
      if (!partnersList.some((p: any) => p.id === tx.partnerAccountId)) continue;
      counts.set(tx.partnerAccountId, (counts.get(tx.partnerAccountId) || 0) + 1);
    }
    const ranked = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).map(([id]) => partnersList.find((p: any) => p.id === id)).filter(Boolean);
    const rest = partnersList.filter((p: any) => !counts.has(p.id));
    return [...ranked, ...rest];
  }, [partnersList]);

  const memberMatches = useMemo(() => {
    if (memberFocusIdx === null) return [];
    const q = (form.members[memberFocusIdx]?.name || '').trim().toLowerCase();
    if (!q) return recentParties.slice(0, 3);
    return partnersList.filter((p: any) => !p.deletedAt && p.name.toLowerCase().includes(q)).slice(0, 8);
  }, [memberFocusIdx, form.members, partnersList, recentParties]);

  const handleSavePs = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    const members: PartnershipMember[] = form.members
      .filter(m => m.name.trim())
      .map((m, i) => {
        const name = m.name.trim();
        let partyId = m.partyId;
        if (!partyId) {
          const match = partnersList.find((x: any) => !x.deletedAt && x.name.toLowerCase() === name.toLowerCase());
          if (match) partyId = match.id;
        }
        return { id: m.id || `mem-${i}-${Date.now()}`, name, partyId: partyId || undefined, sharePct: Number(m.sharePct) || 0 };
      });
    if (members.length === 0) { toast(t('ps.needMember'), 'warning'); return; }
    const total = members.reduce((s, m) => s + m.sharePct, 0);
    if (Math.round(total) !== 100) { toast(t('ps.shareMust100').replace('{total}', String(Math.round(total))), 'warning'); return; }
    const payload = { title: form.title.trim(), crop: form.crop.trim(), season: form.season as SeasonType, year: Number(form.year) || new Date().getFullYear(), description: form.description.trim() || undefined, members };
    if (editingId) {
      updatePartnership(editingId, payload);
      toast(t('ps.updated'), 'success');
    } else {
      addPartnership(payload);
      toast(t('ps.added'), 'success');
    }
    setShowPsModal(false);
    setEditingId(null);
    setForm(emptyForm());
    refresh();
  };

  const handleEditClick = (p: Partnership) => {
    setEditingId(p.id);
    setForm({
      title: p.title,
      crop: p.crop || '',
      season: p.season,
      year: String(p.year),
      description: p.description || '',
      members: (p.members?.length ? p.members : [{ id: 'm1', name: '', partyId: '', sharePct: '' }]).map((m, i) => ({ id: m.id || `m${i}`, name: m.name, partyId: m.partyId || '', sharePct: String(m.sharePct) })),
    });
    setShowPsModal(true);
  };

  const handleAddEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!entryFor) return;
    const amount = Number(entryForm.amount);
    if (!(amount > 0)) { toast(t('works.amountPositive'), 'warning'); return; }
    if (entryForm.date > todayStr()) { toast(t('works.noFuture'), 'warning'); return; }
    if (entryForm.type === 'expense' && !entryForm.paidByPartyId) { toast(t('ps.paidByRequired'), 'warning'); return; }
    addPartnershipEntry({
      partnershipId: entryFor,
      type: entryForm.type,
      amount,
      date: entryForm.date,
      description: entryForm.description.trim(),
      paidByPartyId: entryForm.type === 'expense' ? entryForm.paidByPartyId : undefined,
    }, { alsoLedger: entryForm.alsoLedger });
    toast(`${formatCurrency(amount)} · ${entryForm.type === 'income' ? t('ps.income') : t('ps.expense')}${entryForm.alsoLedger ? ` · ${t('works.ledgerSynced')}` : ''}`, 'success');
    setEntryFor(null);
    setEntryForm(emptyEntry);
    refresh();
  };

  const handleDelete = (id: string) => {
    const ps = list.find(x => x.id === id);
    const createdToday = ps && ps.createdAt?.split('T')[0] === todayStr();
    if (createdToday) doDelete(id);
    else if (hasPins()) setPinDeleteId(id);
    else setShowPinSetup(t('ps.deleteAction'));
  };

  const doDelete = (id: string) => {
    deletePartnership(id);
    setConfirmDelete(null);
    toast(t('ps.deleted'), 'success');
    refresh();
  };

  return (
    <div className="space-y-6">
      <Reveal>
        <div className="flex items-center justify-between">
          <p className="text-slate-500 dark:text-slate-400 text-sm">{t('ps.subtitle')}</p>
          <button onClick={() => { setEditingId(null); setForm(emptyForm()); setShowPsModal(true); }} className="h-10 w-10 rounded-xl bg-brand text-white flex items-center justify-center hover:bg-orange-600 transition-colors active:scale-95 shrink-0" type="button" title={t('ps.add')}>
            <Plus className="h-5 w-5" />
          </button>
        </div>
      </Reveal>

      {list.length === 0 && (
        <Reveal delay={100}>
          <div className="bg-white dark:bg-[#2A2522] rounded-2xl border border-slate-200 dark:border-brand-muted shadow-sm p-12 text-center">
            <Users className="h-12 w-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300 mb-2">{t('ps.emptyTitle')}</h3>
            <p className="text-slate-400 dark:text-slate-500 mb-6">{t('ps.emptyBody')}</p>
            <Button onClick={() => { setEditingId(null); setForm(emptyForm()); setShowPsModal(true); }}>{t('ps.first')}</Button>
          </div>
        </Reveal>
      )}

      <div className="grid grid-cols-1 gap-6">
        {list.map(ps => {
          const entries = getPartnershipEntries(ps.id);
          const sum = getPartnershipSummary(ps.id);
          const open = expandedId === ps.id;
          return (
            <div key={ps.id} className="bg-white dark:bg-[#2A2522] rounded-2xl border border-slate-200 dark:border-brand-muted shadow-sm overflow-hidden">
              <button type="button" onClick={() => setExpandedId(open ? null : ps.id)} className="w-full text-left p-6 pb-4 flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-brand-secondary dark:bg-brand-muted/30 rounded-xl text-brand dark:text-brand-secondary"><Users className="h-6 w-6" /></div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">{ps.title}</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 capitalize">
                      {ps.crop ? `${ps.crop} · ` : ''}{t(`works.season.${ps.season}`)} {ps.year} · {ps.members.length} {t('ps.members')}
                    </p>
                  </div>
                </div>
                <span className={cn("text-xs px-2 py-1 rounded-full font-medium", sum.totalIncome - sum.totalExpense >= 0 ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400")}>
                  Net {formatCurrency(sum.totalIncome - sum.totalExpense)}
                </span>
              </button>

              {open && (
                <div className="px-6 pb-6 space-y-5">
                  {/* Member shares */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {sum.rows.map(r => (
                      <div key={r.memberId} className="p-3 bg-slate-50 dark:bg-brand-muted rounded-xl border border-slate-100 dark:border-brand-muted">
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate">{r.name}</p>
                        <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{r.sharePct}%</p>
                        <p className={cn("text-xs font-semibold", r.balance >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400")}>
                          {r.balance >= 0 ? '+' : ''}{formatCurrency(r.balance)}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Entries */}
                  <div className="rounded-xl border border-slate-100 dark:border-brand-muted divide-y divide-slate-50 dark:divide-brand-muted max-h-64 overflow-y-auto">
                    {entries.length === 0 ? (
                      <p className="p-4 text-center text-sm text-slate-400">{t('ps.noEntries')}</p>
                    ) : (
                      [...entries].sort((a, b) => b.date.localeCompare(a.date)).map(e => (
                        <div key={e.id} className="px-4 py-2.5 flex items-center justify-between group">
                          <div className="min-w-0">
                            <p className="text-sm text-slate-900 dark:text-slate-100 truncate">{e.description}</p>
                            <p className="text-[11px] text-slate-400">
                              {e.date}{e.type === 'expense' && e.paidByPartyId ? ` · ${t('ps.paidByEntry').replace('{name}', getPartnerNameSafe(e.paidByPartyId))}` : ''}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 ml-2">
                            <span className={cn("text-sm font-medium", e.type === 'income' ? "text-green-600" : "text-red-600")}>
                              {e.type === 'income' ? '+' : '-'}{formatCurrency(e.amount)}
                            </span>
                            <button onClick={() => { deletePartnershipEntry(e.id); refresh(); }} className="opacity-0 group-hover:opacity-100 p-1 text-slate-300 hover:text-red-500 transition-opacity" title={t('common.delete')}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Settlement summary */}
                  {sum.rows.length > 0 && (
                    <div className="rounded-xl bg-slate-50 dark:bg-brand-muted/50 border border-slate-100 dark:border-brand-muted p-4">
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">{t('ps.settlement')}</p>
                      <div className="space-y-2">
                        {sum.rows.map(r => (
                          <div key={r.memberId} className="flex items-center justify-between text-sm">
                            <span className="text-slate-700 dark:text-slate-300 truncate">{r.name}</span>
                            <span className="flex items-center gap-3 shrink-0">
                              <span className="text-[11px] text-slate-400 hidden md:inline">{t('ps.paidShort')} {formatCurrency(r.paid)}</span>
                              <span className={cn("font-semibold", r.balance >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400")}>
                                {r.balance >= 0 ? t('ps.gets') : t('ps.owes')} {formatCurrency(Math.abs(r.balance))}
                              </span>
                            </span>
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-200 dark:border-brand-muted text-xs text-slate-500 dark:text-slate-400">
                        <span className="flex items-center gap-1"><TrendingUp className="h-3 w-3 text-green-500" /> {formatCurrency(sum.totalIncome)}</span>
                        <span className="flex items-center gap-1"><TrendingDown className="h-3 w-3 text-red-500" /> {formatCurrency(sum.totalExpense)}</span>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-3">
                    <Button variant="outline" size="sm" className="gap-2" onClick={() => { setEntryFor(ps.id); setEntryForm({ ...emptyEntry }); }}>
                      <IndianRupee className="h-4 w-4" /> {t('ps.addEntry')}
                    </Button>
                    <Button variant="ghost" size="sm" className="gap-1 text-slate-500 dark:text-slate-400" onClick={() => handleEditClick(ps)}>
                      <Pencil className="h-4 w-4" /> {t('common.edit')}
                    </Button>
                    {confirmDelete === ps.id ? (
                      <div className="ml-auto flex gap-1 items-center">
                        <Button size="sm" variant="danger" className="h-6 px-1.5 text-xs min-w-0" onClick={() => handleDelete(ps.id)}>Yes</Button>
                        <Button size="sm" variant="ghost" className="h-6 px-1.5 text-xs min-w-0" onClick={() => setConfirmDelete(null)}>No</Button>
                      </div>
                    ) : (
                      <Button variant="ghost" size="sm" className="ml-auto gap-1 text-slate-400 hover:text-red-600 dark:hover:text-red-400" onClick={() => setConfirmDelete(ps.id)}>
                        <Trash2 className="h-4 w-4" /> {t('common.delete')}
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add/Edit Partnership Modal */}
      {showPsModal && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm flex items-start sm:items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white dark:bg-[#2A2522] rounded-2xl max-w-lg w-full p-6 shadow-2xl my-4">
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-4">{editingId ? t('ps.editTitle') : t('ps.addTitle')}</h2>
            <form onSubmit={handleSavePs} className="space-y-4">
              <input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-brand-muted outline-none focus:ring-2 focus:ring-brand text-base" placeholder={t('ps.titlePlaceholder')} />
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 block mb-1">{t('works.crop')}</label>
                  <input value={form.crop} onChange={e => setForm({ ...form, crop: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-brand-muted outline-none focus:ring-2 focus:ring-brand text-sm" placeholder={t('works.cropPlaceholder')} />
                </div>
                <div>
                  <label className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 block mb-1">{t('works.season')}</label>
                  <select value={form.season} onChange={e => setForm({ ...form, season: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-brand-muted outline-none focus:ring-2 focus:ring-brand text-sm">
                    {SEASONS.map(s => <option key={s} value={s}>{t(`works.season.${s}`)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 block mb-1">{t('works.year')}</label>
                  <input type="number" value={form.year} onChange={e => setForm({ ...form, year: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-brand-muted outline-none focus:ring-2 focus:ring-brand text-sm" />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">{t('ps.membersShare')}</label>
                  <span className={cn("text-xs font-semibold", Math.round(shareTotal) === 100 ? "text-green-600" : "text-amber-600")}>{Math.round(shareTotal)}%</span>
                </div>
                <div className="space-y-2">
                  {form.members.map((m, i) => (
                    <div key={m.id} className="grid grid-cols-[1fr_72px_36px] gap-2 items-center">
                      <div className="relative">
                        <input value={m.name} autoComplete="off"
                          onChange={e => {
                            const name = e.target.value;
                            const match = partnersList.find((x: any) => !x.deletedAt && x.name.toLowerCase() === name.trim().toLowerCase());
                            const members = [...form.members];
                            members[i] = { ...members[i], name, partyId: match ? match.id : '' };
                            setForm({ ...form, members });
                          }}
                          onFocus={() => setMemberFocusIdx(i)}
                          onBlur={() => setTimeout(() => setMemberFocusIdx(cur => (cur === i ? null : cur)), 120)}
                          onKeyDown={e => { if (e.key === 'Escape') setMemberFocusIdx(null); }}
                          className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-brand-muted outline-none focus:ring-2 focus:ring-brand text-sm"
                          placeholder={t('ps.customName')} />
                        {memberFocusIdx === i && memberMatches.length > 0 && (
                          <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-[#2A2522] border border-slate-200 dark:border-brand-muted rounded-lg shadow-lg max-h-44 overflow-y-auto z-20">
                            {memberMatches.map((p: any) => (
                              <button type="button" key={p.id}
                                onMouseDown={e => e.preventDefault()}
                                onClick={() => {
                                  const members = [...form.members];
                                  members[i] = { ...members[i], name: p.name, partyId: p.id };
                                  setForm({ ...form, members });
                                  setMemberFocusIdx(null);
                                }}
                                className="w-full text-left px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-brand-secondary dark:hover:bg-brand-muted/40 truncate">
                                {p.name}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <input required min="0" max="100" type="number" placeholder="%" value={m.sharePct}
                        onChange={e => { const members = [...form.members]; members[i] = { ...members[i], sharePct: e.target.value }; setForm({ ...form, members }); }}
                        className="w-full px-2 py-2 rounded-lg border border-slate-200 dark:border-brand-muted outline-none focus:ring-2 focus:ring-brand text-sm text-center" />
                      <button type="button" disabled={form.members.length <= 1}
                        onClick={() => setForm({ ...form, members: form.members.filter(x => x.id !== m.id) })}
                        className="p-2 text-slate-300 hover:text-red-500 disabled:opacity-30 disabled:hover:text-slate-300">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
                <button type="button" onClick={() => setForm({ ...form, members: [...form.members, { id: `m${Date.now()}`, name: '', partyId: '', sharePct: '' }] })}
                  className="mt-2 text-xs font-medium text-brand hover:text-orange-600 flex items-center gap-1">
                  <Plus className="h-3.5 w-3.5" /> {t('ps.addMember')}
                </button>
              </div>

              <div>
                <label className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 block mb-1">{t('works.notes')}</label>
                <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-brand-muted outline-none focus:ring-2 focus:ring-brand text-sm" placeholder={t('works.notesPlaceholder')} />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button variant="ghost" size="sm" onClick={() => { setShowPsModal(false); setEditingId(null); setForm(emptyForm()); }}>{t('common.cancel')}</Button>
                <Button type="submit" size="sm">{editingId ? t('common.save') : t('ps.create')}</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Entry Modal */}
      {entryFor && (() => {
        const ps = list.find(p => p.id === entryFor);
        if (!ps) return null;
        const memberPartyIds = ps.members.filter(m => m.partyId).map(m => m.partyId);
        return (
          <div className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm flex items-start sm:items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-white dark:bg-[#2A2522] rounded-2xl max-w-md w-full p-6 shadow-2xl my-4">
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-1">{t('ps.addEntryTitle')}</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">{ps.title}</p>
              <form onSubmit={handleAddEntry} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block">{t('ps.typeLabel')}</label>
                    <select value={entryForm.type} onChange={e => setEntryForm({ ...entryForm, type: e.target.value as any })}
                      className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-brand-muted outline-none focus:ring-2 focus:ring-brand">
                      <option value="expense">{t('ps.expense')}</option>
                      <option value="income">{t('ps.income')}</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block">{t('works.amountLabel')}</label>
                    <input required type="number" min="0" step="0.01" value={entryForm.amount} onChange={e => setEntryForm({ ...entryForm, amount: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-brand-muted outline-none focus:ring-2 focus:ring-brand" placeholder="₹ 0" />
                  </div>
                </div>
                {entryForm.type === 'expense' && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block">{t('ps.paidBy')}</label>
                    <select required value={entryForm.paidByPartyId} onChange={e => setEntryForm({ ...entryForm, paidByPartyId: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-brand-muted outline-none focus:ring-2 focus:ring-brand">
                      <option value="">{t('ps.selectPayer')}</option>
                      {memberPartyIds.map(pid => <option key={pid} value={pid}>{getPartnerNameSafe(pid)}</option>)}
                    </select>
                    <p className="text-[11px] text-slate-400">{t('ps.paidByHint')}</p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block">{t('works.dateLabel')}</label>
                    <input required type="date" max={todayStr()} value={entryForm.date} onChange={e => setEntryForm({ ...entryForm, date: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-brand-muted outline-none focus:ring-2 focus:ring-brand" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block">{t('ps.descriptionLabel')}</label>
                    <input required value={entryForm.description} onChange={e => setEntryForm({ ...entryForm, description: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-brand-muted outline-none focus:ring-2 focus:ring-brand" placeholder={t('ps.descriptionPlaceholder')} />
                  </div>
                </div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={entryForm.alsoLedger} onChange={e => setEntryForm({ ...entryForm, alsoLedger: e.target.checked })}
                    className="h-4 w-4 accent-[#EA580C]" />
                  <span className="text-sm text-slate-600 dark:text-slate-400">{t('ps.alsoLedger')}</span>
                </label>
                <div className="flex items-center justify-end gap-2 pt-2">
                  <Button variant="ghost" size="sm" onClick={() => { setEntryFor(null); setEntryForm(emptyEntry); }}>{t('common.cancel')}</Button>
                  <Button type="submit" size="sm">{t('ps.saveEntry')}</Button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      <PinPrompt
        open={pinDeleteId !== null}
        onClose={() => setPinDeleteId(null)}
        onSuccess={() => { if (pinDeleteId) doDelete(pinDeleteId); setPinDeleteId(null); }}
        title={t('ps.deletePinTitle')}
        message={t('ps.deletePinMsg')}
      />

      <PinSetupGuide
        open={showPinSetup !== null}
        onClose={() => setShowPinSetup(null)}
        action={showPinSetup || ''}
      />
    </div>
  );
}
