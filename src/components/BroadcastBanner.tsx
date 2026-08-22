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
  info: <Info className="h-3.5 w-3.5 shrink-0" />,
  warning: <AlertTriangle className="h-3.5 w-3.5 shrink-0" />,
  success: <CheckCircle className="h-3.5 w-3.5 shrink-0" />,
  error: <AlertCircle className="h-3.5 w-3.5 shrink-0" />,
};

const BG: Record<string, string> = {
  info: 'bg-blue-600 text-white',
  warning: 'bg-amber-500 text-white',
  success: 'bg-green-600 text-white',
  error: 'bg-red-600 text-white',
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
    <div className={`fixed top-2 right-2 z-[9998] max-w-sm w-[calc(100vw-1rem)] ${BG[type]} rounded-lg shadow-lg px-3 py-2 text-xs font-medium leading-snug flex items-start gap-2`}>
      <span className="mt-0.5">{ICONS[type]}</span>
      <span className="flex-1 min-w-0">
        {data.title && <span className="font-bold">{data.title} </span>}
        {data.message}
      </span>
      {!data.pinned && (
        <button onClick={dismiss} className="shrink-0 p-0.5 rounded hover:bg-white/20 transition-colors">
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
