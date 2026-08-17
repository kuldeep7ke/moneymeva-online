'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { Button } from '@/components/ui/button';
import { User, Briefcase, Target, Users, CheckCircle, ArrowRight, ArrowLeft, Wallet, BarChart3, Upload } from 'lucide-react';
import { updateProfile } from '@/lib/localAuth';
import { addGoal, addPartner } from '@/lib/store';
import { cn } from '@/lib/utils';
import Reveal from '@/components/Reveal';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';

const STEPS = [
  { key: 'personal', label: 'Personal', icon: User },
  { key: 'financial', label: 'Financial', icon: Wallet },
  { key: 'business', label: 'Business', icon: Briefcase, optional: true },
  { key: 'partner', label: 'Party', icon: Users, optional: true },
  { key: 'goals', label: 'Goals', icon: Target, optional: true },
  { key: 'complete', label: 'Done', icon: CheckCircle },
];

const MONTHLY_INCOME_OPTIONS = [
  'Under ₹25,000', 'Under ₹1,00,000',
  'Under ₹50,000', 'Above ₹1,00,000',
];

const PRIMARY_GOALS = [
  'Track Expenses', 'Save for a Goal', 'Reduce Debt',
  'Grow Investments', 'Manage Business', 'All of the Above',
];

const PROFESSION_OPTIONS = [
  { value: 'salaried', label: 'Salaried Employee', icon: '💼' },
  { value: 'freelancer', label: 'Freelancer / Self-Employed', icon: '💻' },
  { value: 'business', label: 'Business Owner', icon: '🏪' },
  { value: 'student', label: 'Student', icon: '🎓' },
  { value: 'homemaker', label: 'Homemaker', icon: '🏠' },
  { value: 'investor', label: 'Investor / Trader', icon: '📈' },
  { value: 'retired', label: 'Retired', icon: '🏖️' },
  { value: 'other', label: 'Other', icon: '👤' },
];

const PROFESSION_CATEGORIES: Record<string, { income: string[]; expense: string[] }> = {
  salaried: {
    income: ['Salary', 'Bonus', 'Reimbursement', 'Incentive', 'Other'],
    expense: ['Rent', 'Groceries', 'Utilities', 'Transport', 'Healthcare', 'Entertainment', 'Dining', 'Shopping', 'Bills', 'Insurance', 'Education', 'EMI', 'Other'],
  },
  freelancer: {
    income: ['Project Income', 'Client Payment', 'Consulting', 'Retainer', 'Other'],
    expense: ['Business Expense', 'Equipment', 'Software', 'Marketing', 'Internet', 'Travel', 'Office Supplies', 'Other'],
  },
  business: {
    income: ['Sales', 'Revenue', 'Services', 'Other'],
    expense: ['Inventory', 'Payroll', 'Rent (Business)', 'Utilities (Business)', 'Marketing', 'GST/Tax', 'Transport', 'Other'],
  },
  student: {
    income: ['Pocket Money', 'Scholarship', 'Stipend', 'Part-time Job', 'Other'],
    expense: ['Education', 'Books', 'Stationery', 'Food', 'Transport', 'Entertainment', 'Mobile Recharge', 'Other'],
  },
  homemaker: {
    income: ['Household', 'Other'],
    expense: ['Household', 'Groceries', 'Utilities', 'Kids', 'Healthcare', 'Entertainment', 'Dining', 'Other'],
  },
  investor: {
    income: ['Dividends', 'Capital Gains', 'Interest', 'Rental Income', 'Other'],
    expense: ['Brokerage', 'Investment', 'Mutual Funds', 'Stocks', 'Other'],
  },
  retired: {
    income: ['Pension', 'Interest', 'Dividends', 'Rental', 'Other'],
    expense: ['Healthcare', 'Medicine', 'Utilities', 'Household', 'Entertainment', 'Other'],
  },
  other: {
    income: ['Income', 'Other'],
    expense: ['Expense', 'Other'],
  },
};

