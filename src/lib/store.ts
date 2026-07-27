import { Transaction, TransactionType, PartnerAccount, RecurringTx, Budget, Reminder, Adjustment, Goal, Todo, MutationAction, MutationLog, ArchiveItemType, ArchivedItem } from '@/types';
import { db } from './db';
import { putDoc, removeDoc, pullAll, checkConnection, ensureConnected, EntityType, initPouchDB, clearPouch, onRemoteChange, manualSync, connected } from './pouchdb';
import { dispatchSyncEvent, getLastSyncEvent } from './sync-notify';

// ─── localStorage keys (tiny settings only) ─────────────────
const LS_KEYS = {
  onboarded: 'mm_onboarded',
  pins: 'mm_pins',
  pinsShown: 'mm_pins_shown',
  pinIndex: 'mm_pin_index',
  lockMinutes: 'mm_lock_minutes',
  lastActivity: 'mm_last_activity',
  version: 'mm_version',
};

// ─── In-memory cache (sync reads) ────────────────────────────
const cache: {
  transactions: Transaction[];
  partners: PartnerAccount[];
  recurring: RecurringTx[];
  budgets: Budget[];
  reminders: Reminder[];
  adjustments: Adjustment[];
  goals: Goal[];
  todos: Todo[];
} = {
  transactions: [],
  partners: [],
  recurring: [],
  budgets: [],
  reminders: [],
  adjustments: [],
  goals: [],
  todos: [],
};

let initialized = false;
export function isStoreReady() { return initialized; }

// ─── Utilities ───────────────────────────────────────────────
let _uid = 'local-user';
export function setUserId(id: string) { _uid = id; }
function uid() { return _uid; }
function now() { return new Date().toISOString(); }
function id() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
function transitionId() { return 'tr_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

async function logMutation(entityType: string, entityId: string, tId: string, action: MutationAction, detail?: string) {
  const entry: MutationLog = {
    id: id(),
    transitionId: tId,
    entityType,
    entityId,
    action,
    timestamp: now(),
    userId: uid(),
    detail,
  };
  try { await db.mutation_log.put(entry); } catch {}
}
export { logMutation };

// ─── Init + Migration ────────────────────────────────────────
function localStorageKey(name: string): string {
  const map: Record<string, string> = {
    transactions: 'mm_transactions',
    partners: 'mm_partners',
    recurring: 'mm_recurring',
    budgets: 'mm_budgets',
    reminders: 'mm_reminders',
    adjustments: 'mm_adjustments',
    goals: 'mm_goals',
    todos: 'mm_todos',
  };
  return map[name] || `mm_${name}`;
}

async function migrateFromLocalStorage() {
  for (const key of ['transactions', 'partners', 'recurring', 'budgets', 'reminders', 'adjustments', 'goals', 'todos']) {
    try {
      const raw = localStorage.getItem(localStorageKey(key));
      if (!raw) continue;
      const items = JSON.parse(raw);
      if (!Array.isArray(items) || items.length === 0) continue;
      const table = db[key as keyof typeof db] as any;
      // Batch insert in chunks to avoid Dexie limits
      for (let i = 0; i < items.length; i += 500) {
        await table.bulkPut(items.slice(i, i + 500));
      }
      localStorage.removeItem(localStorageKey(key));
    } catch { /* skip */     }
  }
}

async function autoCleanupCompletedTodos() {
  const cut = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const toRemove = cache.todos.filter(t => t.status === 'completed' && new Date(t.completedAt || t.createdAt).getTime() < cut);
  if (toRemove.length === 0) return;
  cache.todos = cache.todos.filter(t => !toRemove.includes(t));
  for (const item of toRemove) {
    try { await db.todos.delete(item.id); } catch {}
  }
}

function deduplicatePartners(partners: PartnerAccount[]): PartnerAccount[] {
  const seen = new Map<string, PartnerAccount>();
  for (const p of partners) {
    const key = p.name.toLowerCase();
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, p);
    } else if (existing.deletedAt && !p.deletedAt) {
      seen.set(key, p);
    } else if (!existing.deletedAt && p.deletedAt) {
      continue;
    } else if (p.createdAt < existing.createdAt) {
      seen.set(key, p);
    }
  }
  return Array.from(seen.values());
}

export async function initDB() {
  if (initialized) return;
  await initPouchDB();
  // Migrate any remaining localStorage data
  await migrateFromLocalStorage();
  // Hydrate cache from Dexie
  cache.transactions = await db.transactions.toArray();
  cache.partners = await db.partners.toArray();
  cache.recurring = await db.recurring.toArray();
  cache.budgets = await db.budgets.toArray();
  cache.reminders = await db.reminders.toArray();
  cache.adjustments = await db.adjustments.toArray();
  cache.goals = await db.goals.toArray();
  cache.todos = await db.todos.toArray();
  // Deduplicate partners by name
  const deduped = deduplicatePartners(cache.partners);
  if (deduped.length < cache.partners.length) {
    cache.partners = deduped;
    await db.partners.clear();
    await db.partners.bulkPut(deduped);
  }
  await autoDeleteExpiredArchived();
  autoCleanupCompletedTodos();
  initialized = true;
  // Auto-process remote changes when live sync detects them
  onRemoteChange(async () => {
    const { ok } = await manualSync();
    if (ok) await processRemoteChanges();
  });
  // Auto-sync every 12 hours if connected
  setInterval(async () => {
    if (!connected()) return;
    dispatchSyncEvent({ status: 'started', message: 'Auto-sync started…' });
    try {
      dispatchSyncEvent({ status: 'pushing', message: 'Pushing local data…' });
      await pushAllToPouch();
      dispatchSyncEvent({ status: 'pushing', message: 'Pulling remote changes…' });
      const { ok, pushed: actualPushed, pulled: actualPulled } = await manualSync();
      if (ok) {
        dispatchSyncEvent({ status: 'pulled', message: `Pulled ${actualPulled} remote change(s)`, pulled: actualPulled });
        dispatchSyncEvent({ status: 'processing', message: 'Applying remote changes…' });
        await processRemoteChanges();
        dispatchSyncEvent({ status: 'complete', message: `Sync complete — pushed ${actualPushed} item(s), pulled ${actualPulled} change(s)`, pushed: actualPushed, pulled: actualPulled });
      } else {
        dispatchSyncEvent({ status: 'error', message: 'Sync failed during pull', error: 'Pull failed' });
      }
    } catch (err) {
      dispatchSyncEvent({ status: 'error', message: 'Auto-sync failed', error: String(err) });
    }
  }, 12 * 60 * 60 * 1000);
}

