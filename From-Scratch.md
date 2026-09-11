# Money Meva — Build from Scratch Guide

A step-by-step blueprint for an AI agent to build this personal finance management app. Each section contains exact implementation details drawn from the working codebase.

---

## 1. Project Initialization

```bash
# Create Next.js app with TypeScript and App Router
npx create-next-app@latest money-meva --typescript --tailwind --eslint --app

# Install core dependencies
npm install dexie pouchdb-browser pouchdb-find \
  @supabase/supabase-js \
  clsx tailwind-merge \
  date-fns \
  lucide-react \
  recharts \
  jspdf jspdf-autotable \
  xlsx \
  docx

# Install dev dependencies
npm install -D @types/pouchdb-browser @types/pouchdb-find

# For Capacitor (Android app)
npm install @capacitor/cli @capacitor/core @capacitor/android \
  @capacitor/local-notifications @capacitor/status-bar @capacitor/app \
  @capacitor/filesystem @capacitor/share

npx cap init Money Meva com.moneymeva.app
npx cap add android
```

### Config Files

**`next.config.ts`** — Static export:
```ts
const nextConfig: NextConfig = {
  output: 'export',
  images: { unoptimized: true },
};
```

**`capacitor.config.ts`:**
```ts
const config: CapacitorConfig = {
  appId: 'com.moneymeva.app',
  appName: 'Money Meva',
  webDir: 'out',
  plugins: {
    LocalNotifications: { smallIcon: 'ic_stat_notify', iconColor: '#FF8A3D' },
    StatusBar: { style: 'DARK', backgroundColor: '#1e1b4b' },
  },
};
```

