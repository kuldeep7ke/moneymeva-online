# Sync (Cloud Sync)

> **Architecture:** PouchDB (local IndexedDB buffer) ↔ Supabase (shared cloud database, link-only — no accounts).
> **Supersedes:** the old CouchDB sync (PouchDB replication to a user-provided CouchDB URL).

## How It Works

```
Device PouchDB (mm_pouch)
   │  push (upsert onConflict id)
   ▼
Supabase sync_docs table  ←  open RLS (any device with anon key reads/writes)
   │  pull (select all) + realtime subscription
   ▼
Device PouchDB (any device with the same URL + key)
```

- **Local buffer**: `src/lib/pouchdb.ts` keeps a PouchDB instance named `mm_pouch`
  so sync never blocks the UI and works offline.
- **Cloud storage**: the actual cloud copy lives in the Supabase `sync_docs` table
  (not a device-to-device relay). Supabase is the hub + backup.
- **Realtime**: live subscription to `sync_docs_realtime` pushes remote changes
  into local PouchDB within seconds.

## What Syncs (verified v7.2.0)

One shared table (`sync_docs`), one row per entity document. Every section of the
app writes through `syncWriteDoc()` / `putDoc()`:

| EntityType | App section |
|---|---|
| `transaction` | Income, Expenses, Investments, Transfers, Capital/Drawings, ledger mirrors (works, partnership, recurring, reminders) |
| `partner` | Party Accounts (पार्टी) + party field everywhere |
| `recurring` | आवर्ती (Recurring) |
| `budget` | Category budgets (Settings/Adjustments zone) |
| `reminder` | Dashboard reminders ("Mark as Paid") |
| `adjustment` | Adjustments page |
| `goal` | Savings → Goals (ध्येय) |
| `work` | Works कामे (incl. payment history) |
| `partnership` | Partnership भागीदारी (members + shares) |
| `partnership_entry` | Partnership income/expense entries |
| `pin` | PIN batch — single `pin:batch` doc |

**Local-only by design:** `mutation_log` Dexie table (per-device audit trail) and
localStorage preferences (language, theme, quotas, dismissed notices, seen-release).
Soft deletes push the full row; permanent deletes push an `{ id, deletedAt }` tombstone.

## Connection

```ts
// src/lib/pouchdb.ts
getConfig()                                   // { url, key } — from env or localStorage override
connectRemote(url, key)                       // create client + ping (no sign-in) → { ok, error? }
manualSync()                                  // one-shot push+pull → { ok, pushed, pulled, pushErr?, pullErr? }
checkConnection()                             // lightweight ping
ensureConnected()                             // reconnect if subscription dropped
disconnectRemote()                            // stop realtime, keep local data
```

- No authentication session — connect is just a client + ping. Every device sharing the URL + anon key reads/writes the same rows.
- Reconnect: 30s interval + `onRemoteChange` callback for live UI updates.

## Sync Modes

| Mode | Trigger | Behavior |
|---|---|---|
| Live | Auto after connect | Realtime push/pull via Supabase subscription |
| Manual | "Sync Now" button | One-shot full push + pull |
| Initial | First connect on device | `pushAllToPouch` then `pullAll` → `processRemoteChanges` |

## Storage (localStorage)

- `sb-<project-ref>-auth-token` — Supabase auth session (Supabase JS standard key)
- `mm_pouch_url` / `mm_sync_key` — manual URL/key overrides (build-time defaults come from `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`; empty by default)
- `mm_pouch_urls` — last 5 URLs used (history dropdown)

## Schema & Security

- Table: `sync_docs` — see `supabase/schema.sql`
  - PK `id` (text) — one row per document (e.g. `transaction:abc123`)
  - `entity` column tags which feature the row belongs to
  - `data` jsonb holds the full document payload
  - `updated_at` timestamptz for conflict resolution (newer wins)
  - `deleted_at` timestamptz soft-delete marker
- **Row-Level Security** (open policies — `using(true)` / `with check(true)`):
  - Any device with the anon key can read and write all rows
  - Protection = keeping the project URL private (not baked into the app)
- Realtime publication on `sync_docs` + `replica identity full`
- Push uses `onConflict: 'id'` (single-column PK); the old composite `(user_id, id)` was removed by the migration

## Error Handling

- `console.warn` on errors — never kills the connection
- `checkConnection()` / `ensureConnected()` — utility guards
- Sign-in failures return `{ ok: false, error }` → shown as toast in Settings
- `over_email_send_rate_limit` (429) — Supabase rate limit when "Confirm email"
  is still on; disable it in the project dashboard (see CLOUD-SYNC-GUIDE.md)

## Events

```ts
// src/lib/sync-notify.ts
dispatchSyncEvent(ev)  // fires mm-sync-event CustomEvent
listenSyncEvents(fn)   // subscribe to status
// Types: started | pushing | pulled | processing | complete | error
```

## Setup (Owners)

1. Create a Supabase project (free tier OK)
2. Run `supabase/schema.sql` in SQL Editor (creates shared `sync_docs` + open RLS + realtime)
3. Set `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` /
   `NEXT_PUBLIC_SITE_URL` in `.env.local` (see `.env.example`) and rebuild —
   users paste the URL + anon key in Settings → Multi-Device Sync → Connect
4. Users can override URL/key per device (bring-your-own-Supabase)

See `SELF-HOSTING.md` for the full step-by-step guide and `CLOUD-SYNC-GUIDE.md`
for the end-user sync walkthrough.

---

#money-meva #reference #sync