// Re-init (used by Clear All Data)
export async function clearAllDB() {
  await Promise.all([
    db.transactions.clear(),
    db.partners.clear(),
    db.recurring.clear(),
    db.budgets.clear(),
    db.reminders.clear(),
    db.adjustments.clear(),
    db.goals.clear(),
    db.todos.clear(),
    db.mutation_log.clear(),
    clearPouch(),
  ]);
  cache.transactions = [];
  cache.partners = [];
  cache.recurring = [];
  cache.budgets = [];
  cache.reminders = [];
  cache.adjustments = [];
  cache.goals = [];
  cache.todos = [];
  // Clear localStorage settings
  for (const k of Object.values(LS_KEYS)) {
    try { localStorage.removeItem(k); } catch {}
  }
  logMutation('*', '*', '*', 'deleted', 'All data cleared');
}

// ─── Archive Auto-Delete ──────────────────────────────────────
const KEEP_FOREVER_KEY = 'mm_archive_keep';

function getKeepForeverSet(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(KEEP_FOREVER_KEY) || '[]')); }
  catch { return new Set(); }
}

function saveKeepForeverSet(set: Set<string>) {
  localStorage.setItem(KEEP_FOREVER_KEY, JSON.stringify([...set]));
}

export function isKeepForever(id: string): boolean {
  return getKeepForeverSet().has(id);
}

export function toggleKeepForever(id: string): boolean {
  const set = getKeepForeverSet();
  if (set.has(id)) { set.delete(id); saveKeepForeverSet(set); return false; }
  else { set.add(id); saveKeepForeverSet(set); return true; }
}

export function getDaysUntilDelete(deletedAt: string): number {
  const deleted = new Date(deletedAt).getTime();
  const expires = deleted + 30 * 24 * 60 * 60 * 1000;
  const remaining = Math.ceil((expires - Date.now()) / (24 * 60 * 60 * 1000));
  return remaining;
}

async function autoDeleteExpiredArchived() {
  const keep = getKeepForeverSet();
  const now = Date.now();
  const cut = now - 30 * 24 * 60 * 60 * 1000;

  const filter = (items: any[]) => items.filter((x: any) => {
    if (!x.deletedAt) return true;
    if (keep.has(x.id)) return true;
    return new Date(x.deletedAt).getTime() > cut;
  });

  let changed = false;
  for (const [key, tableName] of Object.entries({ transactions: 'transactions', partners: 'partners', recurring: 'recurring', reminders: 'reminders', budgets: 'budgets', adjustments: 'adjustments', goals: 'goals', todos: 'todos' })) {
    const arr = (cache as any)[key];
    if (!arr) continue;
    const filtered = filter(arr);
    if (filtered.length < arr.length) {
      const removed = arr.filter((x: any) => !filtered.includes(x));
      (cache as any)[key] = filtered;
      const table = db[tableName as keyof typeof db] as any;
      for (const item of removed) {
        try { await table.delete(item.id); } catch {}
      }
      changed = true;
    }
  }
}

// ─── Transactions ────────────────────────────────────────────
export function getTransactions(type?: string): Transaction[] {
  const all = cache.transactions.filter(t => !t.deletedAt);
  return type ? all.filter(t => t.type === type) : all;
}

export function getSavings(): Transaction[] {
  return cache.transactions.filter(t => !t.deletedAt && t.type === 'expense' && t.savingTag);
}

export function getArchivedTransactions(): Transaction[] {
  return cache.transactions.filter(t => t.deletedAt);
}

export function getLastDeletedTransaction(): Transaction | null {
  const archived = getArchivedTransactions().sort((a, b) => new Date(b.deletedAt!).getTime() - new Date(a.deletedAt!).getTime());
  return archived[0] || null;
}

function archivedItem(type: ArchiveItemType, item: any, label: string, subtitle: string, amount: number, deletedAt: string): ArchivedItem {
  return { id: item.id, type, label, subtitle, amount, deletedAt, original: item };
}