**`tsconfig.json`** — Add path alias:
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": { "@/*": ["./src/*"] }
  }
}
```

---

## 2. TypeScript Types (`src/types/index.ts`)

Define all data entities. Key types:

- **`Transaction`** — id, userId, transitionId, amount, type ('income'|'expense'|'investment'), category, description, date, account ('cash'|'bank'|'upi'), savingTag?, transferId?, partnerAccountId?, isRecurring, recurringId?, deletedAt?, createdAt, updatedAt
- **`PartnerAccount`** — id, userId, transitionId, name, type, group ('personal'|'services'|'financial'|'business'|'government'|'agriculture'|'office' — shared constants in `src/lib/parties.ts`), description, budgetWindowStart, budgetWindowEnd, initialInvestment, creditLimit?, creditSettleDays?, deletedAt?, createdAt, updatedAt
- **`RecurringTx`** — id, userId, transitionId, title, amount, category, txType, frequency, customIntervalDays?, startDate, endDate?, status, nextDate, reminderDays, deletedAt?, createdAt
- **`Budget`** — id, userId, transitionId, category, limit, period ('monthly'|'yearly'), deletedAt?, createdAt
- **`Reminder`** — id, userId, transitionId, title, description, dueDate, category, amount, frequency, status, deletedAt?, createdAt
- **`Adjustment`** — id, userId, transitionId, amount, accountType ('personal'|'partner'), partnerAccountId?, notes, date, sourceTransactionId?, sourceType? ('credit-purchase'|'credit-sale'), settleStatus? ('pending'|'settled'), settledAmount?, settleTransferId?, deletedAt?, createdAt
- **`Goal`** — id, userId, transitionId, name, target, saved, deletedAt?, createdAt
- **`MutationLog`** — id, transitionId, entityType, entityId, action, timestamp, userId, detail?
- **`WorkEntry`** — id, userId, transitionId, direction ('receivable'|'payable'), partyId?, partnershipId?, profile (WORK_PROFILES key), workType, crop?, season ('kharif'|'rabi'|'summer'|'annual'), year, area? {value, unit}, startDate, endDate?, agreedAmount, paidAmount, payments[] {id, date, amount, note?, linkedTransactionId?}, dueDate?, notes?, deletedAt?, createdAt, updatedAt
- **`Partnership`** — id, userId, transitionId, title, crop, season, year, members[] {id, partyId?, name, sharePct}, notes?, description?, deletedAt?, createdAt, updatedAt
- **`PartnershipEntry`** — id, userId, transitionId, partnershipId, type ('income'|'expense'), description, amount, date, paidByPartyId?, linkedTransactionId?, deletedAt?, createdAt, updatedAt
- **`ArchivedItem`** — id, type, label, subtitle, amount, deletedAt, original
- **`UserProfile`** — id, full_name, currency, onboarding_completed, email?, phone?, monthly_income?, etc.

Use `TransactionType = 'income' | 'expense' | 'investment'`, `ReminderFrequency`, `MutationAction`, `ArchiveItemType`.

> **Note:** There is no `saving` transaction type. Savings goals track their own `saved` balance; goal contributions are recorded as `expense` transactions and withdrawals as `income`. Categories are kept separate per type (`mm_income_categories`, `mm_expense_categories`, `mm_investment_categories`) — they are never merged across types.

---

## 3. Database Layer (`src/lib/db.ts`)

Uses **Dexie.js** (IndexedDB wrapper) for offline-first storage.

```ts
class MoneyMevaDB extends Dexie {
  transactions!: Table<Transaction, string>;
  partners!: Table<PartnerAccount, string>;
  recurring!: Table<RecurringTx, string>;
  budgets!: Table<Budget, string>;
  reminders!: Table<Reminder, string>;
  adjustments!: Table<Adjustment, string>;
  goals!: Table<Goal, string>;
  works!: Table<WorkEntry, string>;
  partnerships!: Table<Partnership, string>;
  partnership_entries!: Table<PartnershipEntry, string>;
  mutation_log!: Table<MutationLog, string>;
}
```

**Schema (version 5)** — two migrations:

`version(4)` — core tables:
| Table | Indexes |
|---|---|
| transactions | id, type, date, category, userId, deletedAt, account, transitionId |
| partners | id, group, userId, deletedAt, transitionId |
| recurring | id, txType, status, userId, deletedAt, nextDate, transitionId |
| budgets | id, category, userId, deletedAt, transitionId |
| reminders | id, status, userId, deletedAt, transitionId |
| adjustments | id, accountType, userId, deletedAt, transitionId |
| goals | id, name, userId, deletedAt, transitionId |
| mutation_log | id, transitionId, entityType, entityId, action, timestamp, userId |

| Table | Indexes |
|---|---|
| works | id, direction, partyId, partnershipId, profile, crop, status, userId, deletedAt, transitionId |
| partnerships | id, crop, season, year, userId, deletedAt, transitionId |
| partnership_entries | id, partnershipId, type, date, paidByPartyId, userId, deletedAt, transitionId |

---

## 4. State Management (`src/lib/store.ts`)

**Pattern:** In-memory cache + Dexie writes + PouchDB sync.

### Architecture

```
┌─────────────────────────────────────────────────┐
│                React Components                  │
│  (call store functions on user actions)          │
└──────────┬──────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────┐
│              Store Layer (store.ts)              │
│                                                   │
│  ┌─────────────┐   ┌──────────┐   ┌──────────┐ │
│  │ In-Memory    │   │  Dexie   │   │ PouchDB  │ │
│  │ Cache (sync) │──▶│ (local)  │──▶│ (sync)   │ │
│  └─────────────┘   └──────────┘   └──────────┘ │
└─────────────────────────────────────────────────┘
```

### Key Concepts

- **`initDB()`**: Call once on app mount. Migrates from legacy localStorage, hydrates cache from Dexie, deduplicates partners, starts PouchDB sync.
- **Unified CRUD pattern** for every entity type:
  1. Generate `id` (timestamp+random) and `transitionId` (`tr_` + timestamp+random)
  2. Push to in-memory cache array
  3. Write to Dexie table (fire-and-forget `.catch(() => {})`)
  4. Write to PouchDB (fire-and-forget)
  5. Log mutation to `mutation_log` table
- **Cache-first reads**: `getTransactions()`, `getPartners()`, etc. read from in-memory arrays for instant UI.
- **Soft-delete** pattern: set `deletedAt` timestamp instead of removing. Permanent delete removes from cache + Dexie.
- **Archive auto-cleanup**: Items deleted >30 days are auto-removed (unless marked "keep forever").

### ID Generation

```ts
function id() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
function transitionId() { return 'tr_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
```

### Important Store Functions

| Function | Purpose |
|---|---|
| `addTransaction()` / `updateTransaction()` / `deleteTransaction()` | CRUD with sync |
| `addPartner()` / `getPartnerPnL()` | Party accounts with P&L |
| `addRecurring()` / `advanceRecurring()` | Recurring with next-date computation. Category suggestions are type-aware: the add modal swaps expense bases (Bills/Premium/…) for income bases (Salary/Business/…) and clears the selection when `txType` changes (`useSortedCategories` recomputes on `[type]`) |
| `setBudgets()` / `upsertBudget()` | Budget management |
| `addReminder()` / `completeAndRescheduleReminder()` | Reminders with frequency |
| `addAdjustment()` / `updateAdjustment()` / `deleteAdjustment()` / `restoreAdjustment()` | Balance corrections + credit payment tracking (all push via `syncWriteDoc('adjustments', …)`) |
| `markCreditAdjustmentsSettled()` | FIFO-settles linked credit adjustments after a party settle/receive (partial stays Pending, full flips to Settled) |
| `backfillCreditAdjustments()` | Idempotent backfill in `initDB()`: creates payment-pending adjustments for existing credit entries, replays clearance history |
| `getPartnerCreditStats()` / `getPartnerCreditBalance()` | Outstanding, limit pct used, limit state, due date/state per partner (FIFO queue over credit txs) |
| `addGoal()` / `updateGoal()` | Savings goals |
| `getAggregates()` / `getMonthlySummary()` / `getCarryForward()` | Dashboard calculations |
| `getAllNotifications()` | Combined notifications |
| `getAllArchivedItems()` / `restoreArchivedItem()` / `permanentDeleteAllArchived()` | Archive |

---

## 5. Authentication (`src/lib/localAuth.ts`)

**Fully local** — no server. Uses `localStorage` for multi-user support.

### Storage Keys
- `mm_users` — Array of `LocalUser` objects (id, email, password, full_name, onboarding state, etc.)
- `mm_session` — Currently logged-in user (password excluded)

### Functions
- `registerUser(email, password, fullName)` — Creates user, sets active session
- `loginUser(email, password)` — Validates credentials, creates session
- `logoutUser()` — Clears session
- `switchUser(userId)` — Multi-user switching
- `getAllUsers()` — Returns all users (passwords stripped)
- `removeUser(userId)` — Deletes a user
- `updateProfile(userId, updates)` — Updates profile fields
- `getSession()` — Returns current user from localStorage

### Auth Provider (`src/components/AuthProvider.tsx`)
React context that wraps the app. Provides `user`, `profile`, `loading`, `signOut`, `refreshAuth`. On mount, reads session from localStorage and sets the user ID.

---

## 6. PIN Security System (`src/lib/pinStore.ts`)

One-time-use 4-digit PINs for sensitive operations.

### Flow
1. User generates 10 random PINs (shown only once)
2. Each PIN can be used exactly once
3. Used index is tracked — no PIN is reused
4. After all 10 are consumed, they auto-rotate back to index 0

### Session Auto-Lock
- Configurable timeout (1h–24h, or disabled)
- `checkAndLock()` compares last activity time vs current time
- Lock triggers PIN prompt before allowing access

### Keys in localStorage
- `mm_pins` — Array of 10 PIN strings
- `mm_pins_used_idx` — Current position in the PIN array
- `mm_pins_shown` — Whether PINs have been displayed to user
- `mm_auto_lock_minutes` — Auto-lock timeout
- `mm_last_activity` — Timestamp of last user activity
- `mm_locked` — Whether session is locked

### Functions
- `generatePins()` — Creates 10 unique 4-digit PINs
- `validatePin(pin)` — Validates against next available PIN, advances index
- `getRemainingPins()` — Count remaining PINs
- `checkAndLock()` — Returns true if session should be locked

---

## 7. UI & Theming

### Tailwind CSS v4 (`src/app/globals.css`)

```css
@import "tailwindcss";
@custom-variant dark (&:where(.dark, .dark *));

@theme inline {
  --color-brand: var(--brand);
  --color-brand-secondary: var(--brand-secondary);
  --color-brand-light: var(--brand-light);
  --color-brand-dark: var(--brand-dark);
  --color-brand-muted: var(--brand-muted);
}
```

### Brand Colors (3 themes)
| Brand | Primary | Secondary | Light | Dark | Muted |
|---|---|---|---|---|---|
| Orange (default) | #FF8A3D | #FFCF9A | #FFF6EC | #1B1B1D | #3D332F |
| Royal Blue | #1E40AF | #FCD34D | #FFF7ED | #0F172A | #1E3A5F |
| Emerald Green | #047857 | #FCD34D | #FFF7ED | #0F2918 | #064E3B |

Brand applied via CSS class on `<html>`: `brand-blue` or `brand-green`.

### Theme Provider (`src/components/ThemeProvider.tsx`)
React context providing `theme` (light/dark), `brand` selection, and `toggle` function. Persisted to localStorage (`mm_theme`, `mm_brand`).

### Animation Utilities
```css
.slide-up { animation: slideUp 0.6s ease-out both; }
.slide-up-0 { animation: slideUp 0.6s ease-out 0s both; }
.slide-up-1 { animation: slideUp 0.6s ease-out 0.1s both; }
.slide-up-2 { animation: slideUp 0.6s ease-out 0.2s both; }
.slide-up-3 { animation: slideUp 0.6s ease-out 0.3s both; }
.slide-up-4 { animation: slideUp 0.6s ease-out 0.4s both; }
.slide-up-5 { animation: slideUp 0.6s ease-out 0.5s both; }
.slide-up-6 { animation: slideUp 0.6s ease-out 0.6s both; }
.slide-up-7 { animation: slideUp 0.6s ease-out 0.7s both; }

@keyframes slideUp {
  from { opacity: 0; transform: translateY(30px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* Icon animations */
