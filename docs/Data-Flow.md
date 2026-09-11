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
Local PouchDB (mm_pouch)
  → push (upsert, onConflict id)
  → Supabase sync_docs (shared rows, open RLS)
  → realtime subscription → other devices' PouchDB
  ├── Live: realtime push/pull after connect
  ├── Manual: "Sync Now" one-shot push+pull
  └── Reconnect: 30s interval + ensureConnected()
```

## Key Rules

1. **Fire-and-forget** — Dexie/PouchDB writes never block UI
2. **Cache-first** — UI reads from memory, not Dexie
3. **Soft-delete** — `deletedAt` field, never hard delete
4. **transitionId** — Links all mutations for one entity
5. **mutation_log** — Every write logged for audit ledger
6. **Cloud rows are shared** — every device with the anon key reads/writes the same rows;
   keep the project URL private to protect data
