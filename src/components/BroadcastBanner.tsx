import { useEffect, useState } from 'react';
import { X, Info, AlertTriangle, CheckCircle, AlertCircle, ExternalLink } from 'lucide-react';
import { BROADCAST_BIN_ID, JSONBIN_BASE, ANNOUNCEMENTS_API } from '@/lib/env';
import { isWithinPeriod } from '@/lib/utils';

interface BroadcastData {
  id: string;
  title?: string;
  message: string;
  type?: 'info' | 'warning' | 'success' | 'error';
  pinned?: boolean;
  expires?: string;
  link?: string;
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

function BroadcastPill({ data, onDismiss }: { data: BroadcastData; onDismiss: () => void }) {
  const type = data.type || 'info';
  const Wrapper = data.link ? 'a' : 'div';
  const wrapperProps = data.link ? { href: data.link, target: '_blank', rel: 'noopener noreferrer' } : {};

  return (
    <div className={`fixed left-1/2 -translate-x-1/2 z-[9998] max-w-lg w-[calc(100vw-1rem)] ${BG[type]} rounded-lg shadow-lg px-3 py-2 text-xs font-medium leading-snug flex items-center gap-2${data.link ? ' cursor-pointer hover:opacity-90 transition-opacity' : ''}`} style={{ top: '8px' }}>
      <Wrapper {...wrapperProps} className="contents">
        <span className="shrink-0">{ICONS[type]}</span>
        <span className="flex-1 min-w-0 truncate">
          {data.title && <span className="font-bold">{data.title} </span>}
          {data.message}
        </span>
        {data.link && <ExternalLink className="h-3 w-3 shrink-0 opacity-70" />}
      </Wrapper>
      {!data.pinned && (
        <button onClick={(e) => { e.stopPropagation(); onDismiss(); }} className="shrink-0 p-0.5 rounded hover:bg-white/20 transition-colors">
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

// Module scope: fetched list is cached across in-app navigation so menu clicks
// don't re-request jsonbin. Cache resets on app start / refresh / reload.
let broadcastCache: BroadcastData[] | null = null;

export default function BroadcastBanner() {
  const [items, setItems] = useState<BroadcastData[]>([]);

  useEffect(() => {
    const applyFilter = (list: BroadcastData[]) => {
      const dismissed = getDismissed();
      const visible = list.filter(b => {
        if (!b?.id || !b?.message) return false;
        if (!isWithinPeriod(undefined, b.expires)) return false;
        if (!b.pinned && dismissed.has(b.id)) return false;
        return true;
      });
      setItems(visible);
    };

    if (broadcastCache) { applyFilter(broadcastCache); return; }

    // Primary: edge-cached proxy (quota-friendly). Fallback: direct jsonbin.
    const fetchJson = async (): Promise<any | null> => {
      try {
        const r = await fetch(`${ANNOUNCEMENTS_API}?type=broadcast`);
        if (!r.ok) throw new Error();
        return await r.json();
      } catch {}
      try {
        if (!BROADCAST_BIN_ID) return null;
        const r = await fetch(`${JSONBIN_BASE}${BROADCAST_BIN_ID}/latest?t=${Date.now()}`, { cache: 'no-store' });
        if (!r.ok) throw new Error();
        return await r.json();
      } catch {}
      return null;
    };

    fetchJson().then(res => {
      if (!res) return;
      const raw = res?.record ?? res;
      broadcastCache = Array.isArray(raw) ? raw : [raw];
      applyFilter(broadcastCache);
    }).catch(() => {});
  }, []);

  if (items.length === 0) return null;

  const dismiss = (id: string) => {
    saveDismissed(id);
    setItems(prev => prev.filter(b => b.id !== id));
  };

  return (
    <>
      {items.map((b, i) => (
        <div key={b.id} style={{ top: `${8 + i * 44}px` }} className={`fixed left-1/2 -translate-x-1/2 z-[9998]`}>
          <BroadcastPill data={b} onDismiss={() => dismiss(b.id)} />
        </div>
      ))}
    </>
  );
}
