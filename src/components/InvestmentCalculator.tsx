'use client';

import { useState, useRef, useEffect } from 'react';
import { X, Calculator, PiggyBank, Repeat, Landmark, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface Props {
  onClose: () => void;
  onApply?: (amount: number) => void;
}

const TABS = [
  { key: 'fd', label: 'FD', icon: Landmark, desc: 'Fixed Deposit' },
  { key: 'sip', label: 'SIP', icon: Repeat, desc: 'Systematic Investment Plan' },
  { key: 'rd', label: 'RD', icon: PiggyBank, desc: 'Recurring Deposit' },
  { key: 'ppf', label: 'PPF', icon: RefreshCw, desc: 'Public Provident Fund' },
];

export default function InvestmentCalculator({ onClose, onApply }: Props) {
  const [tab, setTab] = useState('fd');
  const [result, setResult] = useState<{ invested: number; maturity: number; returns: number; breakdown?: string[] } | null>(null);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const tabBarRef = useRef<HTMLDivElement>(null);
  const activeTabRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (activeTabRef.current && tabBarRef.current) {
      activeTabRef.current.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, [tab]);

  // FD
  const [fdPrincipal, setFdPrincipal] = useState('');
  const [fdRate, setFdRate] = useState('');
  const [fdYears, setFdYears] = useState('');
  const [fdMonths, setFdMonths] = useState('');
  const [fdCompound, setFdCompound] = useState('4');

  // SIP
  const [sipMonthly, setSipMonthly] = useState('');
  const [sipRate, setSipRate] = useState('');
  const [sipYears, setSipYears] = useState('');

  // RD
  const [rdMonthly, setRdMonthly] = useState('');
  const [rdRate, setRdRate] = useState('');
  const [rdYears, setRdYears] = useState('');

  // PPF
  const [ppfAnnual, setPpfAnnual] = useState('');
  const [ppfRate, setPpfRate] = useState('7.1');
  const [ppfYears, setPpfYears] = useState('15');

  const calcFD = () => {
    const P = Number(fdPrincipal);
    const r = Number(fdRate) / 100;
    const t = Number(fdYears) + Number(fdMonths) / 12;
    const n = Number(fdCompound);
    if (!P || !r || !t) return { invested: P, maturity: P, returns: 0 };
    const A = P * Math.pow(1 + r / n, n * t);
    const breakdown: string[] = [];
    for (let y = 1; y <= Math.ceil(t); y++) {
      const val = P * Math.pow(1 + r / n, n * y);
      breakdown.push(`Year ${y}: ₹${Math.round(val).toLocaleString()}`);
    }
    return { invested: P, maturity: Math.round(A), returns: Math.round(A - P), breakdown };
  };

  const calcSIP = () => {
    const P = Number(sipMonthly);
    const r = Number(sipRate) / 100 / 12;
    const n = Number(sipYears) * 12;
    if (!P || !r || !n) return { invested: P * n, maturity: P * n, returns: 0 };
    const M = P * ((Math.pow(1 + r, n) - 1) / r) * (1 + r);
    const invested = P * n;
    const breakdown: string[] = [];
    for (let y = 1; y <= Number(sipYears); y++) {
      const months = y * 12;
      const val = P * ((Math.pow(1 + r, months) - 1) / r) * (1 + r);
      breakdown.push(`Year ${y}: ₹${Math.round(val).toLocaleString()} (invested ₹${(P * months).toLocaleString()})`);
    }
    return { invested: Math.round(invested), maturity: Math.round(M), returns: Math.round(M - invested), breakdown };
  };

  const calcRD = () => {
    const P = Number(rdMonthly);
    const r = Number(rdRate) / 100 / 4;
    const n = Number(rdYears) * 4;
    if (!P || !r || !n) return { invested: P * n, maturity: P * n, returns: 0 };
    const M = P * ((Math.pow(1 + r, n) - 1) / (1 - Math.pow(1 + r, -1/3)));
    const invested = P * Number(rdYears) * 12;
    return { invested: Math.round(invested), maturity: Math.round(M), returns: Math.round(M - invested) };
  };

  const calcPPF = () => {
    const P = Number(ppfAnnual);
    const r = Number(ppfRate) / 100;
    const t = Number(ppfYears);
    if (!P || !r || !t) return { invested: P * t, maturity: P * t, returns: 0 };
    const M = P * ((Math.pow(1 + r, t) - 1) / r) * (1 + r);
    const invested = P * t;
    const breakdown: string[] = [];
    for (let y = 1; y <= t; y++) {
      const val = P * ((Math.pow(1 + r, y) - 1) / r) * (1 + r);
      breakdown.push(`Year ${y}: ₹${Math.round(val).toLocaleString()}`);
    }
    return { invested: Math.round(invested), maturity: Math.round(M), returns: Math.round(M - invested), breakdown };
  };

  const handleCalculate = () => {
    let res;
    switch (tab) {
      case 'fd': res = calcFD(); break;
      case 'sip': res = calcSIP(); break;
      case 'rd': res = calcRD(); break;
      case 'ppf': res = calcPPF(); break;
      default: return;
    }
    setResult(res);
    setShowBreakdown(false);
  };

  const activeTab = TABS.find(t => t.key === tab);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-start justify-center z-[60] overflow-y-auto">
      <div className="bg-white dark:bg-[#2A2522] rounded-2xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl mt-20 sm:mt-28 mx-4">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-slate-100 dark:border-brand-muted/50 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-brand-secondary dark:bg-brand-muted/20">
              <Calculator className="h-5 w-5 text-brand" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Investment Calculator</h3>
              <p className="text-[11px] text-slate-400 dark:text-slate-500">{activeTab?.desc}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-brand-muted active:scale-95 transition-all">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs — horizontal scroll */}
        <div ref={tabBarRef} className="flex gap-1.5 px-5 py-3 overflow-x-auto shrink-0 scrollbar-hide border-b border-slate-100 dark:border-brand-muted/30">
          {TABS.map(t => (
            <button key={t.key} ref={tab === t.key ? activeTabRef : undefined}
              onClick={() => { setTab(t.key); setResult(null); }}
              className={cn("flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all active:scale-95",
                tab === t.key
                  ? "bg-brand text-white shadow-sm shadow-brand/30"
                  : "bg-slate-100 dark:bg-brand-muted/20 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-brand-muted/40"
              )}>
              <t.icon className="h-3.5 w-3.5 shrink-0" /> {t.label}
            </button>
          ))}
        </div>

        {/* Form — scrollable */}
        <div className="overflow-y-auto px-5 py-4 space-y-4 flex-1">
          {/* FD Form */}
          {tab === 'fd' && (
            <div className="space-y-3.5">
              <p className="text-[10px] text-slate-400 dark:text-slate-500 italic text-center">A = P × (1 + r/n)<sup>nt</sup></p>
              <NumInput label="Principal Amount" value={fdPrincipal} onChange={setFdPrincipal} placeholder="e.g. 50000" autoFocus />
              <NumInput label="Interest Rate (% p.a.)" value={fdRate} onChange={setFdRate} placeholder="e.g. 7.5" step="0.1" />
              <div className="grid grid-cols-2 gap-3">
                <NumInput label="Years" value={fdYears} onChange={setFdYears} placeholder="0" />
                <NumInput label="Months" value={fdMonths} onChange={setFdMonths} placeholder="0" />
              </div>
              <SelectInput label="Compounding" value={fdCompound} onChange={setFdCompound}
                options={[
                  { value: '1', label: 'Yearly' },
                  { value: '2', label: 'Half-Yearly' },
                  { value: '4', label: 'Quarterly' },
                  { value: '12', label: 'Monthly' },
                ]} />
            </div>
          )}

          {/* SIP Form */}
          {tab === 'sip' && (
            <div className="space-y-3.5">
              <p className="text-[10px] text-slate-400 dark:text-slate-500 italic text-center">M = P × ((1+r)<sup>n</sup> - 1) / r × (1+r)</p>
              <NumInput label="Monthly Investment" value={sipMonthly} onChange={setSipMonthly} placeholder="e.g. 5000" autoFocus />
              <NumInput label="Expected Return (% p.a.)" value={sipRate} onChange={setSipRate} placeholder="e.g. 12" step="0.1" />
              <NumInput label="Investment Period (years)" value={sipYears} onChange={setSipYears} placeholder="e.g. 10" />
            </div>
          )}

          {/* RD Form */}
          {tab === 'rd' && (
            <div className="space-y-3.5">
              <p className="text-[10px] text-slate-400 dark:text-slate-500 italic text-center">Quarterly compounding RD formula</p>
              <NumInput label="Monthly Deposit" value={rdMonthly} onChange={setRdMonthly} placeholder="e.g. 2000" autoFocus />
              <NumInput label="Interest Rate (% p.a.)" value={rdRate} onChange={setRdRate} placeholder="e.g. 6.5" step="0.1" />
              <NumInput label="Tenure (years)" value={rdYears} onChange={setRdYears} placeholder="e.g. 5" />
            </div>
          )}

          {/* PPF Form */}
          {tab === 'ppf' && (
            <div className="space-y-3.5">
              <p className="text-[10px] text-slate-400 dark:text-slate-500 italic text-center">M = P × ((1+r)<sup>t</sup> - 1) / r × (1+r)</p>
              <NumInput label="Annual Investment" value={ppfAnnual} onChange={setPpfAnnual} placeholder="e.g. 150000" autoFocus />
              <NumInput label="Interest Rate (% p.a.)" value={ppfRate} onChange={setPpfRate} placeholder="e.g. 7.1" step="0.1" />
              <NumInput label="Tenure (years)" value={ppfYears} onChange={setPpfYears} placeholder="e.g. 15" />
            </div>
          )}

          {/* Calculate Button */}
          <Button className="w-full py-3 text-sm font-semibold gap-2" onClick={handleCalculate}>
            <Calculator className="h-4 w-4" /> Calculate
          </Button>
        </div>

        {/* Result — sticky bottom */}
        {result && (
          <div className="shrink-0 px-5 pb-5 pt-0">
            <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/30 dark:to-teal-900/20 border border-emerald-200 dark:border-emerald-800/60 space-y-3 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Total Invested</span>
                <span className="text-sm font-bold text-slate-800 dark:text-slate-200">₹{result.invested.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Maturity Amount</span>
                <span className="text-base font-bold text-emerald-700 dark:text-emerald-300">₹{result.maturity.toLocaleString()}</span>
              </div>
              <div className="h-px bg-emerald-200 dark:bg-emerald-700/50" />
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Total Returns</span>
                <span className="text-base font-bold text-brand">+₹{result.returns.toLocaleString()}</span>
              </div>

              {result.breakdown && (
                <>
                  <button onClick={() => setShowBreakdown(!showBreakdown)}
                    className="flex items-center justify-center gap-1 w-full text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 pt-1 transition-colors">
                    {showBreakdown ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    {showBreakdown ? 'Hide' : 'Show'} year-wise breakdown
                  </button>
                  {showBreakdown && (
                    <div className="space-y-1 max-h-28 overflow-y-auto pt-1 border-t border-emerald-200 dark:border-emerald-700/30">
                      {result.breakdown.map((b, i) => (
                        <p key={i} className="text-[11px] text-slate-500 dark:text-slate-400">{b}</p>
                      ))}
                    </div>
                  )}
                </>
              )}

              {onApply && (
                <Button size="sm" variant="outline" className="w-full mt-1 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 active:scale-[0.98] transition-all" onClick={() => onApply(result.maturity)}>
                  Use this amount
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function NumInput({ label, value, onChange, placeholder, step, autoFocus }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; step?: string; autoFocus?: boolean }) {
  return (
    <div>
      <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1.5">{label}</label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 text-sm font-medium">₹</span>
        <input value={value} onChange={e => onChange(e.target.value)} autoFocus={autoFocus}
          inputMode="decimal" type="number" min="0" step={step || '1'}
          placeholder={placeholder || '0'}
          className="w-full pl-7 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-brand-muted dark:bg-brand-dark text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-brand focus:border-transparent text-sm transition-all" />
      </div>
    </div>
  );
}

function SelectInput({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div>
      <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1.5">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-brand-muted dark:bg-brand-dark text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand/60 text-sm transition-all appearance-none bg-no-repeat bg-right-3"
        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundPosition: 'right 10px center', backgroundSize: '14px' }}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}