.icon-pulse { animation: pulse 1.5s ease-in-out infinite; }
.icon-spin  { animation: spin 1s linear infinite; }
.icon-bounce { animation: bounce 0.6s ease infinite; }
.icon-float { animation: float 2s ease-in-out infinite; }
.icon-glow  { animation: glow 1.5s ease-in-out infinite; }

@keyframes pulse  { 0%,100%{opacity:1} 50%{opacity:0.5} }
@keyframes spin   { to{transform:rotate(360deg)} }
@keyframes bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
@keyframes float  { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-3px)} }
@keyframes glow   { 0%,100%{filter:brightness(1)} 50%{filter:brightness(1.4)} }
```

Staggered animations can be applied inline to avoid class-merging conflicts:
```tsx
style={{ animation: `slideUp 0.6s ease-out ${i * 0.1}s both` }}
```

### Reusable UI Component (`src/components/ui/button.tsx`)
Use `clsx` + `tailwind-merge` for class merging.

### Utility Functions (`src/lib/utils.ts`)
- `cn(...inputs)` — Combines `clsx` + `tailwind-merge`
- `formatCurrency(amount)` — Formats INR with `Intl.NumberFormat('en-IN')`
- `useInView(threshold)` — IntersectionObserver hook for scroll animations
- `getSortedCategories()` — Categories sorted by usage frequency (most-used first)

---

## 8. Page Structure

### App Router Layout

```
src/app/
├── layout.tsx              # Root layout: ThemeProvider + I18nProvider + ToastProvider + AuthProvider + RegisterSW
├── page.tsx                # Landing page (marketing, demo chart, Login/Register CTA)
├── loading.tsx             # Global loading skeleton
├── globals.css             # Tailwind v4 + brand variables + animations
├── login/page.tsx          # Login/Register page with multi-user switching
├── onboarding/page.tsx     # 6-step wizard (Personal Info → Financial Profile → Work → Partners → Savings Goal → Complete)
├── terms/page.tsx          # Terms & Conditions (public, no auth required)
├── privacy/page.tsx        # Privacy Policy (public, no auth required)
├── auth/callback/page.tsx  # Auth callback (legacy, kept for compatibility)
│
└── dashboard/
    ├── page.tsx            # Dashboard: summary cards, charts, recent txns, recurring grid, goals
    ├── layout.tsx          # DashboardLayout wrapper (see below)
    ├── income/page.tsx     # Income CRUD (wraps TransactionPage)
    ├── expenses/page.tsx   # Expenses CRUD (wraps TransactionPage)
    ├── investments/page.tsx# Investments CRUD (wraps TransactionPage)
    ├── savings/page.tsx    # Goals (goals grid with contribute/withdraw + progress)
    ├── partners/page.tsx   # Party accounts with P&L, mini-ledger modal, edit support + Partnership (भागीदारी) tab
    ├── works/page.tsx      # Work register (कामे): direction, crop/season/area, pending payments, payment history
    ├── accounts/page.tsx   # Account overview
    ├── categories/page.tsx  # Categories CRUD with tabs, inline edit/delete, PIN-protected batch save
    ├── adjustments/page.tsx # Balance corrections
    ├── recurring/page.tsx  # Recurring transactions management + tabs (Income/Expense/Investment/Notifications/History)
    ├── ledger/page.tsx     # Audit log — mutation history with filters, CSV export
    ├── summary/page.tsx    # Charts: cash flow, spending breakdown, month-by-month
    ├── archive/page.tsx    # Soft-deleted items: restore, permanent delete, empty all
    ├── settings/page.tsx   # PIN setup, sync config, export/import, themes, brand, auto-lock, clear data
    ├── developer/page.tsx  # AUTHOR-ONLY tool (never advertised in nav/docs) — see "Developer Page" below
    ├── account/page.tsx    # PIN-gated password change and user management
    ├── support/page.tsx    # Contact support (Telegram, email, website)
    ├── about/page.tsx      # App info, version, edit profile
    ├── privacy/page.tsx    # Privacy (dashboard version)
    └── terms/page.tsx      # Terms (dashboard version)
