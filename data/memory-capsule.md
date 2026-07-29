# Money Meva — Memory Capsule

**Version:** v7.1.1.24 (incremented on every build)
**Repository:** github.com/kuldeep7ke/money-meva
**Deployment:** Cloudflare Pages (auto-deploy on push to master)
**Android:** Capacitor APK via GitHub Actions (auto-build on push)
**Last Updated:** 2026-07-27

---

## Architecture Overview

### Stack
| Layer | Technology | Rationale |
|---|---|---|
| Framework | Next.js 16.2.9 (App Router) | Static export for cheap hosting; React 19 for latest features |
| Styling | Tailwind CSS v4 + CSS variables | Rapid prototyping; 3-brand theme via CSS custom properties |
| i18n | Custom hook + translations.ts | 3 languages (mr/hi/en), no external lib needed |
| Database | Dexie.js (IndexedDB wrapper) | Offline-first; no server needed; 9 tables with compound indexes |
| Sync | PouchDB ↔ CouchDB (live + manual) | Live sync with auto-reconnect (30s), manual "Sync Now" push+pull, skip_setup: false |
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
PouchDB → CouchDB is optional. Live sync with auto-reconnect (30s interval) keeps data in sync in real-time. Manual "Sync Now" does one-shot push+pull. Connection errors are logged but never kill the connection.

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

## Party Field in Transaction Forms

### Behavior
1. **Default state** — Input always shows "None" when no party is selected (both Add and Edit modals)
2. **No parties exist** → Just "None" displayed (no dropdown items)
3. **Parties exist** → Dropdown shows latest 3 most-used parties, with "None" as the first option
4. **Typing** → Searches all parties by name
5. **No match** → "Create Party (Name)" option appears
6. **Click Create** → Opens inline modal (group, type, description)
7. **Create & Select** → Party created via `addPartner()`, list refreshed, new party auto-selected
8. **Select "None"** → Clears `partnerAccountId` and `party` values

### Modal Behavior
- **No backdrop click-to-close**: All modals across the app (Add, Edit, Create Party, Duplicate Warning, Detail, PIN prompts, Install prompt, Calculator, Data/security notices) require explicit Cancel/X button dismissals
- Closed via dedicated buttons only — accidental outside clicks never lose form state

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

### Categories (`/dashboard/categories`)
- Three tabs: Income / Expense / Investment categories
- Reads from localStorage keys (`mm_income_categories`, `mm_expense_categories`, `mm_investment_categories`) + categories found in transaction records
- Inline edit, delete with confirmation, add new categories
- PIN-protected batch save — all changes saved at once to localStorage
- Default categories set during onboarding (profession-based), surfaced in transaction dropdowns via `recentCategories`

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

## Recent Changes (v7.1.1.23)

### UX Polish (2026-07-27)
- **Party field defaults to "None"**: Both Add and Edit forms now show "None" in the Party (Optional) input when no party is selected. A "None" option added as the first item in the party dropdown for both forms. Selecting "None" clears `partnerAccountId`.
- **No backdrop click-to-close on any modal**: Removed all `onClick` handlers from backdrop overlays across 9 files (TransactionPage, DataSafetyNotice, InstallPrompt, InvestmentCalculator, PinPrompt, PinSetupGuide, SecurityTipNotice, and all dashboard pages). Users must use explicit Cancel/X buttons to dismiss modals.

### File Changes
| File | Change |
|---|---|
| `src/components/TransactionPage.tsx` | Party field shows "None" default + "None" option in dropdown; removed backdrop onClick on Add, Edit, Create Party, Dup Warning, Detail modals |
| `src/app/dashboard/page.tsx` | Removed backdrop onClick on 8 modals (Add Money, Goal, Goal Tx, Task, Recurring, Quick Add Tx, Quick Add Party, Confirm) |
| `src/app/dashboard/adjustments/page.tsx` | Removed backdrop onClick |
| `src/app/dashboard/recurring/page.tsx` | Removed backdrop onClick |
| `src/app/dashboard/summary/page.tsx` | Removed backdrop onClick |
| `src/app/dashboard/partners/page.tsx` | Removed backdrop onClick on 4 modals (Add, Tx, Dup Warning, Ledger) |
| `src/app/dashboard/savings/page.tsx` | Removed backdrop onClick on Goal and Todo modals |
| `src/app/dashboard/settings/page.tsx` | Removed backdrop onClick on 4 modals (Clear, PIN Conf, Sync Fail, Import) |
| `src/components/DataSafetyNotice.tsx` | Removed backdrop onClick |
| `src/components/InstallPrompt.tsx` | Removed backdrop onClick |
| `src/components/InvestmentCalculator.tsx` | Removed backdrop onClick |
| `src/components/PinPrompt.tsx` | Removed backdrop onClick |
| `src/components/PinSetupGuide.tsx` | Removed backdrop onClick |
| `src/components/SecurityTipNotice.tsx` | Removed backdrop onClick |

