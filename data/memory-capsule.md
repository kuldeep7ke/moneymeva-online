# Money Meva — Memory Capsule

**Version:** v7.1.1.34 (incremented on every build)
**Repository:** github.com/kuldeep7ke/money-meva-online (private, Supabase sync)
**Legacy repository:** github.com/kuldeep7ke/money-meva (frozen at `dc965eb`, pure CouchDB — do not build from it)
**Deployment:** Cloudflare Pages (auto-deploy on push to master)
**Android:** Capacitor APK via GitHub Actions (auto-build on push)
**Docs vault:** `docs/` (Obsidian-compatible, seed at `AGENTS.md`)
**Last Updated:** 2026-08-17

---

## Architecture Overview

### Stack
| Layer | Technology | Rationale |
|---|---|---|
| Framework | Next.js 16.2.9 (App Router) | Static export for cheap hosting; React 19 for latest features |
| Styling | Tailwind CSS v4 + CSS variables | Rapid prototyping; 3-brand theme via CSS custom properties |
| i18n | Custom hook + translations.ts | 3 languages (mr/hi/en), no external lib needed |
| Database | Dexie.js (IndexedDB wrapper) | Offline-first; no server needed; 9 tables with compound indexes |
| Sync | PouchDB ↔ Supabase `sync_docs` (realtime) | Local PouchDB buffer (`mm_pouch`); cloud hub = Supabase table; live realtime + manual "Sync Now"; 30s reconnect |
| State | In-memory cache + Dexie + PouchDB | Cache for instant reads, Dexie for persistence, PouchDB for sync |
| Auth | Local (localStorage) + optional Supabase Auth | Local multi-user profiles; cloud login (email+password, JWT in `mm_sb_session`) only when Multi-Device Sync enabled |
| Security | One-time 4-digit PINs + Supabase RLS | PINs for app access; cloud rows isolated per `auth.uid()` via Row-Level Security; no PII stored remotely |
| Mobile | Capacitor v8 (Android) | Wraps static Next.js output as native APK |
| Charts | Recharts | Lightweight, React-native charting |
| PDF Export | jsPDF + jsPDF-autotable | Client-side PDF generation |
| Excel Export | SheetJS (xlsx) | Client-side Excel generation |
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
- **URL/key overrides**: Settings can paste a different URL + anon key (bring-your-own-Supabase); defaults baked from `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` (`.env.local`, gitignored)
- **Multi-user isolation**: verified E2E — account B sees 0 rows of account A, RLS blocks cross-account writes, realtime events never cross accounts

### 5. Local Auth with Multi-User
Users in localStorage `mm_users`. Session in `mm_session`. No server needed. Cloud login (Supabase) is separate and only used for Multi-Device Sync.

### 6. Future-Date Guard
Income/expense/investment entries cannot be dated after today. Dated picker capped via `max={todayStr()}`, submit validated with warning toast. Exempt: recurring start/end, task/todo due, investment maturity. Needed in: TransactionPage add/edit, Dashboard quick-add, Partners transaction modal.

### 7. Per-Type Categories
Categories are kept **separate** per transaction type — `mm_income_categories`, `mm_expense_categories`, `mm_investment_categories` + default base lists. Never merged across types (intentional: dropdowns stay relevant, budgets/breakdowns stay type-scoped).

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
- Add/Edit modals with searchable category + party dropdowns
- Search, filters (category/date/amount), sort, group by day/week/month
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
- Export/Import (PDF, Excel, JSON) — summary exports have no Savings column
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

### i18n
- `Reveal` component `transform` breaks `fixed` positioning — use `createPortal` for dropdowns
- Default language saved in `mm_language`
- `getDefaultLanguage()` returns `'mr'`

### Windows PowerShell
- `npm` runs fail under PS execution policy — use `cmd /c "npm run …"`

---

## Recent Changes

### v7.1.1.34 (2026-08-17) — Cloud Sync 2.0 (Supabase)
- **Migrated cloud sync CouchDB → Supabase** after the Railway CouchDB instance died (404 "Application not found").
- **Supabase project** `orpgmbrycnmjwtalupce` (ap-south-1, PG 17.6): `sync_docs` table (PK `(user_id,id)`, `data` jsonb, `updated_at`, `deleted_at`), RLS policies `sync_docs_own_{select,insert,update,delete}`, realtime publication, `mailer_autoconfirm: true`.
- **`pouchdb.ts`**: `signUpUser`, `connectRemote(url, key, email, password)`, `checkConnection`, `ensureConnected`, `disconnectRemote`, user-scoped `putDoc`/`removeDoc` (push upsert `onConflict user_id,id`), realtime subscription, `mm_sb_session`/`mm_sb_url`/`mm_sb_key` in localStorage, env fallback in `getConfig()`.
- **Settings**: URL + anon key auto-filled from `.env.local`; email + password inputs; "Create account & sync" / "Connect" / "Sync Now" / "Disconnect".
- **Verified E2E**: ping, push, pull, conflict-update, realtime event, delete, alice/bob isolation, RLS delete-block. All test users cleaned up.
- **Repo split**: new private repo `money-meva-online`; origin retargeted; old `money-meva` untouched at `dc965eb`.
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
- Categories page; category dropdown fixes; repo renamed `money-meva`.

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