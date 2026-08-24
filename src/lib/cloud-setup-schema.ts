// Canonical source: supabase/schema.sql (keep in sync).
// Inlined here so the setup wizard can offer one-tap Copy without a network fetch.

export const CLOUD_SETUP_SQL = `-- Money Meva — Cloud Sync on Supabase (multi-user, per-user isolation)
-- Run this in: Supabase Dashboard → SQL Editor → New query → Run

create table if not exists public.sync_docs (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id         text not null,
  entity     text not null default '',
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.sync_docs add column if not exists user_id uuid not null default auth.uid() references auth.users (id) on delete cascade;

alter table public.sync_docs drop constraint if exists sync_docs_pkey;
alter table public.sync_docs add constraint sync_docs_pkey primary key (user_id, id);

drop index if exists sync_docs_updated_at_idx;
create index if not exists sync_docs_user_updated_at_idx on public.sync_docs (user_id, updated_at);

alter table public.sync_docs enable row level security;

drop policy if exists "sync_docs_own_select" on public.sync_docs;
create policy "sync_docs_own_select" on public.sync_docs for select using (auth.uid() = user_id);

drop policy if exists "sync_docs_own_insert" on public.sync_docs;
create policy "sync_docs_own_insert" on public.sync_docs for insert with check (auth.uid() = user_id);

drop policy if exists "sync_docs_own_update" on public.sync_docs;
create policy "sync_docs_own_update" on public.sync_docs for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "sync_docs_own_delete" on public.sync_docs;
create policy "sync_docs_own_delete" on public.sync_docs for delete using (auth.uid() = user_id);

alter table public.sync_docs replica identity full;
alter publication supabase_realtime add table public.sync_docs;
`;
