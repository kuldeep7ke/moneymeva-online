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
- **`PartnerAccount`** — id, userId, transitionId, name, type, group ('customer'|'vendor'|'contact'), description, budgetWindowStart, budgetWindowEnd, initialInvestment, deletedAt?, createdAt, updatedAt
- **`RecurringTx`** — id, userId, transitionId, title, amount, category, txType, frequency, customIntervalDays?, startDate, endDate?, status, nextDate, reminderDays, deletedAt?, createdAt
- **`Budget`** — id, userId, transitionId, category, limit, period ('monthly'|'yearly'), deletedAt?, createdAt
- **`Reminder`** — id, userId, transitionId, title, description, dueDate, category, amount, frequency, status, deletedAt?, createdAt
- **`Adjustment`** — id, userId, transitionId, amount, accountType ('personal'|'partner'), partnerAccountId?, notes, date, deletedAt?, createdAt
- **`Goal`** — id, userId, transitionId, name, target, saved, deletedAt?, createdAt
- **`Todo`** — id, userId, transitionId, title, description, dueDate, category, amount?, priority, important, status, completedAt?, deletedAt?, createdAt
- **`MutationLog`** — id, transitionId, entityType, entityId, action, timestamp, userId, detail?
- **`ArchivedItem`** — id, type, label, subtitle, amount, deletedAt, original
- **`UserProfile`** — id, full_name, currency, onboarding_completed, email?, phone?, monthly_income?, etc.

Use `TransactionType = 'income' | 'expense' | 'investment'`, `ReminderFrequency`, `TodoPriority`, `MutationAction`, `ArchiveItemType`.

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
  todos!: Table<Todo, string>;
  mutation_log!: Table<MutationLog, string>;
}
```

**Schema (version 4):**
| Table | Indexes |
|---|---|
| transactions | id, type, date, category, userId, deletedAt, account, transitionId |
| partners | id, group, userId, deletedAt, transitionId |
| recurring | id, txType, status, userId, deletedAt, nextDate, transitionId |
| budgets | id, category, userId, deletedAt, transitionId |
| reminders | id, status, userId, deletedAt, transitionId |
| adjustments | id, accountType, userId, deletedAt, transitionId |
| goals | id, name, userId, deletedAt, transitionId |
| todos | id, status, category, priority, important, userId, deletedAt, transitionId |
| mutation_log | id, transitionId, entityType, entityId, action, timestamp, userId |

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
| `addRecurring()` / `advanceRecurring()` | Recurring with next-date computation |
| `setBudgets()` / `upsertBudget()` | Budget management |
| `addReminder()` / `completeAndRescheduleReminder()` | Reminders with frequency |
| `addAdjustment()` / `deleteAdjustment()` | Balance corrections |
| `addGoal()` / `updateGoal()` | Savings goals |
| `addTodo()` / `completeTodo()` / `toggleTodoImportant()` | Task management |
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
    ├── page.tsx            # Dashboard: summary cards, charts, recent txns, 2-col Tasks+Recurring grid, goals
    ├── layout.tsx          # DashboardLayout wrapper (see below)
    ├── income/page.tsx     # Income CRUD (wraps TransactionPage)
    ├── expenses/page.tsx   # Expenses CRUD (wraps TransactionPage)
    ├── investments/page.tsx# Investments CRUD (wraps TransactionPage)
    ├── savings/page.tsx    # Goals + Tasks (dual-tab: goals grid / to-do list)
    ├── partners/page.tsx   # Party accounts with P&L, mini-ledger modal, edit support
    ├── accounts/page.tsx   # Account overview
    ├── categories/page.tsx  # Categories CRUD with tabs, inline edit/delete, PIN-protected batch save
    ├── adjustments/page.tsx # Balance corrections
    ├── recurring/page.tsx  # Recurring transactions management + tabs (Income/Expense/Investment/Notifications/History)
    ├── ledger/page.tsx     # Audit log — mutation history with filters, CSV export
    ├── summary/page.tsx    # Charts: cash flow, spending breakdown, month-by-month
    ├── archive/page.tsx    # Soft-deleted items: restore, permanent delete, empty all
    ├── settings/page.tsx   # PIN setup, sync config, export/import, themes, brand, auto-lock, clear data
    ├── developer/page.tsx  # Dev tools: version/release-notes status, DB stats, localStorage inspector, sync diagnostics (masked URL, sync email, last event), announcement bin tests, JSON import/export, PIN viewer
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

**Future-date guard:** Income/expense/investment entries cannot be dated in the future. Date inputs use `max={today}`, and submit handlers validate with a warning toast (a shared `todayStr()` helper in each file). Recurring start/end dates, task/todo due dates, and investment maturity dates are exempt.

**Empty states:** When no transactions exist, mobile/desktop views and the archive show an icon + heading + hint ("Click + Add to record your first ...") instead of bare text. Ledger uses animated skeleton rows while loading.

**Toast feedback:** Pages use the global `useToast()` hook (`src/components/Toast.tsx`, provider in root layout) — no native `alert()` calls anywhere.

**Category dropdown:** Reads from localStorage keys (`mm_income_categories`, `mm_expense_categories`, `mm_investment_categories`) merged with categories found in existing transactions. `saveCategoryToLocalStorage()` persists new categories on add/edit. No `.slice(0,10)` limit — all used categories appear. Keyboard navigation (ArrowDown/Enter) reaches the inline "Create" button in both add and edit modals.

**Party field:** Shows "None" by default in both Add and Edit modals when no party is selected. A "None" option is the first item in the party dropdown. Selecting "None" clears `partnerAccountId` and `party` values.

**Modal behavior:** No modal closes when clicking outside/on the backdrop overlay. Users must use explicit Cancel/X buttons to dismiss any modal (Add, Edit, Create Party, Duplicate Warning, Detail, or any popup across the app).

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
- **Auth**: Supabase Auth — email + password, JWT session in `mm_sb_session`
- **Isolation**: Row-Level Security (`auth.uid() = user_id`) — cross-account access impossible
- **Live updates**: realtime subscription on `sync_docs_realtime` (replica identity full)

### Entity Mapping
Each Dexie entity maps to a PouchDB doc prefixed with `entityType:id`; the cloud row id is the same (`entityType:id`):
- `transaction:abc123` → `entity: 'transaction'`
- `partner:def456` → `entity: 'partner'`
- etc.

### Key Functions

| Function | Purpose |
|---|---|
| `getConfig()` | `{ url, key }` from obfuscated defaults in `env.ts` or localStorage override (`mm_sb_url`/`mm_sb_key`) |
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
1. URL + anon key pre-filled from env (`mm_sb_url`/`mm_sb_key` overrides allowed)
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

### Remote Announcements (jsonbin.io)
Broadcast pills and banner modals are remote-config — owner edits JSON on jsonbin.io, all users (web + installed APKs) get changes without app updates.

```
jsonbin.io bins ──fetch (cache-busted, every dashboard load)──> BroadcastBanner.tsx / BannerModal.tsx
```

- **Config** (`src/lib/env.ts`): `BROADCAST_BIN_ID` / `BANNER_BIN_ID` / `JSONBIN_BASE` stored as XOR+base64 obfuscated strings (`_K` = 'moneymeva', decoded at runtime via `_d()`) — no plain-text IDs or URLs in shipped bundles
- **Fetch**: `https://api.jsonbin.io/v3/b/<BIN_ID>/latest?t=${Date.now()}` with `cache: 'no-store'`; unwrap response via `res?.record ?? res`
- **Broadcast pill**: centered floating pills top-center (`z-[9998]`, stacked 44px apart), color-coded by `type`, optional clickable `link`, per-ID dismissal (`mm_dismissed_broadcasts`), `pinned` = no dismiss; JSON is an array of objects
- **Banner modal**: full-screen overlay (`z-[10000]`), centered card with title/content/image/href/width, X top-right with 5s countdown, shows EVERY refresh (no persistence), scheduled via `startDate`/`expires`
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
| `PinPrompt` | Modal for PIN code input |
| `PinSetupGuide` | Shows generated PINs to user (one-time) |
| `Reveal` | Scroll-triggered reveal animation wrapper |
| `ShareButton` | Web Share API button |
| `InstallPrompt` | PWA install banner |
| `DataSafetyNotice` | Data safety information banner |
| `SecurityTipNotice` | Security tip banner |
| `WhatsNewModal` | Version update release notes modal — shows once per version (localStorage `mm_seen_release`) on dashboard load |
| `BroadcastBanner` | Remote broadcast pills — stacked floating notifications top-center, fetched from jsonbin.io (`BROADCAST_BIN_ID`), per-ID dismissal in localStorage |
| `BannerModal` | Remote ad-style overlay — full-screen backdrop + centered card (image/href/width), X with 5s countdown, shows every refresh, `startDate`/`expires` scheduling |
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
    → getTodos() → pending todos (2-col card)
    → getRecurring() → active recurring (2-col card)
    → getAllNotifications() → notification panel
  → Action buttons open modals (type/amount/account/date) before writing to ledger
  → All reads are from in-memory cache (instant)
