# Changelog

## v7.1.1.34 (2026-08-17) — Cloud Sync 2.0 (Supabase)
- **Migrated cloud sync from CouchDB → Supabase** (shared project, per-user isolation)
- `supabase/schema.sql`: `sync_docs` table (PK `user_id,id`), Row-Level Security, realtime publication
- `pouchdb.ts`: `signUpUser`, `connectRemote(url, key, email, password)`, user-scoped upserts (`onConflict user_id,id`), realtime subscription, 30s reconnect
- Settings → Multi-Device Sync: URL + anon key auto-filled from build env; users only enter email + password; "Create account & sync" / "Connect"
- Multi-user isolation verified E2E (two accounts, RLS blocks cross-account reads/writes)
- New GitHub repo: `money-meva-online` (private). Old repo `money-meva` frozen at `dc965eb` (pure CouchDB).
- Docs: USER-GUIDE, Sync guide, Security (RLS), README, memory capsule updated

## v7.1.1.28
- Added global toast system (Toast.tsx + ToastProvider)
- Added skeleton component library (Skeleton.tsx)
- Replaced all `alert()` calls with toast (6 occurrences)
- Upgraded ledger loading from spinner to skeleton rows
- Upgraded 12 empty states with icons + headings + CTAs
- Wired ToastProvider into root layout

## v7.1.1.26
- Rollback point — all UI state work built on top
- Social media OG image (og-image.svg)
- Sitemap + robots.txt for SEO
- Open Graph + Twitter Card meta tags
- Removed backdrop click-to-close on all modals
- Party field defaults to "None" with clear-on-focus

## v7.1.1.20
- Categories page with PIN-protected batch save
- Category dropdown keyboard nav reaches "Create"
- Category save on add/edit

## v7.1.1.15
- Renamed "Money Meva Premium" → "Money Meva"
- Updated git remote + GitHub repo name

## v7.1.1.10
- Investment calculator (FD/SIP/RD/PPF)
- Developer page tools

## v7.1.1.5
- Partners page with CRUD
- PIN setup guide

## v7.1.1.0
- Initial working version
