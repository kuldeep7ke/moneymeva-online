import { useEffect, useState } from 'react';
import { X, Info, AlertTriangle, CheckCircle, AlertCircle } from 'lucide-react';

interface BroadcastData {
  id: string;
  title?: string;
  message: string;
  type?: 'info' | 'warning' | 'success' | 'error';
  pinned?: boolean;
  expires?: string;
}

const ICONS: Record<string, React.ReactNode> = {
  info: <Info className="h-4 w-4 shrink-0" />,
  warning: <AlertTriangle className="h-4 w-4 shrink-0" />,
  success: <CheckCircle className="h-4 w-4 shrink-0" />,
  error: <AlertCircle className="h-4 w-4 shrink-0" />,
};

const BG: Record<string, string> = {
  info: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300',
  warning: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300',
  success: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300',
  error: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300',
};

const DISMISSED_KEY = 'mm_dismissed_broadcasts';

function getDismissed(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch { return new Set(); }
}

function saveDismissed(id: string) {
  const dismissed = getDismissed();
  dismissed.add(id);
  try { localStorage.setItem(DISMISSED_KEY, JSON.stringify([...dismissed])); } catch {}
}

export default function BroadcastBanner() {
  const [data, setData] = useState<BroadcastData | null>(null);

  useEffect(() => {
    fetch(`/broadcast.json?t=${Date.now()}`, { cache: 'no-store' })
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then((b: BroadcastData) => {
        if (!b?.id || !b?.message) return;
        if (b.expires && new Date(b.expires) < new Date()) return;
        if (!b.pinned && getDismissed().has(b.id)) return;
        setData(b);
      })
      .catch(() => {});
  }, []);

  if (!data) return null;

  const type = data.type || 'info';

  const dismiss = () => {
    saveDismissed(data.id);
    setData(null);
  };

  return (
    <div className={`w-full border-b ${BG[type]}`}>
      <div className="max-w-4xl mx-auto px-4 py-2.5 flex items-center justify-center gap-2 text-sm font-medium">
        <span className="shrink-0">{ICONS[type]}</span>
        {data.title && <span className="font-bold">{data.title}</span>}
        <span>{data.message}</span>
        {!data.pinned && (
          <button onClick={dismiss} className="ml-2 shrink-0 p-0.5 rounded hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
            <X className="h-3.5 w-3.5 opacity-50" />
          </button>
        )}
      </div>
    </div>
  );
}
