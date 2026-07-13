# Money Meva — Complete Build Prompt

Offline-first PWA personal finance manager for Indian users. Tracks income, expenses, savings, investments. All data local (IndexedDB + localStorage) — zero servers.

---

## 1. Tech Stack

| Dependency | Version | Purpose |
|---|---|---|
| Next.js | `16.2.9` | App Router, `output: 'export'` (static), `images: { unoptimized: true }` |
| React | `19.2.4` | UI |
| TypeScript | `^5` | `target: ES2017`, `moduleResolution: bundler`, `@/* → ./src/*` |
| Tailwind CSS | `^4` | PostCSS plugin (`@tailwindcss/postcss ^4`) |
| Dexie.js | `^4.4.4` | IndexedDB wrapper |
| Recharts | `^3.9.1` | Charts |
| Lucide React | `^1.22.0` | Icons |
| date-fns | `^4.4.0` | Dates |
| clsx + tailwind-merge | `^2.1.1` / `^3.6.0` | `cn()` helper |
| jsPDF + jspdf-autotable | `^4.2.1` / `^5.0.8` | PDF export |
| SheetJS (xlsx) | `^0.18.5` | Excel export |
| @supabase/supabase-js | `^2.110.0` | Optional cloud auth (mock fallback) |
| @capacitor/local-notifications | `8.2.0` | Android tray notifications |
| ESLint | `v9` | `eslint-config-next` |

---

## 2. Architecture Overview

```
src/
├── app/                        # Routes (App Router)
│   ├── page.tsx                # Landing page
│   ├── login/page.tsx          # Login/Register
│   ├── onboarding/page.tsx     # 6-step wizard
│   ├── dashboard/              # All dashboard pages (12 routes)
│   ├── terms/page.tsx          # Public Terms
│   └── privacy/page.tsx        # Public Privacy
├── components/
│   ├── DashboardLayout.tsx     # Main shell (sidebar, nav, session lock)
│   ├── AuthProvider.tsx        # Context: user, profile, signOut
│   ├── ThemeProvider.tsx       # Context: theme (light/dark), brand (orange/blue/green)
│   ├── TransactionPage.tsx     # Reusable CRUD page for income/expense/investment
│   ├── ui/button.tsx           # Button component (5 variants, 4 sizes)
│   └── ... (Reveal, PinPrompt, modals, etc.)
└── lib/
    ├── db.ts                   # Dexie schema (7 tables)
    ├── store.ts                # Core logic (CRUD, summaries, archive, notifications)
    ├── localAuth.ts            # localStorage auth (register, login, session)
    ├── pinStore.ts             # 10 cyclic 4-digit PINs, session auto-lock
    ├── activityLog.ts          # Event log (max 200)
    ├── capacitor-notifications.ts  # Capacitor local notification sync
    ├── export.ts               # PDF + Excel
    ├── utils.ts                # cn(), useInView(), formatCurrency(), categories
    └── supabase.ts             # Optional Supabase client
```

### Color System

| Token | Value | Usage |
|---|---|---|
| `bg-brand` / `text-brand` | `#FF8A3D` | Orange brand |
| `.brand-orange` | `#FF8A3D` | Default theme |
| `.brand-blue` | `#3B82F6` | Royal blue theme |
| `.brand-green` | `#10B981` | Emerald theme |
| Success | `green-500/600` | |
| Danger | `red-500/600` | |
| Warning | `amber-500/600` | |

### Routes

| Route | Page |
|---|---|
| `/` | Landing page |
| `/login` | Login/Register |
| `/onboarding` | 6-step wizard |
| `/dashboard` | Main dashboard |
| `/dashboard/{income,expenses,savings,investments}` | Transaction pages |
| `/dashboard/partners` | Partner accounts |
| `/dashboard/recurring` | Recurring automation |
| `/dashboard/adjustments` | Balance adjustments |
| `/dashboard/summary` | P&L + export |
| `/dashboard/settings` | All settings |
| `/dashboard/archive` | Archived items |
| `/dashboard/{about,privacy,terms}` | Info pages |
| `/terms`, `/privacy` | Public versions (no login) |

### Data Layer Rules

- IDs: `crypto.randomUUID()`
- Timestamps: ISO strings via `new Date().toISOString()`
- Soft deletes: `deletedAt` timestamp (null = active)
- All entities scoped by `userId` for multi-user isolation
- Cache is source of truth for reads; writes go to cache + IndexedDB

---

## 3. Setup & Build Phases

### Phase A: Project Initialization (Steps 1–4)

---