```

### Dashboard Layout Wrapping

Each dashboard page wraps its content in `<DashboardLayout>` component (NOT a Next.js layout file). The `DashboardLayout` handles:

1. Auth guard — redirects to `/login` if no session
2. Onboarding guard — redirects to `/onboarding` if not completed
3. InitDB — calls `initDB()` on mount, shows loading skeleton until ready
4. Desktop sidebar nav (collapsible)
5. Mobile bottom FAB (floating action button, filtered nav items)
6. Dark/light theme toggle
7. PIN lock check — `checkAndLock()` on navigation
8. Auto-lock — `updateLastActivity()` on click
9. InstallPrompt component (PWA install)
10. StatusBar (Capacitor native)
11. `store-ready` event dispatch (for child components to refresh)

### TransactionPage Component (`src/components/TransactionPage.tsx`)

A reusable CRUD page used by Income, Expenses, and Investments.

**Features:**
- Add modal with form (amount, category, description, date, account type, partner)
- Duplicate detection on save
- PIN-protected edit for non-today entries
- PIN-protected delete
- Inline search + filter panel (category, date range, amount range)
- Sort by date/amount, ascending/descending
- Group by day/week/month
- Desktop table view
- Mobile minimal list view (icon + description + date + amount) with **category badge** (slate pill) + **account badge** (Cash/Bank/UPI/Invest, colored) beside the date — shared `ACCOUNT_BADGE` map in `TransactionPage.tsx`; works in the Android APK
- Tap-to-view detail modal on mobile (full info)
- Archive view with restore permanent delete
- **30-day default date filter** (`filterDateFrom` = local-tz date − 30 days on init; "Clear Filters" resets to show all)

**Future-date guard:** Income/expense/investment entries cannot be dated in the future. Date inputs use `max={today}`, and submit handlers validate with a warning toast (a shared `todayStr()` helper in each file). Recurring start/end dates and investment maturity dates are exempt.

**Empty states:** When no transactions exist, mobile/desktop views and the archive show an icon + heading + hint ("Click + Add to record your first ...") instead of bare text. Ledger uses animated skeleton rows while loading.

**Toast feedback:** Pages use the global `useToast()` hook (`src/components/Toast.tsx`, provider in root layout) — no native `alert()` calls anywhere.

**Category dropdown:** Reads from localStorage keys (`mm_income_categories`, `mm_expense_categories`, `mm_investment_categories`) merged with categories found in existing transactions. `saveCategoryToLocalStorage()` persists new categories on add/edit. No `.slice(0,10)` limit — all used categories appear. Keyboard navigation (ArrowDown/Enter) reaches the inline "Create" button in both add and edit modals.

**Party field:** Shows "None" by default in both Add and Edit modals when no party is selected. A "None" option is the first item in the party dropdown. Selecting "None" clears `partnerAccountId` and `party` values.

**Credit settlement rows:** Real cash/bank/UPI `Credit Settlement` legs are hidden from the list (`isRealSettlementLeg`) but still affect account balances + party ledger. Informational clearing rows on the opposite side show as visible entries with an amber **"Credit settled"** badge (`isCreditSettlementRow`). The section footer total excludes ALL `Credit Settlement` rows (`sectionTotal` filters them out) — including on the "Credit only" filter chip, which shows just the credit-account rows.

**Credit entry tips:** The add modal's account selector shows context hints when the account is `credit` — a credit purchase "counts in expenses now" and "a payment-pending adjustment is added; settling updates it to paid"; a credit sale mirrors that for income. Hints are the i18n keys `credit.notePurchasePending` / `credit.noteSalePending` (and the settled variants) in mr/hi/en.

**Modal behavior:** No modal closes when clicking outside/on the backdrop overlay. Users must use explicit Cancel/X buttons to dismiss any modal (Add, Edit, Create Party, Duplicate Warning, Detail, or any popup across the app).

---

### Developer Page (`src/app/dashboard/developer/page.tsx`) — AUTHOR-ONLY

An internal diagnostic/tool page for the owner. It is **not** linked in the sidebar
nav (`DashboardLayout`) and is **not** documented for users in README/guides/info
files — the only references live here, in `From-Scratch.md`, and in the memory
capsule. Arranged top → bottom:

1. **Header** — live app version (`<meta name="app-version">`), release-notes
   version + `getLastSeenVersion()` status, and an inactivity timer readout.
2. **Data Management** — import a JSON/XLSX backup (file → preview rows → Import);
   Export Raw Data (JSON); Custom Export with optional from/to dates and selectable
   sections (Income, Expenses, Investments, Categories, Party, Recurring, Works,
   Goals, Accounts, Partnership) as Excel (XLSX) or re-importable JSON.
3. **Database & Cloud Sync** — "Quick Connect" to any Supabase URL + anon key in
   **anonymous** mode (requires "Anonymous sign-ins" enabled in the Supabase
   dashboard) or email/password mode. The connection is *temporary* and never
   overwrites the Settings config. Shows masked current config, **Remote Data**
   (Load Stats per entity / Browse Rows — this account's rows only; not-connected
   guards), and Pull Remote → Local / Push Local → Remote.
4. **Diagnostics** — Sync Health (masked URL, sync account, status, last sync event
   via `getLastSyncEvent()`), **Test Connection** button, Local Database stats for
   all 11 tables (friendly labels via `dbLabel()`), storage usage, localStorage
   key/value inspector.
5. **Danger Zone** — notice box (cannot be reversed; export first; disable cloud
   sync on other devices) + compact button row: Start Fresh (Clear Remote + Push
   Local), Clear Remote Only, Clear Local Only, Clear ALL Data (Local + Remote).
   Every destructive/sync action is two-stage confirmed (in-app modal, no native
   `confirm()`) and guarded against running while offline.

---

## 9. Default Categories (`src/lib/defaultCategories.ts`)

Per-profession categories:

| Profession | Income Categories | Expense Categories |
|---|---|---|
| Salaried | Salary, Freelance, Bonus, Refund, Gift | Food, Transport, Rent, Bills, Shopping, Entertainment, Health, Education, Dining Out, Groceries, Subscription, EMI, Insurance, Tax |
| Business | Sales Revenue, Client Payment, Investment Income, Refund | Plus Software, Inventory, Marketing, Travel, Salary |
| Freelancer | Client Project, Consultation, Retainer, Royalty, Refund | Software, Equipment, Travel + shared |
| Student | Allowance, Part-time Job, Scholarship, Gift, Refund | Education + shared (no EMI/Insurance/Tax) |
| Homemaker | Allowance, Rental Income, Gift, Refund | Groceries + shared |
| Retired | Pension, Investment Income, Rental Income, Gift, Refund | Insurance + shared |
| Investor | Dividend, Capital Gains, Interest, Rental Income, Refund | Brokerage + shared |
| Medical | Consultation, Procedure, Hospital, Refund | Equipment + shared |

All sets get "Other" appended.

`src/lib/defaultCategories.ts` also defines the **work profiles** (`WORK_PROFILES`) that drive the Works page. Each onboarding profession maps to a matching work profile (via `profileForProfession`, with `workProfilesForProfession` surfacing the user's profiles first):

| Onboarding profession | Default work profile | Work-type examples |
|---|---|---|
| `salaried` | employee | Salary, Overtime, Commission, Bonus, Advance, Reimbursement |
| `business` | shop (+ employer) | Supply Order, Delivery, Installation, Repair Job |
| `freelancer` | freelancer | Project Work, Consulting, Retainer, Royalty, Hourly Work |
| `student` | student | Part-time Job, Internship, Tuition, Freelance Help |
| `homemaker` | homemaker | Household Work, Rental Income, Catering, Handicraft Sale |
| `investor` | investor | Trading, Dividend Income, Capital Gains, Interest Income |
| `retired` | retired | Pension, Part-time Work, Consulting, Rental Income |
| `farmer` | farmer | Land Prep, Sowing, Spraying, Harvesting, Produce Sale… |
| `other` | general | Freelance Task, Commission Work, Home Repair |

`employer` (Payroll, Contractor Payment, Material Purchase, Invoice Out, Labour) is offered to both `salaried` and `business` users. In the Works add-form the farmer-specific fields (crop, season, year, area) render **only** for the `farmer` / `farm_services` profiles.

---

## 10. Cloud Sync (`src/lib/pouchdb.ts`)

### Architecture

```
Device A (PouchDB) ──push/pull──→ Supabase sync_docs (RLS per user) ←──realtime── Device B (PouchDB)
       │                                │
  IndexedDB                         cloud hub + backup
