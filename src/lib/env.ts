// Runtime config. Supabase URL/key are NOT baked in — this app is offline-first and
// cloud sync is bring-your-own: set NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY
// / NEXT_PUBLIC_SITE_URL in .env.local (see SELF-HOSTING.md) before building, or paste a
// project in Settings → Multi-Device Sync at runtime. Announcement bins stay obfuscated.
const _K = 'moneymeva';
function _d(e: string): string {
  try {
    const bin = atob(e);
    let out = '';
    for (let i = 0; i < bin.length; i++) {
      out += String.fromCharCode(bin.charCodeAt(i) ^ _K.charCodeAt(i % _K.length));
    }
    return out;
  } catch {
    return '';
  }
}

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  'https://moneymevaonline.pages.dev'
).replace(/\/$/, '');

// jsonbin.io Bin IDs (broadcast & banner — edit via jsonbin.io dashboard, see docs/BROADCAST-GUIDE.md)
export const BROADCAST_BIN_ID = _d('Ww5WXB9dVk4HWAlaBB9YAERYXlldBk5U');
export const BANNER_BIN_ID = _d('Ww5WXB9dUEUHWAlaBB9YAERYXlldBhte');
export const JSONBIN_BASE = _d('BRsaFQpXSlkAHQZADwoCCxQIA0EHClYbVlkDQg==');

// Edge-cached proxy (Cloudflare Pages Function, functions/api/announcements.js).
// Primary source for broadcasts/banner — protects the jsonbin free quota
// (~48 origin requests/month instead of per-device requests). Direct jsonbin
// URLs above remain as automatic fallback if the proxy fails.
export const ANNOUNCEMENTS_API = `${SITE_URL}/api/announcements`;