**Step 1 — Create Next.js project**
```bash
npx create-next-app@16.2.9 money-meva --typescript --tailwind --eslint --app --src-dir
```
- Delete `src/app/favicon.ico` and `public/` boilerplate

**Step 2 — Configure core files**
- `next.config.ts`: `output: 'export'`, `images: { unoptimized: true }`
- `tsconfig.json`: verify `@/* → ./src/*`
- `postcss.config.mjs`: Tailwind v4 PostCSS only
- `eslint.config.mjs`: flat config with `eslint-config-next` + TypeScript

**Step 3 — Install dependencies**
```bash
npm install dexie recharts lucide-react date-fns clsx tailwind-merge jspdf jspdf-autotable xlsx @supabase/supabase-js
npm install -D @tailwindcss/postcss
```

**Step 4 — Tailwind v4 globals (`src/app/globals.css`)**
```css
@import "tailwindcss";

@layer utilities {
  .reveal { opacity: 0; transform: translateY(30px); pointer-events: none; }
  .revealed { opacity: 1; transform: translateY(0); pointer-events: auto; transition: opacity 0.6s ease-out, transform 0.6s ease-out; }
}

@keyframes slideUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}
```

### Phase B: Foundation Layer (Steps 5–9)

---

**Step 5 — Utils (`src/lib/utils.ts`)**
- `cn(...inputs)` — `clsx` + `twMerge`
- `useInView(threshold=0.15)` — IntersectionObserver hook, fires once, returns `{ ref, inView }`
- `formatCurrency(amount)` — `Intl.NumberFormat('en-IN', ...)` with INR, 0 decimals
- `getSortedCategories(baseCategories, type?)` — sort by base order, then usage count, then alpha
- `useSortedCategories(baseCategories, type?)` — hook wrapper

**Step 6 — UI button (`src/components/ui/button.tsx`)**
- `Button` with `forwardRef`
- Variants: `primary` (bg-brand), `secondary` (bg-slate-100), `outline` (border), `ghost`, `danger` (bg-red-500)
- Sizes: `sm` (h-8), `md` (h-9), `lg` (h-10), `xl` (h-12)

**Step 7 — Dexie database (`src/lib/db.ts`)**

7 tables: `transactions`, `partners`, `recurring`, `budgets`, `reminders`, `adjustments`, `goals`

```ts
export class MoneyMevaDB extends Dexie {
  transactions!: Dexie.Table<Transaction, string>;
  partners!: Dexie.Table<PartnerAccount, string>;
  recurring!: Dexie.Table<RecurringTx, string>;
  budgets!: Dexie.Table<Budget, string>;
  reminders!: Dexie.Table<Reminder, string>;
  adjustments!: Dexie.Table<Adjustment, string>;
  goals!: Dexie.Table<Goal, string>;

  constructor() {
    super('MoneyMevaDB');
    this.version(1).stores({
      transactions: 'id, userId, type, date, deletedAt, category, partnerAccountId',
      partners: 'id, userId, deletedAt',
      recurring: 'id, userId, deletedAt, status',
      budgets: 'id, userId, deletedAt',
      reminders: 'id, userId, deletedAt, status',
      adjustments: 'id, userId, deletedAt',
      goals: 'id, userId, deletedAt',
    });
  }
}
export const db = new MoneyMevaDB();
```

**Step 8 — Types (`src/types/index.ts`)**

Types to create:
- `TransactionType = 'income' | 'expense' | 'saving' | 'investment'`
- `Transaction` — id, userId, amount, type, category, description, date, partnerAccountId?, isRecurring, recurringId?, deletedAt?, createdAt, updatedAt
- `PartnerAccount` — id, userId, name, type, group (customer/vendor/contact), description?, budgetWindowStart/End?, initialInvestment?, deletedAt?
- `RecurringTx` — id, userId, title, amount, category, frequency (daily/weekly/monthly/yearly/custom), customIntervalDays?, startDate, endDate?, status (active/stopped), nextDate, reminderDays
- `Budget` — id, userId, category, limit, period (monthly/yearly)
- `Reminder` — id, userId, title, description, dueDate, category, amount, frequency (once/daily/weekly/monthly/quarterly/half-yearly/yearly), status (pending/completed)
- `Adjustment` — id, userId, amount, accountType (personal/partner), partnerAccountId?, notes, date
- `Goal` — id, userId, name, target, saved
- `ArchiveItemType` — union of all entity types
- `ArchivedItem` — id, type, label, subtitle?, amount?, deletedAt, original
- `UserProfile` — id, full_name, email?, phone?, currency, monthly_income?, primary_goal?, occupation?, business_name?, business_type?, onboarding_completed?, terms_accepted?

