import { useEffect, useState } from 'react';
import { RELEASE_NOTES, shouldShowWhatsNew, markVersionSeen } from '@/lib/whats-new';
import { requestPopup, cancelPopup } from '@/lib/popup-queue';

export default function WhatsNewModal() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const meta = document.querySelector('meta[name="app-version"]');
    const version = meta?.getAttribute('content');
    if (!version) return;
    if (shouldShowWhatsNew(version)) {
      requestPopup('whats-new', 10, () => setShow(true));
    }
    return () => cancelPopup('whats-new');
  }, []);

  const handleDismiss = () => {
    const meta = document.querySelector('meta[name="app-version"]');
    const version = meta?.getAttribute('content');
    if (version) markVersionSeen(version);
    cancelPopup('whats-new');
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl max-w-md w-full mx-4 p-6 border border-slate-200 dark:border-slate-700">
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-1">
          What&apos;s New in Money Meva
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
          {RELEASE_NOTES.version} &middot; {RELEASE_NOTES.date}
        </p>
        <ul className="space-y-2 mb-6">
          {RELEASE_NOTES.items.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-brand shrink-0" />
              {item}
            </li>
          ))}
        </ul>
        <button
          onClick={handleDismiss}
          className="w-full py-2.5 rounded-xl bg-brand text-white font-semibold text-sm hover:opacity-90 transition-opacity"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
