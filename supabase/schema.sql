-- Money Meva — Cloud Sync on Supabase (multi-user, per-user isolation)
-- Run this in: Supabase Dashboard → SQL Editor → New query → Run
-- Creates/upgrades the sync_docs table used by the app's cloud sync.
-- Each app user signs in with email + password; data is isolated per user.

-- Every app feature stores its data as JSON documents in THIS single table
-- (there is deliberately no table per feature). The `entity` column tags which
-- feature a row belongs to:
--   Money Meva entity list (matches src/lib/store.ts entityMap + pouchdb.ts):
--   entity = transaction | partner | recurring | budget | reminder | adjustment
--            | goal | work | partnership | partnership_entry | pin | audit
--   transaction       → Income / Expenses / Investments  (src/lib/db.ts transactions)
--   partner           → Party Accounts (group: personal/services/financial/
--                       business/government/agriculture/office; type: per-group)
--   recurring         → Recurring transactions
--   budget            → Budgets
--   reminder          → Reminders
--   adjustment        → Adjustments
--   goal              → Savings & Goals
--   work              → Works (farm/job register)
--   partnership       → Partnership (members + share %)   [feat: auto-add self]
--   partnership_entry → Partnership income/expense entries (paidByPartyId may be
--                       a real party id or "__ps:<memberId>" for free-text members)
--   pin               → PIN batch (device PINs, synced across devices)
--   audit             → Audit Ledger / mutation_log history
--
-- Party groups & types (personal/services/financial/business/government/
-- agriculture/office) are app constants (src/lib/parties.ts) — no table needed.
-- They are stored as plain `group`/`type` fields inside each `partner` doc.
--
--   id         = "<entity>:<item-id>" (e.g. "transaction:ab12cd")
--   data       = the full document (jsonb)
--   updated_at = last write time (used for conflict resolution, newer wins)
--   deleted_at = set when a document is permanently deleted on another device
--   user_id    = the Supabase Auth user who owns the row (RLS enforces this)

create table if not exists public.sync_docs (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id         text not null,
  entity     text not null default '',
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Upgrade path: older installs already have the table without user_id.
alter table public.sync_docs add column if not exists user_id uuid not null default auth.uid() references auth.users (id) on delete cascade;

-- Composite PK: (user_id, id) — two different users may use the same entity:item id.
alter table public.sync_docs drop constraint if exists sync_docs_pkey;
alter table public.sync_docs add constraint sync_docs_pkey primary key (user_id, id);

drop index if exists sync_docs_updated_at_idx;
create index if not exists sync_docs_user_updated_at_idx on public.sync_docs (user_id, updated_at);

-- Per-feature lookups: developer page Remote Data Load Stats & Browse Rows
-- (getRemoteStats / getRemoteRows in src/lib/pouchdb.ts) group by this.
drop index if exists sync_docs_user_entity_idx;
create index if not exists sync_docs_user_entity_idx on public.sync_docs (user_id, entity);

-- Row Level Security: a user can only see/modify their OWN rows.
-- Requires the app to be signed in via Supabase Auth (email + password).
alter table public.sync_docs enable row level security;

drop policy if exists "sync_docs_anon_select" on public.sync_docs;
drop policy if exists "sync_docs_anon_insert" on public.sync_docs;
drop policy if exists "sync_docs_anon_update" on public.sync_docs;
drop policy if exists "sync_docs_anon_delete" on public.sync_docs;

drop policy if exists "sync_docs_own_select" on public.sync_docs;
create policy "sync_docs_own_select" on public.sync_docs for select using (auth.uid() = user_id);

drop policy if exists "sync_docs_own_insert" on public.sync_docs;
create policy "sync_docs_own_insert" on public.sync_docs for insert with check (auth.uid() = user_id);

drop policy if exists "sync_docs_own_update" on public.sync_docs;
create policy "sync_docs_own_update" on public.sync_docs for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "sync_docs_own_delete" on public.sync_docs;
create policy "sync_docs_own_delete" on public.sync_docs for delete using (auth.uid() = user_id);

-- Enable live (realtime) sync — lets the app push/pull instantly across devices.
alter table public.sync_docs replica identity full;
alter publication supabase_realtime add table public.sync_docs;

-- Optional: if you want new sign-ups to work immediately without email
-- confirmation, run:
--   alter table auth.users alter column email_confirmed_at set default now();