**Step 9 — Core data store (`src/lib/store.ts`)**

This is the largest file. Architecture:

- **In-memory caches**: arrays for each entity (transactions, partners, recurring, budgets, reminders, adjustments, goals)
- **`initDB()`** — Called on app mount:
  1. Check `mm_migrated_v2` flag; migrate legacy data from old localStorage keys to IndexedDB
  2. Hydrate all caches from IndexedDB
  3. Call `autoDeleteExpiredArchived()` — deletes archived items > 30 days old
  4. Call `deduplicatePartners()` — group by lowercase name, keep non-deleted over deleted, keep newer
  5. Create default partners (Cash, Bank, UPI Wallet) if missing
  6. Set `initialized = true`

- **CRUD pattern** (example: transactions):
  - `getTransactions(type?)` — filter cache by `!deletedAt` + optional type, sort by date desc
  - `addTransaction(tx)` — generate ID, set timestamps, add to cache + IndexedDB
  - `updateTransaction(id, updates)` — merge updates, update cache + IndexedDB
  - `deleteTransaction(id)` — set `deletedAt`, update cache + IndexedDB (soft delete)
  - `restoreTransaction(id)` — remove `deletedAt`
  - `permanentDeleteTransaction(id)` — remove from cache + IndexedDB (hard delete)
  - Same pattern for: partners, recurring, budgets, reminders, adjustments, goals

- **Partner-specific**:
  - `getPartnerPnL(partnerId)` — sum income - expenses from partner-linked transactions
  - `addPartner(p)` — check duplicate by name (case-insensitive) before creating; if exists with `deletedAt`, restore it
  - Default partners `['Cash', 'Bank', 'UPI Wallet']` are protected from deletion

- **Recurring-specific**:
  - `addRecurring(r)` — auto-calculate `nextDate` from `startDate` using `computeNextDate()`
  - `computeNextDate(from, frequency)` — add 1 day/week/month/quarter(3mo)/half-year(6mo)/year

- **Reminder-specific**:
  - `completeAndRescheduleReminder(id)` — if frequency != 'once', compute next date; else mark completed

- **Summary/Aggregates**:
  - `getMonthlySummary(year, month)` — sum by type for month
  - `getAggregates()` — overall `{ balance, income, expense, saving, investment }`
  - `getCarryForward()` — last month's balance, current start, current balance

- **Archive**:
  - `getAllArchivedItems()` — collect all entities with `deletedAt`, sort by deletedAt desc
  - `restoreArchivedItem(type, id)` — route to correct restore function
  - `permanentDeleteArchivedItem(type, id)` / `permanentDeleteAllArchived()`
  - `autoDeleteExpiredArchived()` — purge items > 30 days old
  - `getDaysUntilDelete(deletedAt)` — days remaining before auto-delete
  - `isKeepForever(id)` / `toggleKeepForever(id)` — localStorage `mm_archive_keep` set

- **Other**:
  - `checkDuplicateTransaction(tx)` — find matching tx by date, type, amount, category, partnerAccountId
  - `getAllNotifications()` — recurring due + archive + budget >= 80% + backup reminder + cloud nudge
  - `setUserId(id)` — sets active user for all operations

- **Race condition guard**: Pages that read from `getAllArchivedItems()` on mount must `await initDB()` before reading, otherwise the cache is empty on page refresh (initDB hydrates asynchronously). Applied in archive page.

### Phase C: Auth & Security (Steps 10–13)

---

**Step 10 — Capacitor notifications (`src/lib/capacitor-notifications.ts`)**
- Installed `@capacitor/local-notifications@8.2.0`
- Created notification icon `android/app/src/main/res/drawable/ic_stat_notify.xml`
- Utility functions: `initLocalNotifications()` — request permissions, `syncLocalNotifications()` — sync in-app notifications to Android tray
- Native platform detection via `Capacitor.isNativePlatform()`
- Deduplication via `mm_cap_shown_notifs` localStorage set
- Integrated into `NotificationPanel.tsx`: calls `initLocalNotifications()` on mount + `syncLocalNotifications()` every 20s
- Configured `smallIcon: 'ic_stat_notify'`, `iconColor: '#FF8A3D'` in `capacitor.config.ts`

**Step 11 — Local auth (`src/lib/localAuth.ts`)**

- Users stored in `money_meva_users` localStorage (JSON array)
- Session in `money_meva_session` localStorage
- `registerUser(email, password, fullName)` — check duplicate, create, set session
- `loginUser(email, password)` — find by email, verify, set session
- `switchUser(userId)`, `getAllUsers()`, `removeUser(userId)`, `logoutUser()`
- `updateProfile(userId, updates)` — update profile fields, sync session
- Password validation: min 6 chars, letters + numbers, not containing full_name or email parts
- Password strength scoring: 0-100 based on length, mixed case, numbers, special chars