## Recent Changes (v7.1.1.21)

### Bug Fixes & Categories Management (2026-07-27)
- **Category dropdown keyboard nav fixed**: ArrowDown can now reach the "Create" button in category dropdowns (add + edit modals). Enter key activates "Create" when highlighted instead of crashing. Both add and edit modal dropdowns fixed.
- **New categories persist in localStorage**: `saveCategoryToLocalStorage()` writes new categories to `mm_income_categories`/`mm_expense_categories`/`mm_investment_categories` on transaction add and edit.
- **All transaction categories shown in dropdown**: Removed `.slice(0,10)` limit from `recentCategories` — every category used in any transaction now appears in the dropdown.
- **Categories management page**: New `/dashboard/categories` page with Income/Expense/Investment tabs. Inline edit, delete with confirmation, add new. PIN-protected batch save to localStorage. Nav item added with `Tag` icon.
- **Repo renamed**: `money-meva-premium` → `money-meva`. All docs, git remote, and URLs updated.
- **`let cache` → `const cache`**: Fixed ESLint prefer-const warning in `store.ts`.

### File Changes
| File | Change |
|---|---|
| `src/app/dashboard/categories/page.tsx` | New page: category CRUD with PIN-protected save |
| `src/components/TransactionPage.tsx` | Keyboard nav fix for category dropdowns, `saveCategoryToLocalStorage()`, removed `.slice(0,10)` |
| `src/components/DashboardLayout.tsx` | Added Categories nav item with `Tag` icon |
| `src/lib/i18n/translations.ts` | Added `nav.categories` key for mr/hi/en |
| `src/lib/store.ts` | `let cache` → `const cache` |

## Recent Changes (v7.1.1.13)

### Bug Fixes & Enhancements (2026-07-20)
- **`_entity` → `entity` fix complete**: All PouchDB custom field references now use `entity` (not `_entity`). Backward compat retained in `pullAll` and `processRemoteChanges`.
- **Mobile UI refinements**: Minimal ledger list with tap-to-view detail modal across income/expenses/investments. Compact action buttons on small screens.
- **Import from File (JSON)**: Developer Zone now supports selecting a JSON export file, previewing tables, and bulk-importing into Dexie. Handles cross-user data reassignment.
- **Animated Icons**: Sync spinner, loading states, status dots, and nav indicators now use CSS animations (spin, bounce, pulse) for richer visual feedback.
- **Developer Zone page**: New `/dashboard/developer` page with session timer (auto-expires after 3 min idle), DB stats, localStorage inspector, sync diagnostics, raw JSON export, brand switcher, PIN viewer, and danger zone.
- **Session timer auto-redirect**: Developer Zone auto-navigates to dashboard after 180s inactivity, with live countdown display.

### File Changes
| File | Change |
|---|---|
| `src/app/dashboard/developer/page.tsx` | New Developer Zone with timer, import, diagnostics |
| `src/lib/pouchdb.ts` | `_entity` → `entity` everywhere, backward compat fallback |
| `src/lib/store.ts` | `processRemoteChanges` reads `doc.entity \|\| doc._entity` |
| `src/components/TransactionPage.tsx` | Mobile UI: compact layout, tap-to-view detail modal |
| `src/app/dashboard/expenses/page.tsx` | Mobile-responsive ledger view |
| `src/app/dashboard/income/page.tsx` | Mobile-responsive ledger view |
| `src/app/dashboard/investments/page.tsx` | Mobile-responsive ledger view |
| Various components | CSS animation classes added to key icons |
