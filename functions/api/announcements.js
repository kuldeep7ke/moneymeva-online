// Cloudflare Pages Function — edge-cached proxy for jsonbin announcement bins.
// All devices hit THIS endpoint; Cloudflare serves from edge cache for 1h,
// so jsonbin receives only ~24 requests/day/month total regardless of user count.
// Bin IDs live server-side here (never shipped in app bundles).
// Optional: set BROADCAST_BIN_ID / BANNER_BIN_ID as Pages env vars in the
// Cloudflare dashboard to override the fallbacks below.
const JSONBIN_BASE = 'https://api.jsonbin.io/v3/b/';
const FALLBACK_IDS = {
  broadcast: '6a89f038f5f4af5e29363c79',
  banner: '6a89f053f5f4af5e29363cb3',
};
const TTL_SECONDS = 3600; // 1h edge cache

export async function onRequestGet(context) {
  const { request, env, waitUntil } = context;
  const url = new URL(request.url);
  const type = url.searchParams.get('type') === 'banner' ? 'banner' : 'broadcast';
  const binId = (type === 'banner' ? env.BANNER_BIN_ID : env.BROADCAST_BIN_ID) || FALLBACK_IDS[type];

  // Normalize cache key: ignore any extra query params so every device shares one cache entry
  const cacheKey = new Request(`${url.origin}/api/announcements?type=${type}`);
  const cache = caches.default;

  let res = await cache.match(cacheKey);
  if (!res) {
    try {
      const upstream = await fetch(`${JSONBIN_BASE}${binId}/latest`, {
        headers: { Accept: 'application/json' },
        cf: { cacheTtl: TTL_SECONDS },
      });
      const body = await upstream.text();
      res = new Response(body, {
        status: upstream.status,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': `public, max-age=${TTL_SECONDS}`,
          'Access-Control-Allow-Origin': '*',
        },
      });
      if (upstream.ok) waitUntil(cache.put(cacheKey, res.clone()));
    } catch {
      res = new Response(JSON.stringify({ error: 'upstream-failed' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }
  }
  return res;
}