**Step 12 — PIN security (`src/lib/pinStore.ts`)**

- Store: `mm_pins` (JSON array of 10 PINs), `mm_pin_index` (number, -1 initially), `mm_pins_shown` (boolean)
- `generatePins(count=10)` — generate unique random 4-digit numbers, store, reset index
- `validatePin(pin)` — compare against PIN at current index; if match, advance index (cyclic)
- `getRemainingPins()` — count of unused PINs
- Session auto-lock:
  - `getAutoLockMinutes()` / `setAutoLockMinutes(minutes)` — `mm_auto_lock` key
  - `updateLastActivity()` / `getLastActivity()` — `mm_last_activity` key
  - `isLocked()` / `setLocked(locked)` — `mm_session_locked` key
  - `checkAndLock()` — if elapsed > timeout, set locked = true

**Step 13 — Activity logger (`src/lib/activityLog.ts`)**
- `logActivity(type, detail?)` — push to `mm_activity_log`, keep max 200
- `getActivityLog()`, `clearActivityLog()`

### Phase D: Export & Supabase (Steps 14–15)

---

**Step 14 — Export functions (`src/lib/export.ts`)**
- `exportSummaryPDF(data)` — jsPDF table: Month, Income, Expense, Savings, Investment + totals
- `exportSummaryExcel(data)` — XLSX workbook
- `exportAllDataExcel()` — all transactions as XLSX
- `exportAllDataPDF()` — all transactions (max 500) as PDF table

**Step 15 — Optional Supabase (`src/lib/supabase.ts`)**
- Read `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- If missing or 'placeholder', return mock client (all methods return null)
- Else, create real Supabase client

### Phase E: Providers & Layout (Steps 16–20)

---

**Step 16 — AuthProvider (`src/components/AuthProvider.tsx`)**
- Context: `{ user, profile, loading, signOut, refreshAuth }`
- On mount: read `money_meva_session`, set user + profile
- Profile fields: `full_name`, `email`, `phone`, `currency`, `monthly_income`, `primary_goal`, `occupation`, `business_name`, `business_type`, `terms_accepted`
- `signOut()` → call `logoutUser()`, redirect to `/login`
- `refreshAuth()` — re-read session

**Step 17 — ThemeProvider (`src/components/ThemeProvider.tsx`)**
- Context: `{ theme, setTheme, brand, setBrand }`
- On mount: read `mm_theme` (default 'light'), `mm_brand` (default 'orange')
- `setTheme`: toggle `dark` class on `<html>`, save to localStorage
- `setBrand`: save to localStorage, set state
- Brands: orange `#FF8A3D`, blue `#3B82F6`, green `#10B981`
- CSS: `.brand-orange`, `.brand-blue`, `.brand-green` classes set `--color-brand`

**Step 18 — DashboardLayout (`src/components/DashboardLayout.tsx`)**

Main shell around all dashboard pages:

- **Auth guard**: redirect to `/login` if no user, to `/onboarding` if not onboarded
- **`ready` gate**: after `initDB()` completes, render children; else show loading spinner
- **Desktop sidebar**: 64px wide, logo, nav items (all 12), archive badge, user profile, share button
- **Mobile sidebar**: slide-over overlay (hamburger toggle), same content
- **Floating FAB (mobile)**: bottom-right button, opens popup with filtered nav: Dashboard, Income, Expenses, Savings, Investments, Partners, Settings
- **Session lock overlay**: full-screen PIN modal when locked
- **Archive count polling**: `setInterval` every 5s
- **Auto-lock**: listen to `mousedown/keydown/touchstart/scroll` → `updateLastActivity()`; `checkAndLock()` every 30s

**Step 19 — Reveal animation (`src/components/Reveal.tsx`)**
```tsx
'use client';
import { useInView } from '@/lib/utils';
export default function Reveal({ children, delay = 0, className = '' }: {
  children: React.ReactNode; delay?: number; className?: string;
}) {
  const { ref, inView } = useInView(0.15);
  return (
    <div ref={ref} className={`reveal ${inView ? 'revealed' : ''} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}
