# Money Meva — Memory Capsule

**Version:** v7.1.1.87 (incremented on every build)
**Repository:** github.com/kuldeep7ke/moneymeva-online (private, Supabase sync)
**Legacy repository:** github.com/kuldeep7ke/moneymeva (frozen at `dc965eb`, pure CouchDB — do not build from it)
**Deployment:** Cloudflare Pages (auto-deploy on push to master)
**Android:** Capacitor APK via GitHub Actions (auto-build on push)
**Remote announcements:** jsonbin.io bins (broadcast + banner) — see `docs/BROADCAST-GUIDE.md`
**Docs vault:** `docs/` (Obsidian-compatible, seed at `AGENTS.md`)
**Last Updated:** 2026-08-23

---

## Architecture Overview

### Stack
| Layer | Technology | Rationale |
|---|---|---|
| Framework | Next.js 16.2.9 (App Router) | Static export for cheap hosting; React 19 for latest features |
| Styling | Tailwind CSS v4 + CSS variables | Rapid prototyping; 3-brand theme via CSS custom properties |
| i18n | Custom hook + translations.ts | 3 languages (mr/hi/en), no external lib needed |
| Database | Dexie.js (IndexedDB wrapper) | Offline-first; no server needed; 9 tables with compound indexes |
| Sync | PouchDB ↔ Supabase `sync_docs` (realtime) | Local PouchDB buffer (`mm_pouch`); cloud hub = Supabase table; live realtime + manual "Sync Now"; 30s reconnect; self-healing `checkConnection` |
| State | In-memory cache + Dexie + PouchDB | Cache for instant reads, Dexie for persistence, PouchDB for sync |
| Auth | Local (localStorage) + optional Supabase Auth | Local multi-user profiles; cloud login (email+password, JWT in `mm_sb_session`) only when Multi-Device Sync enabled |
| Security | One-time 4-digit PINs + Supabase RLS | PINs for app access; cloud rows isolated per `auth.uid()` via Row-Level Security; no PII stored remotely |
| Mobile | Capacitor v8 (Android) | Wraps static Next.js output as native APK; plugins: app, browser, filesystem, share, local-notifications, status-bar |
| Charts | Recharts | Lightweight, React-native charting |
| PDF Export | jsPDF + jsPDF-autotable | Client-side PDF generation |
| Excel Export | SheetJS (xlsx) | Client-side Excel generation |
| File I/O (Android) | @capacitor/filesystem + @capacitor/share | Exports write to Cache → native share sheet (blob-URL downloads don't work in WebView) |
| Toasts | Custom context (Toast.tsx) | Global success/error/warning/info — replaces `alert()` |

### Why Not...
- **Self-hosted/CouchDB sync** → Removed. Railway CouchDB instance decommissioned (dead 404). Replaced by a shared Supabase project with per-user isolation — zero server to run, free tier, realtime built-in.
- **Server components** → Cannot use. Dexie/PouchDB are browser-only. All pages `'use client'`.
- **Zustand/Redux** → Unnecessary. In-memory cache arrays + direct reads are simpler.
- **Prisma/SQLite** → Dexie is the only offline-capable option for browser storage.
- **react-i18next** → Unnecessary. Custom hook + translations.ts is simpler for 3 languages.

### Transaction Types
Exactly **three** types exist: `income`, `expense`, `investment` (union in `src/types/index.ts`). The old `saving` type was removed from the app — logic, charts, exports, and type union no longer reference it. Savings are tracked as goals only; goal **contribute** records an `expense` transaction, **withdraw** records `income`.

---

## Key Architectural Decisions

### 1. Data Flow Pattern
Every write: `id()` → cache → Dexie (fire-and-forget) → PouchDB (fire-and-forget) → mutation_log (fire-and-forget)

### 2. Soft-Delete Everything
Every entity has `deletedAt?: string`. Items disappear from active views, appear in Archive, auto-permanent-delete after 30 days.

### 3. transitionId System
Every entity gets a `transitionId` at creation. Links all mutations across lifecycle. Used in Audit Ledger.

### 4. Offline-First Cloud Sync (Supabase)
Local PouchDB buffer (`mm_pouch`) + Supabase `sync_docs` table as the cloud hub (not a relay — data IS stored on Supabase). Optional: app fully works offline without it.
- **Sign-up**: `signUpUser(url, key, email, password)` → Supabase Auth → connect
- **Connect**: `connectRemote(url, key, email, password)` → sign in → initial `pushAllToPouch` → realtime subscription → `pullAll` → `processRemoteChanges`
- **Push**: upsert with `onConflict: 'user_id,id'` (composite PK — every row owned by the signed-in user)
- **Pull**: `select` scoped by RLS (`auth.uid() = user_id`)
- **Live updates**: realtime channel on `sync_docs_realtime` (replica identity full); 30s reconnect interval; `onRemoteChange` for UI refresh
- **Self-healing checks**: `checkConnection()` — if session looks dead (getUser fails on expired token), recreates the client, `getSession()` auto-refreshes, re-pings, and re-subscribes instead of reporting `false`. Successful reconnects dispatch a sync event (`'complete', 'Sync reconnected'`) so Settings updates its UI live (listens via `listenSyncEvents`) — no more flicker between "Sync Now" and the create-account form on slow/flaky Android networks
- **URL/key defaults**: baked into `src/lib/env.ts` as XOR+base64 obfuscated constants (`_K='moneymeva'`, runtime `_d()` decoder) — no plain-text secrets in shipped bundles; `.env.local` is inert (nothing reads env vars anymore). Settings can still paste a different URL + anon key at runtime (bring-your-own-Supabase); re-encode via one-liner in CLOUD-SYNC-GUIDE.md
- **Multi-user isolation**: verified E2E — account B sees 0 rows of account A, RLS blocks cross-account writes, realtime events never cross accounts

### 5. Local Auth with Multi-User
Users in localStorage `mm_users`. Session in `mm_session`. No server needed. Cloud login (Supabase) is separate and only used for Multi-Device Sync.

### 6. Future-Date Guard
Income/expense/investment entries cannot be dated after today. Dated picker capped via `max={todayStr()}`, submit validated with warning toast. Exempt: recurring start/end, task/todo due, investment maturity. Needed in: TransactionPage add/edit, Dashboard quick-add, Partners transaction modal.

### 7. Per-Type Categories
Categories are kept **separate** per transaction type — `mm_income_categories`, `mm_expense_categories`, `mm_investment_categories` + default base lists. Never merged across types (intentional: dropdowns stay relevant, budgets/breakdowns stay type-scoped).

### 8. Remote Announcements (jsonbin.io)
Broadcast pills + banner modals are **remote-config**: JSON hosted on jsonbin.io, fetched with cache-busting (`?t=${Date.now()}`, `cache: 'no-store'`) on every dashboard load. Works in web AND installed APKs without app updates.
- **Bins**: broadcast `6a89f038f5f4af5e29363c79` (array of pill objects), banner `6a89f053f5f4af5e29363cb3` (single object)
- **Wiring**: Bin IDs + jsonbin base URL stored as XOR+base64 obfuscated constants in `src/lib/env.ts` (`BROADCAST_BIN_ID`/`BANNER_BIN_ID`/`JSONBIN_BASE`, runtime `_d()` decoder) — invisible to bundle extraction; verified zero plain-text occurrences in `out/`
- **jsonbin response shape**: `{ record: <actual JSON>, metadata: {...} }` — components unwrap via `res?.record ?? res`
- **Broadcast pill** (`BroadcastBanner.tsx`): centered floating pill top-center, `fixed left-1/2 -translate-x-1/2 z-[9998] max-w-lg w-[calc(100vw-1rem)]`, stacked via inline `style={{top: `${8+i*44}px`}}`; solid color-coded bg (info=blue-600, warning=amber-500, success=green-600, error=red-600); optional `link` wraps pill in anchor + ExternalLink icon; per-ID dismissal in localStorage `mm_dismissed_broadcasts`; `pinned: true` = no X; array format = multiple stacked pills
- **Banner modal** (`BannerModal.tsx`): full-screen overlay `fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm`, centered card, width via Tailwind class field (`max-w-md` default), optional image (max-h-64) + href (whole card clickable); X button absolute top-right with 5-second countdown (disabled until 0, shows number then X icon); NO localStorage persistence — shows every refresh; scheduling via `startDate`/`expires` date checks
- Local `public/broadcast.json`/`public/banner.json` are dead fallbacks only (fetch URL switches to jsonbin when BIN_ID set — which is always now)
- Full editing workflow: `docs/BROADCAST-GUIDE.md`

---

## i18n System

### Languages
| Code | Name | Native Name | Default |
|---|---|---|---|
| `mr` | Marathi | मराठी | Yes |
| `hi` | Hindi | हिन्दी | No |
| `en` | English | English | No |

### Files
- `src/lib/i18n/translations.ts` — All translation data (phrase objects for mr/hi/en)
- `src/lib/i18n/index.tsx` — I18nProvider + useTranslation hook

### Hook Usage
```tsx
const { lang, setLang, t } = useTranslation();
t('nav.dashboard')           // "डॅशबोर्ड"
t('common.save')             // "सेव्ह करा"
t('tx.add', { title: 'खर्च' }) // "खर्च — नवीन"
```

### Translation Philosophy
- **Grammar stays native** — Marathi/Hindi SOV structure preserved
- **English loanwords only** for tech terms: Dashboard, Save, Sync, UPI, PIN, Google, Settings
- **Everyday words** for money: खर्च, बचत, पैसे, रक्कम, तारीख, श्रेणी, व्यवहार, उत्पन्न
- **No repetition** — vary word choice across keys (e.g., ध्येय not गोल for goals in Marathi)
- **Marathi hero**: "पैसे कुठे जातात? शोधूया." (relatable hook)
- **English footer**: Copyright always `© 2026 Money Meva.` in all languages

### Nav Labels (Marathi)
डॅशबोर्ड, उत्पन्न, खर्च, ध्येय, गुंतवणूक, पार्टी, आवर्ती, खाती, वर्ग, एडजस्टमेंट, सारांश, लेजर, आर्काइव्ह, सेटिंग्ज, माहिती, मदत, अटी, गोपनीयता

### Nav Labels (Hindi)
डैशबोर्ड, कमाई, खर्च, बचत, निवेश, पार्टी, आवर्ती, खाते, वर्ग, एडजस्टमेंट, सारांश, लेजर, आर्काइव्ह, सेटिंग्स, जानकारी, मदद, शर्तें, गोपनीयता

### Language Selector
- `src/components/LanguageSelector.tsx`
- Two variants: `default` (settings) and `minimal` (landing footer)
- Default uses `createPortal` to render at `document.body` — avoids parent `transform`/`overflow` clipping
- `fixed` positioning with `getBoundingClientRect()` for dropdown
- `z-[9999]` ensures dropdown above all content

---

## Global Toast System

- `src/components/Toast.tsx`
- `ToastProvider` wraps the root layout inside `<I18nProvider>` (see `src/app/layout.tsx`)
- `useToast()` returns a **callable** `(message, type?, duration?) => void` (binds `addToast`)
- Types: `success | error | warning | info` — colored toasts with icon, auto-dismiss (default 4000ms), click-to-dismiss
- Uses existing `.slide-up` CSS animation class (`@keyframes slideUp` already in `globals.css`)
- **Replaced all native `alert()` calls** (6 across settings, developer, adjustments)

---

## Skeleton Loading

- `src/components/Skeleton.tsx` — base `Skeleton` (pulse) + composites:
  - `SkeletonCard` (lines), `SkeletonTable` (rows×cols), `SkeletonChart`, `SkeletonList` (avatar rows)
- Dashboard already has local `CardSkeleton`/`ChartSkeleton`; Ledger uses skeleton rows for load
- Pattern: `animate-pulse` + grey rounded blocks (`bg-slate-200 dark:bg-brand-muted/30`)

---

## Empty States

All list/table/chart empty views show **icon + bold heading + grey hint** (not bare text). Done across: Dashboard (chart, expenses, recent, tasks, recurring, goals), TransactionPage (mobile/desktop/archive), Partners, Ledger, Archive, Adjustments.

---

## Database Schema (Dexie v4)

| Table | Primary Index | Secondary Indexes |
|---|---|---|
| transactions | id | type*, date*, category*, userId*, deletedAt, account, transitionId |
| partners | id | group*, userId*, deletedAt, transitionId |
| recurring | id | txType*, status*, userId*, deletedAt, nextDate, transitionId |
| budgets | id | category*, userId*, deletedAt, transitionId |
| reminders | id | status*, userId*, deletedAt, transitionId |
| adjustments | id | accountType*, userId*, deletedAt, transitionId |
| goals | id | name*, userId*, deletedAt, transitionId |
| todos | id | status*, category*, priority*, important*, userId*, deletedAt, transitionId |
| mutation_log | id | transitionId*, entityType*, entityId*, action*, timestamp*, userId* |

---

## PIN Security

- 10 random 4-digit PINs, no duplicates
- Single-use with index tracking, resets after 10
- Session auto-lock: configurable 1h–24h or off
- Stored in localStorage `mm_pins` + PouchDB `pin:batch`

---

## Theme System

- CSS variables: `--brand`, `--brand-secondary`, `--brand-light`, `--brand-dark`, `--brand-muted`
- 3 brands: Orange (default), Royal Blue, Emerald Green
- Dark mode via `.dark` class on `<html>`, persisted in `mm_theme`

---

## Page Details

### Dashboard (`/dashboard`)
- Summary cards with animated counters
- 6-month cash flow AreaChart, spending PieChart
- Balance carry-forward, sync card
- Goals, Tasks, Recurring cards — always visible with empty-state placeholders
- Upcoming Reminders card
- Notes: `aggregates` now has no `saving` field; available-to-spend = income − expense limit − invest limit (quotas 15%/35%)

### Income / Expenses / Investments (`/dashboard/{type}`)
- Shared `TransactionPage` component
- Desktop: table with Date, Category, Description, Amount, Partner, Actions
- Mobile: minimal list with tap-to-view detail modal
- **Badges**: category badge (slate pill) + account badge (Cash/Bank/UPI/Invest, colored) shown beside the date in the mobile list and next to the description on desktop — both views share one `ACCOUNT_BADGE` map in `TransactionPage.tsx`; works in the Android APK too
- Add/Edit modals with searchable category + party dropdowns
- Search, filters (category/date/amount), sort, group by day/week/month
- 30-day default date filter (`filterDateFrom` init = local-tz date −30d; "Clear Filters" shows all)
- Archive tab for soft-deleted items
- Future dates blocked (date picker `max` + submit toast)

### Partners (`/dashboard/partners`)
- Groups: Customer / Vendor / Contact
- P&L per partner, mini ledger with transaction history
- Add/edit modal (pre-filled on edit, `updatePartner`), duplicate guard skips self

### Recurring (`/dashboard/recurring`)
- Active/stopped recurring transactions
- Frequency: daily, weekly, monthly, yearly, custom
- "Advance" button creates transaction, computes next date

### Categories (`/dashboard/categories`)
- Three tabs: Income / Expense / Investment categories
- Reads from localStorage keys (`mm_income_categories`, `mm_expense_categories`, `mm_investment_categories`) + categories found in transactions
- Inline edit, delete with confirmation, add new
- PIN-protected batch save — all changes saved at once to localStorage
- Default categories set during onboarding (profession-based), surfaced in transaction dropdowns via `recentCategories`

### Settings (`/dashboard/settings`)
- Profile, PIN Security, Brand picker, Theme toggle
- Multi-Device Sync (Supabase: URL+key auto-filled, email/password, Connect / Create account & sync / Sync Now / Disconnect)
- Export/Import (PDF, Excel, JSON) — summary exports have no Savings column; on Android exports open the native share sheet (Filesystem Cache → Share)
- Language selector with portal dropdown
- Danger Zone

---

## Build & Dev Commands

```bash
npm run dev                  # Next.js dev server
npm run build                # Static export to out/ (auto version bump)
npm run version:patch        # vX.Y.Z.N → vX.Y.Z.N+1
npx cap sync android         # Sync web to Android
npm run lint
npm run android:apk          # build → version → gradle assembleDebug
```

---

## Known Gotchas

### PouchDB / Supabase Sync
- `db.type()` deprecated in PouchDB 9.x (harmless warning)
- `_`-prefixed custom fields (like `_entity`) rejected — use `entity` instead
- Upserts against Supabase need `onConflict: 'user_id,id'` (composite PK) — plain `onConflict: 'id'` silently no-ops/fails
- Realtime requires `ALTER PUBLICATION supabase_realtime ADD TABLE sync_docs;` + replica identity full, else events never fire
- SQL-created `auth.users` rows break GoTrue (500 "Database error querying schema") — always create users via the sign-up API
- `over_email_send_rate_limit` (429): turn OFF "Confirm email" in Authentication → Email to let users sign up instantly without rate limits
- Anon key without session: select returns 0 rows, insert blocked, delete no-ops — safe to expose
- Sync errors silent — use `syncHandler.on('error')` / `onRemoteChange` for visibility

### Dexie
- Bulk operations: chunk at 500 items
- Compound indexes are comma-separated strings
- `db.table.put()` silent on failure (fire-and-forget)

### Next.js Static Export
- `output: 'export'` — no server-side features
- All pages must be `'use client'`
- Images unoptimized

### Runtime Config (env.ts)
- `NEXT_PUBLIC_*` env vars are NOT read anywhere since v7.1.1.85 — `.env.local` is inert; all defaults live as XOR+base64 strings in `src/lib/env.ts` (`_K='moneymeva'`, `_d()` decoder)
- To rotate a value: encode with the node one-liner in CLOUD-SYNC-GUIDE.md, paste into env.ts, rebuild
- Obfuscation defeats bundle grep/extraction only — network traffic still reveals runtime calls

### i18n
- `Reveal` component `transform` breaks `fixed` positioning — use `createPortal` for dropdowns
- Default language saved in `mm_language`
- `getDefaultLanguage()` returns `'mr'`

### Windows PowerShell
- `npm` runs fail under PS execution policy — use `cmd /c "npm run …"`

---

## Recent Changes

### v7.1.1.87 (2026-08-23) — Developer Zone Refresh
- Header shows live app version (meta `app-version`) + release-notes version/seen status (`getLastSeenVersion`).
- Sync Diagnostics upgraded: masked URL (`mask()` helper), sync account email from `mm_sb_session`, connection test, **last sync event** via `getLastSyncEvent()`, timing hints (realtime ≈ s / 2-min pull / 30-s watchdog).
- New **Remote Announcements** section: masked bin IDs, live "Test Bin Fetch" against both jsonbin bins (unwraps `record`, reports item counts), dismissed-pills counter + "Clear Dismissed Pills" (`mm_dismissed_broadcasts` reset).
- Removed dead imports (`connected as syncConnected`, `BarChart3`).

### v7.1.1.85–.86 (2026-08-23) — Secret Obfuscation
- All runtime secrets moved to XOR+base64 obfuscated constants in `src/lib/env.ts` (Supabase URL + anon key, both jsonbin Bin IDs, jsonbin base URL). Runtime `_d()` decoder with `_K='moneymeva'`.
- Removed ALL `process.env.NEXT_PUBLIC_*` reads — `.env.local`/`.env.example` now inert (replaced with pointer comments). CI workflow env vars harmless but unused.
- Verified: zero plain-text occurrences of any secret in built `out/` bundle (web + APK). Caveat documented: obfuscation ≠ cryptographic secrecy — network monitoring can still recover values; anon key is public-by-design anyway (RLS protects data).

### v7.1.1.84 (2026-08-23) — jsonbin Bin IDs Wired
- Broadcast/banner Bin IDs baked in: `.env.local` + hardcoded fallbacks in `src/lib/env.ts`. jsonbin.io is now the live source of truth for announcements; GitHub JSON files are inert fallbacks.

### v7.1.1.82–.83 (2026-08-23) — jsonbin.io Remote Config
- `BroadcastBanner.tsx`/`BannerModal.tsx` fetch from `https://api.jsonbin.io/v3/b/<BIN_ID>/latest` when a Bin ID is configured, else fall back to local `/broadcast.json`//`banner.json`. Response unwrapped via `res?.record ?? res` (jsonbin wraps payloads).

### v7.1.1.81 (2026-08-23) — Banner Date Scheduling
- `startDate` field added to banner: shows only between `startDate` and `expires` (both YYYY-MM-DD). Guide rewritten with scheduling recipes.

### v7.1.1.77–.80 (2026-08-19–23) — Banner Modal
- New `public/banner.json` + `BannerModal.tsx`, wired into DashboardLayout (z-[10000] overlay above broadcast pills). Iterated per feedback: filled all options (.78) → X button top-right with 5s countdown, no bottom close (.79) → removed localStorage persistence so it shows on EVERY refresh, dismissal session-only (.80).

### v7.1.1.70–.76 (2026-08-19) — Broadcast Pill System
- New `public/broadcast.json` + `BroadcastBanner.tsx` + DashboardLayout wiring; owner edits JSON → all users see messages without app updates. Position iterated: full-width banner → compact pill top-right → static centered banner (covered page, rejected) → final **centered floating pill** that never pushes content down. Then added: optional clickable `link` + emoji support (.75), array format for multiple independently-dismissable stacked pills (.76). `docs/BROADCAST-GUIDE.md` created.

### v7.1.1.72 (2026-08-19) — Archive Panel Moved to Top
- TransactionPage archive panel moved from bottom of ledger pages to right after the header (near the Archive button where users look for it); duplicate bottom copy removed.

### v7.1.1.66 (2026-08-19) — Category Badges on Mobile
- Mobile transaction list row now shows the category badge (slate pill, same style as the desktop table) beside the date, before the account badge — covers the Android APK (uses the mobile layout).

### v7.1.1.68 (2026-08-19) — Entry Submission Toasts
- Success toasts added to every save flow: `handleAdd`, `handleDupConfirm`, `doEdit` in TransactionPage + partners page `handleAddTx`/`handleDupConfirm`. Shows entry summary: `{Type} added/updated · {category} · {amount}`.

### v7.1.1.69 (2026-08-19) — What's New Modal
- On dashboard load, compares current build version (from `<meta name="app-version">`) against `mm_seen_release` in localStorage. If different, shows a "What's New" modal listing the latest release notes. Dismissed via "Got it" button (no backdrop close). Works on web + Android APK — APK installs a new build → version differs → modal shows once.

### v7.1.1.65 (2026-08-19) — Sync Status Stability + Native Exports + Mobile Badges
- **Sync flicker fixed** (Android APK: Settings alternated between "Sync Now" and the create-link form with blank email/password). Root cause: `checkConnection()` returned `false` on a dead session (expired Supabase access token) and nothing re-checked after the 30s reconnect timer recovered — the UI only re-evaluated on page remount. Fixes: (1) `checkConnection()` now self-heals — recreates the client, `getSession()` auto-refreshes the token, re-pings, re-subscribes, returns the real result; (2) `startReconnectTimer` dispatches a sync event (`'complete'`, "Sync reconnected") after successful reconnect; (3) Settings subscribes via `listenSyncEvents` and re-runs `checkConnection()` — status follows reality instead of going stale.
- **Android exports fixed** (CSV/PDF/Excel did nothing on the APK — blob-URL anchor clicks don't work in the Capacitor WebView, no download manager). Added `@capacitor/filesystem` + `@capacitor/share` (v8, cap-synced). `downloadBlob()` on native: blob → base64 → write to `Cache/exports/` → `Filesystem.getUri` → native share sheet (user saves to Drive/Files/etc.), file auto-deleted after 60s. Web path unchanged (share API → anchor download).
- **Account badges on mobile**: `ACCOUNT_BADGE` map (cash=emerald, bank=blue, upi=purple, invest=violet) extracted to module scope in `TransactionPage.tsx`; badges now render beside the date in the mobile list view (previously desktop table only) — covers the Android APK since it uses the mobile layout.

### v7.1.1.64 (2026-08-19) — Account Badges (Desktop)
- Desktop transaction table Description cell shows a colored badge (Cash/Bank/UPI/Invest) when `t.account` is set (`t.account?: 'cash'|'bank'|'upi'|'invest'`).

### v7.1.1.63 (2026-08-19) — Default 30-Day Filter Restored
- `filterDateFrom` init is `useState(() => { const d = new Date(); d.setDate(d.getDate() - 30); return local `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}` })` (local timezone, not UTC). "Clear Filters" still sets `''` (show all). Restores the pre-audit behavior the user wanted after v7.1.1.60 changed the default to ''.

### v7.1.1.62 (2026-08-18) — Visibility & Boot Hardening
- **`Reveal.tsx` rebuilt** — content could stay invisible forever when IntersectionObserver never reported `isIntersecting` (blank lists on Income/Expenses/Ledger + below-fold sections on every page, incl. dashboard cards; top blocks were visible so it looked page-specific). Fix: reveal immediately if already in viewport at mount, forgiving threshold (0.01) + rootMargin, safety timer reveals unconditionally after `delay + 1500ms`, fallback without IntersectionObserver. Same class risk on landing page `useInView` hooks — they are declared but never applied in JSX (dead code, no impact).
- **`initDB()` hardened** — any hydration step throwing left the whole app stuck on the LoadingOverlay forever (`ready` never set, no store-ready). Now try/catch around init so `initialized = true` + store-ready ALWAYS fire; DashboardLayout also catches rejections.
- Verified ledger/developer/onboarding data loads all have try/catch (getMutationLog, import flows, dumps) — no skeleton-forever paths remain.

### v7.1.1.60 (2026-08-18) — Full Audit & Bug-Fix Pass
Five parallel audits (store/sync, dashboard/summary/savings, TransactionPage ×2, partners/accounts/categories, settings/login/onboarding/i18n) — every finding verified against source, all fixed, build green.
- **Local-date helper**: `todayStr()` (local timezone, not UTC) added to `src/lib/utils.ts`; replaces all `new Date().toISOString().split('T')[0]` uses (TransactionPage, dashboard, partners, adjustments, savings, recurring, accounts, onboarding, settings CSV). UTC dates made "today" = yesterday in IST (00:00–05:30), blocking same-day entries + wrong PIN prompts.
- **store.ts**: `advanceRecurring` now accepts overrides `{amount, date, account, description}` and parses nextDate in UTC (was local-parse → date −1 in IST); dashboard's advance modal no longer double-creates the transaction. `updatedAt` added to every entity type + set/bumped on all add/update/delete/restore/complete/advance paths. `permanentDeleteAllArchived` now `bulkDelete`s removed rows from Dexie (were rehydrating on reload) + writes tombstones. `deleteFromCacheAndWrite` writes a tombstone doc instead of `removeDoc` so permanent deletes propagate to remote. `clearAllDB` LS_KEYS pin keys fixed (`mm_pins_used_idx`, `mm_auto_lock_minutes`, `mm_locked`). Removed dead `getSavings`/`counterKey`, awaited `autoCleanupCompletedTodos()`, removed stray console.log, `getCarryForward` clamps both bounds.
- **pouchdb.ts**: `pushLocalToRemote` upserts tombstones for `_deleted` docs instead of hard-deleting rows (other devices kept stale copies). `startReconnectTimer` detects expired sessions (supabase set but no user) → recreates client + `getSession()` auto-refresh (was a sync deadlock). OAuth logs → `console.debug`.
- **TransactionPage**: amount>0 guards in add/edit/dup-confirm; investSource default/reset `'bank'`; `bank` source now creates the promised "Investment Outflow" expense (was silently recording account:'cash' investments, dead `savings`/`partner_` branches removed); dupWarning carries account; quick filters use real calendar weeks/months/quarters + local dates; `filterDateFrom` defaults to '' (all); headings "Add/Edit {title}" fixed ("Incom" bug); edit-modal category dropdown uses its own `filteredEditCategories` memo (was keyed to add-modal search); removed dead imports + dead investSource detail block.
- **dashboard**: recurring advance = single call with overrides; `handleDone` guards amount>0; Sync Now wrapped in try/finally + error toast; `periodRef` fixes stale-period refresh; goal contribute refreshes aggregates for the active period; `getPeriodSince` normalized to local midnight; investments render violet in Recent Transactions (were red expenses).
- **summary**: goal % guarded against target=0 (NaN bar); stat grid `lg:grid-cols-3` (was 4 for 3 cards).
- **partners**: amount>0 guard; delete warns with linked-transaction count; local todayStr.
- **settings**: backup now reads `getSession().user` (was dead `money_meva_session` key → empty profile) + includes `todos`; import handles `todos`; user-data clear = `clearAllDB()` + `logoutUser()` (was clearing only 7 Dexie tables → data resurrected via live sync; no longer flips `onboarding_completed` → login guard was deleting the account the copy promised would stay); CSV export escapes fields + import maps partnerId column + help text 'saving'→'investment'; Supabase URL format validation on Connect/Create.
- **categories**: listens for `store-ready` (was reading empty data on first mount).
- **InvestmentCalculator**: "Use this amount" fills `result.invested` (was `result.maturity` → FD ₹72,243 recorded as a ₹50,000 investment).
- **onboarding**: seeds `mm_investment_categories` per profession (was income+expense only); local today for partner dates.
- **localAuth**: `updateProfile` only rewrites the session when updating the logged-in user (was overwriting session with any edited user).
- **account page**: "Logout & Clear Data" actually calls `clearAllDB()` (Dexie data was surviving logout).
- **i18n**: footer copyright `© 2026-27 Money Meva | All Right Reserved` → `© 2026 Money Meva.` (all 3 languages); Marathi hero → `पैसे कुठे जातात? शोधूया.`
- **Types**: `updatedAt: string` added to RecurringTx/Budget/Reminder/Adjustment/Goal/Todo; `add*` signatures `Omit<…, 'updatedAt'>`.
- Known-deferred (documented, not implemented): store getters have no userId filtering (multi-user local profiles share one dataset by design; cloud isolation handled by Supabase RLS); plaintext passwords in `mm_users`; partner delete leaves orphaned `partnerAccountId`s (soft-delete is safe); duplicate toast systems (global + local) left as-is.

### v7.1.1.34 (2026-08-17) — Cloud Sync 2.0 (Supabase)
- **Migrated cloud sync CouchDB → Supabase** after the Railway CouchDB instance died (404 "Application not found").
- **Supabase project** `orpgmbrycnmjwtalupce` (ap-south-1, PG 17.6): `sync_docs` table (PK `(user_id,id)`, `data` jsonb, `updated_at`, `deleted_at`), RLS policies `sync_docs_own_{select,insert,update,delete}`, realtime publication, `mailer_autoconfirm: true`.
- **`pouchdb.ts`**: `signUpUser`, `connectRemote(url, key, email, password)`, `checkConnection`, `ensureConnected`, `disconnectRemote`, user-scoped `putDoc`/`removeDoc` (push upsert `onConflict user_id,id`), realtime subscription, `mm_sb_session`/`mm_sb_url`/`mm_sb_key` in localStorage, env fallback in `getConfig()`.
- **Settings**: URL + anon key auto-filled from `.env.local`; email + password inputs; "Create account & sync" / "Connect" / "Sync Now" / "Disconnect".
- **Verified E2E**: ping, push, pull, conflict-update, realtime event, delete, alice/bob isolation, RLS delete-block. All test users cleaned up.
- **Repo split**: new private repo `moneymeva-online`; origin retargeted; old `moneymeva` untouched at `dc965eb`.
- **Docs**: USER-GUIDE.md, CLOUD-SYNC-GUIDE.md, updated Sync/Security/Architecture/Data-Flow/File-Map, README, memory capsule.

### v7.1.1.33 (2026-08-03)
- **Party edit**: Partners page cards now have a pencil Edit button → pre-filled modal → `updatePartner()`. Duplicate-name check excludes self. "+" resets create mode.

### v7.1.1.32 (2026-08-03)
- **Future-date guard** for income/expense/investment (incl. dashboard quick-add & partners transactions): `max={today}` on date pickers + submit-time validation with warning toast. Recurring/tasks/todos/maturity exempt. Added shared `todayStr()` helper in TransactionPage, dashboard, partners.

### v7.1.1.31 (2026-08-03)
- **Removed the `saving` transaction type entirely**:
  - `TransactionType` union → `'income' | 'expense' | 'investment'`
  - `getMonthlySummary`/`getAggregates` drop `saving`
  - Goal contribute now records `expense` (withdraw = `income`)
  - TransactionPage `type==='income'||type==='saving'` branches simplified to `type==='income'`; category branch removed
  - Summary P&L chart/cards drop Savings; PDF/Excel summary export drops Savings column
  - CSV import list no longer accepts `saving`

### v7.1.1.29 (2026-08-03)
- Summary page: removed `saving`/“Total Savings” card + Savings bar from P&L Trend chart.

### v7.1.1.28 (2026-07-30)
- **Global Toast system** (`Toast.tsx`), `ToastProvider` in root layout, `useToast()` returns callable; replaced all 6 `alert()` calls.
- **Skeleton library** (`Skeleton.tsx`); ledger spinner → skeleton rows.
- Upgraded 12 empty states (dashboard 6 + TransactionPage 3 + others).

### v7.1.1.26 (2026-07-27)
- Party field defaults to “None”; no backdrop click-to-close on **all** modals.
- Categories page; category dropdown fixes; repo renamed `moneymeva`.

---

## Sync Debug — From Scratch

### The Bug (Pushed 0 · Pulled 0) — historical (CouchDB era)
`putDoc` added a `_entity` field to every PouchDB doc. PouchDB 9 rejects custom fields starting with `_` (only `_id`, `_rev`, `_deleted`, `_attachments`, `_conflicts` allowed). Each `localDB.put()` threw `"Bad special document member: _entity"` — silently caught, zero docs reached CouchDB.

### The Fix
Renamed `_entity` → `entity` everywhere (`src/lib/pouchdb.ts`, `src/lib/store.ts`). Backward compat: `pullAll`/`processRemoteChanges` fall back to `doc._entity` for old remote docs.

### Supabase migration (v7.1.1.34)
Remote is no longer a CouchDB database. `pullAll` maps `sync_docs` rows back into PouchDB docs (`id` → `entityType:id`); push maps PouchDB docs back to rows. Old CouchDB-era docs in a user's local PouchDB keep working (same `entityType:id` ids).

---

## Obsidian Vault (`docs/`)

- Home → Start-Here → File-Map (every source file linked)
- Active-Tasks / Bug-Tracker / Changelog
- Templates: Feature, Bug Report, Daily Dev Log, Quick Note
- Reference: Architecture, Data-Flow, i18n, Sync, Security, Capacitor
- `.obsidian/` is git-ignored (local user settings)