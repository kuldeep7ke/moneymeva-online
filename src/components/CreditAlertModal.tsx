'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { HandCoins, X, ArrowRight } from 'lucide-react';
import { requestPopup, cancelPopup } from '@/lib/popup-queue';
import { isPopupEnabled } from '@/lib/notification-prefs';
import { getPartners, getPartnerCreditStats } from '@/lib/store';
import { useTranslation } from '@/lib/i18n';
import { cn } from '@/lib/utils';

const SESSION_KEY = 'mm_credit_alert_shown';
const DELAY_MS = 2 * 60 * 1000; // 2-minute delay for credit alarms

export default function CreditAlertModal() {
  const [show, setShow] = useState(false);
  const router = useRouter();
  const { t } = useTranslation();

  const alerts = useMemo(() => {
    let list: ReturnType<typeof getPartnerCreditStats>[] = [];
    try {
      for (const p of getPartners()) {
        if (p.deletedAt) continue;
        const s = getPartnerCreditStats(p.id, p);
        if (s.limitState === 'near' || s.limitState === 'reached') list.push(s);
      }
    } catch { list = []; }
    list.sort((a, b) => (a.limitState === b.limitState ? b.outstanding - a.outstanding : a.limitState === 'reached' ? -1 : 1));
    return list;
  }, []);

  useEffect(() => {
    if (!isPopupEnabled('credit') || alerts.length === 0) return;
    let shown = false;
    try { shown = sessionStorage.getItem(SESSION_KEY) === '1'; } catch { /* ignore */ }
    if (shown) return;
    const timer = setTimeout(() => {
      requestPopup('credit-alert', 50, () => setShow(true));
    }, DELAY_MS);
    return () => { clearTimeout(timer); cancelPopup('credit-alert'); };
  }, [alerts.length]);

  const dismiss = () => {
    try { sessionStorage.setItem(SESSION_KEY, '1'); } catch { /* ignore */ }
    cancelPopup('credit-alert');
    setShow(false);
  };

  const goPartners = () => {
    dismiss();
    router.push('/dashboard/partners');
  };

  if (!show || alerts.length === 0) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
      <div className="bg-white dark:bg-[#2A2522] rounded-2xl max-w-md w-full p-6 shadow-2xl border border-amber-300 dark:border-amber-700">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={cn("p-2 rounded-full", alerts.some(a => a.limitState === 'reached') ? "bg-red-100 dark:bg-red-900/30" : "bg-amber-100 dark:bg-amber-900/30")}>
              <HandCoins className={cn("h-5 w-5", alerts.some(a => a.limitState === 'reached') ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400")} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">{t('credit.modalTitle')}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">{t('credit.needsAttention', { n: alerts.length })}</p>
            </div>
          </div>
          <button onClick={dismiss} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
            <X className="h-4 w-4 text-slate-400" />
          </button>
        </div>

        <div className="space-y-2 max-h-64 overflow-y-auto mb-5">
          {alerts.map(a => {
            const reached = a.limitState === 'reached';
            const name = getPartners().find(p => p.id === a.partnerId)?.name || 'Party';
            return (
              <div key={a.partnerId} className={cn("flex items-center justify-between p-3 rounded-xl border", reached ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800" : "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800")}>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{name}</p>
                  <p className={cn("text-[11px] font-medium", reached ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-500")}>
                    {reached ? t('credit.limitReached') : t('credit.nearLimit')} · {Math.round(a.pctUsed)}%
                  </p>
                </div>
                <div className="text-right shrink-0 ml-3">
                  <p className="text-sm font-bold text-slate-900 dark:text-slate-100">₹{a.outstanding.toLocaleString('en-IN')}</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">{t('credit.ofLimit', { lim: a.limit.toLocaleString('en-IN') })}</p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex gap-2">
          <button onClick={goPartners} className="flex-1 py-2.5 rounded-xl bg-brand text-white font-semibold text-sm hover:opacity-90 transition-opacity items-center justify-center gap-1.5 inline-flex">
            {t('credit.partyAccounts')} <ArrowRight className="h-3.5 w-3.5" />
          </button>
          <button onClick={dismiss} className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-brand-muted text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-brand-muted/50 transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}