export function getAllArchivedItems(): ArchivedItem[] {
  const items: ArchivedItem[] = [];
  for (const t of getArchivedTransactions()) {
    items.push(archivedItem('transaction', t, t.description || t.category, `${t.type} · ${t.category}`, t.amount, t.deletedAt!));
  }
  for (const p of cache.partners.filter(p => p.deletedAt)) {
    items.push(archivedItem('partner', p, p.name, 'Partner Account', p.initialInvestment || 0, p.deletedAt!));
  }
  for (const r of cache.recurring.filter(r => r.deletedAt)) {
    items.push(archivedItem('recurring', r, r.title, `Recurring · ${r.frequency}`, r.amount, r.deletedAt!));
  }
  for (const r of cache.reminders.filter(r => r.deletedAt)) {
    items.push(archivedItem('reminder', r, r.title, `Reminder · ${r.frequency}`, r.amount, r.deletedAt!));
  }
  for (const b of cache.budgets.filter(b => b.deletedAt)) {
    items.push(archivedItem('budget', b, b.category, `Budget · ${b.period}`, b.limit, b.deletedAt!));
  }
  for (const a of cache.adjustments.filter(a => a.deletedAt)) {
    items.push(archivedItem('adjustment', a, a.notes || 'Adjustment', `Adjustment · ${a.accountType}`, a.amount, a.deletedAt!));
  }
  for (const g of cache.goals.filter(g => g.deletedAt)) {
    items.push(archivedItem('goal', g, g.name, `Goal · ₹${g.target.toLocaleString('en-IN')}`, g.saved, g.deletedAt!));
  }
  for (const t of cache.todos.filter(t => t.deletedAt)) {
    items.push(archivedItem('todo', t, t.title, `Todo · ${t.category || 'Other'}`, t.amount || 0, t.deletedAt!));
  }
  return items.sort((a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime());
}

export function restoreArchivedItem(type: ArchiveItemType, id: string) {
  switch (type) {
    case 'transaction': restoreTransaction(id); break;
    case 'partner': restorePartner(id); break;
    case 'recurring': restoreRecurring(id); break;
    case 'reminder': restoreReminder(id); break;
    case 'budget': restoreBudget(id); break;
    case 'adjustment': restoreAdjustment(id); break;
    case 'goal': restoreGoal(id); break;
    case 'todo': restoreTodo(id); break;
  }
}

export function permanentDeleteArchivedItem(type: ArchiveItemType, id: string) {
  switch (type) {
    case 'transaction': permanentDeleteTransaction(id); break;
    case 'partner': permanentDeletePartner(id); break;
    case 'recurring': permanentDeleteRecurring(id); break;
    case 'reminder': permanentDeleteReminder(id); break;
    case 'budget': permanentDeleteBudget(id); break;
    case 'adjustment': permanentDeleteAdjustment(id); break;
    case 'goal': permanentDeleteGoal(id); break;
    case 'todo': permanentDeleteTodo(id); break;
  }
}

export async function permanentDeleteAllArchived() {
  const keepTx = cache.transactions.filter(t => !t.deletedAt);
  const keepPartners = cache.partners.filter(p => !p.deletedAt);
  const keepRecurring = cache.recurring.filter(r => !r.deletedAt);
  const keepReminders = cache.reminders.filter(r => !r.deletedAt);
  const keepBudgets = cache.budgets.filter(b => !b.deletedAt);
  const keepAdjustments = cache.adjustments.filter(a => !a.deletedAt);
  const keepGoals = cache.goals.filter(g => !g.deletedAt);
  const keepTodos = cache.todos.filter(t => !t.deletedAt);
  cache.transactions = keepTx;
  cache.partners = keepPartners;
  cache.recurring = keepRecurring;
  cache.reminders = keepReminders;
  cache.budgets = keepBudgets;
  cache.adjustments = keepAdjustments;
  cache.goals = keepGoals;
  cache.todos = keepTodos;
  await Promise.all([
    db.transactions.bulkPut(keepTx),
    db.partners.bulkPut(keepPartners),
    db.recurring.bulkPut(keepRecurring),
    db.reminders.bulkPut(keepReminders),
    db.budgets.bulkPut(keepBudgets),
    db.adjustments.bulkPut(keepAdjustments),
    db.goals.bulkPut(keepGoals),
    db.todos.bulkPut(keepTodos),
  ]);
}

function upsertCacheAndWrite<T extends { id: string }>(table: string, list: T[], item: T) {
  const idx = list.findIndex(x => x.id === item.id);
  if (idx >= 0) list[idx] = item;
  else list.push(item);
  (db as any)[table].put(item).catch(() => {});
}

function deleteFromCacheAndWrite<T extends { id: string }>(table: string, list: T[], id: string) {
  const idx = list.findIndex(x => x.id === id);
  if (idx >= 0) {
    const item = list[idx];
    const tId = (item as any).transitionId || '';
    logMutation(logEntityType(table), id, tId, 'permanent_deleted');
    list.splice(idx, 1);
  }
  (db as any)[table].delete(id).catch(() => {});
  syncRemoveDoc(table, id).catch(() => {});
}

const logEntityType = (table: string): string => table === 'partners' ? 'party' : entityMap[table] || table.slice(0, -1);

// ─── PouchDB Sync Helpers ─────────────────────────────────────
const entityMap: Record<string, EntityType> = {
  transactions: 'transaction', partners: 'partner', recurring: 'recurring',
  budgets: 'budget', reminders: 'reminder', adjustments: 'adjustment', goals: 'goal', todos: 'todo',
};
const entityTableMap: Record<EntityType, string> = {
  transaction: 'transactions', partner: 'partners', recurring: 'recurring',
  budget: 'budgets', reminder: 'reminders', adjustment: 'adjustments', goal: 'goals', todo: 'todos',
};

async function triggerSync() {
  await ensureConnected();
}

async function syncWriteDoc(table: string, data: any) {
  const entity = entityMap[table];
  if (!entity) return;
  await triggerSync();
  await putDoc(entity, data);
}

async function syncRemoveDoc(table: string, id: string) {
  const entity = entityMap[table];
  if (!entity) return;
  await triggerSync();
  await removeDoc(entity, id);
}

export async function processRemoteChanges() {
  const connected = await checkConnection();
  if (!connected) return;
  const docs = await pullAll();
  let updated = 0;
  for (const doc of docs) {
    const entity = (doc.entity || doc._entity) as EntityType;
    if (!entity || !doc.id) continue;
    const dexieTable = entityTableMap[entity];
    const cacheKey = dexieTable;
    const list = (cache as any)[cacheKey];
    if (!list) continue;
    const { _entity, entity: _e, ...cleanDoc } = doc;
    if (doc.deletedAt) {
      const idx = list.findIndex((x: any) => x.id === cleanDoc.id);
      if (idx >= 0) {
        const local = list[idx];
        if (!local.deletedAt || cleanDoc.deletedAt > local.deletedAt) {
          list[idx] = cleanDoc;
          try { await (db as any)[dexieTable].put(cleanDoc); } catch {}
        }
      }
      continue;
    }
    const idx = list.findIndex((x: any) => x.id === cleanDoc.id);
    if (idx >= 0) {
      const local = list[idx];
      if (cleanDoc.updatedAt && local.updatedAt && cleanDoc.updatedAt <= local.updatedAt) continue;
      list[idx] = cleanDoc;
    } else {
      list.push(cleanDoc);
    }
    try { await (db as any)[dexieTable].put(cleanDoc); } catch {}
    updated++;
  }
  if (updated > 0) {
    console.log(`Sync: ${updated} remote change(s) applied`);
    window.dispatchEvent(new CustomEvent('store-ready'));
  }
}

export async function pushAllToPouch() {
  const tables: [string, EntityType][] = [
    ['transactions', 'transaction'],
    ['partners', 'partner'],
    ['recurring', 'recurring'],
    ['budgets', 'budget'],
    ['reminders', 'reminder'],
    ['adjustments', 'adjustment'],
    ['goals', 'goal'],
    ['todos', 'todo'],
  ];
  let count = 0;
  for (const [cacheKey, entity] of tables) {
    const items = (cache as any)[cacheKey] || [];
    for (const item of items) {
      if (!item.id) continue;
      await putDoc(entity, item);
      count++;
    }
  }
  return count;
}

export function addTransaction(tx: Omit<Transaction, 'id' | 'transitionId' | 'userId' | 'createdAt' | 'updatedAt'>): Transaction {
  if (typeof tx.amount !== 'number' || !isFinite(tx.amount) || tx.amount <= 0) throw new Error('Amount must be a positive number');
  const t: Transaction = { ...tx, id: id(), transitionId: transitionId(), userId: uid(), createdAt: now(), updatedAt: now() };
  cache.transactions.push(t);
  db.transactions.put(t).catch(() => {});
  syncWriteDoc('transactions', t);
  const partnerName = t.partnerAccountId ? getPartnerName(t.partnerAccountId) : null;
  const detail = partnerName ? `${t.type} ₹${t.amount.toLocaleString('en-IN')} · ${t.category} · ${partnerName}` : `${t.type} ₹${t.amount.toLocaleString('en-IN')} · ${t.category}`;
  logMutation('transaction', t.id, t.transitionId, 'created', detail);
  return t;
}

function getPartnerName(partnerId: string): string | null {
  const partner = cache.partners.find(p => p.id === partnerId);
  return partner?.name || null;
}

export function updateTransaction(id: string, updates: Partial<Transaction>): Transaction | null {
  const idx = cache.transactions.findIndex(t => t.id === id);
  if (idx === -1) return null;
  const prev = cache.transactions[idx];
  const tId = prev.transitionId;
  cache.transactions[idx] = { ...prev, ...updates, updatedAt: now() };
  db.transactions.put(cache.transactions[idx]).catch(() => {});
  syncWriteDoc('transactions', cache.transactions[idx]);
  const action: MutationAction = updates.deletedAt ? 'deleted' : updates.deletedAt === undefined && prev.deletedAt ? 'restored' : 'updated';
  const partnerName = cache.transactions[idx].partnerAccountId ? getPartnerName(cache.transactions[idx].partnerAccountId) : null;
  const detail = partnerName ? `${cache.transactions[idx].type} ₹${cache.transactions[idx].amount} · ${cache.transactions[idx].category} · ${partnerName}` : `${cache.transactions[idx].type} ₹${cache.transactions[idx].amount} · ${cache.transactions[idx].category}`;
  logMutation('transaction', id, tId, action, detail);
  return cache.transactions[idx];
}

export function deleteTransaction(id: string) {
  return updateTransaction(id, { deletedAt: now() });
}

export function restoreTransaction(id: string) {
  return updateTransaction(id, { deletedAt: undefined });
}

export function permanentDeleteTransaction(id: string) {
  deleteFromCacheAndWrite('transactions', cache.transactions, id);
}

export function checkDuplicateTransaction(tx: { amount: number; type: string; category: string; description: string; date: string; partnerAccountId?: string }): Transaction | null {
  const match = cache.transactions.find(t =>
    !t.deletedAt &&
    t.date === tx.date &&
    t.type === tx.type &&
    t.amount === tx.amount &&
    t.category === tx.category &&
    (t.partnerAccountId || undefined) === (tx.partnerAccountId || undefined)
  );
  return match || null;
}

// ─── Partners ────────────────────────────────────────────────
export function getPartners(): PartnerAccount[] {
  return cache.partners.filter(p => !p.deletedAt);
}

export function addPartner(p: Omit<PartnerAccount, 'id' | 'transitionId' | 'userId' | 'createdAt' | 'updatedAt'>): PartnerAccount | null {
  const duplicate = cache.partners.find(existing => !existing.deletedAt && existing.name.toLowerCase() === p.name.toLowerCase());
  if (duplicate) return duplicate;
  const partner: PartnerAccount = { ...p, id: id(), transitionId: transitionId(), userId: uid(), createdAt: now(), updatedAt: now() };
  cache.partners.push(partner);
  db.partners.put(partner).catch(() => {});
  syncWriteDoc('partners', partner);
  logMutation('party', partner.id, partner.transitionId, 'created', p.name);
  return partner;
}

export function updatePartner(id: string, updates: Partial<PartnerAccount>) {
  const idx = cache.partners.findIndex(p => p.id === id);
  if (idx === -1) return null;
  const prev = cache.partners[idx];
  const tId = prev.transitionId;
  cache.partners[idx] = { ...prev, ...updates, updatedAt: now() };
  db.partners.put(cache.partners[idx]).catch(() => {});
  syncWriteDoc('partners', cache.partners[idx]);
  const action: MutationAction = updates.deletedAt ? 'deleted' : updates.deletedAt === undefined && prev.deletedAt ? 'restored' : 'updated';
  logMutation('party', id, tId, action, cache.partners[idx].name);
  return cache.partners[idx];
}

export function deletePartner(id: string) {
  return updatePartner(id, { deletedAt: now() });
}

export function restorePartner(id: string) {
  return updatePartner(id, { deletedAt: undefined });
}

export function permanentDeletePartner(id: string) {
  deleteFromCacheAndWrite('partners', cache.partners, id);
}

export function getPartnerPnL(partnerId: string) {
  const txs = getTransactions().filter(t => t.partnerAccountId === partnerId);
  const income = txs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  return { income, expense, net: income - expense };
}

// ─── Recurring ───────────────────────────────────────────────
export function getRecurring(): RecurringTx[] {
  return cache.recurring.filter(r => !r.deletedAt);
}

export function addRecurring(r: Omit<RecurringTx, 'id' | 'transitionId' | 'userId' | 'createdAt'>): RecurringTx {
  const rec: RecurringTx = { ...r, id: id(), transitionId: transitionId(), userId: uid(), createdAt: now() };
  cache.recurring.push(rec);
  db.recurring.put(rec).catch(() => {});
  syncWriteDoc('recurring', rec);
  logMutation('recurring', rec.id, rec.transitionId, 'created', `${r.title} · ${r.frequency}`);
  return rec;
}

export function updateRecurring(id: string, updates: Partial<RecurringTx>) {
  const idx = cache.recurring.findIndex(r => r.id === id);
  if (idx === -1) return null;
  const prev = cache.recurring[idx];
  const tId = prev.transitionId;
  cache.recurring[idx] = { ...prev, ...updates };
  db.recurring.put(cache.recurring[idx]).catch(() => {});
  syncWriteDoc('recurring', cache.recurring[idx]);
  const action: MutationAction = updates.deletedAt ? 'deleted' : updates.deletedAt === undefined && prev.deletedAt ? 'restored' : 'updated';
  logMutation('recurring', id, tId, action, cache.recurring[idx].title);
  return cache.recurring[idx];
}

export function deleteRecurring(id: string) {
  const idx = cache.recurring.findIndex(r => r.id === id);
  if (idx === -1) return;
  const tId = cache.recurring[idx].transitionId;
  cache.recurring[idx] = { ...cache.recurring[idx], deletedAt: now() };
  db.recurring.put(cache.recurring[idx]).catch(() => {});
  syncWriteDoc('recurring', cache.recurring[idx]);
  logMutation('recurring', id, tId, 'deleted', cache.recurring[idx].title);
}

export function advanceRecurring(id: string): Transaction | null {
  const idx = cache.recurring.findIndex(r => r.id === id);
  if (idx === -1) return null;
  const rec = cache.recurring[idx];
  const tId = rec.transitionId;
  const nextDate = rec.nextDate;
  const tx = addTransaction({
    amount: rec.amount,
    type: rec.txType === 'income' ? 'income' : 'expense',
    category: rec.category,
    description: rec.title,
    date: nextDate,
    isRecurring: true,
    recurringId: rec.id,
    partnerAccountId: undefined,
  });
  // Advance nextDate
  const dt = new Date(nextDate + 'T00:00:00');
  switch (rec.frequency) {
    case 'daily': dt.setDate(dt.getDate() + 1); break;
    case 'weekly': dt.setDate(dt.getDate() + 7); break;
    case 'monthly': dt.setMonth(dt.getMonth() + 1); break;
    case 'yearly': dt.setFullYear(dt.getFullYear() + 1); break;
    case 'custom': dt.setDate(dt.getDate() + (rec.customIntervalDays || 30)); break;
  }
  const newNextDate = dt.toISOString().split('T')[0];
  cache.recurring[idx] = { ...cache.recurring[idx], nextDate: newNextDate };
  db.recurring.put(cache.recurring[idx]).catch(() => {});
  syncWriteDoc('recurring', cache.recurring[idx]);
  logMutation('recurring', id, tId, 'advanced', `${rec.title} → next: ${newNextDate}`);
  return tx;
}

export function restoreRecurring(id: string) {
  const idx = cache.recurring.findIndex(r => r.id === id);
  if (idx === -1) return;
  const tId = cache.recurring[idx].transitionId;
  cache.recurring[idx] = { ...cache.recurring[idx], deletedAt: undefined };
  db.recurring.put(cache.recurring[idx]).catch(() => {});
  syncWriteDoc('recurring', cache.recurring[idx]);
  logMutation('recurring', id, tId, 'restored', cache.recurring[idx].title);
}

export function permanentDeleteRecurring(id: string) {
  deleteFromCacheAndWrite('recurring', cache.recurring, id);
}

// ─── Budgets ─────────────────────────────────────────────────
export function getBudgets(): Budget[] {
  return cache.budgets.filter(b => !b.deletedAt);
}

export async function setBudgets(budgets: Budget[]) {
  cache.budgets = budgets.map(b => ({ ...b, transitionId: b.transitionId || transitionId(), userId: uid() }));
  try { await db.budgets.clear(); } catch {}
  try { await db.budgets.bulkPut(cache.budgets); } catch {}
  cache.budgets.forEach(b => syncWriteDoc('budgets', b));
  logMutation('budget', 'batch', cache.budgets[0]?.transitionId || '', 'updated', `${budgets.length} budget(s) set`);
}

export function deleteBudget(id: string) {
  const idx = cache.budgets.findIndex(b => b.id === id);
  if (idx === -1) return;
  const tId = cache.budgets[idx].transitionId;
  cache.budgets[idx] = { ...cache.budgets[idx], deletedAt: now() };
  db.budgets.put(cache.budgets[idx]).catch(() => {});
  syncWriteDoc('budgets', cache.budgets[idx]);
  logMutation('budget', id, tId, 'deleted', cache.budgets[idx].category);
}

export function restoreBudget(id: string) {
  const idx = cache.budgets.findIndex(b => b.id === id);
  if (idx === -1) return;
  const tId = cache.budgets[idx].transitionId;
  cache.budgets[idx] = { ...cache.budgets[idx], deletedAt: undefined };
  db.budgets.put(cache.budgets[idx]).catch(() => {});
  syncWriteDoc('budgets', cache.budgets[idx]);
  logMutation('budget', id, tId, 'restored', cache.budgets[idx].category);
}

export function permanentDeleteBudget(id: string) {
  deleteFromCacheAndWrite('budgets', cache.budgets, id);
}

export function upsertBudget(b: { category: string; limit: number; period: 'monthly' | 'yearly'; id?: string }): Budget {
  if (b.id) {
    const idx = cache.budgets.findIndex(x => x.id === b.id);
    if (idx >= 0) {
      const tId = cache.budgets[idx].transitionId;
      cache.budgets[idx] = { ...cache.budgets[idx], ...b };
      db.budgets.put(cache.budgets[idx]).catch(() => {});
      syncWriteDoc('budgets', cache.budgets[idx]);
      logMutation('budget', b.id, tId, 'updated', b.category);
      return cache.budgets[idx];
    }
  }
  const nb: Budget = { ...b, id: id(), transitionId: transitionId(), userId: uid(), createdAt: now() };
  cache.budgets.push(nb);
  db.budgets.put(nb).catch(() => {});
  syncWriteDoc('budgets', nb);
  logMutation('budget', nb.id, nb.transitionId, 'created', b.category);
  return nb;
}

// ─── Reminders ───────────────────────────────────────────────
export function getReminders(): Reminder[] {
  return cache.reminders.filter(r => !r.deletedAt);
}

export function addReminder(r: Omit<Reminder, 'id' | 'transitionId' | 'userId' | 'createdAt'>): Reminder {
  const rem: Reminder = { ...r, id: id(), transitionId: transitionId(), userId: uid(), createdAt: now() };
  cache.reminders.push(rem);
  db.reminders.put(rem).catch(() => {});
  syncWriteDoc('reminders', rem);
  logMutation('reminder', rem.id, rem.transitionId, 'created', r.title);
  return rem;
}

function computeNextDate(from: string, frequency: string): string | null {
  if (frequency === 'once') return null;
  const d = new Date(from);
  switch (frequency) {
    case 'daily': d.setDate(d.getDate() + 1); break;
    case 'weekly': d.setDate(d.getDate() + 7); break;
    case 'monthly': d.setMonth(d.getMonth() + 1); break;
    case 'quarterly': d.setMonth(d.getMonth() + 3); break;
    case 'half-yearly': d.setMonth(d.getMonth() + 6); break;
    case 'yearly': d.setFullYear(d.getFullYear() + 1); break;
    default: return null;
  }
  return d.toISOString().split('T')[0];
}

export function completeAndRescheduleReminder(id: string) {
  const idx = cache.reminders.findIndex(r => r.id === id);
  if (idx === -1) return;
  const rem = cache.reminders[idx];
  const tId = rem.transitionId;
  if (rem.frequency === 'once') {
    cache.reminders[idx].status = 'completed';
  } else {
    const next = computeNextDate(rem.dueDate, rem.frequency);
    if (next) {
      cache.reminders[idx].dueDate = next;
    } else {
      cache.reminders[idx].status = 'completed';
    }
  }
  db.reminders.put(cache.reminders[idx]).catch(() => {});
  syncWriteDoc('reminders', cache.reminders[idx]);
  logMutation('reminder', id, tId, 'completed', rem.title);
}

export function deleteReminder(id: string) {
  const idx = cache.reminders.findIndex(r => r.id === id);
  if (idx === -1) return;
  const tId = cache.reminders[idx].transitionId;
  cache.reminders[idx] = { ...cache.reminders[idx], deletedAt: now() };
  db.reminders.put(cache.reminders[idx]).catch(() => {});
  syncWriteDoc('reminders', cache.reminders[idx]);
  logMutation('reminder', id, tId, 'deleted', cache.reminders[idx].title);
}

export function restoreReminder(id: string) {
  const idx = cache.reminders.findIndex(r => r.id === id);
  if (idx === -1) return;
  const tId = cache.reminders[idx].transitionId;
  cache.reminders[idx] = { ...cache.reminders[idx], deletedAt: undefined };
  db.reminders.put(cache.reminders[idx]).catch(() => {});
  syncWriteDoc('reminders', cache.reminders[idx]);
  logMutation('reminder', id, tId, 'restored', cache.reminders[idx].title);
}

export function permanentDeleteReminder(id: string) {
  deleteFromCacheAndWrite('reminders', cache.reminders, id);
}

// ─── Adjustments ─────────────────────────────────────────────
export function getAdjustments(): Adjustment[] {
  return cache.adjustments.filter(a => !a.deletedAt);
}

export function addAdjustment(a: Omit<Adjustment, 'id' | 'transitionId' | 'userId' | 'createdAt'>): Adjustment {
  const adj: Adjustment = { ...a, id: id(), transitionId: transitionId(), userId: uid(), createdAt: now() };
  cache.adjustments.push(adj);
  db.adjustments.put(adj).catch(() => {});
  syncWriteDoc('adjustments', adj);
  logMutation('adjustment', adj.id, adj.transitionId, 'created', `${a.accountType} · ${a.notes || 'adjustment'}`);
  return adj;
}

export function deleteAdjustment(id: string) {
  const idx = cache.adjustments.findIndex(a => a.id === id);
  if (idx === -1) return;
  const tId = cache.adjustments[idx].transitionId;
  cache.adjustments[idx] = { ...cache.adjustments[idx], deletedAt: now() };
  db.adjustments.put(cache.adjustments[idx]).catch(() => {});
  syncWriteDoc('adjustments', cache.adjustments[idx]);
  logMutation('adjustment', id, tId, 'deleted', cache.adjustments[idx].notes || 'adjustment');
}

export function restoreAdjustment(id: string) {
  const idx = cache.adjustments.findIndex(a => a.id === id);
  if (idx === -1) return;
  const tId = cache.adjustments[idx].transitionId;
  cache.adjustments[idx] = { ...cache.adjustments[idx], deletedAt: undefined };
  db.adjustments.put(cache.adjustments[idx]).catch(() => {});
  syncWriteDoc('adjustments', cache.adjustments[idx]);
  logMutation('adjustment', id, tId, 'restored', cache.adjustments[idx].notes || 'adjustment');
}

export function permanentDeleteAdjustment(id: string) {
  deleteFromCacheAndWrite('adjustments', cache.adjustments, id);
}

// ─── Goals ───────────────────────────────────────────────────
export function getGoals(): Goal[] {
  return cache.goals.filter(g => !g.deletedAt);
}

export function addGoal(g: Omit<Goal, 'id' | 'transitionId' | 'userId' | 'createdAt'>): Goal {
  const goal: Goal = { ...g, id: id(), transitionId: transitionId(), userId: uid(), createdAt: now() };
  cache.goals.push(goal);
  db.goals.put(goal).catch(() => {});
  syncWriteDoc('goals', goal);
  logMutation('goal', goal.id, goal.transitionId, 'created', g.name);
  return goal;
}

export function updateGoal(id: string, updates: Partial<Goal>) {
  const idx = cache.goals.findIndex(g => g.id === id);
  if (idx === -1) return null;
  const prev = cache.goals[idx];
  const tId = prev.transitionId;
  cache.goals[idx] = { ...prev, ...updates };
  db.goals.put(cache.goals[idx]).catch(() => {});
  syncWriteDoc('goals', cache.goals[idx]);
  const action: MutationAction = updates.deletedAt ? 'deleted' : updates.deletedAt === undefined && prev.deletedAt ? 'restored' : 'updated';
  logMutation('goal', id, tId, action, cache.goals[idx].name);
  return cache.goals[idx];
}

export function deleteGoal(id: string) {
  const idx = cache.goals.findIndex(g => g.id === id);
  if (idx === -1) return;
  const tId = cache.goals[idx].transitionId;
  cache.goals[idx] = { ...cache.goals[idx], deletedAt: now() };
  db.goals.put(cache.goals[idx]).catch(() => {});
  syncWriteDoc('goals', cache.goals[idx]);
  logMutation('goal', id, tId, 'deleted', cache.goals[idx].name);
}

export function restoreGoal(id: string) {
  const idx = cache.goals.findIndex(g => g.id === id);
  if (idx === -1) return;
  const tId = cache.goals[idx].transitionId;
  cache.goals[idx] = { ...cache.goals[idx], deletedAt: undefined };
  db.goals.put(cache.goals[idx]).catch(() => {});
  syncWriteDoc('goals', cache.goals[idx]);
  logMutation('goal', id, tId, 'restored', cache.goals[idx].name);
}

export function permanentDeleteGoal(id: string) {
  deleteFromCacheAndWrite('goals', cache.goals, id);
}

// ─── Todos ────────────────────────────────────────────────────
export function getTodos(): Todo[] {
  return cache.todos.filter(t => !t.deletedAt);
}

export function addTodo(t: Omit<Todo, 'id' | 'transitionId' | 'userId' | 'createdAt'>): Todo {
  const todo: Todo = { ...t, id: id(), transitionId: transitionId(), userId: uid(), createdAt: now() };
  cache.todos.push(todo);
  db.todos.put(todo).catch(() => {});
  syncWriteDoc('todos', todo);
  logMutation('todo', todo.id, todo.transitionId, 'created', t.title);
  return todo;
}

export function updateTodo(id: string, updates: Partial<Todo>) {
  const idx = cache.todos.findIndex(t => t.id === id);
  if (idx === -1) return null;
  const prev = cache.todos[idx];
  const tId = prev.transitionId;
  cache.todos[idx] = { ...prev, ...updates };
  db.todos.put(cache.todos[idx]).catch(() => {});
  syncWriteDoc('todos', cache.todos[idx]);
  const action: MutationAction = updates.deletedAt ? 'deleted' : updates.deletedAt === undefined && prev.deletedAt ? 'restored' : 'updated';
  logMutation('todo', id, tId, action, cache.todos[idx].title);
  return cache.todos[idx];
}

export function deleteTodo(id: string) {
  const idx = cache.todos.findIndex(t => t.id === id);
  if (idx === -1) return;
  const tId = cache.todos[idx].transitionId;
  cache.todos[idx] = { ...cache.todos[idx], deletedAt: now() };
  db.todos.put(cache.todos[idx]).catch(() => {});
  syncWriteDoc('todos', cache.todos[idx]);
  logMutation('todo', id, tId, 'deleted', cache.todos[idx].title);
}

export function restoreTodo(id: string) {
  const idx = cache.todos.findIndex(t => t.id === id);
  if (idx === -1) return;
  const tId = cache.todos[idx].transitionId;
  cache.todos[idx] = { ...cache.todos[idx], deletedAt: undefined };
  db.todos.put(cache.todos[idx]).catch(() => {});
  syncWriteDoc('todos', cache.todos[idx]);
  logMutation('todo', id, tId, 'restored', cache.todos[idx].title);
}

export function permanentDeleteTodo(id: string) {
  deleteFromCacheAndWrite('todos', cache.todos, id);
}

export function toggleTodoImportant(id: string) {
  const idx = cache.todos.findIndex(t => t.id === id);
  if (idx === -1) return null;
  const tId = cache.todos[idx].transitionId;
  cache.todos[idx] = { ...cache.todos[idx], important: !cache.todos[idx].important };
  db.todos.put(cache.todos[idx]).catch(() => {});
  syncWriteDoc('todos', cache.todos[idx]);
  logMutation('todo', id, tId, 'toggled', `${cache.todos[idx].title} → important: ${cache.todos[idx].important}`);
  return cache.todos[idx];
}

export function completeTodo(id: string) {
  const idx = cache.todos.findIndex(t => t.id === id);
  if (idx === -1) return null;
  const tId = cache.todos[idx].transitionId;
  cache.todos[idx] = { ...cache.todos[idx], status: 'completed', completedAt: now() };
  db.todos.put(cache.todos[idx]).catch(() => {});
  syncWriteDoc('todos', cache.todos[idx]);
  logMutation('todo', id, tId, 'completed', cache.todos[idx].title);
  return cache.todos[idx];
}

// ─── Summary helpers ─────────────────────────────────────────
function cashBankTransactions(txs: Transaction[]): Transaction[] {
  return txs.filter(t => !t.account || (t.account !== 'invest' && (t.account === 'cash' || t.account === 'bank' || t.account === 'upi')));
}

export function getCashBankBalance(): number {
  const txs = cashBankTransactions(getTransactions());
  return txs.reduce((s, t) => s + (t.type === 'income' ? t.amount : -t.amount), 0);
}

export function getMonthlySummary(year: number, month: number) {
  const txs = getTransactions().filter(t => {
    const d = new Date(t.date);
    return d.getFullYear() === year && d.getMonth() === month;
  });
  const cb = cashBankTransactions(txs);
  return {
    income: txs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0),
    expense: txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
    saving: txs.filter(t => t.type === 'saving').reduce((s, t) => s + t.amount, 0),
    investment: txs.filter(t => t.type === 'investment').reduce((s, t) => s + t.amount, 0),
    total: cb.reduce((s, t) => s + (t.type === 'income' ? t.amount : -t.amount), 0),
    cashBankBalance: cb.reduce((s, t) => s + (t.type === 'income' ? t.amount : -t.amount), 0),
  };
}

