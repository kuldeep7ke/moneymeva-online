import { createClient } from '@supabase/supabase-js';

const LS_URL = 'mm_pouch_url';
const LS_KEY = 'mm_sync_key';
const RECONNECT_INTERVAL = 30000;
const SYNC_TABLE = 'sync_docs';

let _PouchDB: any = null;
let localDB: any = null;
let supabase: any = null;
let channel: any = null;
let reconnectTimer: any = null;
let changeListeners: Array<() => void> = [];

export type EntityType = 'transaction' | 'partner' | 'recurring' | 'budget' | 'reminder' | 'adjustment' | 'goal' | 'todo';

async function ensurePouch() {
  if (_PouchDB) return _PouchDB;
  if (typeof window === 'undefined') return null;
  const pdb = await import('pouchdb-browser');
  const find = await import('pouchdb-find');
  _PouchDB = pdb.default;
  _PouchDB.plugin(find.default);
  return _PouchDB;
}

function isLegacyCouchDbUrl(url: string): boolean {
  const u = (url || '').trim();
  if (!u) return false;
  if (/^https?:\/\/[^/@]+@[^/]+/i.test(u)) return true;
  return /couchdb|railway|cloudant|iriscouch/i.test(u);
}

export function getConfig() {
  const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const envKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  try {
    let url = localStorage.getItem(LS_URL) || '';
    if (isLegacyCouchDbUrl(url)) {
      localStorage.removeItem(LS_URL);
      url = '';
    }
    const key = localStorage.getItem(LS_KEY) || envKey;
    return { url: url || envUrl, key: key || envKey };
  } catch { return { url: envUrl, key: envKey }; }
}

function saveConfig(url: string, key: string) {
  try {
    localStorage.setItem(LS_URL, url);
    localStorage.setItem(LS_KEY, key);
  } catch {}
}

const LS_URLS_HISTORY = 'mm_pouch_urls';

export function getSyncUrlHistory(): string[] {
  try {
    const raw = localStorage.getItem(LS_URLS_HISTORY);
    if (!raw) return [];
    const parsed: string[] = JSON.parse(raw);
    const kept = parsed.filter(u => !isLegacyCouchDbUrl(u));
    if (kept.length !== parsed.length) {
      localStorage.setItem(LS_URLS_HISTORY, JSON.stringify(kept));
    }
    return kept;
  } catch { return []; }
}

export function saveSyncUrlHistory(url: string) {
  if (isLegacyCouchDbUrl(url)) return;
  const list = getSyncUrlHistory().filter(u => u !== url);
  list.unshift(url);
  const kept = list.slice(0, 5);
  localStorage.setItem(LS_URLS_HISTORY, JSON.stringify(kept));
}

export function connected(): boolean { return !!(localDB && supabase); }

export function onRemoteChange(fn: () => void) {
  changeListeners.push(fn);
  return () => { changeListeners = changeListeners.filter(f => f !== fn); };
}

function notifyChange() {
  changeListeners.forEach(fn => fn());
}

const ENTITY_PREFIXES: Record<string, EntityType> = {
  transaction: 'transaction', partner: 'partner', recurring: 'recurring',
  budget: 'budget', reminder: 'reminder', adjustment: 'adjustment', goal: 'goal', todo: 'todo',
};

function cleanSupabaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

async function pingRemote(client: any): Promise<{ ok: boolean; error?: string }> {
  try {
    const { error } = await client.from(SYNC_TABLE).select('id').limit(1);
    if (error) {
      const msg = error?.message || error?.details || String(error || 'Unknown error');
      if (/sync_docs|42P01|relation/i.test(msg)) {
        return { ok: false, error: "Table 'sync_docs' not found — run the schema.sql from the supabase/ folder in your project's SQL Editor" };
      }
      return { ok: false, error: msg };
    }
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e || 'Unknown error') };
  }
}

