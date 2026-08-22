import { useEffect, useState, useCallback } from 'react';
import { X, Loader2 } from 'lucide-react';
import { BANNER_BIN_ID, JSONBIN_BASE, ANNOUNCEMENTS_API } from '@/lib/env';
import { isWithinPeriod } from '@/lib/utils';

interface BannerData {
  id: string;
  title?: string;
  content: string;
  image?: string;
  href?: string;
  width?: string;
  startDate?: string;
  expires?: string;
}

const COUNTDOWN_SECONDS = 7;

// Module scope: true after the banner displays once. Survives in-app navigation
// (menu clicks) because SPA route changes don't reset modules — but resets on
// app start / refresh / reload, which is exactly when the banner should show.
let bannerShownThisLoad = false;

export default function BannerModal() {
  const [data, setData] = useState<BannerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);

  useEffect(() => {
    if (bannerShownThisLoad) { setLoading(false); return; }
    // Primary: edge-cached proxy (quota-friendly). Fallback: direct jsonbin.
    const fetchJson = async (): Promise<any | null> => {
      try {
        const r = await fetch(`${ANNOUNCEMENTS_API}?type=banner`);
        if (!r.ok) throw new Error();
        return await r.json();
      } catch {}
      try {
        if (!BANNER_BIN_ID) return null;
        const r = await fetch(`${JSONBIN_BASE}${BANNER_BIN_ID}/latest?t=${Date.now()}`, { cache: 'no-store' });
        if (!r.ok) throw new Error();
        return await r.json();
      } catch {}
      return null;
    };
    fetchJson()
      .then((res: any) => {
        if (!res) return;
        const b: BannerData = res?.record ?? res;
        if (!b?.id || !b?.content) return;
        if (!isWithinPeriod(b.startDate, b.expires)) return;
        bannerShownThisLoad = true;
        setData(b);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // No image → banner is fully rendered as soon as data paints
  useEffect(() => {
    if (data && !data.image) setReady(true);
  }, [data]);

  // Countdown starts once fully displayed (7s)
  useEffect(() => {
    if (ready && countdown === null) setCountdown(COUNTDOWN_SECONDS);
  }, [ready, countdown]);

  useEffect(() => {
    if (!ready || countdown === null) return;
    if (countdown <= 0) return;
    const t = setInterval(() => setCountdown(c => (c !== null && c > 0 ? c - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [ready, countdown]);

  // Cached images may never fire onLoad — check completeness via ref
  const imgRef = useCallback((el: HTMLImageElement | null) => {
    if (el && el.complete && el.naturalWidth > 0) setReady(true);
  }, []);
  const onImgDone = useCallback(() => setReady(true), []);

  const dismiss = useCallback(() => {
    setData(null);
    setReady(false);
    setCountdown(null);
  }, []);

  if (loading) {
    return (
      <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-[calc(100vw-2rem)] overflow-hidden">
          <div className="h-44 bg-slate-200 dark:bg-slate-800 flex items-center justify-center gap-2">
            <Loader2 className="h-6 w-6 text-slate-400 animate-spin" />
            <span className="text-xs text-slate-400 font-medium">Loading…</span>
          </div>
          <div className="px-6 py-5 space-y-3">
            <div className="h-4 w-2/3 rounded bg-slate-200 dark:bg-slate-800 animate-pulse" />
            <div className="space-y-2">
              <div className="h-3 w-full rounded bg-slate-200 dark:bg-slate-800 animate-pulse" />
              <div className="h-3 w-5/6 rounded bg-slate-200 dark:bg-slate-800 animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const widthClass = data.width || 'max-w-md';
  const Wrapper = data.href ? 'a' : 'div';
  const wrapperProps = data.href ? { href: data.href, target: '_blank', rel: 'noopener noreferrer' } : {};
  const canClose = countdown !== null && countdown <= 0;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className={`bg-white dark:bg-slate-900 rounded-2xl shadow-2xl ${widthClass} w-[calc(100vw-2rem)] max-h-[calc(100vh-4rem)] overflow-hidden relative`} onClick={e => e.stopPropagation()}>
        {canClose && (
          <button
            onClick={dismiss}
            className="absolute top-3 right-3 z-10 h-8 w-8 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center text-white transition-opacity"
            aria-label="Close banner"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        {!canClose && (
          <div className="absolute top-3 right-3 z-10 h-8 w-8 rounded-full bg-black/40 flex items-center justify-center text-white">
            {countdown !== null && countdown > 0 ? (
              <span className="text-xs font-bold">{countdown}</span>
            ) : (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}
          </div>
        )}
        <Wrapper {...wrapperProps} className="contents">
          {data.image && (
            <img
              ref={imgRef}
              src={data.image}
              alt={data.title || ''}
              onLoad={onImgDone}
              onError={onImgDone}
              className="w-full object-cover max-h-64"
            />
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
