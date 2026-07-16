# Money Meva Premium — Memory Capsule

**Version:** v7.1.0.10 (incremented on every build)
**Repository:** github.com/kuldeep7ke/money-meva-premium
**Deployment:** Cloudflare Pages (auto-deploy on push to master)
**Android:** Capacitor APK via GitHub Actions (auto-build on push)
**Last Updated:** 2026-07-17

---

## Architecture Overview

### Stack
| Layer | Technology | Rationale |
|---|---|---|
| Framework | Next.js 16.2.9 (App Router) | Static export for cheap hosting; React 19 for latest features |
| Styling | Tailwind CSS v4 + CSS variables | Rapid prototyping; 3-brand theme via CSS custom properties |
| i18n | Custom hook + translations.ts | 3 languages (mr/hi/en), no external lib needed |
| Database | Dexie.js (IndexedDB wrapper) | Offline-first; no server needed; 9 tables with compound indexes |
| Sync | PouchDB ↔ CouchDB (manual + 12hr auto) | Quota-saving: manual "Sync Now" button + auto-sync every 12 hours |
| State | In-memory cache + Dexie + PouchDB | Cache for instant reads, Dexie for persistence, PouchDB for sync |
| Auth | Fully local (localStorage) | No server dependency; multi-user with session switching |
| Security | One-time 4-digit PINs | Simple but effective; no PII stored remotely; auto-rotate after 10 uses |
| Mobile | Capacitor v8 (Android) | Wraps static Next.js output as native APK |
| Charts | Recharts | Lightweight, React-native charting |
| PDF Export | jsPDF + jsPDF-autotable | Client-side PDF generation |
| Excel Export | SheetJS (xlsx) | Client-side Excel generation |

### Why Not...
- **Supabase/Firebase** → Removed. Fully local-first with optional CouchDB sync.
- **Server components** → Cannot use. Dexie/PouchDB are browser-only. All pages `'use client'`.
- **Zustand/Redux** → Unnecessary. In-memory cache arrays + direct reads are simpler.
- **Prisma/SQLite** → Dexie is the only offline-capable option for browser storage.
- **react-i18next** → Unnecessary. Custom hook + translations.ts is simpler for 3 languages.

---

## Key Architectural Decisions

### 1. Data Flow Pattern
Every write: `id()` → cache → Dexie (fire-and-forget) → PouchDB (fire-and-forget) → mutation_log (fire-and-forget)

### 2. Soft-Delete Everything
Every entity has `deletedAt?: string`. Items disappear from active views, appear in Archive, auto-permanent-delete after 30 days.

### 3. transitionId System
Every entity gets a `transitionId` at creation. Links all mutations across lifecycle. Used in Audit Ledger.

### 4. Offline-First Sync
PouchDB → CouchDB is optional and manual-first. "Sync Now" does one-shot push+pull. Auto-sync every 12 hours.

### 5. Local Auth with Multi-User
Users in localStorage `mm_users`. Session in `mm_session`. No server needed.

---

## i18n System

### Languages
| Code | Name | Native Name | Default |
|---|---|---|---|
| mr | Marathi | मराठी | Yes |
| hi | Hindi | हिन्दी | No |
| en | English | English | No |

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
- **English loanwords only** for tech terms: Dashboard, Loading, Save, Sync, UPI, PIN, Google, Settings
- **Everyday words** for money: खर्च, बचत, पैसे, रक्कम, तारीख, श्रेणी, व्यवहार, उत्पन्न
- **No repetition** — vary word choice across keys (e.g., ध्येय not गोल for goals in Marathi)
- **Marathi hero**: "पैसे कुठे जातात? शोधूया." (relatable hook)
- **English footer**: Copyright always `© 2026 Money Meva.` in all languages

### Nav Labels (Marathi)
डॅशबोर्ड, उत्पन्न, खर्च, ध्येय, गुंतवणूक, पार्टी, आवर्ती, खाती, एडजस्टमेंट, सारांश, लेजर, आर्काइव्ह, सेटिंग्ज, माहिती, मदत, अटी, गोपनीयता

