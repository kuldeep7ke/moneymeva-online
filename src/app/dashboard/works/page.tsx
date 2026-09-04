'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Plus, Sprout, ArrowDownLeft, ArrowUpRight, Trash2, X, Pencil, IndianRupee, Clock } from 'lucide-react';
import { formatCurrency, cn, todayStr } from '@/lib/utils';
import { getWorks, getWorkStatus, workPendingAmount, workDurationDays, addWork, updateWork, deleteWork, recordWorkPayment, getPartnerNameSafe, getPartnerships, getPartners, getTransactions, addPartner, isStoreReady } from '@/lib/store';
import { AREA_UNITS, getWorkProfile, profileForProfession, workProfilesForProfession } from '@/lib/defaultCategories';
import type { WorkEntry, WorkDirection, SeasonType } from '@/types';
import PinPrompt from '@/components/PinPrompt';
import PinSetupGuide from '@/components/PinSetupGuide';
import { hasPins } from '@/lib/pinStore';
import Reveal from '@/components/Reveal';
import { useTranslation } from '@/lib/i18n';
import { useToast } from '@/components/Toast';
import { useAuth } from '@/components/AuthProvider';

const SEASONS = ['kharif', 'rabi', 'summer', 'annual'] as const;

export default function WorksPage() {
  const toast = useToast();
  const { t } = useTranslation();
  const { profile } = useAuth();
  const [works, setWorks] = useState<WorkEntry[]>([]);
  const [partnersList, setPartnersList] = useState<any[]>([]);
  const [partnershipsList, setPartnershipsList] = useState<any[]>([]);

  const refresh = () => {
    if (!isStoreReady()) return;
    setWorks(getWorks());
    setPartnersList(getPartners());
    setPartnershipsList(getPartnerships());
  };

  useEffect(() => {
    refresh();
    const onReady = () => refresh();
    window.addEventListener('store-ready', onReady);
    return () => window.removeEventListener('store-ready', onReady);
  }, []);

  const [filterDir, setFilterDir] = useState<'all' | WorkDirection>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [payWorkId, setPayWorkId] = useState<string | null>(null);
  const [historyId, setHistoryId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [pinDeleteId, setPinDeleteId] = useState<string | null>(null);
  const [showPinSetup, setShowPinSetup] = useState<string | null>(null);

  const defaultProfile = profileForProfession(profile?.profession);
  const emptyForm = { direction: 'receivable' as WorkDirection, profile: defaultProfile, workType: '', crop: '', season: 'kharif', year: String(new Date().getFullYear()), partyId: '', partnershipId: '', agreedAmount: '', startDate: todayStr(), endDate: '', areaValue: '', areaUnit: 'acre', notes: '' };
  const [form, setForm] = useState(emptyForm);
  const [payForm, setPayForm] = useState({ amount: '', date: todayStr(), note: '', alsoLedger: true });

  const orderedProfiles = workProfilesForProfession(profile?.profession);
  const isFarmProfile = form.profile === 'farmer' || form.profile === 'farm_services';

  const [typeSearch, setTypeSearch] = useState('');
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [typeHighlightIndex, setTypeHighlightIndex] = useState(-1);
  const typeRef = useRef<HTMLDivElement>(null);

  const [partySearch, setPartySearch] = useState('');
  const [showPartyDropdown, setShowPartyDropdown] = useState(false);
  const [partyFocused, setPartyFocused] = useState(false);
  const [partyHighlightIndex, setPartyHighlightIndex] = useState(-1);
  const partyRef = useRef<HTMLDivElement>(null);
  const [showCreateParty, setShowCreateParty] = useState<string | null>(null);
  const [createPartyForm, setCreatePartyForm] = useState({ group: 'contact' as 'customer' | 'vendor' | 'contact', type: 'individual', description: '' });
  const [partyWarn, setPartyWarn] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (typeRef.current && !typeRef.current.contains(e.target as Node)) { setShowTypeDropdown(false); setTypeHighlightIndex(-1); }
      if (partyRef.current && !partyRef.current.contains(e.target as Node)) setShowPartyDropdown(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const resetFieldStates = () => {
    setTypeSearch(''); setShowTypeDropdown(false); setTypeHighlightIndex(-1);
    setPartySearch(''); setShowPartyDropdown(false); setPartyFocused(false); setPartyHighlightIndex(-1);
  };

  const PARTY_TYPES: Record<string, { value: string; label: string }[]> = {
    vendor: [
      { value: 'supplier', label: 'Supplier' },
      { value: 'wholesaler', label: 'Wholesaler' },
      { value: 'contractor', label: 'Contractor' },
      { value: 'service_provider', label: 'Service Provider' },
      { value: 'freelancer', label: 'Freelancer' },
      { value: 'shop', label: 'Shop / Retailer' },
      { value: 'other', label: 'Other' },
    ],
    customer: [
      { value: 'client', label: 'Client' },
      { value: 'retail', label: 'Retail Customer' },
      { value: 'regular', label: 'Regular' },
      { value: 'corporate', label: 'Corporate' },
      { value: 'other', label: 'Other' },
    ],
    contact: [
      { value: 'individual', label: 'Individual / Person' },
      { value: 'friend', label: 'Friend / Family' },
      { value: 'employee', label: 'Employee' },
      { value: 'landlord', label: 'Landlord / Tenant' },
      { value: 'investor', label: 'Investor' },
      { value: 'consultant', label: 'Consultant' },
      { value: 'other', label: 'Other' },
    ],
  };

  const typeOptions = useMemo(() => getWorkProfile(form.profile).workTypes.map(wt => t(`works.types.${wt.key}`)), [form.profile, t]);

  const filteredTypeOptions = useMemo(() => {
    if (!typeSearch) return typeOptions;
    return typeOptions.filter(o => o.toLowerCase().includes(typeSearch.toLowerCase()));
  }, [typeSearch, typeOptions]);

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

  const filteredParties = useMemo(() => {
    if (!partySearch) return recentParties.slice(0, 3);
    const s = partySearch.toLowerCase();
    return partnersList.filter((p: any) => p.name.toLowerCase().includes(s));
  }, [partySearch, recentParties, partnersList]);

  const selectedPartyName = form.partyId ? partnersList.find((p: any) => p.id === form.partyId)?.name : '';

  const handleCreateParty = () => {
    if (!showCreateParty) return;
    const existing = partnersList.find((p: any) => !p.deletedAt && p.name.toLowerCase() === showCreateParty.trim().toLowerCase());
    if (existing) {
      setPartyWarn(`"${existing.name}" already exists`);
      setTimeout(() => setPartyWarn(null), 3000);
      setForm({ ...form, partyId: existing.id });
      setPartySearch(existing.name);
      setShowCreateParty(null);
      setCreatePartyForm({ group: 'contact', type: 'individual', description: '' });
      return;
    }
    const result = addPartner({ name: showCreateParty, type: createPartyForm.type, group: createPartyForm.group, description: createPartyForm.description, budgetWindowStart: '', budgetWindowEnd: '', initialInvestment: 0 });
    if (result) {
      refresh();
      setForm(f => ({ ...f, partyId: result.id }));
      setPartySearch(result.name);
    }
    setShowCreateParty(null);
    setCreatePartyForm({ group: 'contact', type: 'individual', description: '' });
  };

  const filtered = useMemo(() => filterDir === 'all' ? works : works.filter(w => w.direction === filterDir), [works, filterDir]);
  const sorted = useMemo(() => [...filtered].sort((a, b) => {
    const pa = getWorkStatus(a) === 'paid' ? 1 : 0;
    const pb = getWorkStatus(b) === 'paid' ? 1 : 0;
    if (pa !== pb) return pa - pb;
    return b.createdAt.localeCompare(a.createdAt);
  }), [filtered]);

  const toReceive = works.filter(w => w.direction === 'receivable').reduce((s, w) => s + workPendingAmount(w), 0);
  const toPay = works.filter(w => w.direction === 'payable').reduce((s, w) => s + workPendingAmount(w), 0);
  const doneCount = works.filter(w => getWorkStatus(w) === 'paid').length;

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      direction: form.direction,
      profile: form.profile,
      workType: form.workType.trim(),
      crop: form.crop.trim() || undefined,
      season: form.season as SeasonType,
      year: Number(form.year) || new Date().getFullYear(),
      partyId: form.partyId || undefined,
      partnershipId: form.partnershipId || undefined,
      agreedAmount: Number(form.agreedAmount),
      startDate: form.startDate,
      endDate: form.endDate || undefined,
      area: form.areaValue ? { value: Number(form.areaValue), unit: form.areaUnit } as WorkEntry['area'] : undefined,
      notes: form.notes.trim() || undefined,
    };
    if (!(payload.agreedAmount > 0)) { toast(t('works.amountPositive'), 'warning'); return; }
    if (!payload.workType) { toast(t('works.typeRequired'), 'warning'); return; }
    if (editingId) {
      updateWork(editingId, payload);
      toast(t('works.updated'), 'success');
    } else {
      addWork(payload);
      toast(t('works.added'), 'success');
    }
    setShowAddModal(false);
    setEditingId(null);
    setForm(emptyForm);
    resetFieldStates();
    refresh();
  };

  const handleEditClick = (w: WorkEntry) => {
    setEditingId(w.id);
    setForm({
      direction: w.direction,
      profile: w.profile,
      workType: w.workType,
      crop: w.crop || '',
      season: w.season,
      year: String(w.year),
      partyId: w.partyId || '',
      partnershipId: w.partnershipId || '',
      agreedAmount: String(w.agreedAmount),
      startDate: w.startDate || todayStr(),
      endDate: w.endDate || '',
      areaValue: w.area ? String(w.area.value) : '',
      areaUnit: w.area?.unit || 'acre',
      notes: w.notes || '',
    });
    setPartySearch(w.partyId ? (partnersList.find((p: any) => p.id === w.partyId)?.name || '') : '');
    setTypeSearch('');
    setShowAddModal(true);
  };

  const handlePay = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payWorkId) return;
    const amount = Number(payForm.amount);
    if (!(amount > 0)) { toast(t('works.amountPositive'), 'warning'); return; }
    if (payForm.date > todayStr()) { toast(t('works.noFuture'), 'warning'); return; }
    const res = recordWorkPayment(payWorkId, { date: payForm.date, amount, note: payForm.note.trim() || undefined }, { alsoLedger: payForm.alsoLedger });
    if (res.work) {
      toast(`${t('works.paymentRecorded')} ${formatCurrency(amount)}${payForm.alsoLedger ? ` · ${t('works.ledgerSynced')}` : ''}`, 'success');
    }
    setPayWorkId(null);
    setPayForm({ amount: '', date: todayStr(), note: '', alsoLedger: true });
    refresh();
  };

  const handleDelete = (id: string) => {
    const w = works.find(x => x.id === id);
    const createdToday = w && w.createdAt?.split('T')[0] === todayStr();
    if (createdToday) {
      doDelete(id);
    } else if (hasPins()) {
      setPinDeleteId(id);
    } else {
      setShowPinSetup(t('works.deleteAction'));
    }
  };

  const doDelete = (id: string) => {
    deleteWork(id);
    setConfirmDelete(null);
    toast(t('works.deleted'), 'success');
    refresh();
  };

  const historyWork = works.find(w => w.id === historyId);

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <Reveal>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 hidden md:block">{t('works.title')}</h1>
              <p className="text-slate-500 dark:text-slate-400 text-base font-semibold md:font-normal md:text-sm block md:hidden md:hidden">{t('works.subtitle')}</p>
              <p className="text-slate-500 dark:text-slate-400 hidden md:block">{t('works.subtitle')}</p>
            </div>
            <button onClick={() => { setEditingId(null); setForm(emptyForm); setShowAddModal(true); }} className="h-10 w-10 rounded-xl bg-brand text-white flex items-center justify-center hover:bg-orange-600 transition-colors active:scale-95 shrink-0" type="button" title={t('works.add')}>
              <Plus className="h-5 w-5" />
            </button>
          </div>
        </Reveal>

        {works.length > 0 && (
          <Reveal delay={100}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-gradient-to-br from-green-600 to-emerald-700 p-5 rounded-2xl shadow-lg text-white">
                <p className="text-sm opacity-80 mb-1 flex items-center gap-1"><ArrowDownLeft className="h-4 w-4" /> {t('works.toReceive')}</p>
                <p className="text-2xl font-bold">{formatCurrency(toReceive)}</p>
              </div>
              <div className="bg-gradient-to-br from-red-600 to-rose-700 p-5 rounded-2xl shadow-lg text-white">
                <p className="text-sm opacity-80 mb-1 flex items-center gap-1"><ArrowUpRight className="h-4 w-4" /> {t('works.toPay')}</p>
                <p className="text-2xl font-bold">{formatCurrency(toPay)}</p>
              </div>
              <div className="bg-white dark:bg-[#2A2522] p-5 rounded-2xl border border-slate-200 dark:border-brand-muted shadow-sm">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">{t('works.completed')}</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{doneCount} / {works.length}</p>
              </div>
            </div>

            <div className="flex items-center justify-center md:justify-start gap-2 flex-wrap mb-6">
              {([
                { key: 'all', label: t('works.filterAll') },
                { key: 'receivable', label: t('works.filterReceive') },
                { key: 'payable', label: t('works.filterPay') },
              ] as const).map(g => (
                <button key={g.key} onClick={() => setFilterDir(g.key as any)}
                  className={cn("px-3 py-2 md:px-4 md:py-2 rounded-lg md:rounded-xl text-xs md:text-sm font-medium transition-colors",
                    filterDir === g.key ? "bg-brand text-white shadow-sm" : "bg-white dark:bg-[#2A2522] border border-slate-200 dark:border-brand-muted text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                  )}>
                  {g.label}
                </button>
              ))}
            </div>
          </Reveal>
        )}

        {works.length === 0 && (
          <Reveal delay={100}>
            <div className="bg-white dark:bg-[#2A2522] rounded-2xl border border-slate-200 dark:border-brand-muted shadow-sm p-12 text-center">
              <Sprout className="h-12 w-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300 mb-2">{t('works.emptyTitle')}</h3>
              <p className="text-slate-400 dark:text-slate-500 mb-6">{t('works.emptyBody')}</p>
              <Button onClick={() => { setEditingId(null); setForm(emptyForm); setShowAddModal(true); }}>{t('works.firstWork')}</Button>
            </div>
          </Reveal>
        )}

        <Reveal delay={200}>
          <div className="grid grid-cols-1 gap-6">
            {sorted.length === 0 && works.length > 0 && (
              <div className="bg-white dark:bg-[#2A2522] rounded-2xl border border-slate-200 dark:border-brand-muted shadow-sm p-8 text-center">
                <p className="text-slate-400 dark:text-slate-500">{t('works.noneInFilter')}</p>
              </div>
            )}
            {sorted.map((w) => {
              const status = getWorkStatus(w);
              const pending = workPendingAmount(w);
              const pct = w.agreedAmount > 0 ? Math.min(100, Math.round((w.paidAmount / w.agreedAmount) * 100)) : 0;
              const dur = workDurationDays(w);
              return (
                <div key={w.id} className="bg-white dark:bg-[#2A2522] p-6 rounded-2xl border border-slate-200 dark:border-brand-muted shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <div className={cn("p-3 rounded-xl", w.direction === 'receivable' ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400")}>
                        {w.direction === 'receivable' ? <ArrowDownLeft className="h-6 w-6" /> : <ArrowUpRight className="h-6 w-6" />}
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                          {w.crop ? `${w.crop} · ` : ''}{w.workType}
                        </h3>
                        <div className="flex items-center gap-2 flex-wrap text-xs text-slate-500 dark:text-slate-400 mt-1">
                          <span className={cn("capitalize px-2 py-0.5 rounded-full font-medium",
                            status === 'paid' ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" :
                            status === 'partial' ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400" :
                            "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400")}>
                            {status === 'paid' ? t('works.statusPaid') : status === 'partial' ? t('works.statusPartial') : t('works.statusPending')}
                          </span>
                          {w.partyId && <span>{getPartnerNameSafe(w.partyId)}</span>}
                          {dur !== null && <span className="flex items-center gap-0.5"><Clock className="h-3 w-3" /> {dur} {t('works.days')}</span>}
                          {w.area && <span>{w.area.value} {w.area.unit}</span>}
                          {(w.profile === 'farmer' || w.profile === 'farm_services') && <span className="capitalize">{t(`works.season.${w.season}`)} {w.year}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" className="p-2 text-slate-400 dark:text-slate-500 hover:text-brand gap-1" onClick={() => handleEditClick(w)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {confirmDelete === w.id ? (
                        <div className="flex gap-1 items-center">
                          <Button size="sm" variant="danger" className="h-6 px-1.5 text-xs min-w-0" onClick={() => handleDelete(w.id)}>Yes</Button>
                          <Button size="sm" variant="ghost" className="h-6 px-1.5 text-xs min-w-0" onClick={() => setConfirmDelete(null)}>No</Button>
                        </div>
                      ) : (
                        <Button variant="ghost" size="sm" className="p-2 text-slate-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400 gap-1" onClick={() => setConfirmDelete(w.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-4">
                    <div className="p-4 bg-slate-50 dark:bg-brand-muted rounded-xl border border-slate-100 dark:border-brand-muted">
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-1">{t('works.agreed')}</p>
                      <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{formatCurrency(w.agreedAmount)}</p>
                    </div>
                    <div className="p-4 bg-slate-50 dark:bg-brand-muted rounded-xl border border-slate-100 dark:border-brand-muted">
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-1">{t('works.paidSoFar')}</p>
                      <p className="text-xl font-bold text-green-600 dark:text-green-400">{formatCurrency(w.paidAmount)}</p>
                    </div>
                    <div className={cn("p-4 bg-slate-50 dark:bg-brand-muted rounded-xl border border-slate-100 dark:border-brand-muted")}>
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-1">{w.direction === 'receivable' ? t('works.pendingReceive') : t('works.pendingPay')}</p>
                      <p className={cn("text-xl font-bold", pending > 0 ? (w.direction === 'receivable' ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400") : "text-slate-900 dark:text-slate-100")}>{formatCurrency(pending)}</p>
                    </div>
                  </div>

                  {pct > 0 && (
                    <div className="mb-4">
                      <div className="h-2 bg-slate-100 dark:bg-brand-muted rounded-full overflow-hidden">
                        <div className={cn("h-full rounded-full transition-all", pct >= 100 ? "bg-green-500" : "bg-brand")} style={{ width: `${pct}%` }} />
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">{pct}% {t('works.settled')} · {w.payments.length} {t('works.payments')}</p>
                    </div>
                  )}

                  <div className="flex gap-3">
                    {status !== 'paid' && (
                      <Button variant="outline" size="sm" className="gap-2" onClick={() => { setPayWorkId(w.id); setPayForm({ amount: String(workPendingAmount(w)), date: todayStr(), note: '', alsoLedger: true }); }}>
                        <IndianRupee className="h-4 w-4" /> {t('works.recordPayment')}
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" className="ml-auto text-slate-500 dark:text-slate-400" onClick={() => setHistoryId(w.id)}>
                      {t('works.viewPayments')}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </Reveal>
      </div>

      {/* Add / Edit Work Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm flex items-start sm:items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white dark:bg-[#2A2522] rounded-2xl max-w-lg w-full p-6 shadow-2xl my-4">
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-4">{editingId ? t('works.editTitle') : t('works.addTitle')}</h2>
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                {([
                  { key: 'receivable', label: t('works.iWillReceive'), icon: <ArrowDownLeft className="h-4 w-4" />, cls: 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400' },
                  { key: 'payable', label: t('works.iWillPay'), icon: <ArrowUpRight className="h-4 w-4" />, cls: 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400' },
                ] as const).map(d => (
                  <button key={d.key} type="button" onClick={() => setForm({ ...form, direction: d.key })}
                    className={cn("flex items-center justify-center gap-2 px-3 py-3 rounded-xl border-2 font-medium transition-colors",
                      form.direction === d.key ? d.cls : "border-slate-200 dark:border-brand-muted text-slate-500 dark:text-slate-400")}>
                    {d.icon} {d.label}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 block mb-1">{t('works.profile')}</label>
                  <select value={form.profile} onChange={e => setForm({ ...form, profile: e.target.value, workType: '', crop: '', areaValue: '' })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-brand-muted outline-none focus:ring-2 focus:ring-brand text-sm">
                    {orderedProfiles.map(p => (
                      <option key={p.value} value={p.value}>{p.icon} {t(`works.profile.${p.value}`)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 block mb-1">{t('works.workType')}</label>
                  <div className="relative" ref={typeRef}>
                    <input required value={form.workType} onChange={e => { setForm({ ...form, workType: e.target.value }); setTypeSearch(e.target.value); setShowTypeDropdown(true); setTypeHighlightIndex(-1); }}
                      onFocus={() => setShowTypeDropdown(true)}
                      onKeyDown={e => {
                        const hasCustom = !!(typeSearch && !filteredTypeOptions.some(o => o.toLowerCase() === typeSearch.toLowerCase()));
                        const totalItems = filteredTypeOptions.length + (hasCustom ? 1 : 0);
                        if (e.key === 'ArrowDown') { e.preventDefault(); setShowTypeDropdown(true); setTypeHighlightIndex(i => Math.min(i + 1, totalItems - 1)); }
                        else if (e.key === 'ArrowUp') { e.preventDefault(); setTypeHighlightIndex(i => Math.max(i - 1, 0)); }
                        else if (e.key === 'Enter' && showTypeDropdown && typeHighlightIndex >= 0) {
                          e.preventDefault();
                          if (typeHighlightIndex < filteredTypeOptions.length) setForm({ ...form, workType: filteredTypeOptions[typeHighlightIndex] });
                          else setForm({ ...form, workType: typeSearch });
                          setTypeSearch(''); setShowTypeDropdown(false); setTypeHighlightIndex(-1);
                        }
                        else if (e.key === 'Escape') { setShowTypeDropdown(false); setTypeHighlightIndex(-1); }
                      }}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-brand-muted outline-none focus:ring-2 focus:ring-brand text-sm" placeholder={t('works.workTypePlaceholder')} />
                    {showTypeDropdown && (
                      <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white dark:bg-[#2A2522] border border-slate-200 dark:border-brand-muted rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {filteredTypeOptions.map((o, i) => (
                          <button key={o} type="button"
                            onClick={() => { setForm({ ...form, workType: o }); setTypeSearch(''); setShowTypeDropdown(false); setTypeHighlightIndex(-1); }}
                            onMouseEnter={() => setTypeHighlightIndex(i)}
                            className={cn("w-full px-4 py-2 text-left text-sm transition-colors", typeHighlightIndex === i ? "bg-brand-secondary dark:bg-brand-muted/30" : "hover:bg-brand-secondary dark:hover:bg-brand-muted/30", form.workType === o && "font-medium")}>
                            {o}
                          </button>
                        ))}
                        {typeSearch && !filteredTypeOptions.some(o => o.toLowerCase() === typeSearch.toLowerCase()) && (
                          <button type="button"
                            onClick={() => { setForm({ ...form, workType: typeSearch }); setTypeSearch(''); setShowTypeDropdown(false); setTypeHighlightIndex(-1); }}
                            onMouseEnter={() => setTypeHighlightIndex(filteredTypeOptions.length)}
                            className={cn("w-full px-4 py-2 text-left text-sm text-brand font-medium transition-colors", typeHighlightIndex === filteredTypeOptions.length ? "bg-brand-secondary dark:bg-brand-muted/30" : "hover:bg-brand-secondary dark:hover:bg-brand-muted/30")}>
                            {t('works.useCustom', { name: typeSearch })}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              {isFarmProfile && (
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
              )}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 block mb-1">{t('works.party')}</label>
                  <div className="relative" ref={partyRef}>
                    <input value={partyFocused && !form.partyId && !partySearch ? '' : (partySearch || selectedPartyName || '')}
                      onChange={e => { setPartySearch(e.target.value); setForm({ ...form, partyId: '' }); setShowPartyDropdown(true); setPartyHighlightIndex(-1); }}
                      onFocus={() => { setPartyFocused(true); setShowPartyDropdown(true); }}
                      onBlur={() => { if (!partySearch && !form.partyId) setPartyFocused(false); }}
                      onKeyDown={e => {
                        const hasCustom = !!(partySearch && !filteredParties.some(p => p.name.toLowerCase() === partySearch.toLowerCase()));
                        const totalItems = 1 + filteredParties.length + (hasCustom ? 1 : 0);
                        if (e.key === 'ArrowDown') { e.preventDefault(); setShowPartyDropdown(true); setPartyHighlightIndex(i => Math.min(i + 1, totalItems - 1)); }
                        else if (e.key === 'ArrowUp') { e.preventDefault(); setPartyHighlightIndex(i => Math.max(i - 1, 0)); }
                        else if (e.key === 'Enter' && showPartyDropdown && partyHighlightIndex >= 0) {
                          e.preventDefault();
                          if (partyHighlightIndex === 0) { setForm({ ...form, partyId: '' }); setPartySearch(''); }
                          else if (partyHighlightIndex - 1 < filteredParties.length) { const p = filteredParties[partyHighlightIndex - 1]; if (p) { setForm({ ...form, partyId: p.id }); setPartySearch(p.name); } }
                          else { setShowCreateParty(partySearch); setPartySearch(''); }
                          setShowPartyDropdown(false); setPartyHighlightIndex(-1);
                        }
                        else if (e.key === 'Escape') { setShowPartyDropdown(false); setPartyHighlightIndex(-1); }
                      }}
                      placeholder={t('works.partySearch')}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-brand-muted outline-none focus:ring-2 focus:ring-brand text-sm" />
                    {showPartyDropdown && (
                      <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white dark:bg-[#2A2522] border border-slate-200 dark:border-brand-muted rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        <button type="button"
                          onClick={() => { setForm({ ...form, partyId: '' }); setPartySearch(''); setShowPartyDropdown(false); setPartyHighlightIndex(-1); }}
                          onMouseEnter={() => setPartyHighlightIndex(0)}
                          className={cn("w-full px-4 py-2 text-left text-sm transition-colors", partyHighlightIndex === 0 ? "bg-brand-secondary dark:bg-brand-muted/30" : "hover:bg-brand-secondary dark:hover:bg-brand-muted/30")}>
                          {t('works.noParty')}
                        </button>
                        {filteredParties.map((p, i) => (
                          <button key={p.id} type="button"
                            onClick={() => { setForm({ ...form, partyId: p.id }); setPartySearch(p.name); setShowPartyDropdown(false); setPartyHighlightIndex(-1); }}
                            onMouseEnter={() => setPartyHighlightIndex(i + 1)}
                            className={cn("w-full px-4 py-2 text-left text-sm transition-colors", partyHighlightIndex === i + 1 ? "bg-brand-secondary dark:bg-brand-muted/30" : "hover:bg-brand-secondary dark:hover:bg-brand-muted/30")}>
                            {p.name}
                          </button>
                        ))}
                        {partySearch && !filteredParties.some(p => p.name.toLowerCase() === partySearch.toLowerCase()) && (
                          <button type="button"
                            onClick={() => { setShowCreateParty(partySearch); setPartySearch(''); setShowPartyDropdown(false); setPartyHighlightIndex(-1); }}
                            onMouseEnter={() => setPartyHighlightIndex(1 + filteredParties.length)}
                            className={cn("w-full px-4 py-2 text-left text-sm text-brand font-medium transition-colors", partyHighlightIndex === 1 + filteredParties.length ? "bg-brand-secondary dark:bg-brand-muted/30" : "hover:bg-brand-secondary dark:hover:bg-brand-muted/30")}>
                            Create Party "{partySearch}"
                          </button>
                        )}
                      </div>
                    )}
                    {partyWarn && <p className="text-xs text-red-500 mt-1">{partyWarn}</p>}
                  </div>
                </div>
                {partnershipsList.length > 0 && (
                  <div>
                    <label className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 block mb-1">{t('works.partnership')}</label>
                    <select value={form.partnershipId} onChange={e => setForm({ ...form, partnershipId: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-brand-muted outline-none focus:ring-2 focus:ring-brand text-sm">
                      <option value="">{t('works.noPartnership')}</option>
                      {partnershipsList.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                    </select>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 block mb-1">{t('works.agreedAmount')}</label>
                  <input required type="number" min="0" step="0.01" value={form.agreedAmount} onChange={e => setForm({ ...form, agreedAmount: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-brand-muted outline-none focus:ring-2 focus:ring-brand text-sm" placeholder="₹ 0" />
                </div>
                {isFarmProfile && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 block mb-1">{t('works.area')}</label>
                    <input type="number" min="0" step="0.01" value={form.areaValue} onChange={e => setForm({ ...form, areaValue: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-brand-muted outline-none focus:ring-2 focus:ring-brand text-sm" placeholder="0" />
                  </div>
                  <div>
                    <label className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 block mb-1">&nbsp;</label>
                    <select value={form.areaUnit} onChange={e => setForm({ ...form, areaUnit: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-brand-muted outline-none focus:ring-2 focus:ring-brand text-sm">
                      {AREA_UNITS.map(u => <option key={u} value={u}>{t(`works.unit.${u}`)}</option>)}
                    </select>
                  </div>
                </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 block mb-1">{t('works.startDate')}</label>
                  <input required type="date" max={todayStr()} value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-brand-muted outline-none focus:ring-2 focus:ring-brand text-sm" />
                </div>
                <div>
                  <label className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 block mb-1">{t('works.endDate')}</label>
                  <input type="date" min={form.startDate} value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-brand-muted outline-none focus:ring-2 focus:ring-brand text-sm" />
                </div>
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 block mb-1">{t('works.notes')}</label>
                <input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-brand-muted outline-none focus:ring-2 focus:ring-brand text-sm" placeholder={t('works.notesPlaceholder')} />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <Button variant="ghost" size="sm" onClick={() => { setShowAddModal(false); setEditingId(null); setForm(emptyForm); resetFieldStates(); }}>{t('common.cancel')}</Button>
                <Button type="submit" size="sm">{editingId ? t('common.save') : t('works.create')}</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {payWorkId && (() => {
        const w = works.find(x => x.id === payWorkId);
        if (!w) return null;
        return (
          <div className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm flex items-start sm:items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-white dark:bg-[#2A2522] rounded-2xl max-w-md w-full p-6 shadow-2xl my-4">
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-1">{t('works.recordPayment')}</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">{w.crop ? `${w.crop} · ` : ''}{w.workType} · {t('works.pendingShort')} {formatCurrency(workPendingAmount(w))}</p>
              <form onSubmit={handlePay} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block">{t('works.amountLabel')}</label>
                    <input required type="number" min="0" step="0.01" value={payForm.amount} onChange={e => setPayForm({ ...payForm, amount: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-brand-muted outline-none focus:ring-2 focus:ring-brand" placeholder="₹ 0" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block">{t('works.dateLabel')}</label>
                    <input required type="date" max={todayStr()} value={payForm.date} onChange={e => setPayForm({ ...payForm, date: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-brand-muted outline-none focus:ring-2 focus:ring-brand" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block">{t('works.noteLabel')}</label>
                  <input value={payForm.note} onChange={e => setPayForm({ ...payForm, note: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-brand-muted outline-none focus:ring-2 focus:ring-brand" placeholder={t('works.notePlaceholder')} />
                </div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={payForm.alsoLedger} onChange={e => setPayForm({ ...payForm, alsoLedger: e.target.checked })}
                    className="h-4 w-4 accent-[#EA580C]" />
                  <span className="text-sm text-slate-600 dark:text-slate-400">{t('works.alsoLedger')}</span>
                </label>
                <div className="flex items-center justify-end gap-2 pt-2">
                  <Button variant="ghost" size="sm" onClick={() => { setPayWorkId(null); setPayForm({ amount: '', date: todayStr(), note: '', alsoLedger: true }); }}>{t('common.cancel')}</Button>
                  <Button type="submit" size="sm">{t('works.savePayment')}</Button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* Payment History Modal */}
      {historyId && historyWork && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#2A2522] w-full max-w-sm rounded-2xl max-h-[80vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-brand-muted">
              <h2 className="font-semibold text-slate-900 dark:text-slate-100 truncate">{historyWork.crop ? `${historyWork.crop} · ` : ''}{historyWork.workType}</h2>
              <button onClick={() => setHistoryId(null)} className="p-1 text-slate-400"><X className="h-5 w-5" /></button>
            </div>
            <div className="flex items-center gap-4 px-4 py-3 bg-slate-50 dark:bg-brand-muted/20 text-sm border-b border-slate-100 dark:border-brand-muted">
              <span className="text-green-600 font-medium">+{formatCurrency(historyWork.paidAmount)}</span>
              <span className="text-slate-400">/ {formatCurrency(historyWork.agreedAmount)}</span>
            </div>
            <div className="flex-1 overflow-y-auto">
              {historyWork.payments.length === 0 ? (
                <div className="p-6 text-center text-sm text-slate-400">{t('works.noPayments')}</div>
              ) : (
                <div className="divide-y divide-slate-50 dark:divide-brand-muted">
                  {[...historyWork.payments].sort((a, b) => b.date.localeCompare(a.date)).map(p => (
                    <div key={p.id} className="px-4 py-2.5 flex items-center justify-between">
                      <div className="min-w-0">
                        <p className="text-sm text-slate-900 dark:text-slate-100 truncate">{p.note || formatCurrency(p.amount)}</p>
                        <p className="text-[11px] text-slate-400">{p.date}</p>
                      </div>
                      <p className="text-sm font-medium text-green-600 ml-2">+{formatCurrency(p.amount)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Party Modal */}
      {showCreateParty && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm flex items-start sm:items-center justify-center z-[60] p-4 overflow-y-auto">
          <div className="bg-white dark:bg-[#2A2522] rounded-2xl max-w-lg w-full p-6 shadow-2xl my-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-1">New Party</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Creating "<span className="font-medium text-slate-700 dark:text-slate-300">{showCreateParty}</span>"</p>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-1">Group</label>
                  <select value={createPartyForm.group} onChange={e => { const g = e.target.value as 'vendor' | 'customer' | 'contact'; setCreatePartyForm({ ...createPartyForm, group: g, type: PARTY_TYPES[g]?.[0]?.value || 'other' }); }}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-brand-muted text-sm outline-none focus:ring-2 focus:ring-brand">
                    <option value="contact">Contact</option>
                    <option value="vendor">Vendor</option>
                    <option value="customer">Customer</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-1">Type</label>
                  <select value={createPartyForm.type} onChange={e => setCreatePartyForm({ ...createPartyForm, type: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-brand-muted text-sm outline-none focus:ring-2 focus:ring-brand">
                    {(PARTY_TYPES[createPartyForm.group] || PARTY_TYPES.contact).map(pt => (
                      <option key={pt.value} value={pt.value}>{pt.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-1">Description (optional)</label>
                <input value={createPartyForm.description} onChange={e => setCreatePartyForm({ ...createPartyForm, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-brand-muted text-sm outline-none focus:ring-2 focus:ring-brand" placeholder="Optional notes..." />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" size="sm" onClick={() => { setShowCreateParty(null); setCreatePartyForm({ group: 'contact', type: 'individual', description: '' }); }}>Cancel</Button>
                <Button size="sm" onClick={handleCreateParty}>Create & Select</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <PinPrompt
        open={pinDeleteId !== null}
        onClose={() => setPinDeleteId(null)}
        onSuccess={() => { if (pinDeleteId) doDelete(pinDeleteId); setPinDeleteId(null); }}
        title={t('works.deletePinTitle')}
        message={t('works.deletePinMsg')}
      />

      <PinSetupGuide
        open={showPinSetup !== null}
        onClose={() => setShowPinSetup(null)}
        action={showPinSetup || ''}
      />
    </DashboardLayout>
  );
}
