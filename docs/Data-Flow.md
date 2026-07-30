# Data Flow

## Write Path

Every data write follows this pattern:

```
User action
  → id()           Generate unique ID
  → cache[]        Update in-memory array (instant UI)
  → Dexie.put()    Persist to IndexedDB (fire-and-forget)
  → PouchDB.put()  Push to sync layer (fire-and-forget)
  → mutation_log   Record for audit trail
```

## Read Path

```
Page loads
  → initDB()       Load all Dexie tables into cache
  → cache[]        Instant renders from memory
  → Dexie           Fallback if cache empty
```

## Sync Path

```
PouchDB (local)
  ↔ CouchDB (remote)
  ├── Live sync: { live: true, retry: true }
  ├── Manual sync: one-shot push+pull
  └── Auto-reconnect: 30s interval
```

## Key Rules

1. **Fire-and-forget** — Dexie/PouchDB writes never block UI
2. **Cache-first** — UI reads from memory, not Dexie
3. **Soft-delete** — `deletedAt` field, never hard delete
4. **transitionId** — Links all mutations for one entity
5. **mutation_log** — Every write logged for audit ledger