### Nav Labels (Hindi)
डैशबोर्ड, कमाई, खर्च, बचत, निवेश, पार्टी, आवर्ती, खाते, एडजस्टमेंट, सारांश, लेजर, आर्काइव्ह, सेटिंग्स, जानकारी, मदद, शर्तें, गोपनीयता

### Language Selector
- `src/components/LanguageSelector.tsx`
- Two variants: `default` (settings) and `minimal` (landing footer)
- Default uses `createPortal` to render at `document.body` — avoids parent `transform`/`overflow` clipping
- `fixed` positioning with `getBoundingClientRect()` for dropdown
- `z-[9999]` ensures dropdown above all content

---

## Party Field in Transaction Forms

### Behavior
1. **No parties exist** → Disabled "None" input shown
2. **Parties exist** → Dropdown shows latest 3 most-used parties
3. **Typing** → Searches all parties by name
4. **No match** → "Create Party (Name)" option appears
5. **Click Create** → Opens inline modal (group, type, description)
6. **Create & Select** → Party created via `addPartner()`, list refreshed, new party auto-selected

### Files
- `src/components/TransactionPage.tsx` — Party field in Add/Edit modals (lines ~789-843, ~903-955)
- `src/app/dashboard/partners/page.tsx` — Full partner management page

### Implementation Details
- `recentParties` — Computed from transactions, sorted by usage frequency
- `filteredParties` — Shows top 3 recent when empty, filters by search text
- `showCreateParty` state — Holds typed name when "Create Party" clicked
- `createPartyForm` state — Group, type, description for new party
- `handleCreateParty()` — Calls `addPartner()`, refreshes, auto-selects in form
- Works in both Add and Edit transaction modals

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

### Income / Expenses / Investments (`/dashboard/{type}`)
- Shared `TransactionPage` component
- Desktop: table with Date, Category, Description, Amount, Partner, Actions
- Mobile: minimal list with tap-to-view detail modal
- Add/Edit modals with searchable category + party dropdowns
- Search, filters (category/date/amount), sort, group by day/week/month
- Archive tab for soft-deleted items

### Partners (`/dashboard/partners`)
- Groups: Customer / Vendor / Contact
- P&L per partner, mini ledger with transaction history
- Add partner modal with group, type, initial investment

### Recurring (`/dashboard/recurring`)
- Active/stopped recurring transactions
- Frequency: daily, weekly, monthly, yearly, custom
- "Advance" button creates transaction, computes next date

### Settings (`/dashboard/settings`)
- Profile, PIN Security, Brand picker, Theme toggle
- Multi-Device Sync (CouchDB URL, Connect/Sync/Disconnect)
- Export/Import (PDF, Excel, JSON)
- Language selector with portal dropdown
- Danger Zone (clear data, PIN-protected)

### Landing Page (`/`)
- Animated hero with demo chart
- Feature highlights, stats, login/register CTAs
- Language selector in footer

---

## Build & Dev Commands

```bash
npm run dev                  # Next.js dev server
npm run build                # Static export to out/
npm run version:patch        # vX.Y.Z.N → vX.Y.Z.N+1
npx cap sync android         # Sync web to Android
npm run lint
```

---

## Sync Debug — From Scratch

### The Bug (Pushed 0 · Pulled 0)
`putDoc` added a `_entity` field to every PouchDB doc. PouchDB 9 rejects custom fields starting with `_` (only `_id`, `_rev`, `_deleted`, `_attachments`, `_conflicts` are allowed). Each `localDB.put()` threw `"Bad special document member: _entity"` — caught silently, so zero documents ever reached CouchDB.

### The Fix
Renamed `_entity` → `entity` everywhere:
- `src/lib/pouchdb.ts` — `putDoc`, `writePins`, index, `pullAll` filter/map
- `src/lib/store.ts` — `processRemoteChanges` reads `doc.entity || doc._entity`

