const LS_URL = 'mm_pouch_url';

let _PouchDB: any = null;
let localDB: any = null;
let remoteDB: any = null;
let syncHandler: any = null;

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

export function connected(): boolean { return !!(localDB && remoteDB && syncHandler); }

export async function initPouchDB() {
  if (localDB) return localDB;
  const Pouch = await ensurePouch();
  if (!Pouch) return null;
  localDB = new Pouch('mm_pouch');
  await localDB.createIndex({ index: { fields: ['_entity', 'updatedAt'] } });
  return localDB;
}

export async function connectRemote(url: string) {
  await initPouchDB();
  disconnectRemote();
  if (!localDB) return false;
  try {
    const Pouch = await ensurePouch();
    remoteDB = new Pouch(url, { skip_setup: true });
    await remoteDB.info();
    saveConfig(url);
    syncHandler = localDB.sync(remoteDB, { live: true, retry: true });
    syncHandler.on('error', () => {});
    return true;
  } catch { remoteDB = null; return false; }
}

export function disconnectRemote() {
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

export async function putDoc(entity: EntityType, data: any) {
  if (!localDB || !remoteDB) return;
  try {
    const id = `${entity}:${data.id}`;
    const existing = await localDB.get(id).catch(() => null);
    if (existing) await localDB.put({ ...existing, ...data, _entity: entity });
    else await localDB.put({ _id: id, ...data, _entity: entity });
  } catch {}
}

export async function removeDoc(entity: EntityType, id: string) {
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
      .filter((r: any) => (r.doc as any)?._entity && !(r.doc as any)._deleted)
      .map((r: any) => {
        const doc = { ...r.doc };
        delete doc._id; delete doc._rev; delete doc._entity;
        return doc;
      });
  } catch { return []; }
}

export async function clearPouch() {
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