```
> ⚠️ `.reveal` creates a stacking context via `transform`. Render modals OUTSIDE all Reveal wrappers.

**Step 20 — Other components**

| Component | File | Purpose |
|---|---|---|
| `ShareButton` | `src/components/ShareButton.tsx` | `navigator.share()` / clipboard fallback |
| `NotificationPanel` | `src/components/NotificationPanel.tsx` | Bell icon + dropdown with notification types |
| `DataSafetyNotice` | `src/components/DataSafetyNotice.tsx` | Random popup (2-4 days, 50% chance) |
| `InstallPrompt` | `src/components/InstallPrompt.tsx` | PWA install prompt (4-7 days, 40% chance); suppressed on Capacitor native |
| `CloudUpgradePopup` | `src/components/CloudUpgradePopup.tsx` | Cloud upgrade nudge (3-5 days, 45% chance) |
| `SecurityTipNotice` | `src/components/SecurityTipNotice.tsx` | Rotates 3 tips (3-7 days, 40% chance) |
| `PinPrompt` | `src/components/PinPrompt.tsx` | Modal: enter 4-digit PIN #N, calls `onSuccess` |
| `PinSetupGuide` | `src/components/PinSetupGuide.tsx` | Educational modal, "Go to Settings" link |
| `LoadingOverlay` | `src/components/LoadingOverlay.tsx` | Full-screen spinner, 100ms delay |
| `RegisterSW` | `src/components/RegisterSW.tsx` | Unregisters all service workers on mount |

### Phase F: Pages — Public (Steps 21–23)

---

**Step 21 — Landing page (`src/app/page.tsx`)**

- Top bar: logo + "Get started" link to `/login`
- Hero: "Meet your money, deeply." + glassmorphism net worth card (AreaChart)
- Stats row: 4 cards (Income ₹85k, Expense ₹42.3k, Savings ₹1,20,000, Investments ₹2,60,000)
- Features: 3 cards with icons, responsive layouts
- Footer: logo, copyright, ShareButton
- **Redirect logic**: if user is logged in and no `?from=dashboard`, redirect to `/dashboard` (or `/onboarding` if incomplete)
- **Authenticated header**: when `?from=dashboard`, show "Edit Profile" (PIN-protected) + "Dashboard" buttons

**Step 22 — Login page (`src/app/login/page.tsx`)**

- Back button at top-left of card
- Toggle: Login / Register
- **Login**: email + password, "Sign in"
- **Register**: full_name, email, password with strength bar + inline validation errors
- Password rules: min 6 chars, letters + numbers, must not contain full_name or email
- "or continue with" + Google OAuth (shows "Coming Soon" modal)
- Quick Login: clickable cards for recent local users
- **Incomplete onboarding cleanup**: on load, if session exists with `onboarding_completed === false`, delete user + clear session
- **Name autofill**: on register success, save `fullName` to `mm_last_name` localStorage; auto-fill from it on register form mount
- LoadingOverlay during submit
- On success: redirect to `/dashboard` if onboarded, else `/onboarding`

**Step 23 — Onboarding wizard (`src/app/onboarding/page.tsx`)**

6 steps with step indicator bar:

| Step | Title | Fields | Required |
|---|---|---|---|
| 1 | Personal Info | Full Name, Phone, T&C checkbox, Import Backup | Name + T&C |
| 2 | Financial Profile | Monthly Income (4 buttons), Primary Goal (6 buttons), Currency | Income + Goal |
| 3 | Work & Business | Occupation, Business Name, Business Type | Optional |
| 4 | Partner | Add Partner toggle → Name, Group, Type, Description | Optional |
| 5 | Goal | Goal Name + Target Amount | Optional |
| 6 | Complete | Success animation + summary + redirect | — |

- **T&C**: checkbox required on Step 1; import backup button disabled until checked; links to public `/terms` and `/privacy`; `terms_accepted` saved in profile
- **Name autofill**: name field pre-filled from `mm_last_name` localStorage
- **Edit mode** (`?edit=true`): pre-fills all fields from existing profile, skips `onboarding_completed` flag, skips goal/partner creation, redirects to `/dashboard/about`
- Navigation: Back (steps 2-5), Skip for now (steps 3-5), Next/Continue/Finish
- Button text: Step 1 "Continue", Steps 2-4 "Next", Step 5 "Finish", Step 6 "Go to Dashboard"

### Phase G: Pages — Dashboard (Steps 24–34)

---

**Step 24 — Dashboard (`src/app/dashboard/page.tsx`)**

- Header: "At a glance | Your money, simplified."
- Welcome Back card: user name, Fast mode badge, Lock Session button
- 6 summary cards (responsive grid): Available to Spend, Total Balance, Total Income, Total Expenses, Investments, Partner Invested
- Balance Carry Forward: gradient section with 3 glassmorphism sub-cards
- Cash Flow Analysis: 6-month AreaChart (Income=indigo, Expense=red)
- Upcoming Reminders: list + "Manage Reminders" modal
- Spending Breakdown: donut PieChart (top 6 categories)
- Recent Transactions: last 5
- Goals section: grid with progress bars, Contribute/Withdraw/Edit/Delete
- Add Money modal: amount + destination
- Wrap sections in `<Reveal>` with delays
- **Cleanup**: unused `getSortedCategories` import removed (only `useSortedCategories` hook is used)

**Step 25 — TransactionPage (`src/components/TransactionPage.tsx`)**

Reusable for income/expense/investment pages. Props: `type`, `title`, `description`.

- **Filter bar**: search, category, date range, amount range, quick filters (This Week/Month/Last Month/Quarter), sort toggle
- **Content**: mobile cards / desktop table (Date, Category, Description, Amount, Actions)
- **Group by**: none/day/week/month with headers
- **Add/Edit modal**: Amount, Category (datalist), Date, Description; duplicate warning
- **Delete flow**: if `createdAt` is today → skip PIN; else PIN or PinSetupGuide; soft delete + undo toast
- **Archive panel**: toggleable list of deleted items with Restore/Delete

**Step 26 — Income/Expenses/Investments pages**

Thin wrappers:
```tsx
export default function IncomePage() {
  return <TransactionPage type="income" title="Income" description="Track your earnings" />;
}
```

**Step 27 — Savings (`src/app/dashboard/savings/page.tsx`)**

Two tabs:
- **Savings**: TransactionPage for `type="saving"` + Source of Funds (Available/partner)
- **Goals**: grid of goal cards with progress bars; Contribute/Withdraw; Edit/Delete

**Step 28 — Partners (`src/app/dashboard/partners/page.tsx`)**

- Summary cards: Total Invested, Net P&L, Total Portfolio Value
- Group tabs: All / Vendors / Customers / Contacts
- Partner cards: name, type badge, budget, investment, P&L, total value
- Actions: Add Transaction (with companion entry), View History
- Add Partner modal: compact layout — Account Name (full width), Group + Type (2-col), Initial Investment (full width), Description (full width); Type uses dropdown + "Create New" option
- Delete protection: 3 default partners (Cash, Bank, UPI Wallet) cannot be deleted

**Step 29 — Recurring (`src/app/dashboard/recurring/page.tsx`)**

- Empty state with CTA
- Add modal: Title, Amount, Category, Frequency, Start/End Date, Reminder Days
- Table: name, amount, frequency, next date, status badge (green/gray), Play/Pause toggle, Delete
- Wrapped in `<Reveal>` with delay=100 for scroll animations

**Step 30 — Adjustments (`src/app/dashboard/adjustments/page.tsx`)**

- Add modal: Amount (±99,99,99,999), Account Type (Personal/Partner), Date, Notes
- Guard: amount validated BEFORE PIN prompt
- List: date, amount (red/green), account type badge, notes, delete

**Step 31 — Summary (`src/app/dashboard/summary/page.tsx`)**

- Stat cards: Total Income, Expenses, Savings, Investments
- P&L Trend: 6-month grouped BarChart
- Goal Progress: progress bars
- **User & System Activity History**: combined timeline of user actions (transactions, partner additions) + system events (notifications, backups), date-grouped (Today / Yesterday / date), shows 2 days by default with "Show All Data" inline expand + full modal overlay, color-coded badges for system events
- Export: PDF (monthly summary table) + Excel (.xlsx)
- Title responsive: `text-lg md:text-3xl`; subtitle hidden on mobile

**Step 32 — Settings (`src/app/dashboard/settings/page.tsx`)**

Sections (in order):
1. **Edit Profile & Visit Landing Page** — gradient card (orange-to-amber) at the very top with `UserCog` icon in brand gradient circle, description, feature badges (Personal Info / Financial Profile / Landing Preview), and "Open Profile Settings" button linking to `/?from=dashboard`
2. **CSV Import/Export** — download CSV, upload CSV with header parsing
3. **Cloud Upgrade** — gradient card with Telegram CTA
4. **Full Data Backup** — Export/Import JSON with cross-user detection
5. **App Color** — 3 theme buttons (Orange/Blue/Green)
6. **Security** — PIN generation (show once + confirmation), remaining count, Regenerate, Auto-lock dropdown
7. **Danger Zone** — Clear User Data / All Data (CAPTCHA + confirmation)

**Step 33 — Archive (`src/app/dashboard/archive/page.tsx`)**

- Empty state with icon
- "Empty Archive" button (PIN-protected)
- Mobile: cards / Desktop: table with columns (ratio 3:6:2:2:2:3 auto-fit):
  - Item (3), Details (6), Amount (2), Archived (2), Auto-Delete (2), Actions (3)
- Items from all entity types via `getAllArchivedItems()`
- **Race condition fix**: `refresh()` awaits `initDB()` before reading cache so data survives page refresh
- Auto-delete countdown badges: "Xd left" / "Expiring today" / "Kept"
- Protect/Unprotect per item (shield icon, localStorage `mm_archive_keep`)
- PIN required for restore, delete, clear

**Step 34 — About / Privacy / Terms pages**

- **About**: Logo, version, stats, profile, contact, links to Privacy/Terms. Sections wrapped in `<Reveal>` with staggered delays.
- **Privacy Policy**: static — no data collection, local-only, security, deletion rights. Back link, header, and content wrapped in `<Reveal>` with delays.
- **Terms of Service**: static — acceptance, responsibilities, disclaimer, liability, IP. Same Reveal animated structure as Privacy.
- Public standalone versions at `/terms` and `/privacy` (no DashboardLayout)

### Phase H: PWA & Polish (Steps 35–37)

---

**Step 35 — PWA support**

**`public/manifest.webmanifest`**:
```json
{
  "name": "Money Meva",
  "short_name": "Money Meva",
  "start_url": "/",
  "display": "standalone",
  "theme_color": "#FF8A3D",
  "background_color": "#FAF5F0",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any maskable" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
  ]
}
```

**Service worker** (`public/sw.js`): cache-first for `/`, `/login`, `/onboarding`, `/dashboard` routes + icons. Versioned cache name.

**`src/app/layout.tsx`**: manifest link, apple-touch-icon, theme-color meta, icon links.

**Icons**: `favicon-32.png`, `icon-192.png`, `icon-512.png`, `logo.png`, `icon.svg`, `icon-app.svg` — all orange rupee design via `scripts/generate-web-icons.mjs`.

**Step 36 — Root layout (`src/app/layout.tsx`)**
- HTML with `suppressHydrationWarning`
- `<ThemeProvider>` → `<AuthProvider>` → `<RegisterSW />`
- Metadata: title, description, icons, manifest, theme-color

**Step 37 — Global styles (`src/app/globals.css`)**
- `@import "tailwindcss"`
- `.reveal` / `.revealed` utilities
- `@keyframes slideUp`

---

## 4. Scripts & Config

### Scripts

| Script | Purpose |
|---|---|
| `scripts/bump-version.cjs` | Read VERSION (`vX.Y.Z.B`), increment (patch/minor/major/build) |
| `scripts/update-android-version.cjs` | Sync VERSION to `android/app/build.gradle` (versionCode = build+10, versionName) |
| `scripts/generate-web-icons.mjs` | Generate web PNG icons (sharp, orange rupee design) |
| `scripts/generate-android-icons.mjs` | Generate Android mipmap icons (adaptive, orange rupee) |
| `scripts/seed-data.js` | Browser console: generate 10 partners, 15 txs, 10 recurring, etc. |
| `scripts/package-webapp.ps1` | Build + copy to `dist/` + zip |
| `start-dev.bat` | `npm run dev` shortcut |

### Deployment

**`netlify.toml`**:
```toml
[build]
  command = "npm run build"
  publish = "out/"