const PARTY_TYPES_BY_GROUP: Record<string, { value: string; label: string }[]> = {
  vendor: [
    { value: 'supplier', label: 'Supplier' },
    { value: 'wholesaler', label: 'Wholesaler' },
    { value: 'contractor', label: 'Contractor' },
    { value: 'service_provider', label: 'Service Provider' },
    { value: 'manufacturer', label: 'Manufacturer' },
    { value: 'freelancer', label: 'Freelancer' },
    { value: 'shop', label: 'Shop / Retailer' },
    { value: 'other', label: 'Other' },
  ],
  customer: [
    { value: 'client', label: 'Client' },
    { value: 'retail', label: 'Retail Customer' },
    { value: 'wholesale_buyer', label: 'Wholesale Buyer' },
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
    { value: 'partner', label: 'Joint Venture Partner' },
    { value: 'consultant', label: 'Consultant' },
    { value: 'other', label: 'Other' },
  ],
};

export default function OnboardingPage() {
  const { user, profile, loading: authLoading, refreshAuth } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    full_name: '',
    phone: '',
    currency: 'INR',
    monthly_income: '',
    primary_goal: '',
    profession: '',
    occupation: '',
    business_name: '',
    business_type: '',
    terms_accepted: false,
  });
  const [goalName, setGoalName] = useState('');
  const [goalTarget, setGoalTarget] = useState('');
  const [partnerForm, setPartnerForm] = useState<{ name: string; group: 'vendor' | 'customer' | 'contact'; type: string; description: string } | null>(null);
  const [importMessage, setImportMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{ done: number; total: number; label: string } | null>(null);

  const searchParams = useSearchParams();
  const isEditMode = searchParams?.get('edit') === 'true';

  useEffect(() => {
    if (!user && !profile) return;
    const saved = typeof window !== 'undefined' ? localStorage.getItem('mm_last_name') : '';
    setForm(f => ({
      ...f,
      full_name: profile?.full_name || saved || '',
      phone: profile?.phone || '',
      currency: profile?.currency || 'INR',
      monthly_income: profile?.monthly_income || '',
      primary_goal: profile?.primary_goal || '',
      profession: (profile as any)?.profession || '',
      occupation: profile?.occupation || '',
      business_name: profile?.business_name || '',
      business_type: profile?.business_type || '',
      terms_accepted: profile?.terms_accepted || false,
    }));
  }, [user?.id, profile?.id]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const handler = App.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) {
        window.history.back();
      } else {
        App.exitApp();
      }
    });
    return () => { handler.then(h => h.remove()); };
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace('/login');
    } else if (profile?.onboarding_completed && !isEditMode) {
      router.replace('/dashboard');
    }
  }, [authLoading, user, profile, router, isEditMode]);

  if (authLoading) return null;

  const update = (field: string, value: string) => setForm(f => ({ ...f, [field]: value }));

  const canProceed = () => {
    if (step === 1) return form.full_name.trim().length > 0 && form.terms_accepted;
    if (step === 2) return form.monthly_income && form.primary_goal;
    if (step === 3) return !!form.profession;
    return true;
  };

  const handleNext = () => {
    if (!canProceed()) return;
    if (user?.id) {
      updateProfile(user.id, {
        full_name: form.full_name,
        phone: form.phone,
        currency: form.currency,
        monthly_income: form.monthly_income,
        primary_goal: form.primary_goal,
        profession: form.profession,
        occupation: form.occupation,
        business_name: form.business_name,
        business_type: form.business_type,
        onboarding_step: step + 1,
        terms_accepted: form.terms_accepted,
      } as any);
    }
    if (step === 6) {
      handleComplete();
    } else {
      setStep(s => s + 1);
    }
  };

  const handleSkip = () => {
    if (step === 6 || step >= STEPS.length) {
      handleComplete();
    } else {
      setStep(s => s + 1);
    }
  };

  const handleComplete = () => {
    setLoading(true);
    if (user?.id) {
      const updates: any = {
        full_name: form.full_name,
        phone: form.phone,
        currency: form.currency,
        monthly_income: form.monthly_income,
        primary_goal: form.primary_goal,
        profession: form.profession,
        occupation: form.occupation,
        business_name: form.business_name,
        business_type: form.business_type,
        terms_accepted: true,
      };
      if (!isEditMode) {
        updates.onboarding_completed = true;
        updates.onboarding_step = 99;
      }
      updateProfile(user.id, updates);
    }
    if (!isEditMode) {
      // Save profession-specific categories to localStorage
      if (form.profession && PROFESSION_CATEGORIES[form.profession]) {
        localStorage.setItem('mm_income_categories', JSON.stringify(PROFESSION_CATEGORIES[form.profession].income));
        localStorage.setItem('mm_expense_categories', JSON.stringify(PROFESSION_CATEGORIES[form.profession].expense));
      }
      if (goalName && Number(goalTarget) > 0) {
        addGoal({ name: goalName, target: Number(goalTarget), saved: 0 });
      }
      if (partnerForm?.name.trim()) {
        const today = new Date().toISOString().split('T')[0];
        addPartner({
          name: partnerForm.name.trim(),
          type: partnerForm.type,
          group: partnerForm.group,
          description: partnerForm.description.trim(),
          budgetWindowStart: today,
          budgetWindowEnd: today,
          initialInvestment: 0,
        });
      }
    }
    refreshAuth();
    setTimeout(() => router.push(isEditMode ? '/dashboard/about' : '/dashboard'), 400);
  };

  const handleBackupImport = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result)) as BackupData;
        if (!data._metadata?.app) {
          setImportMessage('Invalid backup file. Choose a Money Meva JSON export.');
          return;
        }

        const currentUserId = user?.id || 'local-user';
        const profile = data.profile || {};
        const total = (['transactions', 'budgets', 'goals', 'reminders', 'recurring', 'partners', 'adjustments'] as const)
          .reduce((n, k) => n + (Array.isArray(data[k]) ? data[k].length : 0), 0);

        setImporting(true);
        setImportProgress({ done: 0, total, label: 'Preparing import…' });
        setTimeout(async () => {
          try {
            const imported = await importBackupData(data, currentUserId, (label, done) => {
              setImportProgress({ done, total, label });
            });

            if (user?.id) {
              updateProfile(user.id, {
                full_name: getString(profile.full_name, form.full_name),
                phone: getString(profile.phone, form.phone),
                currency: getString(profile.currency, form.currency),
                monthly_income: getString(profile.monthly_income, form.monthly_income),
                primary_goal: getString(profile.primary_goal, form.primary_goal),
                occupation: getString(profile.occupation, form.occupation),
                business_name: getString(profile.business_name, form.business_name),
                business_type: getString(profile.business_type, form.business_type),
                onboarding_completed: true,
                onboarding_step: 99,
                terms_accepted: true,
              });
            }

            refreshAuth();
            setImporting(false);
            setImportProgress(null);
            setImportMessage(`Imported ${imported} backup items. Opening your dashboard...`);
            setLoading(true);
            setTimeout(() => router.push('/dashboard'), 600);
          } catch {
            setImporting(false);
            setImportProgress(null);
            setImportMessage('Could not import backup. Make sure the file is valid JSON.');
          }
        }, 50);
      } catch {
        setImportMessage('Could not import backup. Make sure the file is valid JSON.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-light via-white to-brand-secondary dark:from-brand-dark dark:via-[#2A2522] dark:to-brand-muted px-4 py-8">
      <div className="max-w-lg w-full">
        {/* Steps indicator */}
        <div className="flex items-center justify-center gap-1 mb-8 flex-wrap">
          {STEPS.filter(s => s.key !== 'complete').map((s, i) => (
            <div key={s.key} className="flex items-center">
              <div className={cn(
                "w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all",
                step > i + 1 ? "bg-green-500 text-white" :
                step === i + 1 ? "bg-brand text-white ring-4 ring-brand/20" :
                "bg-slate-200 dark:bg-brand-muted text-slate-400 dark:text-slate-500"
              )}>
                {step > i + 1 ? <CheckCircle className="h-4 w-4" /> : i + 1}
              </div>
              {s.key !== 'goals' && <div className={cn("w-6 sm:w-8 h-0.5 mx-0.5 sm:mx-1", step > i + 1 ? "bg-green-500" : "bg-slate-200 dark:bg-brand-muted")} />}
            </div>
          ))}
        </div>

        <Reveal>
        <div className="bg-white dark:bg-[#2A2522] p-4 sm:p-8 rounded-2xl shadow-xl border border-slate-100 dark:border-brand-muted">
          {/* Step 1: Personal Info - Mandatory */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="text-center space-y-2 mb-6">
                <div className="bg-brand-secondary dark:bg-brand-muted/30 w-16 h-16 rounded-full flex items-center justify-center mx-auto">
                  <User className="h-8 w-8 text-brand dark:text-brand-secondary" />
                </div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Personal Information</h1>
                 <p className="text-sm text-slate-500 dark:text-slate-400">Basic details to personalize your experience.</p>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-1">Full Name <span className="text-red-500">*</span></label>
                <input required value={form.full_name} onChange={e => update('full_name', e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-200 dark:border-brand-muted dark:bg-brand-dark dark:text-slate-100 outline-none focus:ring-2 focus:ring-brand" placeholder="John Doe" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-1">Phone Number</label>
                <input type="tel" value={form.phone} onChange={e => update('phone', e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-200 dark:border-brand-muted dark:bg-brand-dark dark:text-slate-100 outline-none focus:ring-2 focus:ring-brand" placeholder="+91 98765 43210" />
                  <p className="text-xs text-slate-400 mt-1">Optional; used for backup and reminders.</p>
              </div>
              <label className="flex items-start gap-2.5 cursor-pointer group">
                <input type="checkbox" checked={form.terms_accepted} onChange={e => setForm(f => ({ ...f, terms_accepted: e.target.checked }))}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand accent-brand" />
                <span className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-300 leading-relaxed">
                  I agree to the{' '}
                  <Link href="/terms" target="_blank" className="text-brand hover:text-brand-secondary underline font-medium">Terms & Conditions</Link>
                  {' '}and confirm I have read the{' '}
                  <Link href="/privacy" target="_blank" className="text-brand hover:text-brand-secondary underline font-medium">Privacy Policy</Link>.
                </span>
              </label>
              <div className="rounded-xl border border-dashed border-amber-200 bg-amber-50/70 p-4 text-center dark:border-amber-800 dark:bg-amber-900/20">
                <Upload className="mx-auto h-7 w-7 text-amber-600 dark:text-amber-400" />
                <h2 className="mt-2 text-sm font-bold text-slate-800 dark:text-slate-100">Already have a backup?</h2>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Import your Money Meva JSON backup to restore old transactions, budgets, goals, partners, and reminders.</p>
                <label className={cn("mt-3 inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold transition-colors",
                  form.terms_accepted ? "cursor-pointer bg-amber-600 text-white hover:bg-amber-700" : "cursor-not-allowed bg-slate-300 text-slate-500 dark:bg-slate-700 dark:text-slate-400"
                )}>
                  <Upload className="mr-2 h-4 w-4" /> Import Backup
                  <input type="file" accept=".json,application/json" className="hidden" disabled={!form.terms_accepted} onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleBackupImport(file);
                    e.target.value = '';
                  }} />
                </label>
                {importMessage && <p className="mt-2 text-xs font-medium text-amber-700 dark:text-amber-300">{importMessage}</p>}
              </div>
            </div>
          )}

          {/* Step 2: Financial Info - Mandatory */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="text-center space-y-2 mb-6">
                <div className="bg-brand-secondary dark:bg-brand-muted/30 w-16 h-16 rounded-full flex items-center justify-center mx-auto">
                  <Wallet className="h-8 w-8 text-brand dark:text-brand-secondary" />
                </div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Financial Profile</h1>
                 <p className="text-sm text-slate-500 dark:text-slate-400">Help us tailor insights for you.</p>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-1">Monthly Income Range <span className="text-red-500">*</span></label>
                <div className="grid grid-cols-2 gap-2">
                  {MONTHLY_INCOME_OPTIONS.map(o => (
                    <button key={o} type="button" onClick={() => update('monthly_income', o)}
                      className={cn("px-3 py-2.5 rounded-lg border text-sm font-medium transition-all text-left leading-tight h-full",
                        form.monthly_income === o
                          ? "border-brand bg-brand-secondary dark:bg-brand-muted/30 text-brand dark:text-brand-secondary"
                          : "border-slate-200 dark:border-brand-muted text-slate-600 dark:text-slate-400 hover:border-brand"
                      )}>{o}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-1">Primary Financial Goal <span className="text-red-500">*</span></label>
                <div className="grid grid-cols-2 gap-2">
                  {PRIMARY_GOALS.map(o => (
                    <button key={o} type="button" onClick={() => update('primary_goal', o)}
                      className={cn("px-3 py-2.5 rounded-lg border text-sm font-medium transition-all text-left leading-tight h-full",
                        form.primary_goal === o
                          ? "border-brand bg-brand-secondary dark:bg-brand-muted/30 text-brand dark:text-brand-secondary"
                          : "border-slate-200 dark:border-brand-muted text-slate-600 dark:text-slate-400 hover:border-brand"
                      )}>{o}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-1">Currency</label>
                <select value={form.currency} onChange={e => update('currency', e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-200 dark:border-brand-muted dark:bg-brand-dark dark:text-slate-100 outline-none focus:ring-2 focus:ring-brand">
                  <option value="INR">Indian Rupee (INR)</option>
                  <option value="USD">US Dollar (USD)</option>
                  <option value="EUR">Euro (EUR)</option>
                  <option value="GBP">British Pound (GBP)</option>
                </select>
              </div>
            </div>
          )}

          {/* Step 3: Work & Business */}
          {step === 3 && (
            <div className="space-y-6">
              <div className="text-center space-y-2 mb-6">
                <div className="bg-brand-secondary dark:bg-brand-muted/30 w-16 h-16 rounded-full flex items-center justify-center mx-auto">
                  <Briefcase className="h-8 w-8 text-brand dark:text-brand-secondary" />
                </div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">What do you do?</h1>
                 <p className="text-sm text-slate-500 dark:text-slate-400">Pick your profession so we can suggest relevant categories.</p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {PROFESSION_OPTIONS.map(p => (
                  <button key={p.value} onClick={() => update('profession', p.value)}
                    className={cn(
                      "relative p-3 rounded-lg border text-center transition-all duration-200",
                      form.profession === p.value
                        ? "border-brand bg-brand-secondary dark:bg-brand-muted/30 shadow-sm"
                        : "border-slate-200 dark:border-brand-muted hover:border-slate-300 dark:hover:border-slate-600 bg-white dark:bg-brand-dark"
                    )}>
                    <span className="text-xl block">{p.icon}</span>
                    <p className="text-[11px] font-semibold text-slate-900 dark:text-slate-100 mt-1 leading-tight">{p.label}</p>
                    {form.profession === p.value && (
                      <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-brand text-white flex items-center justify-center">
                        <CheckCircle className="h-2.5 w-2.5" />
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 4: Partner Setup - Optional */}
          {step === 4 && (
            <div className="space-y-6">
              <div className="text-center space-y-2 mb-6">
                <div className="bg-brand-secondary dark:bg-brand-muted/30 w-16 h-16 rounded-full flex items-center justify-center mx-auto">
                  <Users className="h-8 w-8 text-brand dark:text-brand-secondary" />
                </div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Party Account</h1>
               <p className="text-sm text-slate-500 dark:text-slate-400">Optional — track shared finances with a party.</p>
                {partnerForm && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-100 dark:border-blue-800">
                    <p className="text-sm text-blue-700 dark:text-blue-300">You can always add party accounts later from the Party page.</p>
                  </div>
                )}
              </div>
              {!partnerForm ? (
                <div className="text-center py-4">
                  <Button variant="outline" onClick={() => setPartnerForm({ name: '', group: 'contact', type: 'individual', description: '' })}>
                    <Users className="h-4 w-4 mr-2" /> Add a Party Account
                  </Button>
                </div>
              ) : (
                <div className="space-y-4 p-4 bg-slate-50 dark:bg-brand-muted/30 rounded-xl">
                  <div>
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-1">Party Name</label>
                    <input value={partnerForm.name} onChange={e => setPartnerForm({ ...partnerForm, name: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-lg border border-slate-200 dark:border-brand-muted dark:bg-brand-dark dark:text-slate-100 outline-none focus:ring-2 focus:ring-brand" placeholder="e.g. Joint Venture" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-1">Group</label>
                      <select value={partnerForm.group} onChange={e => { const newGroup = e.target.value as 'vendor' | 'customer' | 'contact'; setPartnerForm({ ...partnerForm, group: newGroup, type: PARTY_TYPES_BY_GROUP[newGroup]?.[0]?.value || 'other' }); }}
                        className="w-full px-4 py-2.5 rounded-lg border border-slate-200 dark:border-brand-muted dark:bg-brand-dark dark:text-slate-100 outline-none focus:ring-2 focus:ring-brand">
                        <option value="contact">Contact</option>
                        <option value="vendor">Vendor</option>
                        <option value="customer">Customer</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-1">Type</label>
                      <select value={partnerForm.type} onChange={e => setPartnerForm({ ...partnerForm, type: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-lg border border-slate-200 dark:border-brand-muted dark:bg-brand-dark dark:text-slate-100 outline-none focus:ring-2 focus:ring-brand">
                        {(PARTY_TYPES_BY_GROUP[partnerForm.group] || PARTY_TYPES_BY_GROUP.contact).map(t => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-1">Description</label>
                    <input value={partnerForm.description} onChange={e => setPartnerForm({ ...partnerForm, description: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-lg border border-slate-200 dark:border-brand-muted dark:bg-brand-dark dark:text-slate-100 outline-none focus:ring-2 focus:ring-brand" placeholder="Brief description" />
                  </div>
                  {partnerForm.name && (
                    <p className="text-xs text-slate-400">Party will be created when you complete setup</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Step 5: Quick Goal - Optional */}
          {step === 5 && (
            <div className="space-y-6">
              <div className="text-center space-y-2 mb-6">
                <div className="bg-brand-secondary dark:bg-brand-muted/30 w-16 h-16 rounded-full flex items-center justify-center mx-auto">
                  <BarChart3 className="h-8 w-8 text-brand dark:text-brand-secondary" />
                </div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Quick Savings Goal</h1>
                 <p className="text-sm text-slate-500 dark:text-slate-400">Optional — set a savings target to track from day one.</p>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-2">Quick Savings Goal</label>
                <div className="flex items-center gap-1 sm:gap-3 flex-nowrap">
                  <input value={goalName} onChange={e => setGoalName(e.target.value)}
                    className="flex-1 min-w-0 px-2 sm:px-4 py-2.5 rounded-lg border border-slate-200 dark:border-brand-muted dark:bg-brand-dark dark:text-slate-100 outline-none focus:ring-2 focus:ring-brand text-xs sm:text-sm" placeholder="e.g. New Laptop" />
                  <input value={goalTarget} onChange={e => setGoalTarget(e.target.value)} type="number"
                    className="flex-[0.6] min-w-0 px-2 sm:px-4 py-2.5 rounded-lg border border-slate-200 dark:border-brand-muted dark:bg-brand-dark dark:text-slate-100 outline-none focus:ring-2 focus:ring-brand text-xs sm:text-sm" placeholder="Target ₹" />
                  {goalName && goalTarget && (
                    <button onClick={() => { setGoalName(''); setGoalTarget(''); }}
                      className="text-xs text-slate-400 hover:text-red-500 shrink-0 px-1 text-nowrap">Remove</button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Step 6: Complete */}
          {step === 6 && (
            <div className="space-y-6 text-center">
              <div className="bg-green-50 dark:bg-green-900/20 w-20 h-20 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle className="h-10 w-10 text-green-500" />
              </div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">All Set!</h1>
              <p className="text-slate-500 dark:text-slate-400">
                Welcome, <span className="font-semibold text-slate-700 dark:text-slate-300">{form.full_name}</span>!
                {form.primary_goal && ` Your primary goal is to "${form.primary_goal}".`}
              </p>
              <div className="bg-brand-light dark:bg-brand-muted/30 rounded-xl p-4 space-y-2 text-left">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Summary</p>
                <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1">
                  <p>💼 {form.occupation || 'Occupation not set'} {form.business_name ? `· ${form.business_name}` : ''}</p>
                  <p>💰 Income: {form.monthly_income || 'Not specified'}</p>
                  <p>🎯 Goal: {form.primary_goal || 'Not set'}</p>
                  {goalName && <p>🏆 Goal: {goalName} (₹{Number(goalTarget).toLocaleString()})</p>}
                </div>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-slate-100 dark:border-brand-muted flex-wrap gap-2">
            <div>
              {step > 1 && step < 6 && (
                <Button variant="ghost" onClick={() => setStep(s => s - 1)} className="gap-1">
                  <ArrowLeft className="h-4 w-4" /> Back
                </Button>
              )}
            </div>
            <div className="flex items-center gap-3">
              {[2, 3, 4, 5].includes(step) && (
                <button onClick={handleSkip} className="text-xs font-medium text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 underline underline-offset-2 transition-colors">
                  Skip for now
                </button>
              )}
              <Button onClick={handleNext} disabled={!canProceed() || loading} className="gap-1">
                {loading ? 'Saving...' : step === 6 ? 'Go to Dashboard' : step === 1 ? 'Continue' : step === 5 ? 'Finish' : 'Next'}
                {!loading && step < 6 && <ArrowRight className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>
        </Reveal>

        <p className="text-center text-xs text-slate-400 dark:text-slate-500 mt-4">
          Step {step} of 6 · {STEPS[step - 1]?.label || 'Complete'}
        </p>
      </div>

      {importing && (
        <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-white dark:bg-slate-950">
          <div className="relative flex items-center justify-center mb-6">
            <img src="/favicon.jpg" alt="" className="h-16 w-16 rounded-2xl shadow-lg" />
            <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-emerald-500 animate-ping" />
          </div>
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-4 px-6 text-center">{importProgress?.label || 'Importing…'}</p>
          <div className="w-72 h-2.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
            <div
              className="h-full rounded-full bg-blue-500 transition-all duration-300"
              style={{ width: `${importProgress && importProgress.total > 0 ? Math.min(100, Math.round((importProgress.done / importProgress.total) * 100)) : 0}%` }}
            />
          </div>
          <p className="text-xs font-medium text-slate-400 dark:text-slate-500 mt-3 tabular-nums">
            {importProgress && importProgress.total > 0
              ? `${Math.min(100, Math.round((importProgress.done / importProgress.total) * 100))}% · ${Math.min(importProgress.done, importProgress.total).toLocaleString()} / ${importProgress.total.toLocaleString()}`
              : ''}
          </p>
        </div>
      )}
    </div>
  );
}

type BackupRecord = Record<string, unknown> & { id?: string };

type BackupData = {
  _metadata?: { app?: string; version?: string; exportDate?: string };
  profile?: BackupRecord;
  transactions?: BackupRecord[];
  budgets?: BackupRecord[];
  goals?: BackupRecord[];
  reminders?: BackupRecord[];
  recurring?: BackupRecord[];
  partners?: BackupRecord[];
  adjustments?: BackupRecord[];
};

function getString(value: unknown, fallback: string) {
  return typeof value === 'string' ? value : fallback;
}

async function importBackupData(
  data: BackupData,
  currentUserId: string,
  onProgress?: (label: string, done: number) => void,
) {
  let imported = 0;
  let processed = 0;
  const merge = async (key: string, items: BackupRecord[] | undefined, label: string) => {
    if (!Array.isArray(items) || items.length === 0) return;
    processed += items.length;
    onProgress?.(label, processed);
    const existing = parseStoredRecords(key);
    const existingIds = new Set(existing.map(item => item.id).filter(Boolean));
    const newItems = items
      .map(item => ({ ...item, userId: currentUserId }))
      .filter(item => !existingIds.has(item.id));

    if (newItems.length > 0) {
      localStorage.setItem(key, JSON.stringify([...existing, ...newItems]));
      imported += newItems.length;
    }
    await new Promise(resolve => setTimeout(resolve, 0));
  };

  await merge('mm_transactions', data.transactions, 'Importing transactions…');
  await merge('mm_budgets', data.budgets, 'Importing budgets…');
  await merge('mm_goals', data.goals, 'Importing goals…');
  await merge('mm_reminders', data.reminders, 'Importing reminders…');
  await merge('mm_recurring', data.recurring, 'Importing recurring…');
  await merge('mm_partners', data.partners, 'Importing partners…');
  await merge('mm_adjustments', data.adjustments, 'Importing adjustments…');

  return imported;
}

function parseStoredRecords(key: string): BackupRecord[] {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}
