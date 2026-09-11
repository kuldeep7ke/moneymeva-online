// Canonical source: supabase/schema.sql (keep in sync).
// Inlined here so the setup wizard can offer one-tap Copy without a network fetch.

export const CLOUD_SETUP_SQL = `-- Money Meva — Cloud Sync on Supabase (shared database, no accounts)
-- Run this in: Supabase Dashboard → SQL Editor → New query → Run
-- EVERY device that connects with the project URL + anon key reads and writes
-- the SAME rows (old CouchDB model) — no email/password/accounts required.

create table if not exists public.sync_docs (
  id         text not null,
  entity     text not null default '',
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- ── Upgrade path ────────────────────────────────────────────────────────────
-- Pre-v7.3.0.33 projects: the table had a \`user_id\` column with per-user RLS
-- and composite PK (user_id, id). This collapses it to one shared document per
-- \`id\`. The app no longer sends user_id.

-- 1) Drop EVERY existing RLS policy on sync_docs (whatever they're called) so the
--    column/constr remodelling below can't be blocked by stale per-user policies.
do $$ declare p record; begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'sync_docs' loop
    execute format('drop policy if exists %I on public.sync_docs', p.policyname);
  end loop;
end $$;

-- 2) Drop user_id (removes its FK to auth.users automatically).
alter table public.sync_docs drop column if exists user_id;

-- 3) Dedupe rows so the new single-column PK can be created: for each document
--    id keep only the newest row (same updated_at → keep one deterministic row).
delete from public.sync_docs d
using public.sync_docs m
where m.id = d.id
  and (m.updated_at > d.updated_at
    or (m.updated_at = d.updated_at and m.ctid > d.ctid));

-- 4) Single-row-per-document PK.
alter table public.sync_docs drop constraint if exists sync_docs_pkey;
alter table public.sync_docs add constraint sync_docs_pkey primary key (id);

drop index if exists sync_docs_user_updated_at_idx;
drop index if exists sync_docs_user_entity_idx;
create index if not exists sync_docs_updated_at_idx on public.sync_docs (updated_at);

-- Per-feature lookups: developer page Remote Data Load Stats & Browse Rows
-- (getRemoteStats / getRemoteRows in src/lib/pouchdb.ts) group by this.
create index if not exists sync_docs_entity_idx on public.sync_docs (entity);

-- Row Level Security stays ON but is fully open to the anon key: any device
-- that knows the project URL + anon key shares this one database (the model
-- the user chose — same as the original CouchDB sync).
alter table public.sync_docs enable row level security;

drop policy if exists "sync_docs_shared_select" on public.sync_docs;
create policy "sync_docs_shared_select" on public.sync_docs for select using (true);

drop policy if exists "sync_docs_shared_insert" on public.sync_docs;
create policy "sync_docs_shared_insert" on public.sync_docs for insert with check (true);

drop policy if exists "sync_docs_shared_update" on public.sync_docs;
create policy "sync_docs_shared_update" on public.sync_docs for update using (true) with check (true);

drop policy if exists "sync_docs_shared_delete" on public.sync_docs;
create policy "sync_docs_shared_delete" on public.sync_docs for delete using (true);

-- Enable live (realtime) sync — lets the app push/pull instantly across devices.
alter table public.sync_docs replica identity full;
alter publication supabase_realtime add table public.sync_docs;
`;