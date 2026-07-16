'use client';

import { useState } from 'react';
import { X, Calculator, PiggyBank, TrendingUp, Repeat, Landmark, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface Props {
  onClose: () => void;
  onApply?: (amount: number) => void;
}

const TABS = [
  { key: 'fd', label: 'FD', icon: Landmark },
  { key: 'sip', label: 'SIP', icon: Repeat },
  { key: 'lumpsum', label: 'Lumpsum', icon: TrendingUp },
  { key: 'rd', label: 'RD', icon: PiggyBank },
  { key: 'ppf', label: 'PPF', icon: RefreshCw },
];

export default function InvestmentCalculator({ onClose, onApply }: Props) {
  const [tab, setTab] = useState('fd');
  const [result, setResult] = useState<{ invested: number; maturity: number; returns: number; breakdown?: string[] } | null>(null);

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

  // Lumpsum
  const [lsAmount, setLsAmount] = useState('');
  const [lsRate, setLsRate] = useState('');
  const [lsYears, setLsYears] = useState('');

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

  const calcLumpsum = () => {
    const P = Number(lsAmount);
    const r = Number(lsRate) / 100;
    const t = Number(lsYears);
    if (!P || !r || !t) return { invested: P, maturity: P, returns: 0 };
    const A = P * Math.pow(1 + r, t);
    const breakdown: string[] = [];
    for (let y = 1; y <= t; y++) {
      const val = P * Math.pow(1 + r, y);
      breakdown.push(`Year ${y}: ₹${Math.round(val).toLocaleString()}`);
    }
    return { invested: P, maturity: Math.round(A), returns: Math.round(A - P), breakdown };
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
      case 'lumpsum': res = calcLumpsum(); break;
      case 'rd': res = calcRD(); break;
      case 'ppf': res = calcPPF(); break;
      default: return;
    }
    setResult(res);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-start sm:items-center justify-center z-[60] p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white dark:bg-[#2A2522] rounded-2xl max-w-lg w-full p-6 shadow-2xl my-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-brand" />
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Investment Calculator</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-brand-muted">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-5 overflow-x-auto pb-1">
          {TABS.map(t => (
            <button key={t.key} onClick={() => { setTab(t.key); setResult(null); }}
              className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors",
                tab === t.key ? "bg-brand text-white" : "bg-slate-100 dark:bg-brand-muted/30 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-brand-muted/50"
              )}>
              <t.icon className="h-3.5 w-3.5" /> {t.label}
            </button>
          ))}
        </div>

        {/* FD Form */}
        {tab === 'fd' && (
          <div className="space-y-3">
            <p className="text-xs text-slate-500 dark:text-slate-400">A = P × (1 + r/n)<sup>nt</sup></p>
            <Input label="Principal Amount (₹)" value={fdPrincipal} onChange={setFdPrincipal} />
            <Input label="Interest Rate (% p.a.)" value={fdRate} onChange={setFdRate} type="number" step="0.1" />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Years" value={fdYears} onChange={setFdYears} type="number" />
              <Input label="Months" value={fdMonths} onChange={setFdMonths} type="number" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1">Compounding</label>
              <select value={fdCompound} onChange={e => setFdCompound(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-brand-muted dark:bg-brand-dark dark:text-slate-100 outline-none focus:ring-2 focus:ring-brand text-sm">
                <option value="1">Yearly</option>
                <option value="2">Half-Yearly</option>
                <option value="4">Quarterly</option>
                <option value="12">Monthly</option>
              </select>
            </div>
          </div>
        )}

        {/* SIP Form */}
        {tab === 'sip' && (
          <div className="space-y-3">
            <p className="text-xs text-slate-500 dark:text-slate-400">M = P × ((1+r)<sup>n</sup> - 1) / r × (1+r)</p>
            <Input label="Monthly Investment (₹)" value={sipMonthly} onChange={setSipMonthly} />
            <Input label="Expected Return (% p.a.)" value={sipRate} onChange={setSipRate} type="number" step="0.1" />
            <Input label="Investment Period (years)" value={sipYears} onChange={setSipYears} type="number" />
          </div>
        )}

        {/* Lumpsum Form */}
        {tab === 'lumpsum' && (
          <div className="space-y-3">
            <p className="text-xs text-slate-500 dark:text-slate-400">A = P × (1 + r)<sup>t</sup></p>
            <Input label="Investment Amount (₹)" value={lsAmount} onChange={setLsAmount} />
            <Input label="Expected Return (% p.a.)" value={lsRate} onChange={setLsRate} type="number" step="0.1" />
            <Input label="Tenure (years)" value={lsYears} onChange={setLsYears} type="number" />
          </div>
        )}

        {/* RD Form */}
        {tab === 'rd' && (
          <div className="space-y-3">
            <p className="text-xs text-slate-500 dark:text-slate-400">Quarterly compounding RD formula</p>
            <Input label="Monthly Deposit (₹)" value={rdMonthly} onChange={setRdMonthly} />
            <Input label="Interest Rate (% p.a.)" value={rdRate} onChange={setRdRate} type="number" step="0.1" />
            <Input label="Tenure (years)" value={rdYears} onChange={setRdYears} type="number" />
          </div>
        )}

        {/* PPF Form */}
        {tab === 'ppf' && (
          <div className="space-y-3">
            <p className="text-xs text-slate-500 dark:text-slate-400">M = P × ((1+r)<sup>t</sup> - 1) / r × (1+r)</p>
            <Input label="Annual Investment (₹)" value={ppfAnnual} onChange={setPpfAnnual} />
            <Input label="Interest Rate (% p.a.)" value={ppfRate} onChange={setPpfRate} type="number" step="0.1" />
            <Input label="Tenure (years)" value={ppfYears} onChange={setPpfYears} type="number" />
          </div>
        )}

        <Button className="w-full mt-4" onClick={handleCalculate}>
          <Calculator className="h-4 w-4 mr-1.5" /> Calculate
        </Button>

        {/* Result */}
        {result && (
          <div className="mt-4 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600 dark:text-slate-400">Total Invested</span>
              <span className="font-bold text-slate-900 dark:text-slate-100">₹{result.invested.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600 dark:text-slate-400">Maturity Amount</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">₹{result.maturity.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm pt-2 border-t border-emerald-200 dark:border-emerald-700">
              <span className="text-slate-600 dark:text-slate-400">Total Returns</span>
              <span className="font-bold text-brand">₹{result.returns.toLocaleString()}</span>
            </div>
            {result.breakdown && (
              <details className="pt-2">
                <summary className="text-xs text-slate-500 dark:text-slate-400 cursor-pointer hover:text-slate-700">Year-wise breakdown</summary>
                <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                  {result.breakdown.map((b, i) => (
                    <p key={i} className="text-xs text-slate-500 dark:text-slate-400">{b}</p>
                  ))}
                </div>
              </details>
            )}
            {onApply && (
              <Button size="sm" variant="outline" className="w-full mt-2" onClick={() => onApply(result.maturity)}>
                Use this amount
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Input({ label, value, onChange, ...props }: { label: string; value: string; onChange: (v: string) => void; type?: string; step?: string }) {
  return (
    <div>
      <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1">{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-brand-muted dark:bg-brand-dark dark:text-slate-100 outline-none focus:ring-2 focus:ring-brand text-sm" {...props as any} />
    </div>
  );
}
