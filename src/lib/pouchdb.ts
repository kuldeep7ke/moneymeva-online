const LS_URL = 'mm_pouch_url';
const RECONNECT_INTERVAL = 30000;

let _PouchDB: any = null;
let localDB: any = null;
let remoteDB: any = null;
let syncHandler: any = null;
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

export function getConfig() {
  try {
    return { url: localStorage.getItem(LS_URL) || '' };
  } catch { return { url: '' }; }
}

function saveConfig(url: string) {
  localStorage.setItem(LS_URL, url);
}

const LS_URLS_HISTORY = 'mm_pouch_urls';

export function getSyncUrlHistory(): string[] {
  try {
    const raw = localStorage.getItem(LS_URLS_HISTORY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function saveSyncUrlHistory(url: string) {
  const list = getSyncUrlHistory().filter(u => u !== url);
  list.unshift(url);
  const kept = list.slice(0, 5);
  localStorage.setItem(LS_URLS_HISTORY, JSON.stringify(kept));
}

export function connected(): boolean { return !!(localDB && remoteDB); }

export function onRemoteChange(fn: () => void) {
  changeListeners.push(fn);
  return () => { changeListeners = changeListeners.filter(f => f !== fn); };
}

function notifyChange() {
  changeListeners.forEach(fn => fn());
}

function parseCouchUrl(url: string): { cleanUrl: string; auth?: { username: string; password: string } } {
  try {
    const u = new URL(url);
    const user = u.username;
    const pass = u.password;
    u.username = '';
    u.password = '';
    const cleanUrl = u.toString();
    if (user) {
      return { cleanUrl, auth: { username: decodeURIComponent(user), password: decodeURIComponent(pass) } };
    }
    return { cleanUrl };
  } catch {
    return { cleanUrl: url };
  }
}

const ENTITY_PREFIXES: Record<string, EntityType> = {
  transaction: 'transaction', partner: 'partner', recurring: 'recurring',
  budget: 'budget', reminder: 'reminder', adjustment: 'adjustment', goal: 'goal', todo: 'todo',
};

function createRemote(Pouch: any, url: string, auth?: { username: string; password: string }) {
  const opts: any = { skip_setup: true };
  if (auth) opts.auth = auth;
  return new Pouch(url, opts);
}

export async function initPouchDB() {
  if (localDB) return localDB;
  const Pouch = await ensurePouch();
  if (!Pouch) return null;
  localDB = new Pouch('mm_pouch');
  await localDB.createIndex({ index: { fields: ['_entity', 'updatedAt'] } });
  return localDB;
}

function startReconnectTimer(url: string) {
  stopReconnectTimer();
  reconnectTimer = setInterval(async () => {
    if (connected()) return;
    const Pouch = await ensurePouch();
    if (!Pouch || !localDB) return;
    try {
      const { cleanUrl, auth } = parseCouchUrl(url);
      const rd = createRemote(Pouch, cleanUrl, auth);
      await rd.info();
      remoteDB = rd;
      syncHandler = localDB.sync(rd, { live: true, retry: true });
      syncHandler.on('change', () => notifyChange());
      syncHandler.on('error', (err: any) => {
        console.warn('[PouchDB] Reconnect sync error (will retry):', err?.message || err);
      });
    } catch {}
  }, RECONNECT_INTERVAL);
}

function stopReconnectTimer() {
  if (reconnectTimer) { clearInterval(reconnectTimer); reconnectTimer = null; }
}

export async function connectRemote(url: string) {
  await initPouchDB();
  disconnectRemote();
  if (!localDB) return false;
  try {
    const Pouch = await ensurePouch();
    const { cleanUrl, auth } = parseCouchUrl(url);
    remoteDB = createRemote(Pouch, cleanUrl, auth);
    await remoteDB.info();
    saveConfig(url);
    syncHandler = localDB.sync(remoteDB, { live: true, retry: true });
    syncHandler.on('change', () => notifyChange());
    syncHandler.on('error', (err: any) => {
      console.warn('[PouchDB] Live sync error (will retry):', err?.message || err);
    });
    return true;
  } catch { remoteDB = null; return false; }
}

export async function manualSync(): Promise<{ ok: boolean; pushed: number; pulled: number }> {
  const result = { ok: false, pushed: 0, pulled: 0 };
  if (!localDB || !remoteDB) return result;
  try {
    const toResult = await localDB.replicate.to(remoteDB);
    const fromResult = await localDB.replicate.from(remoteDB);
    result.pushed = toResult.docs_read || 0;
    result.pulled = fromResult.docs_read || 0;
    result.ok = true;
    return result;
  } catch { return result; }
}

export function disconnectRemote() {
  stopReconnectTimer();
  if (syncHandler) { try { syncHandler.cancel(); } catch {} syncHandler = null; }
  remoteDB = null;
  localStorage.removeItem(LS_URL);
}

export async function checkConnection(): Promise<boolean> {
  const cfg = getConfig();
  if (!cfg.url) return false;
  if (connected()) return true;
  return await connectRemote(cfg.url);
}

export async function ensureConnected() {
  const cfg = getConfig();
  if (!cfg.url) return;
  if (!localDB) await initPouchDB();
  if (connected()) return;
  await connectRemote(cfg.url);
}

export async function putDoc(entity: EntityType, data: any) {
  if (!localDB) await initPouchDB();
  if (!localDB) return;
  try {
    const id = `${entity}:${data.id}`;
    const existing = await localDB.get(id).catch(() => null);
    if (existing) await localDB.put({ ...existing, ...data, _entity: entity });
    else await localDB.put({ _id: id, ...data, _entity: entity });
  } catch {}
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
  if (!localDB || !remoteDB) return [];
  try {
    await localDB.replicate.from(remoteDB);
    const result = await localDB.allDocs({ include_docs: true });
    return result.rows
      .filter((r: any) => {
        const doc = r.doc;
        if (!doc || doc._deleted) return false;
        if (doc._entity) return true;
        const prefix = (doc._id || '').split(':')[0];
        return !!ENTITY_PREFIXES[prefix];
      })
      .map((r: any) => {
        const doc = { ...r.doc };
        delete doc._id; delete doc._rev;
        if (!doc._entity) {
          const prefix = (r.doc._id || '').split(':')[0];
          doc._entity = ENTITY_PREFIXES[prefix];
        }
        return doc;
      });
  } catch { return []; }
}

export async function clearPouch() {
  stopReconnectTimer();
  if (syncHandler) { try { syncHandler.cancel(); } catch {} syncHandler = null; }
  remoteDB = null;
  if (localDB) { try { await localDB.destroy(); } catch {} localDB = null; }
  await initPouchDB();
}

export async function writePins(pins: string[]) {
  if (!localDB) await initPouchDB();
  if (!localDB) return;
  try {
    const existing = await localDB.get('pin:batch').catch(() => null);
    if (existing) {
      await localDB.put({ ...existing, pins, _entity: 'pin', updatedAt: new Date().toISOString() });
    } else {
      await localDB.put({ _id: 'pin:batch', pins, _entity: 'pin', updatedAt: new Date().toISOString() });
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
  if (!localDB || !remoteDB) return null;
  try {
    await localDB.replicate.from(remoteDB);
    return await readPinsFromPouch();
  } catch { return null; }
}
