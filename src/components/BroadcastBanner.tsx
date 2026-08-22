import { useEffect, useState } from 'react';
import { Megaphone, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BroadcastData {
  id: string;
  title?: string;
  message: string;
  type?: 'info' | 'warning' | 'success' | 'error';
  pinned?: boolean;
  expires?: string;
}

const TYPE_STYLES: Record<string, string> = {
  info: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200',
  warning: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200',
  success: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200',
  error: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200',
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
    fetch(`/broadcast.json?t=${Date.now()}`)
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

  const dismiss = () => {
    saveDismissed(data.id);
    setData(null);
  };

  return (
    <div className={cn(
      'mx-4 mt-3 mb-1 px-4 py-3 rounded-xl border flex items-start gap-3 text-sm',
      TYPE_STYLES[data.type || 'info'],
    )}>
      <Megaphone className="h-4 w-4 mt-0.5 shrink-0 opacity-60" />
      <div className="flex-1 min-w-0">
        {data.title && <p className="font-semibold mb-0.5">{data.title}</p>}
        <p className="opacity-90">{data.message}</p>
      </div>
      {!data.pinned && (
        <button onClick={dismiss} className="shrink-0 p-0.5 rounded hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
          <X className="h-3.5 w-3.5 opacity-50" />
        </button>
      )}
    </div>
  );
}
