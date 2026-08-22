import { useEffect, useState, useCallback } from 'react';
import { X } from 'lucide-react';

interface BannerData {
  id: string;
  title?: string;
  content: string;
  image?: string;
  href?: string;
  width?: string;
  expires?: string;
}

const DISMISSED_KEY = 'mm_dismissed_banners';

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

export default function BannerModal() {
  const [data, setData] = useState<BannerData | null>(null);
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    fetch(`/banner.json?t=${Date.now()}`, { cache: 'no-store' })
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then((b: BannerData) => {
        if (!b?.id || !b?.content) return;
        if (b.expires && new Date(b.expires) < new Date()) return;
        if (getDismissed().has(b.id)) return;
        setData(b);
        setCountdown(5);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!data || countdown <= 0) return;
    const timer = setInterval(() => setCountdown(c => c - 1), 1000);
    return () => clearInterval(timer);
  }, [data, countdown]);

  const dismiss = useCallback(() => {
    if (!data) return;
    saveDismissed(data.id);
    setData(null);
  }, [data]);

  if (!data) return null;

  const widthClass = data.width || 'max-w-md';
  const Wrapper = data.href ? 'a' : 'div';
  const wrapperProps = data.href ? { href: data.href, target: '_blank', rel: 'noopener noreferrer' } : {};

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className={`bg-white dark:bg-slate-900 rounded-2xl shadow-2xl ${widthClass} w-[calc(100vw-2rem)] max-h-[calc(100vh-4rem)] overflow-hidden flex flex-col`} onClick={e => e.stopPropagation()}>
        {data.title && (
          <div className="px-6 pt-5 pb-3">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">{data.title}</h2>
          </div>
        )}
        <Wrapper {...wrapperProps} className="contents">
          <div className="px-6 pb-4 flex-1 overflow-y-auto">
            {data.image && (
              <img src={data.image} alt={data.title || ''} className="w-full rounded-xl mb-3 object-cover max-h-64" />
            )}
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">{data.content}</p>
          </div>
        </Wrapper>
        <div className="px-6 pb-5 pt-2 flex justify-end">
          <button
            onClick={dismiss}
            disabled={countdown > 0}
            className="px-4 py-2 rounded-xl bg-brand text-white text-sm font-semibold transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {countdown > 0 ? `Close (${countdown}s)` : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
}