export function getAggregates(since?: Date) {
  const txs = since ? getTransactions().filter(t => new Date(t.date) >= since!) : getTransactions();
  const cb = cashBankTransactions(txs);
  return {
    balance: cb.reduce((s, t) => s + (t.type === 'income' ? t.amount : -t.amount), 0),
    income: txs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0),
    expense: txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
    saving: txs.filter(t => t.type === 'saving').reduce((s, t) => s + t.amount, 0),
    investment: txs.filter(t => t.type === 'investment').reduce((s, t) => s + t.amount, 0),
    cashBankBalance: cb.reduce((s, t) => s + (t.type === 'income' ? t.amount : -t.amount), 0),
  };
}

export function getSpentInPeriod(type: TransactionType, category: string, period: 'monthly' | 'yearly') {
  const txs = getTransactions().filter(t => t.type === type && t.category === category);
  const now = new Date();
  return txs
    .filter(t => {
      const d = new Date(t.date);
      if (period === 'monthly') return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
      return d.getFullYear() === now.getFullYear();
    })
    .reduce((s, t) => s + t.amount, 0);
}

export function getBudgetForCategory(category: string): { budget: Budget | undefined; spent: number; pct: number } {
  const budgets = getBudgets();
  const budget = budgets.find(b => b.category === category);
  if (!budget) return { budget: undefined, spent: 0, pct: 0 };
  const spent = getSpentInPeriod('expense', category, budget.period);
  const pct = budget.limit > 0 ? Math.round((spent / budget.limit) * 100) : 0;
  return { budget, spent, pct };
}