```

- **Local buffer**: PouchDB instance named `mm_pouch` with compound index on `[entity, updatedAt]`
- **Cloud hub**: Supabase `sync_docs` table (PK `(user_id, id)`, `data` jsonb) — see `supabase/schema.sql`
- **Auth**: Supabase Auth — email + password; JWT session stored under `sb-<project-ref>-auth-token` (Supabase JS standard key)
- **Isolation**: Row-Level Security (`auth.uid() = user_id`) — cross-account access impossible
- **Live updates**: realtime subscription on `sync_docs_realtime` (replica identity full)

### Entity Mapping (verified v7.2.0)
Every Dexie entity syncs to the single `sync_docs` table as a JSON document. Doc id = `entityType:id`; cloud row id is identical; `entity` column holds the EntityType.

| Dexie table | EntityType | Doc id | Write paths that sync |
|---|---|---|---|
| transactions | transaction | `transaction:<id>` | add, update, soft-delete, restore |
| partners | partner | `partner:<id>` | same |
| recurring | recurring | `recurring:<id>` | same + advance/skip/pause/resume |
| budgets | budgets→budget | `budget:<id>` | upsertBulk, add, update, delete/restore |
| reminders | reminder | `reminder:<id>` | add, update, complete+reschedule, delete/restore |
| adjustments | adjustment | `adjustment:<id>` | add, update, soft-delete/restore |
| goals | goal | `goal:<id>` | add, contribute/update, delete/restore |
| works | work | `work:<id>` | addWork, updateWork (incl. payments), delete/restore |
| partnerships | partnership | `partnership:<id>` | addPartnership, updatePartnership, delete/restore |
| partnership_entries | partnership_entry | `partnership_entry:<id>` | add/delete/restore entry |
| mutation_log | mutation_log | `mutation_log:<id>` | audit entry push with transitionId

- **Soft deletes** push the full updated row (`deletedAt` set). **Permanent deletes** push a tombstone `{ id, deletedAt }` via `putDoc` in `deleteFromCacheAndWrite`.
- **PINs** sync as one doc: `pin:batch` (`entity: 'pin'`) via `writePins()` / `pullPinsFromRemote()`.
- **Audit sync**: `mutation_log` entries are pushed to PouchDB and sync across devices as `mutation_log:<id>` docs (last-write-wins by timestamp), so the ledger is consistent on every device.
- **Local-only by design**: localStorage preferences (language, theme, quotas, dismissed notices, seen-release marker).
- Supabase-side schema comment lists these entities too — see `supabase/schema.sql`.

### Key Functions

| Function | Purpose |
|---|---|
| `getConfig()` | `{ url, key }` from obfuscated defaults in `env.ts` or localStorage override (`mm_pouch_url` / `mm_sync_key`) |
| `initPouchDB()` | Creates local PouchDB instance, creates indexes |
| `signUpUser(url, key, email, password)` | Creates Supabase account + connects |
| `connectRemote(url, key, email, password)` | Signs in, pushes local buffer, subscribes to realtime, pulls |
| `disconnectRemote()` | Stops realtime subscription, clears session |
| `checkConnection()` | Validates session + ping; **self-healing** — if the session looks dead (expired token), recreates the client, `getSession()` auto-refreshes, re-pings, re-subscribes; never returns false on a recoverable state |
| `ensureConnected()` | Re-subscribes if session exists but subscription dropped |
| `putDoc(entity, data)` | Writes doc to local PouchDB + pushes to Supabase (`onConflict user_id,id`) |
| `removeDoc(entity, id)` | Removes doc from local PouchDB + upserts `deleted_at` on cloud |
| `pullAll()` | Fetches own rows from Supabase, maps to PouchDB docs |
| `clearPouch()` | Destroys local DB, reinitializes |
| `onRemoteChange(fn)` | Subscribes to realtime changes (live UI updates) |

### Reconnect Strategy
- 30-second interval timer (`RECONNECT_INTERVAL`)
- Detects dead sessions (supabase set but no user) → recreates client → `getSession()` auto-refreshes the token → ping → re-subscribe → `notifyChange()` → dispatches sync event (`'complete'`, "Sync reconnected")
- `ensureConnected()` re-establishes the realtime subscription using the stored session
- **Settings page listens via `listenSyncEvents()`** and re-runs `checkConnection()` on every sync event — the Connect/Sync-Now UI follows actual connection state instead of going stale (fixes Android APK flicker between "Sync Now" and the create-account form)

### Periodic Pull (in store.ts)
Every 2 minutes, calls `processRemoteChanges()` which:
1. Checks connection (`checkConnection()`)
2. Pulls own rows from Supabase
3. Maps rows to PouchDB docs, reads all docs with `entity`
4. Merges into cache (respects `updatedAt` timestamps — skips if local is newer)

### Sync Flow (Settings Page)
1. URL + anon key pre-filled from env (`mm_pouch_url` / `mm_sync_key` overrides allowed)
2. User enters email + password → **Create account & sync** (`signUpUser`) or **Connect** (`connectRemote`)
3. Session saved to localStorage
4. Status indicators: idle → connecting → connected / error
5. Sync failure toast after consecutive errors
6. Disconnect button + confirmation (local data stays)

---

## 11. Activity Log (`src/lib/activityLog.ts`)

Simple localStorage-based activity tracker. Max 200 entries.

```ts
type ActivityType = 'pin_used' | 'login' | 'login_failed' | 'logout' | 'register'
  | 'session_lock' | 'session_unlock' | 'auto_lock_off' | 'data_cleared'
  | 'entry_created' | 'entry_deleted' | 'entry_restored' | 'entry_edited'
  | 'entry_exported' | 'entry_imported';
