# Changelog

## v7.3.1 (2026-09-10) — Accrual Credit Model, Credit Alerts & Settlement Tracking
- **Accrual credit tracking** — credit purchases/sales count in income/expense totals at record time (no longer at settlement). `operationalTransactions()` excludes `Credit Settlement` everywhere, so settlements never double-count.
- **Auto payment-pending adjustments** — every credit entry creates a linked Adjustment (`sourceTransactionId`, `sourceType`, `settleStatus: pending`, `settledAmount: 0`) in the Adjustments section.
- **FIFO settle tracking** — settling or receiving in the Party Account updates those adjustments FIFO: partial payments stay Pending with a tracked settled amount, full payments flip to Settled with a language-aware note.
- **Visible settlement rows** — real cash/bank/UPI payment legs are hidden from the list (balances + party ledger still move); the opposite-section clearing row shows with an amber **"Credit settled"** badge + a **"Credit only"** filter chip.
- **Adjustments page columns** — Source ("Credit purchase/sale · Party") and Status (Pending/Settled) badges.
- **Partner credit limits** — optional credit limit (₹10,000 default) + settle-within days (30 default) per party; near/reached-limit badges on cards; `getPartnerCreditStats` computes outstanding/pct/due state.
- **Backfill** — existing credit entries get pending adjustments automatically on first load (idempotent); clearance history is replayed to mark settlements correctly.
- **Credit alerts + Notification & Popups settings** — CreditAlertModal, NotificationPanel credit icon, per-type popup toggles, swipe-to-dismiss dashboard credit chip.
- **Fix** — restoring a deleted credit transaction now also restores its archived linked adjustment (v7.3.0.22).
- **Other** — PIN inputs switched to `type="text"` + `inputMode="numeric"` + `.pin-mask`; new `credit.*` i18n keys (mr/hi/en); worked example: dashboard "1W" is a rolling 7-day window while the Expenses page "This Week" is calendar Monday→today (values legitimately differ mid-week).

## v7.3.0 (2026-09-10) — Party Groups Redesign, Partnership Fixes, Supabase Verify
- **Party groups redesign** — 3 generic groups → 7 (Personal, Services, Financial, Business, Government, Agriculture, Office) with per-group types; shared constants in `src/lib/parties.ts`, auto-migration of old records in `initDB`
- **Partnership "Who paid?" fix** — dropdown now lists ALL members, including free-text names (pseudo payer `__ps:<memberId>`); settlement math attributes `paid` correctly to them
- **Partnership UX** — new partnerships auto-add the current user as the first member (links to their Partner card when a name match exists)
- **Supabase verify** — confirmed every feature stores data in the single `sync_docs` table via the `entity` tag (11 Dexie tables + PINs); live RLS/realtime checks against the shared project; `supabase/schema.sql` gained `sync_docs_user_entity_idx (user_id, entity)` — re-run in SQL Editor to apply
- **Docs restructure** — README, USER-GUIDE, From-Scratch, memory capsules aligned to the current app (7 groups, partnership details, up-to-date version)

## v7.2.0 (2026-08-23) — Big Update: Works, Partnership, Accounts 2.0, Performance
- **Works (कामे)** module — farm & job entries with direction (receivable/payable), profiles, payment history, pending tracking
- **Partnership (भागीदारी)** tab in Party Accounts — member shares (must total 100%), settlement math (`balance = incomeShare + paid − expenseShare`), ledger mirroring; members are free-text fields with recent-party suggestions
- **Accounts page rebuilt** — 5 cards: Cash, Bank, Capital, Revenue, Expenses; period pills (1W–ALL); Add Capital/Drawings modal writes real synced transactions
- **Stats integrity** — `getAggregates()`/`getMonthlySummary()` now exclude `Transfer`, `Capital`, `Drawings`; transfers no longer inflate Income+Expense totals
- **Dashboard** — compact single-line summary cards; Tasks card removed (Savings = Goals only)
- **Performance** — dashboard scans transactions once per render (was ~18×), first-load-only skeleton, notification polling 20s→60s
- **Categories page** — tap a category to view all its entries with count + total
- **Sync audit (v7.2.0)** — verified all 11 entities + `pin:batch` sync through `sync_docs`; entity list corrected in `supabase/schema.sql`; stale localStorage key names fixed across docs (`mm_pouch_url`, `mm_sync_key`, `mm_pouch_urls`, `sb-<ref>-auth-token`)

## v7.1.1.34 (2026-08-17) — Cloud Sync 2.0 (Supabase)
- **Migrated cloud sync from CouchDB → Supabase** (shared project, per-user isolation)
- `supabase/schema.sql`: `sync_docs` table (PK `user_id,id`), Row-Level Security, realtime publication
- `pouchdb.ts`: `signUpUser`, `connectRemote(url, key, email, password)`, user-scoped upserts (`onConflict user_id,id`), realtime subscription, 30s reconnect
- Settings → Multi-Device Sync: URL + anon key auto-filled from build env; users only enter email + password; "Create account & sync" / "Connect"
- Multi-user isolation verified E2E (two accounts, RLS blocks cross-account reads/writes)
- New GitHub repo: `moneymeva-online` (private). Old repo `moneymeva` frozen at `dc965eb` (pure CouchDB).
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

## v7.1.1.5
- Partners page with CRUD
- PIN setup guide

## v7.1.1.0
- Initial working version