function subscribeRealtime(client: any) {
  try {
    if (channel) { try { supabase.removeChannel(channel); } catch {} channel = null; }
    channel = client.channel('sync_docs_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: SYNC_TABLE }, () => notifyChange())
      .subscribe();
  } catch {}
}

function stopReconnectTimer() {
  if (reconnectTimer) { clearInterval(reconnectTimer); reconnectTimer = null; }
}

function startReconnectTimer(url: string, key: string) {
  stopReconnectTimer();
  reconnectTimer = setInterval(async () => {
    if (connected()) return;
    try {
      const client = createClient(cleanSupabaseUrl(url), key);
      const { ok } = await pingRemote(client);
      if (ok) {
        supabase = client;
        subscribeRealtime(client);
        notifyChange();
      }
    } catch {}
  }, RECONNECT_INTERVAL);
}

export async function initPouchDB() {
  if (localDB) return localDB;
  const Pouch = await ensurePouch();
  if (!Pouch) return null;
  localDB = new Pouch('mm_pouch');
  await localDB.createIndex({ index: { fields: ['entity', 'updatedAt'] } });
  return localDB;
}

async function getCurrentUserId(): Promise<string | null> {
  if (!supabase) return null;
  try {
    const { data } = await supabase.auth.getUser();
    return data?.user?.id || null;
  } catch { return null; }
}

export async function signUpUser(url: string, key: string, email: string, password: string): Promise<{ ok: boolean; needsConfirmation?: boolean; error?: string }> {
  try {
    const client = createClient(cleanSupabaseUrl(url), key.trim());
    const { data, error } = await client.auth.signUp({ email, password });
    if (error) return { ok: false, error: error.message };
    const needsConfirmation = !data.session;
    return { ok: true, needsConfirmation };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e || 'Sign up failed') };
  }
}

// ─── Google OAuth ──────────────────────────────────────────────

