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

export default function BannerModal() {
  const [data, setData] = useState<BannerData | null>(null);
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    fetch(`/banner.json?t=${Date.now()}`, { cache: 'no-store' })
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then((b: BannerData) => {
        if (!b?.id || !b?.content) return;
        if (b.expires && new Date(b.expires) < new Date()) return;
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
    setData(null);
  }, []);

  if (!data) return null;

  const widthClass = data.width || 'max-w-md';
  const Wrapper = data.href ? 'a' : 'div';
  const wrapperProps = data.href ? { href: data.href, target: '_blank', rel: 'noopener noreferrer' } : {};

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className={`bg-white dark:bg-slate-900 rounded-2xl shadow-2xl ${widthClass} w-[calc(100vw-2rem)] max-h-[calc(100vh-4rem)] overflow-hidden relative`} onClick={e => e.stopPropagation()}>
        <button
          onClick={dismiss}
          disabled={countdown > 0}
          className="absolute top-3 right-3 z-10 h-8 w-8 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center text-white transition-opacity disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {countdown > 0 ? <span className="text-xs font-bold">{countdown}</span> : <X className="h-4 w-4" />}
        </button>
        <Wrapper {...wrapperProps} className="contents">
          {data.image && (
            <img src={data.image} alt={data.title || ''} className="w-full object-cover max-h-64" />
          )}
          <div className="px-6 py-5">
            {data.title && <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">{data.title}</h2>}
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">{data.content}</p>
          </div>
        </Wrapper>
      </div>
    </div>
  );
}