```

Storage key: `mm_activity_log`

---

## 12. Export/Import (`src/lib/export.ts` + `src/lib/download.ts`)

| Function | Format | Libraries |
|---|---|---|
| `exportSummaryPDF()` | PDF with auto-table | `jspdf`, `jspdf-autotable` |
| `exportAllDataPDF()` | PDF of all transactions | `jspdf`, `jspdf-autotable` |
| `exportSummaryExcel()` | Excel (.xlsx) | `xlsx` |
| `exportAllDataExcel()` | Excel of all transactions | `xlsx` |
| JSON export (in Settings) | Full JSON backup | Built-in JSON |
| JSON import (in Settings) | Cross-user detection + reassignment | Built-in JSON |

All exports funnel through `downloadBlob()` in `src/lib/download.ts`:
- **Web:** `navigator.share({ files })` when available, else blob-URL + anchor click
- **Android (Capacitor):** blob → base64 → `Filesystem.writeFile` to `Cache/exports/` → `Filesystem.getUri` → **native share sheet** (`@capacitor/share`), file auto-deleted after 60s. Blob-URL anchor downloads do NOT work inside the WebView — this is why the native path is required.

---

## 13. Notifications (`src/lib/capacitor-notifications.ts`)

- Uses `@capacitor/local-notifications` for native Android notifications
- `initLocalNotifications()` — Requests permissions
- `syncLocalNotifications()` — Checks for new in-app notifications, schedules up to 3 native notifications
- Only fires on native Capacitor platform (`Capacitor.isNativePlatform()`)

### In-App Notification Types (from `getAllNotifications()`)
| Type | Trigger | Severity |
|---|---|---|
| Recurring due | `nextDate` within reminder days | danger/warning/info |
| Archive alert | Most recent archived item | info |
| Budget overrun | ≥80% of limit used | danger (≥100%) / warning (≥80%) |
| Overdue reminders | `dueDate <= today` | info |
| Weekend backup | Saturday/Sunday (once per day) | warning |

### Remote Announcements (jsonbin.io + edge cache)
Broadcast pills and banner modals are remote-config — owner edits JSON on jsonbin.io, all users (web + installed APKs) get changes within ~10 min, no app updates.

```
jsonbin.io bins ──origin fetch──> functions/api/announcements.js (Cloudflare Pages Function, 10-min edge cache) ──/api/announcements?type=…──> BroadcastBanner.tsx / BannerModal.tsx
```

- **Quota protection**: every device hits the site's own `/api/announcements` endpoint; the Pages Function edge-caches responses for `TTL_MINUTES` (currently 10), so jsonbin is fetched at most ~6×/hour/bin regardless of user count (~290/day combined ≈ 8.6k/month worst case — near the 10k free cap; raise `TTL_MINUTES` to 20–30 if quota warnings appear). Bin IDs live server-side in the Function (optional Pages env vars override hardcoded fallbacks)
- **Config** (`src/lib/env.ts`): `BROADCAST_BIN_ID` / `BANNER_BIN_ID` / `JSONBIN_BASE` / `ANNOUNCEMENTS_API` stored as XOR+base64 obfuscated strings (`_K` = 'moneymeva', decoded at runtime via `_d()`) — no plain-text IDs or URLs in shipped bundles
- **Fetch**: proxy first (`ANNOUNCEMENTS_API?type=broadcast|banner`, default HTTP caching), then direct jsonbin fallback (`?t=${Date.now()}` + `cache: 'no-store'`) if the proxy fails; unwrap response via `res?.record ?? res`
- **Broadcast pill**: floating pills top-center over the **content area** — fixed wrapper centers via `fixed left-1/2 md:left-[calc(50%+8rem)] -translate-x-1/2 z-[9998]` (`md:` offset = half the `w-64` sidebar, so desktop pills sit over content, not the sidebar), stacked 44px apart via inline `top: 8 + i*44`. The **pill itself carries NO positioning** — only the swipe-to-dismiss `transform: translateX(dragX)` — so centering and drag motion can never conflict. Color-coded by `type`, optional clickable `link`, per-ID dismissal (`mm_dismissed_broadcasts`), `pinned` = no dismiss, swipe-left ≥70px dismisses; JSON is an array of objects; fetched list cached at module level (no refetch on navigation)
- **Tailwind v4 gotcha (v7.3.0.25)**: do NOT apply a `-translate-x-1/2` class and an inline `translateX(calc(-50% + …))` on the same element. v4 implements translate utilities via the independent CSS `translate` property, so the class and the inline style **add up** instead of the inline replacing the class (v3 behavior) — the pill rendered a full-width off-center. Rule: keep centering on a wrapper, keep motion on the child.
- **Banner modal**: full-screen overlay (`z-[10000]`), skeleton card while fetching, centered card with title/content/image/href/width, countdown (7s) starts only after the banner fully displays (waits for image `onLoad`, with cached-image `complete` check + `onError` fallback), X top-right enables at 0; shows once per app load via module flag `bannerShownThisLoad` — resets on real refresh/reload only; scheduled via inclusive local-day `startDate`/`expires` through `isWithinPeriod()` in `utils.ts`
- Full field reference: `docs/BROADCAST-GUIDE.md`

---

## 14. PWA Setup

**`public/manifest.webmanifest`**:
```json
{
  "name": "Money Meva",
  "short_name": "Money Meva",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#FFF6EC",
  "theme_color": "#FF8A3D",
  "icons": [...]
}
```

**Root layout** includes:
```tsx
<meta name="apple-mobile-web-app-capable" content="yes" />
<link rel="apple-touch-icon" href="/icon-512.png" />
```

**`InstallPrompt` component** (`src/components/InstallPrompt.tsx`):
- Listens for `beforeinstallprompt` event
- Suppresses default browser banner (`preventDefault()`)
- Shows a custom install button (guarded: not in Capacitor, not standalone)
- On click, triggers `prompt()` on the deferred event

**`RegisterSW` component** (`src/components/RegisterSW.tsx`):
- Registers service worker for offline caching

---

## 15. Build Scripts

### `scripts/bump-version.cjs`
Reads `VERSION` file (format `v{major}.{minor}.{patch}.{build}`), bumps the appropriate component. Used as `prebuild` script in `package.json`.

### `scripts/update-android-version.cjs`
Updates `android/app/build.gradle` versionCode and versionName from `VERSION` file.

### `scripts/package-webapp.ps1`
PowerShell script for packaging web app.

### `package.json` scripts
```json
{
  "dev": "next dev",
  "build": "next build",
  "prebuild": "node scripts/bump-version.cjs patch",
  "lint": "eslint",
  "cap:sync": "npx cap sync android",
  "cap:copy": "npx cap copy android",
  "cap:build": "npx cap build android",
  "cap:open": "npx cap open android",
  "android:apk": "npm run build && npm run version:patch && node scripts/update-android-version.cjs && npx cap copy android && cd android && gradlew assembleDebug",
  "version:patch|minor|major": "node scripts/bump-version.cjs {patch|minor|major}"
}
```

---

## 16. CI/CD

### Cloudflare Pages Deploy (`.github/workflows/nextjs.yml`)
Triggered on push to `master`:
1. Checkout + Node 22 setup
2. `npm ci`
3. `npm run build` (static export → `out/`)
4. `wrangler pages deploy out --project-name=money-meva --branch=master`

Requires `CLOUDFLARE_API_TOKEN` GitHub secret.

### Android APK Build (`.github/workflows/build-apk.yml`)
Triggered on push to `master` (paths: VERSION, android/**, src/**, package.json) or workflow_dispatch:
1. Checkout + Node 22 + Java 21 + Android SDK
2. `npm ci`
3. Optional version bump
4. `npm run build`
5. `npx cap sync android`
6. Node script to sync version
7. `./gradlew assembleDebug` in `android/`
8. Upload APK artifact (`MoneyMeva-APK`)

---

## 17. Component Library (`src/components/`)

| Component | Purpose |
|---|---|
| `AuthProvider` | Auth context wrapper |
| `ThemeProvider` | Theme/brand context |
| `I18nProvider` | i18n context wrapper providing `useTranslation()` hook |
| `ToastProvider` / `useToast()` | Global toast system (success/error/warning/info), replaces `alert()` |
| `Skeleton` | Reusable skeletons: `SkeletonCard`, `SkeletonTable`, `SkeletonChart`, `SkeletonList` |
| `DashboardLayout` | Main dashboard shell (nav, auth guard, DB init, PIN lock) |
| `TransactionPage` | Reusable CRUD for income/expense/investment |
| `NotificationPanel` | Dropdown panel showing all notifications |
| `CreditAlertModal` | Overdue / near-limit credit alert modal (driven by `getPartnerCreditStats` + `notification-prefs.ts` toggles) |
| `PinPrompt` | Modal for PIN code input |
| `PinSetupGuide` | Shows generated PINs to user (one-time) |
| `Reveal` | Scroll-triggered reveal animation wrapper |
| `ShareButton` | Web Share API button |
| `InstallPrompt` | PWA install banner |
| `DataSafetyNotice` | Data safety information banner |
| `SecurityTipNotice` | Security tip banner |
| `WhatsNewModal` | Version update release notes modal — shows once per version (localStorage `mm_seen_release`) on dashboard load |
| `BroadcastBanner` | Remote broadcast pills — stacked floating notifications top-center, fetched from jsonbin.io (`BROADCAST_BIN_ID`), per-ID dismissal in localStorage |
| `BannerModal` | Remote ad-style overlay — full-screen backdrop + centered card (image/href/width), skeleton loading while fetch, X appears after full display then 7s countdown, shows once per app load (module flag — never on SPA navigation), inclusive local-day `startDate`/`expires` scheduling via shared `isWithinPeriod()` |
| `LoadingOverlay` | Full-screen loading overlay |
| `RegisterSW` | Service worker registration |
| `ui/button` | Base button component |
| `InvestmentCalculator` | FD/SIP/RD/PPF calculator for investments page |
| `LanguageSelector` | Language dropdown (default/minimal variants, uses portal for dropdown) |

---

## 18. Data Flow Summary

### Write Operation (e.g., adding an expense)
```
User clicks "Save"
  → TransactionPage.handleAdd()
  → store.addTransaction(formData)
    → Generate id() + transitionId()
    → Push to cache.transactions[]
    → Dexie: db.transactions.put(tx)
    → PouchDB: putDoc('transaction', tx)
    → mutation_log: logMutation('transaction', id, tId, 'created', detail)
  → setTransactions(getTransactions(type))
  → UI re-renders from cache