// ─── Notifications ───────────────────────────────────────────
export interface AppNotification {
  id: string;
  type: 'recurring' | 'trash' | 'budget' | 'reminder' | 'sync';
  title: string;
  message: string;
  severity: 'danger' | 'warning' | 'info';
  amount: number;
}

export function getRecurringNotifications(): AppNotification[] {
  const recs = getRecurring().filter(r => r.status === 'active');
  const today = new Date();
  const notifs: AppNotification[] = [];
  for (const r of recs) {
    const nextDate = new Date(r.nextDate);
    const diffDays = Math.ceil((nextDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) continue;
    if (diffDays <= r.reminderDays) {
      notifs.push({
        id: `rec-${r.id}`,
        type: 'recurring',
        title: r.title,
        message: diffDays === 0 ? 'Due today!' : `Due in ${diffDays} day${diffDays > 1 ? 's' : ''}`,
        severity: diffDays === 0 ? 'danger' : diffDays <= 2 ? 'warning' : 'info',
        amount: r.amount,
      });
    }
  }
  return notifs;
}

export function getArchiveNotifications(): AppNotification[] {
  const all = getAllArchivedItems();
  if (all.length === 0) return [];
  const last = all[0];
  return [{
    id: `arch-${last.id}-${last.type}`,
    type: 'trash',
    title: `"${last.label}" archived`,
    message: `${last.type} · Deleted ${new Date(last.deletedAt).toLocaleDateString('en-IN')}`,
    severity: 'info',
    amount: last.amount,
  }];
}

export function getBudgetNotifications(): AppNotification[] {
  const budgets = getBudgets();
  const notifs: AppNotification[] = [];
  const now = new Date();
  for (const b of budgets) {
    const txs = getTransactions().filter(t => {
      if (t.type !== 'expense' || t.category !== b.category) return false;
      const d = new Date(t.date);
      if (b.period === 'monthly') return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
      return d.getFullYear() === now.getFullYear();
    });
    const spent = txs.reduce((s, t) => s + t.amount, 0);
    const pct = b.limit > 0 ? Math.round((spent / b.limit) * 100) : 0;
    if (pct >= 80) {
      notifs.push({
        id: `budget-${b.id}`,
        type: 'budget',
        title: `Budget alert: ${b.category}`,
        message: `${pct}% of limit used (₹${Math.round(spent).toLocaleString('en-IN')})`,
        severity: pct >= 100 ? 'danger' : 'warning',
        amount: b.limit - spent,
      });
    }
  }
  return notifs;
}

export function getAllNotifications(): AppNotification[] {
  const today = new Date().toISOString().split('T')[0];
  const reminderNotifs: AppNotification[] = getReminders()
    .filter(r => r.status === 'pending' && r.dueDate <= today)
    .map(r => ({
      id: `rem-${r.id}`,
      type: 'reminder',
      title: r.title,
      message: `Due: ${r.dueDate}`,
      severity: 'info',
      amount: r.amount,
    }));
  const syncNotifs: AppNotification[] = [];
  const lastSync = getLastSyncEvent();
  if (lastSync && lastSync.status === 'complete') {
    const counterKey = 'mm_sync_notif_counter';
    const counter = (lastSync.pushed || 0) + '_' + (lastSync.pulled || 0) + '_' + (lastSync.error || '');
    const lastShown = localStorage.getItem('mm_sync_notif_last') || '';
    if (counter !== lastShown) {
      syncNotifs.push({
        id: `sync-${Date.now()}`,
        type: 'sync',
        title: 'Sync Complete',
        message: `Pushed ${lastSync.pushed || 0} item(s) · Pulled latest changes`,
        severity: lastSync.error ? 'warning' : 'info',
        amount: 0,
      });
      localStorage.setItem('mm_sync_notif_last', counter);
    }
  }
  return [
    ...syncNotifs,
    ...getRecurringNotifications(),
    ...getArchiveNotifications(),
    ...getBudgetNotifications(),
    ...reminderNotifs,
    ...getWeekendReminders(),
  ];
}

function getWeekendReminders(): AppNotification[] {
  const day = new Date().getDay();
  const notWeekend = day !== 0 && day !== 6;
  const lastShown = localStorage.getItem('mm_weekend_notif_last_shown');
  const today = new Date().toISOString().split('T')[0];
  if (lastShown === today) return [];
  if (notWeekend) return [];
  localStorage.setItem('mm_weekend_notif_last_shown', today);
  return [
    {
      id: 'weekend-backup',
      type: 'reminder',
      title: 'Weekly Backup Reminder',
      message: 'It\'s the weekend! Back up your data from Settings → Export.',
      severity: 'warning',
      amount: 0,
    },
    {
      id: 'weekend-install',
      type: 'reminder',
      title: 'Install Money Meva',
      message: 'Install as an app for faster access and offline use.',
      severity: 'info',
      amount: 0,
    },
  ];
}

// ─── Carry forward ───────────────────────────────────────────
export function getCarryForward() {
  const txs = cashBankTransactions(getTransactions());
  const now = new Date();
  const currentMonth = txs.filter(t => {
    const d = new Date(t.date);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  });
  const lastMonth = txs.filter(t => {
    const d = new Date(t.date);
    const lm = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
    const ly = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    return d.getFullYear() === ly && d.getMonth() === lm;
  });
  const lastMonthBal = lastMonth.reduce((s, t) => s + (t.type === 'income' ? t.amount : -t.amount), 0);
  const currentBal = currentMonth.reduce((s, t) => s + (t.type === 'income' ? t.amount : -t.amount), 0);
  return { lastMonthCarry: Math.max(0, lastMonthBal), currentStart: lastMonthBal, currentBalance: currentBal };
}

// ─── Mutation Log Query ───────────────────────────────────────
export async function getMutationLog(limit = 100): Promise<MutationLog[]> {
  try {
    return await db.mutation_log.orderBy('timestamp').reverse().limit(limit).toArray();
  } catch { return []; }
}

export async function getMutationLogByTransitionId(transitionId: string): Promise<MutationLog[]> {
  try {
    return await db.mutation_log.where('transitionId').equals(transitionId).reverse().toArray();
  } catch { return []; }
}

export async function getMutationLogByEntity(entityType: string, entityId: string): Promise<MutationLog[]> {
  try {
    return await db.mutation_log.where({ entityType, entityId }).reverse().toArray();
  } catch { return []; }
}
