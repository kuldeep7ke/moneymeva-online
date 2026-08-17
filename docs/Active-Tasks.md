# 📋 Active Tasks

> Current work in progress. Move completed items to [[Changelog]].

---

## In Progress

- [ ] Publish moneymeva-online (new repo: Supabase cloud sync) — docs + README updated
- [ ] User guide polish (docs/USER-GUIDE.md)

## Up Next

- [ ] Decide: keep shared Supabase as default vs "bring your own Supabase" primary flow
- [ ] Wire CI build env (URL + anon key as GitHub secrets) for future APK/web builds
- [ ] PWA offline improvements

## Backlog

- [ ] Investment portfolio tracking
- [ ] Multi-currency support
- [ ] Recurring reminders via notifications
- [ ] Skeleton loading for remaining pages
- [ ] Empty state polish pass

---

## Done (recent)

- [x] **Cloud sync migrated CouchDB → Supabase** (v7.1.1.34+)
  - `sync_docs` table + RLS + realtime in `supabase/schema.sql`
  - `pouchdb.ts`: `signUpUser`, `connectRemote(url, key, email, password)`, user-scoped push (`onConflict user_id,id`), realtime subscription, 30s reconnect
  - Settings: URL + anon key auto-filled from env, email/password inputs, "Create account & sync" / "Connect"
  - Multi-user isolation verified E2E (alice/bob): no cross-account reads, writes blocked by RLS
  - Old CouchDB/Railway URL decommissioned (Railway instance dead)
  - New GitHub repo `moneymeva-online` (private), old `money-meva` untouched at `dc965eb`
- [x] Global toast system (v7.1.1.28)
- [x] Skeleton component library
- [x] Ledger skeleton loading
- [x] 12 empty state upgrades
- [x] Alert → toast migration (6 calls)
- [x] Social media OG image
- [x] Sitemap + robots.txt
- [x] Modal backdrop click removal
- [x] Party field "None" default
- [x] Categories page with PIN-protected batch save

---

#money-meva #tasks