```

---

## 19. Key Implementation Details

### Dashboard Card Action Modals
Tasks ✅ and Recurring 🔄 buttons open a modal form instead of directly writing to the ledger:
- **Task modal**: User selects income/expense type, fills amount, account, date, description → "Save & Complete" creates transaction + marks todo done
- **Recurring modal**: Pre-filled with recurring data (type, amount, date, description) — user confirms/modifies → "Save & Advance" creates transaction + advances nextDate
- Both modals use the same pattern: `addTransaction()` → entity action (`completeTodo()` / `advanceRecurring()`) → `refreshDashboard()`

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
- Sums income and expense separately
- Returns `{ income, expense, net }`

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

### Partner P&L + Edit
- `getPartnerPnL(partnerId)` — filters transactions by `partnerAccountId`, sums income/expense, returns `{ income, expense, net }`
- Partners page has a pencil **Edit** button per card → reuses the add modal pre-filled → `updatePartner(id, updates)`. Duplicate-name check skips the party being edited.

### Future-Date Guard
All income/expense/investment entry points block future dates:
- `TransactionPage` add + edit modals
- Dashboard quick-add modal
- Partners page transaction modal
Implementation: `max={todayStr()}` on `<input type="date">` + submit-time string comparison `date > todayStr()` → warning toast. Exempt: recurring dates, task/todo due dates, investment maturity dates.

### Mobile Responsiveness
- Desktop: sidebar nav + full table views
- Mobile: bottom FAB nav + minimal list views + tap-through detail modals
- Audit ledger: subtitle truncated to 4 words on mobile
- Buttons: full labels on desktop, icons only on mobile (or smaller variants)

---

## 20. Version File

`VERSION` contains the current version string: `v{major}.{minor}.{patch}.{build}` (e.g., `v7.1.1.33`).

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
│   │   ├── env.ts              # Runtime config (Supabase URL/key, jsonbin Bin IDs) as XOR+base64 obfuscated strings — decoded at runtime via _d(), never plain text in bundles
│   │   ├── activityLog.ts      # Activity tracking
│   │   ├── defaultCategories.ts# Category definitions
│   │   ├── utils.ts            # Shared utilities
│   │   ├── supabase.ts         # Legacy (unused)
│   │   ├── capacitor-notifications.ts
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