```

### Sync Flow (from remote)
```
Live sync change detected
  → processRemoteChanges()
    → checkConnection()
    → localDB.replicate.from(remoteDB)
    → localDB.allDocs({ include_docs: true })
    → Filter by entity + !_deleted
    → For each doc:
      → Find in cache by id
      → If local.updatedAt >= doc.updatedAt, skip
      → Else update cache + write to Dexie
```

### Dashboard Data Flow
```
DashboardPage mounts
  → DashboardLayout calls initDB()
    → Hydrates cache from Dexie
    → Starts periodic pull (2min)
    → Dispatches 'store-ready'
  → DashboardPage reads from store:
    → getAggregates() → balance, income, expense, etc.
    → getMonthlySummary() → chart data
    → getCarryForward() → rollover balance
    → getGoals() → progress bars
    → getRecurring() → active recurring (2-col card) + advance modal
    → getAllNotifications() → notification panel
  → Action buttons open modals (type/amount/account/date) before writing to ledger
  → All reads are from in-memory cache (instant)
```

---

## 19. Key Implementation Details

### Recurring Card Action Modal
Recurring 🔄 buttons open a modal form instead of directly writing to the ledger:
- **Recurring modal**: Pre-filled with recurring data (type, amount, date, description) — user confirms/modifies → "Save & Advance" creates transaction + advances nextDate
- Pattern: `addTransaction()` → `advanceRecurring()` → `refreshDashboard()`

### Recurring Transaction Advancement
`advanceRecurring(id)`:
1. Creates a transaction with current `nextDate`
2. Computes new `nextDate` based on frequency (daily/weekly/monthly/yearly/custom)
3. Updates the recurring record in cache + Dexie + PouchDB
4. Returns the created transaction

### Reminder "Mark as Paid"
`completeAndRescheduleReminder(id)`:
- For `once` frequency: mark as completed
- For recurring: compute next date (daily/weekly/monthly/quarterly/half-yearly/yearly), update `dueDate`
- Does NOT auto-create an expense (user creates manually or uses recurring)

### Partner P&L
`getPartnerPnL(partnerId)`:
- Filters transactions by `partnerAccountId`
- Sums income and expense separately (accrual — excludes `Credit Settlement` rows; the P&L sheet in export does the same)
- Returns `{ income, expense, net }`

### Credit (उधार) Model — Accrual + Auto-Adjustment
- **Accrual basis** — a credit purchase (`account: 'credit'`, type expense) counts as an expense and a credit sale as income at record time. Settlement rows (category `Credit Settlement`) never affect income/expense totals anywhere (`operationalTransactions()` in `store.ts` excludes both `NON_OPERATIONAL_CATEGORIES` and `CREDIT_SETTLEMENT_CATEGORY`).
- **Auto-adjustment** — `addTransaction()` calls `maybeAutoCreateCreditAdjustment(t)` for credit entries (skips `Credit Settlement` rows and entries without `partnerAccountId`). It calls the normal `addAdjustment()` path (→ cache → Dexie → `syncWriteDoc('adjustments')` → audit log), so adjustments sync like any other data. Fields: `sourceTransactionId`, `sourceType` (`credit-purchase|credit-sale`), `settleStatus: 'pending'`, `settledAmount: 0`.
- **FIFO settlement** — `partners/page.tsx` calls `markCreditAdjustmentsSettled(partnerId, amount, transferId, isReceive)` after each settle/receive. It sorts pending adjustments oldest-first (date, then createdAt), siphons the cleared amount, sets `settledAmount`, and marks `settleStatus: 'settled'` + a language-aware note when fully covered. A partial payment leaves the adjustment Pending.
- **Delete/restore linkage** — `updateTransaction()` finds linked adjustments by `sourceTransactionId` (all, regardless of deleted state) and archives/restores them in the same direction as the transaction.
- **Backfill** — `backfillCreditAdjustments()` runs inside `initDB()` (try/catch guarded, idempotent): creates pending adjustments for any credit transaction missing one, then replays `Credit Settlement` clearing rows FIFO to mark the correct ones Settled. Runs every load until nothing is missing.
- **Exclusion in export/accounts** — `export.ts` `incRows`/`expRows`, the party P&L sheet, and the category-stats loop skip `Credit Settlement`; `accounts/page.tsx` revenue/expense filters exclude the category too.
- **Credit stats per partner** — `getPartnerCreditStats(partnerId, partner?)` computes outstanding, limit, `pctUsed`, `limitState` (none/near/reached via `NEAR_LIMIT_PCT = 0.8`), oldest unsettled date (FIFO queue), `dueDate`/`daysRemaining`/`dueState` using `creditSettleDaysFor()`; defaults from `DEFAULT_CREDIT_LIMIT = 10000` / `DEFAULT_CREDIT_SETTLE_DAYS = 30` in `src/lib/parties.ts`.

### Duplicate Detection
`checkDuplicateTransaction(tx)`:
- Looks for existing transaction with same date, type, amount, category, and optional partnerAccountId
- Returns the matching transaction or null

### Dashboard Calculations
- **Expense limit** = income × expense quota (default 15%)
- **Invest limit** = income × invest quota (default 35%)
- **Available to Spend** = income − expense limit − invest limit (quotas editable via "Editing Quota" UI)
- **Balance** = total income − total expense (all time, cash/bank/upi)
- **Carry Forward** = last month's cash/bank/upi balance (positive only)
- **Total Income/Expense/Investment** = across all accounts (per type; no saving type exists)
- **v7.2.0**: `getAggregates()` + `getMonthlySummary()` exclude categories `Transfer`, `Capital`, `Drawings` from income/expense totals — internal transfers and owner capital no longer inflate revenue stats (`NON_OPERATIONAL_CATEGORIES` in store.ts)
- **v7.3.0 (accrual credit)**: the same totals ALSO exclude `Credit Settlement`, so credit purchases/sales count once at record time and settlement never double-counts; `operationalTransactions()` in store.ts is the single shared filter
- **Accounts page** (5 cards): Cash, Bank, Capital (net of `Capital`/`Drawings` tagged txs), Revenue & Expenses (period-based via pill selector; excludes the same non-operational categories)

### Partner P&L + Edit
- `getPartnerPnL(partnerId)` — filters transactions by `partnerAccountId`, sums income/expense, returns `{ income, expense, net }`
- Partners page has a pencil **Edit** button per card → reuses the add modal pre-filled → `updatePartner(id, updates)`. Duplicate-name check skips the party being edited.

### Works Module (कामे)
- **Page**: `/dashboard/works` (`src/app/dashboard/works/page.tsx`). Nav item sits after Party Accounts; included in mobile floating nav.
- **Profession-driven profiles**: `WORK_PROFILES` registry in `defaultCategories.ts` is now keyed to onboarding professions — farmer🌾, employee💼, employer🏢, freelancer💻, student🎓, homemaker🏠, investor📈, retired🏖️, farm_services🚜, labor👷, shop🏪, contractor📋, transport🚛, general👤. Each profile lists preset work types (i18n keys under `works.types.*`). `profileForProfession()` maps onboarding profession → default profile; `workProfilesForProfession()` returns the user's matching profile(s) first so the add-form selector surfaces what's relevant (e.g. a salaried user sees Employee + Employer at the top, not a farmer default). `employer` is offered to both `salaried` and `business` users. Switching the profile selector resets the work type and toggles farmer-only fields.
- **Farmer-only fields**: crop, season, year, area render (and the season chip on the card shows) **only** when the selected profile is `farmer` or `farm_services`. Other profiles get a minimal amount/party/dates form.
- **Direction model**: `receivable` = my work / payment to receive (auto-ledger entry becomes Income, category "Work Payment"); `payable` = hired work / I must pay (auto-ledger entry becomes Expense, category "Labor").
- **Status derivation**: `getWorkStatus(w)` → paid when `paidAmount >= agreedAmount > 0`; partial when any payment exists; otherwise pending.
- **Payments**: `recordWorkPayment(workId, { date, amount, note }, { alsoLedger })` appends to `payments[]`, recomputes `paidAmount`, and optionally creates the mirrored ledger transaction (checkbox default ON). Payment rows store `linkedTransactionId` for traceability.

### Partnership Module (भागीदारी)
- **Placement**: tab inside the Party Accounts page (`Accounts | भागीदारी` segmented control) — component `src/components/PartnershipTab.tsx`.
- **Model**: a Partnership has members with `sharePct` (validated to total 100% on save); entries are shared income/expense records. Expenses track `paidByPartyId` (which member fronted the money).
- **Settlement math** (`getPartnershipSummary`): per member `balance = incomeShare + paid − expenseShare` where shares are `total × sharePct/100`. Positive → member should receive; negative → member owes the pool.
- **Ledger mirror**: entry save can auto-create a main-ledger transaction (category "Partnership", description `"{title} · {detail}"`); edits/deletes keep the mirror in step via `linkedTransactionId`.
- **Works link**: the Add Work form shows a Partnership dropdown when partnerships exist; the work keeps its own `partyId` too.

### Farmer Onboarding
- Farmer is an official profession choice (`PROFESSION_CATEGORIES.farmer` in both `onboarding/page.tsx` and `defaultCategories.ts`) with farming income/expense/investment categories. Maps to the farmer work profile via `profileForProfession()`.

### Future-Date Guard
All income/expense/investment entry points block future dates:
- `TransactionPage` add + edit modals
- Dashboard quick-add modal
- Partners page transaction modal
Implementation: `max={todayStr()}` on `<input type="date">` + submit-time string comparison `date > todayStr()` → warning toast. Exempt: recurring dates, investment maturity dates.

### Mobile Responsiveness
- Desktop: sidebar nav + full table views
- Mobile: bottom FAB nav + minimal list views + tap-through detail modals
- Audit ledger: subtitle truncated to 4 words on mobile
- Buttons: full labels on desktop, icons only on mobile (or smaller variants)

---

## 20. Version File

`VERSION` contains the current version string: `v{major}.{minor}.{patch}.{build}` (e.g., `v7.2.0.47`).

The build number (4th component) is incremented on each `npm run build` via the `prebuild` script. On CI, this bumps locally in the runner; the repo isn't modified.

### Modal Behavior (all popups/forms)
- No modal closes when clicking outside/on the backdrop overlay
- Users must use explicit Cancel/X buttons to dismiss any modal (Add, Edit, Create Party, Duplicate Warning, Detail, PIN prompts, install prompt, calculator, notices)
- Applies across all dashboard pages, TransactionPage, and every modal component (PinPrompt, PinSetupGuide, InstallPrompt, InvestmentCalculator, DataSafetyNotice, SecurityTipNotice)
- Implemented by removing `onClick` handlers from all backdrop overlay divs

---

## 21. File Skeleton Reference

```
money-meva/
├── .github/workflows/
│   ├── nextjs.yml              # Cloudflare Pages deploy
│   └── build-apk.yml           # Android APK build
├── android/                    # Capacitor Android project
│   ├── app/build.gradle        # Version synced from VERSION
│   └── app/src/main/res/       # Icons, notifications
├── docs/                       # Obsidian documentation vault
│   ├── Home.md                 # Vault dashboard
│   ├── templates/              # Feature / Bug Report / Dev Log templates
│   └── dev/                    # Daily dev logs
├── public/
│   ├── manifest.webmanifest
│   ├── icon-512.png
│   ├── icon.svg
│   ├── og-image.svg            # Social media preview
│   ├── sitemap.xml             # SEO sitemap (public pages only)
│   ├── robots.txt              # Crawler directives
│   ├── broadcast.json          # Legacy fallback — live source is jsonbin.io
│   ├── banner.json             # Legacy fallback — live source is jsonbin.io
│   └── favicon-32.png
├── functions/
│   └── api/
│       └── announcements.js     # Cloudflare Pages Function — edge-cached (TTL_MINUTES = 10) proxy for jsonbin bins; serves /api/announcements?type=broadcast|banner
├── scripts/
│   ├── bump-version.cjs        # Version increment
│   ├── update-android-version.cjs
│   ├── package-webapp.ps1
│   └── seed-data.js
├── src/
│   ├── app/                    # Next.js App Router pages
│   ├── components/             # React components (incl. Toast.tsx, Skeleton.tsx)
│   ├── lib/                    # Business logic
│   │   ├── db.ts               # Dexie schema
│   │   ├── store.ts            # State management + CRUD
│   │   ├── pouchdb.ts          # Supabase sync engine (sync_docs hub, realtime)
│   │   ├── localAuth.ts        # Local auth system
│   │   ├── pinStore.ts         # PIN security
│   │   ├── export.ts           # PDF/Excel export
│   │   ├── download.ts         # downloadBlob (native share sheet on Android), copyText, printHtml
│   │   ├── whats-new.ts        # Release notes + localStorage version tracking for What's New modal
│   │   ├── env.ts              # Runtime config — Supabase URL/key EMPTY by default (bring-your-own via NEXT_PUBLIC_* build env or Settings → Sync); jsonbin Bin IDs stay XOR+base64 obfuscated
│   │   ├── activityLog.ts      # Activity tracking
│   │   ├── defaultCategories.ts# Category definitions
│   │   ├── utils.ts            # Shared utilities
│   │   ├── supabase.ts         # Legacy (unused)
│   │   ├── capacitor-notifications.ts
│   │   ├── notification-prefs.ts # "Notification & Popups" per-type toggles + dismissal state
│   │   └── i18n/               # Translations (mr/hi/en) + I18nProvider
│   └── types/index.ts          # TypeScript interfaces
├── VERSION                     # Current version string
├── capacitor.config.ts         # Capacitor configuration
├── next.config.ts              # Next.js config (static export)
├── tsconfig.json               # TypeScript config
├── package.json                # Dependencies + scripts
├── postcss.config.mjs          # PostCSS for Tailwind
└── eslint.config.mjs           # ESLint flat config
```