export async function signInWithGoogle(): Promise<{ ok: boolean; error?: string }> {
  const cfg = getConfig();
  if (!cfg.url || !cfg.key) {
    return { ok: false, error: 'Cloud sync is not configured — set the Supabase URL and anon key first (Settings → Multi-Device Sync)' };
  }
  try {
    const client = createClient(cleanSupabaseUrl(cfg.url), cfg.key.trim());
    const { error } = await client.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/login` },
    });
    if (error) {
      if (/provider is not enabled/i.test(error.message)) {
        return { ok: false, error: 'Google sign-in is not enabled on this cloud project yet. Ask the app owner to enable it (Supabase → Authentication → Providers → Google).' };
      }
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e || 'Google sign-in failed') };
  }
}

function readStoredOAuthUser(cfg: { url: string; key: string }): { email: string; fullName: string } | null {
  try {
    const ref = cfg.url.replace(/^https?:\/\//, '').replace(/\.supabase\.co.*$/, '');
    const raw = window.localStorage.getItem(`sb-${ref}-auth-token`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const token = typeof parsed?.access_token === 'string' ? parsed.access_token : '';
    if (!token) return null;
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    const email = typeof payload?.email === 'string' ? payload.email : '';
    if (!email) return null;
    const meta = payload?.user_metadata || {};
    const fullName = meta.full_name || meta.name || email;
    return { email, fullName };
  } catch {
    return null;
  }
}

export async function getOAuthSessionUser(): Promise<{ email: string; fullName: string } | null> {
  const cfg = getConfig();
  if (!cfg.url || !cfg.key) return null;
  const direct = readStoredOAuthUser(cfg);
  if (direct) {
    console.log('[OAuth] session recovered from storage', direct.email);
    return direct;
  }
  console.log('[OAuth] not in storage yet — polling client session');
  try {
    const client = createClient(cleanSupabaseUrl(cfg.url), cfg.key.trim());
    let user: any = null;
    for (let i = 0; i < 15; i++) {
      const { data } = await client.auth.getSession();
      if (data.session?.user) { user = data.session.user; break; }
      await new Promise(r => setTimeout(r, 250));
    }
    if (!user || !user.email) return null;
    const meta = user.user_metadata || {};
    const fullName = meta.full_name || meta.name || meta.email || '';
    return { email: user.email, fullName };
  } catch (e) {
    console.error('[OAuth] session poll failed', e);
    return null;
  }
}

export async function connectRemote(url: string, key?: string, email?: string, password?: string): Promise<{ ok: boolean; error?: string }> {
  await initPouchDB();
  disconnectRemote();
  if (!localDB) return { ok: false, error: 'Local database not initialized' };
  const cleanUrl = cleanSupabaseUrl(url);
  const anonKey = (key || getConfig().key || '').trim();
  if (!cleanUrl || !anonKey) return { ok: false, error: 'Supabase URL and anon key are required' };
  try {
    const client = createClient(cleanUrl, anonKey);
    if (email && password) {
      const { error: signInErr } = await client.auth.signInWithPassword({ email, password });
      if (signInErr) return { ok: false, error: signInErr.message };
    } else {
      const { data: sessionData } = await client.auth.getSession();
      if (!sessionData.session) return { ok: false, error: 'No active session — sign in with email and password' };
    }
    const ping = await pingRemote(client);
    if (!ping.ok) return { ok: false, error: ping.error };
    supabase = client;
    saveConfig(cleanUrl, anonKey);
    subscribeRealtime(client);
    startReconnectTimer(cleanUrl, anonKey);
    return { ok: true };
  } catch (err: any) {
    supabase = null;
    const msg = err?.message || err?.name || String(err || 'Unknown error');
    console.error('[Sync] Connection failed:', msg);
    return { ok: false, error: msg };
  }
}

// ─── Push: local PouchDB → Supabase ─────────────────────────────

async function pushLocalToRemote(): Promise<{ pushed: number; pushErr?: string }> {
  if (!localDB || !supabase) return { pushed: 0 };
  let pushed = 0;
  let failures = 0;
  const userId = await getCurrentUserId();
  if (!userId) return { pushed: 0, pushErr: 'Not signed in' };
  try {
    const result = await localDB.allDocs({ include_docs: true });
    const rows = result.rows || [];
    for (const row of rows) {
      const doc = row.doc;
      if (!doc || !doc._id || doc._id.startsWith('_design/')) continue;
      const entity = doc.entity || (doc._id.split(':')[0] in ENTITY_PREFIXES ? doc._id.split(':')[0] : null);
      if (!entity) continue;
      if (doc._deleted) {
        try {
          const { error } = await supabase.from(SYNC_TABLE).delete().eq('user_id', userId).eq('id', doc._id);
          if (error) failures++;
        } catch { failures++; }
        continue;
      }
      const data: any = { ...doc };
      delete data._id; delete data._rev; delete data._deleted;
      const updatedAt = data.updatedAt || new Date().toISOString();
      try {
        const { error } = await supabase.from(SYNC_TABLE).upsert(
          { user_id: userId, id: doc._id, entity, data, updated_at: updatedAt },
          { onConflict: 'user_id,id' }
        );
        if (error) failures++;
        else pushed++;
      } catch { failures++; }
    }
  } catch (e: any) {
    console.warn('[Sync] Push failed:', e?.message || e);
    failures++;
  }
  return { pushed, pushErr: failures > 0 ? `${failures} write failure(s)` : undefined };
}

// ─── Pull: Supabase → local PouchDB ─────────────────────────────

function toTimestamp(v: any): number {
  if (!v) return 0;
  const t = new Date(v).getTime();
  return isNaN(t) ? 0 : t;
}

async function applyRemoteRow(row: any): Promise<boolean> {
  if (!localDB) return false;
  const docId = row.id;
  const data = (row.data && typeof row.data === 'object') ? row.data : {};
  const entity = row.entity || (docId.split(':')[0] in ENTITY_PREFIXES ? docId.split(':')[0] : null);
  if (!entity) return false;
  try {
    const existing = await localDB.get(docId).catch(() => null);
    if (existing) {
      const localTs = toTimestamp(existing.updatedAt);
      const remoteTs = toTimestamp(row.updated_at);
      if (remoteTs > 0 && localTs > 0 && remoteTs <= localTs) return false;
    }
    if (row.deleted_at) {
      if (existing) { try { await localDB.remove(existing); } catch {} }
      return true;
    }
    if (existing) {
      await localDB.put({ ...existing, ...data, entity, updatedAt: row.updated_at || data.updatedAt || new Date().toISOString() });
    } else {
      await localDB.put({ _id: docId, ...data, entity, updatedAt: row.updated_at || data.updatedAt || new Date().toISOString() });
    }
    return true;
  } catch { return false; }
}

async function pullRemoteToLocal(): Promise<{ pulled: number }> {
  if (!localDB || !supabase) return { pulled: 0 };
  let pulled = 0;
  try {
    const { data: rows, error } = await supabase.from(SYNC_TABLE).select('*').order('updated_at', { ascending: true });
    if (error || !rows) return { pulled: 0 };
    for (const row of rows) {
      if (await applyRemoteRow(row)) pulled++;
    }
  } catch (e: any) {
    console.warn('[Sync] Pull failed:', e?.message || e);
  }
  return { pulled };
}

export async function manualSync(): Promise<{ ok: boolean; pushed: number; pulled: number; pushErr?: string }> {
  const result: { ok: boolean; pushed: number; pulled: number; pushErr?: string } = { ok: false, pushed: 0, pulled: 0 };
  if (!localDB || !supabase) return result;
  try {
    const pushResult = await pushLocalToRemote();
    result.pushed = pushResult.pushed;
    result.pushErr = pushResult.pushErr;
    const pullResult = await pullRemoteToLocal();
    result.pulled = pullResult.pulled;
    result.ok = true;
    return result;
  } catch (e: any) {
    console.warn('[Sync] manualSync failed:', e?.message || e);
    return result;
  }
}

export function disconnectRemote() {
  stopReconnectTimer();
  if (channel) { try { supabase?.removeChannel?.(channel); } catch {} channel = null; }
  if (supabase) { try { supabase.auth.signOut(); } catch {} }
  supabase = null;
}

export async function checkConnection(): Promise<boolean> {
  const cfg = getConfig();
  if (!cfg.url || !cfg.key) return false;
  if (connected()) {
    const userId = await getCurrentUserId();
    return !!userId;
  }
  const { ok } = await connectRemote(cfg.url, cfg.key);
  return ok;
}

export async function ensureConnected() {
  const cfg = getConfig();
  if (!cfg.url || !cfg.key) return;
  if (!localDB) await initPouchDB();
  if (connected()) return;
  await connectRemote(cfg.url, cfg.key);
}

export async function putDoc(entity: EntityType, data: any) {
  if (!localDB) await initPouchDB();
  if (!localDB) return;
  const id = `${entity}:${data.id}`;
  try {
    const existing = await localDB.get(id).catch(() => null);
    if (existing) await localDB.put({ ...existing, ...data, entity });
    else await localDB.put({ _id: id, ...data, entity });
  } catch {} // fail silently, will retry on next sync
}

export async function removeDoc(entity: EntityType, id: string) {
  if (!localDB) await initPouchDB();
  if (!localDB) return;
  try {
    const doc = await localDB.get(`${entity}:${id}`);
    await localDB.remove(doc);
  } catch {}
}

export async function pullAll(): Promise<any[]> {
  if (!localDB || !supabase) return [];
  const { pulled } = await pullRemoteToLocal();
  if (pulled === 0) return [];
  try {
    const result = await localDB.allDocs({ include_docs: true });
    return result.rows
      .filter((r: any) => {
        const doc = r.doc;
        if (!doc || doc._deleted) return false;
        if (doc.entity || doc._entity) return true;
        const prefix = (doc._id || '').split(':')[0];
        return !!ENTITY_PREFIXES[prefix];
      })
      .map((r: any) => {
        const doc = { ...r.doc };
        delete doc._id; delete doc._rev;
        if (!doc.entity) {
          const prefix = (r.doc._id || '').split(':')[0];
          doc.entity = doc._entity || ENTITY_PREFIXES[prefix];
        }
        delete doc._entity;
        return doc;
      });
  } catch { return []; }
}

export async function clearPouch() {
  stopReconnectTimer();
  if (channel) { try { supabase?.removeChannel?.(channel); } catch {} channel = null; }
  supabase = null;
  if (localDB) { try { await localDB.destroy(); } catch {} localDB = null; }
  await initPouchDB();
}

export async function clearRemote() {
  stopReconnectTimer();
  if (channel) { try { supabase?.removeChannel?.(channel); } catch {} channel = null; }
  if (!supabase) return;
  try {
    const { error } = await supabase.from(SYNC_TABLE).delete().neq('id', '');
    if (error) console.warn('[Sync] clearRemote failed:', error?.message || error);
  } catch (e: any) {
    console.warn('[Sync] clearRemote failed:', e?.message || e);
  }
  supabase = null;
  if (localDB) { try { await localDB.destroy(); } catch {} localDB = null; }
  await initPouchDB();
}

export async function writePins(pins: string[]) {
  if (!localDB) await initPouchDB();
  if (!localDB) return;
  try {
    const existing = await localDB.get('pin:batch').catch(() => null);
    if (existing) {
      await localDB.put({ ...existing, pins, entity: 'pin', updatedAt: new Date().toISOString() });
    } else {
      await localDB.put({ _id: 'pin:batch', pins, entity: 'pin', updatedAt: new Date().toISOString() });
    }
  } catch {}
}

export async function readPinsFromPouch(): Promise<string[] | null> {
  if (!localDB) await initPouchDB();
  if (!localDB) return null;
  try {
    const doc = await localDB.get('pin:batch');
    return (doc as any).pins || null;
  } catch { return null; }
}

export async function pullPinsFromRemote(): Promise<string[] | null> {
  if (!localDB || !supabase) return null;
  try {
    await pullRemoteToLocal();
    return await readPinsFromPouch();
  } catch { return null; }
}