```

**`VERSION`** file at root: `vX.Y.Z` format, auto-bumped on each build.

---

## 5. Android APK Build (GitHub Actions)

Workflow at `.github/workflows/build-apk.yml` — manual trigger only.

**Workflow steps:**
1. Checkout code
2. Setup Java 21 (Temurin)
3. Setup Node.js 22
4. `npm ci` + install Capacitor deps if missing
5. `node scripts/bump-version.cjs patch` — bumps VERSION
6. `node scripts/update-android-version.cjs` — syncs versionCode/Name
7. Generate `debug.keystore` if missing (for consistent signing)
8. `npx next build` (static export)
9. `npx cap sync` (copy web to Android)
10. Install Android SDK platform 36 + build-tools
11. `./gradlew assembleDebug` in `android/`
12. Upload APK artifact
13. Upload `debug.keystore` as artifact (first run, commit it to repo)

**Requirements:**
- Android project at `android/` (via `npx cap add android`)
- `capacitor.config.ts` with appId, appName, webDir
- `android/app/build.gradle`: target API 36, minSdk 24, `signingConfigs.debug` pointing to `debug.keystore`
- Gradle 8.14+
- **Consistent signing**: commit `android/app/debug.keystore` so APK updates work across CI runs

**In-app trigger** (Settings page):
- Shows last build status from GitHub API
- "Build APK" button with instructions, opens workflow URL

---

## 6. UI Patterns & Edge Cases

### Modal pattern
```html
fixed inset-0 bg-black/50 backdrop-blur-sm overflow-y-auto flex items-start sm:items-center justify-center z-50 p-4
<div class="my-4">...</div>
```

### Mobile/Desktop switching
```html
<div class="hidden md:block">Desktop</div>
<div class="md:hidden">Mobile</div>
```

### PIN security rules
- Required for: delete/edit of items not created today, clearing archive, creating adjustments, export/import, clearing data, disabling auto-lock, editing profile from About/landing
- Validation is cyclic (10 PINs, then restart from index 0)
- Events that do NOT reset auto-lock: page refresh, browser back/forward, URL bar changes

### Edge cases
1. **Duplicate transaction guard**: `checkDuplicateTransaction()` prevents accidental re-entries
2. **Partner deduplication**: case-insensitive name matching, prefer non-deleted, prefer newer
3. **Adjustment amount guard**: validated before PIN prompt, rejects 0 and > ±₹99,99,99,999
4. **Delete today-rule**: skip PIN if entry `createdAt` matches today
5. **Cross-user import**: detect different user, show confirmation to reassign
6. **Archive overflow**: max 200 activity log entries
7. **Loading state delay**: LoadingOverlay has 100ms delay
8. **PWA install**: capture `beforeinstallprompt` event
9. **Random popups**: independent timers in localStorage, Math.random() chance
10. **Landing page redirect**: logged-in users redirected unless `?from=dashboard`
11. **Incomplete registration cleanup**: session with `onboarding_completed=false` triggers user deletion on login page load
12. **Edit mode guard**: `?edit=true` skips `onboarding_completed` flag and goal/partner creation
13. **Archive race condition**: `refresh()` must `await initDB()` before reading cache, otherwise data is empty on page refresh
14. **Capacitor notification dedup**: tracks shown notifications via `mm_cap_shown_notifs` localStorage Set to avoid re-sending to Android tray
15. **Activity History merge**: combines user actions (transaction CRUD, partner adds) from Dexie + system events from `mm_activity_log`; sorts by timestamp desc; date-grouped with Today/Yesterday headers
16. **Partner form validation**: name required; type dropdown with "Create New" text input fallback; Group/Type in 2-col layout on desktop
17. **InstallPrompt native guard**: suppressed when `Capacitor.isNativePlatform()` returns true, so APK users never see the PWA install popup

---

## 7. Final Checklist

- [ ] All pages render without errors
- [ ] Static export builds successfully (`next build`)
- [ ] Dark mode toggles correctly
- [ ] Brand colors change in Settings
- [ ] Landing page redirects logged-in users; `?from=dashboard` skips redirect
- [ ] Landing page shows Edit Profile + Dashboard for existing users (PIN-protected)
- [ ] Onboarding requires T&C agreement; import backup disabled until accepted
- [ ] Name auto-fills from registration history
- [ ] Onboarding edit mode (`?edit=true`) pre-fills all fields
- [ ] Edit Profile from About page requires PIN (if set)
- [ ] Incomplete onboarding users are cleaned up on next visit
- [ ] `/terms` and `/privacy` public pages accessible without login
- [ ] CRUD works on all entity types
- [ ] PIN creation, viewing, and validation works
- [ ] Session auto-lock locks and unlocks correctly
- [ ] Archive stores and restores all entity types
- [ ] Archive columns auto-fit with 3:6:2:2:2:3 ratio
- [ ] Archive auto-delete after 30 days works with countdown badges
- [ ] Export CSV, JSON, PDF, Excel all work
- [ ] Import CSV and JSON work with duplicate detection
- [ ] PWA install prompt works
- [ ] Service worker caches core routes
- [ ] Mobile responsive: no overflow, all forms fit on 375px+ screens
- [ ] Reveal animations play on scroll
- [ ] Floating nav shows only filtered items
- [ ] Google OAuth shows "Coming Soon" (mock)
- [ ] Netlify deployment succeeds from `out/`
- [ ] APK builds via GitHub Actions with consistent signing
- [ ] Archive data persists on page refresh (await `initDB()` before reading cache)
- [ ] Android local notifications appear in system tray (20s polling in NotificationPanel)
- [ ] Local notification dedup works (same notification not sent twice)
- [ ] Partner creation form compact layout works (Group+Type 2-col on desktop)
- [ ] Activity History shows combined user + system events on Summary page
- [ ] Activity History date-grouped (Today/Yesterday/date) with "Show All Data" expand
- [ ] Activity History removed from Settings page entirely
- [ ] Summary title responsive (`text-lg md:text-3xl`); subtitle hidden on mobile