Backward compat: `pullAll` and `processRemoteChanges` fall back to `doc._entity` for any docs already on remote CouchDB with the old field name. `entity` is stripped from the cache when writing to Dexie; it only lives on the PouchDB doc for entity-type identification.

---

## Known Gotchas

### PouchDB
- `db.type()` deprecated in PouchDB 9.x (harmless warning)
- `_`-prefixed custom fields (like `_entity`) rejected — use `entity` instead
- `skip_setup: false` — PouchDB auto-creates remote DB
- Sync errors silent — use `syncHandler.on('error')` for visibility

### Dexie
- Bulk operations: chunk at 500 items
- Compound indexes are comma-separated strings
- `db.table.put()` silent on failure (fire-and-forget)

### Next.js Static Export
- `output: 'export'` — no server-side features
- All pages must be `'use client'`
- Images unoptimized

### i18n
- `Reveal` component has `transform` which breaks `fixed` positioning — use `createPortal` for dropdowns
- Default language saved in `mm_language` localStorage
- `getDefaultLanguage()` returns `'mr'`

---

## Recent Changes (v7.1.0.10)

### Dashboard Enhancements (2026-07-17)
- **Tasks & Recurring 2-col grid**: Cards now split entries into two columns inside each card (`md:grid-cols-2`)
- **Transaction modals on action**: ✅/🔄 buttons open a form (type, amount, account, date, description) instead of directly creating ledger entries — user confirms before write
- **Removed Bills & Due card**: Consolidated — no separate Bills section on dashboard
- **Cleanup**: Removed dead reminder modal code, unused state/functions

### File Changes
| File | Change |
|---|---|
| `src/app/dashboard/page.tsx` | 2-col grid for entries, task/recurring modals, removed Bills card & dead code |

## Recent Changes (v7.0.0.19)

### Bug Fixes (Comprehensive Audit 2026-07-16)

#### Sync Fix (Pushed 6 · Pulled 0 → Working)
- **`_entity` → `entity` everywhere**: PouchDB 9 rejects custom `_`-prefixed fields. `putDoc()` silently failed on every write. Renamed to `entity` — now docs write and sync correctly. (`pouchdb.ts`, `store.ts`)

#### Critical Financial Fixes
- **Investment source double-counting**: Investment from non-cash sources (savings/adjustment/partner) now sets `account: 'invest'` — excluded from cash/bank balance. Only the fund-source entry affects cash balance. Fixes ₹2000 reduction for ₹1000 investment. (`TransactionPage.tsx:191-196`, `store.ts:947-949`)
- **Budget notifications ignore period**: `getBudgetNotifications()` now filters by `budget.period` (monthly/yearly), matching the period-specific budget calculation. Previously showed inflated percentages. (`store.ts:1052-1071`)
- **Sync skips remote deletes**: `processRemoteChanges()` now applies `deletedAt` from remote documents to local cache, ensuring deletes sync across devices. (`store.ts:423-442`)
- **Stale category data**: `getSortedCategories()` reads from in-memory store cache instead of deleted `localStorage` (which was cleared during v4 migration). (`utils.ts:41-53`)

#### i18n Additions
- New dashboard keys: `dashboard.available`, `dashboard.totalIncome`, `dashboard.totalExpenses`, `dashboard.investments`, `dashboard.partners` — all 3 languages (mr/hi/en)

### File Changes
| File | Change |
|---|---|
| `src/lib/store.ts` | Investment `account='invest'` filtering (cashBankTransactions), budget period filter, remote delete sync |
| `src/components/TransactionPage.tsx` | Investment account assignment by investSource |
| `src/lib/utils.ts` | getSortedCategories uses in-memory cache |
| `src/types/index.ts` | Account type widened to include `'invest'` |
| `src/lib/i18n/translations.ts` | New dashboard i18n keys for mr/hi/en |
| `src/app/dashboard/page.tsx` | useTranslation hook + translated cards |
