# Money Meva Premium — Memory Capsule

**Version:** v6.1.0.8 (incremented on every build)
**Repository:** github.com/kuldeep7ke/money-meva-premium
**Deployment:** Cloudflare Pages (auto-deploy on push to master)
**Android:** Capacitor APK via GitHub Actions (auto-build on push)
**Last Updated:** 2026-07-15

---

## 🏗 Architecture Overview

### Stack
| Layer | Technology | Rationale |
|---|---|---|
| Framework | Next.js 16.2.9 (App Router) | Static export for cheap hosting; React 19 for latest features |
| Styling | Tailwind CSS v4 + CSS variables | Rapid prototyping; 3-brand theme via CSS custom properties |
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
- **Supabase/Firebase** → Removed. The original app used Supabase but migrated to fully local-first with optional CouchDB sync. User data never leaves device unless user explicitly sets up sync.
- **Server components** → Cannot use. Dexie/PouchDB are browser-only (IndexedDB). All pages are `'use client'`.
- **Zustand/Redux** → Unnecessary. In-memory cache arrays + direct reads are simpler for this scale.
- **Prisma/SQLite** → Dexie is the only offline-capable option for browser storage.

---

## 🧠 Key Architectural Decisions

### 1. Data Flow Pattern

Every write operation follows this exact pattern:
1. Generate `id()` and `transitionId()`
2. Mutate in-memory cache (instant UI)
3. Write to Dexie (fire-and-forget, `.catch(() => {})`)
4. Write to PouchDB (fire-and-forget)
5. Log to `mutation_log` (fire-and-forget)

**Why fire-and-forget?** The app is fully local-first. If a write fails, the cache already has it. The app works 100% offline. Sync is best-effort.

### 2. Soft-Delete Everything

Every entity has `deletedAt?: string`. When "deleted":
- `deletedAt` is set to current timestamp
- Item disappears from active views
- Item appears in Archive
- After 30 days, auto-permanently-deleted (unless "Keep Forever" is set)

This allows undo, restore, and prevents accidental data loss.

### 3. transitionId System

Every entity gets a `transitionId` at creation. This links all mutations of an entity across its lifecycle. The `mutation_log` table records every action (`created → updated → deleted → restored → permanent_deleted`) linked by `transitionId`. Used in the Audit Ledger to show an entity's full life-cycle chain.

### 4. Offline-First Sync (Quota-Saving)

PouchDB → CouchDB sync is completely optional and manual-first. The app:
- Works fully offline with zero configuration
- When sync URL is configured, connects and verifies (no live sync)
- "Sync Now" button does a one-shot push (local→remote) then pull (remote→local)
- Auto-sync runs once every 12 hours if connected (saves cloud quota)
- No live replication — data only moves on explicit user action or 12hr auto-sync
- Never blocks the UI — all sync operations are background

### 5. Local Auth with Multi-User

Users are stored as JSON in localStorage under `mm_users`. The active session is stored in `mm_session`. This means:
- No server needed for auth
- Multiple users can share the same browser
- Quick-switch between users from login screen
- User data is isolated by `userId` field on every entity

---

## 📦 Database Schema (Dexie v4)

All tables use string IDs (timestamp+random). Indexes:

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

*Compound indexes are defined as comma-separated strings in the schema.

---

## 🔐 PIN Security Details

### Generation
- 10 random 4-digit PINs (each digit 0-9)
- No duplicate PINs within the batch
- Generated once per user (or regenerated on demand)

### Usage
- A "used index" tracks position — each PIN is single-use
- After PIN 10 is used, index resets to 0 (reuses PINs)
- Failed attempts are logged to activity log
- No lockout (too restrictive for local app)

### Session Auto-Lock
- Configurable: 1h / 2h / 4h / 8h / 12h / 24h / Off
- `checkAndLock()` compares `mm_last_activity` vs current time
- On lock: shows a PIN gate before allowing any action
- `updateLastActivity()` called on every navigation click

### PIN Storage
- Primary: localStorage `mm_pins`
- Sync: also written to PouchDB under `pin:batch` doc (so synced across devices)

---

## 🎨 Theme System

### CSS Variables Approach
```css
:root {
  --brand: #FF8A3D;          /* Default orange */
  --brand-secondary: #FFCF9A;
  --brand-light: #FFF6EC;
  --brand-dark: #1B1B1D;
  --brand-muted: #3D332F;
}
```
Switching brand = changing CSS custom properties. The `@theme inline {}` directive maps them to Tailwind utility classes (`bg-brand`, `text-brand-dark`, etc.).

### Dark Mode
- Toggled by adding `.dark` class to `<html>`
- Components use `dark:` prefix for dark mode variants
- Persisted in localStorage `mm_theme`

---

## 📄 Page Details

### Dashboard (`/dashboard`)
- **Summary Cards**: Balance, Available to Spend, Income, Expense, Investments, Partner Invested — each with animated counters
- **Charts**: 6-month cash flow AreaChart (Recharts), spending breakdown PieChart
- **Balance carry-forward**: Shows last month's closing balance rolled over
- **Goals**: Progress bars with contribute/withdraw inline
- **Reminders**: Upcoming reminders with "Mark as Paid" (creates transaction + reschedules)
- **Sync card**: Shows Connected / "Offline — set up sync" with Set Up button → settings
- **Loading state**: Skeleton cards (CardSkeleton, ChartSkeleton) while DB initializes

### Income / Expenses / Investments (`/dashboard/{income|expenses|investments}`)
Uses the shared [`TransactionPage`] component with `type` prop.
- **Desktop**: Table with columns (Date, Category, Description, Amount, Partner, Actions)
- **Mobile**: Minimal list (icon + description truncated + date + amount) with tap-to-view detail modal
- **Add modal**: Form with amount, category (dropdown with search), description, date, account type, partner
- **Search**: Filters by description (case-insensitive)
- **Filters**: Category, date range, amount range — toggled via `SlidersHorizontal` button
- **Sort**: Date (newest/oldest) or Amount (high/low)
- **Group**: Day / Week / Month
- **Archive**: Separate tab showing soft-deleted items with restore/permanent-delete

### Partners (`/dashboard/partners`)
- Groups: Customer / Vendor / Contact
- Each partner shows: name, type, budget window, initial investment
- **P&L**: Income, Expense, Net for each partner
- **Mini Ledger**: Tapping a partner opens a bottom-middle sheet with full transaction history for that partner (income/expense/net breakdown)
- "View History" button per partner

### Recurring (`/dashboard/recurring`)
- List of active/stopped recurring transactions
- Frequency: daily, weekly, monthly, yearly, custom interval
- "Advance" button → creates a transaction with nextDate, computes new nextDate
- Reminder days configurable per recurring (due-date notification)

### Budgets (`/dashboard/budgets`)
- Per-category monthly/yearly spending limits
- Overrun warnings at ≥80% (color-coded: yellow at 80%, red at 100%)
- Real-time spent calculation

### Reminders (`/dashboard/reminders`)
- One-time and recurring reminders
- "Mark as Paid" → (for recurring) reschedules to next date, (for once) marks completed
- Due date alerts in notification panel
- Frequency: once, daily, weekly, monthly, quarterly, half-yearly, yearly

### Todos (`/dashboard/todos`)
- Title, description, due date, category, amount, priority (low/medium/high), important flag
- Status: pending / completed
- Auto-cleanup: completed todos >30 days are removed
- Toggle important, mark complete

### Ledger (`/dashboard/ledger`)
- All mutations tracked via `mutation_log` table
- Columns: Timestamp, Entity Type (with icon), Entity ID, Action (color-coded: green=created, blue=updated, red=deleted, etc.), Detail
- Expandable rows showing life-cycle chain (all mutations grouped by transitionId)
- Copy transitionId button
- CSV export
- Filters: entity type, action type
- Search by entity ID or detail text
- Mobile: smaller export button, subtitle truncated to 4 words

### Archive (`/dashboard/archive`)
- Unified view of all soft-deleted items across all entity types
- Sortable by deletion date
- "Keep Forever" toggle per item (prevents 30-day auto-delete)
- Bulk restore, permanent delete, or "Empty All" (PIN-protected)
- Days remaining before auto-delete shown

### Settings (`/dashboard/settings`)
Organized in card sections:
- **Profile**: Name, email, occupation, business info
- **PIN Security**: Generate/reveal PINs, auto-lock config, remaining PINs count
- **Brand**: Orange / Royal Blue / Emerald Green picker
- **Theme**: Dark/Light toggle
- **Multi-Device Sync**: CouchDB URL input, Connect/Sync Now/Disconnect, status indicators (idle/connecting/connected/error), copy URL button
- **Export/Import**: PDF, Excel, JSON export; JSON import with cross-user detection
- **Activity Log**: Last 200 events with color-coded timeline
- **Danger Zone**: Clear user data / clear all data (PIN-protected, captcha confirm, cloud sync warning)
- **Support**: Contact support link (opens support page)

### Sync Failure Popup
- After 2 consecutive sync errors, shows a modal: "Having trouble syncing your data? Your local data is safe. Try again or contact support."
- Buttons: "Try Again" (reconnects), "Dismiss"
- Support links: Email, Telegram, Website

### Onboarding (`/onboarding`)
6-step wizard (linear, with back navigation):
1. **Personal Info**: Full name, phone, email
2. **Financial Profile**: Monthly income, primary goal, currency (INR default)
3. **Work/Business**: Occupation type (salaried/business/freelancer/student/homemaker/retired/investor/medical), business name/type
4. **Partner Accounts**: Add initial partners (optional)
5. **Savings Goal**: Add initial savings goal (optional)
6. **Complete**: T&C agreement, summary of entered info

### Landing Page (`/`)
- Animated hero with demo AreaChart
- Feature highlights (Spend, Save, Wealth)
- Sample stats display
- Testimonial quote
- Login / Register CTAs
- Redirects to dashboard if already logged in
- `/login?from=dashboard` for "back to dashboard" link

---

## 🔄 PouchDB Sync Implementation

### Connection Lifecycle
```
User enters URL → connectRemote(url)
  ├── create remote PouchDB
  ├── remoteDB.info() (test connection)
  ├── save URL to localStorage
  ├── localDB.sync(remoteDB, { live: true, retry: true })
  ├── syncHandler.on('change') → notifyChange()
  ├── syncHandler.on('error') → disconnect, start reconnect timer
  └── return true/false

Reconnect Timer (30s):
  ├── if connected, skip
  ├── test remote connection
  ├── if ok, replace syncHandler
  └── if fail, wait for next interval

Periodic Pull (2min):
  ├── processRemoteChanges()
  ├── localDB.replicate.from(remoteDB)
  ├── allDocs with _entity field
  ├── merge into cache (skip if local is newer)
  └── update Dexie
```

### Entity → Document Mapping
Each Dexie entity row is stored as a PouchDB document:
- `_id`: `"transaction:abc123"` (entity type + colon + entity ID)
- `_entity`: `"transaction"` (for querying by type)
- All original fields preserved
- On deletion from Dexie, PouchDB doc is deleted via `localDB.remove()`

### PouchDB Indexes
```js
localDB.createIndex({ index: { fields: ['_entity', 'updatedAt'] } });
```

---

## 🏗 Project Evolution

### Phase 1: Core CRUD App
- Next.js with Dexie local storage
- Manual entries for income/expense/investment
- Basic dashboard with totals
- localStorage-based auth

### Phase 2: Feature Expansion
- Partners with dual-entry transactions
- Recurring transactions with advance
- Budgets with overrun warnings
- Reminders with mark-as-paid
- Goals with contribute/withdraw
- Todos with priorities
- Archive system with soft-delete

### Phase 3: Data Layer Upgrade
- Migrated from localStorage → Dexie IndexedDB
- In-memory cache for instant reads
- Mutation log for full audit trail
- transitionId linking across entity lifecycle

### Phase 4: Cloud Sync
- Added PouchDB/CouchDB sync engine
- Settings page sync configuration
- Dashboard sync status card
- Live bi-directional replication
- Auto-reconnect + periodic pull
- Sync failure popup with support links

### Phase 5: Mobile & Polish
- Capacitor Android wrapper
- PWA service worker + install prompt
- Responsive mobile UI (minimal lists, detail modals, FAB nav)
- StatusBar integration
- Native notifications
- PDF/Excel export
- Periodic data safety notices

### Phase 6: CI/CD & Deployment
- Cloudflare Pages auto-deploy
- GitHub Actions APK build
- Version bumping pipeline
- README documentation
- Cloud Sync Setup guide

---

## ⚙️ CI/CD Pipeline Details

### Cloudflare Pages (nextjs.yml)
- **Trigger**: Push to master
- **Build**: `npm ci` → `npm run build` (generates `out/`)
- **Deploy**: `wrangler pages deploy out --project-name=money-meva-premium --branch=master`
- **Secret**: `CLOUDFLARE_API_TOKEN`

### Android APK (build-apk.yml)
- **Trigger**: Push to master (when VERSION, android/**, src/**, or package.json change) or manual dispatch
- **Build environment**: ubuntu-latest, Node 22, Java 21, Android SDK
- **Steps**: Checkout → Setup Node → Setup Java → Setup Android → `npm ci` → (optional version bump) → `npm run build` → `npx cap sync android` → sync version → `./gradlew assembleDebug`
- **Artifact**: `MoneyMeva-APK` (app-debug.apk)

---

## 🧪 Build & Dev Commands

```bash
# Development
npm run dev                  # Next.js dev server on localhost:3000

# Production build
npm run build                # Static export to out/

# Version bumping
npm run version:patch        # vX.Y.Z.N → vX.Y.Z.N+1
npm run version:minor        # vX.Y.Z.N → vX.Y+1.0.0
npm run version:major        # vX.Y.Z.N → vX+1.0.0.0

# Capacitor
npx cap sync android         # Sync web build to Android project
npx cap copy android         # Copy web assets to Android
npx cap open android         # Open Android Studio
npx cap build android        # Build Android app

# Android APK (full pipeline)
npm run android:apk

# Lint
npm run lint
```

---

## 🚨 Known Gotchas & Edge Cases

### PouchDB
- `db.type()` is deprecated in PouchDB 9.x → warning in console but harmless
- `skip_setup: true` required when connecting to remote to avoid auto-creating databases
- PouchDB `allDocs` includes design docs — must filter by `_entity` field
- Sync errors are silent (`.catch(() => {})`) — use `syncHandler.on('error')` for visibility
- Reconnect timer uses `setInterval` — no exponential backoff

### Dexie
- Bulk operations may exceed IndexedDB limits — chunk at 500 items
- Compound indexes are comma-separated strings, not arrays
- Schema version upgrades require careful migration planning
- `db.table.put()` is silent on failure by design (fire-and-forget)

### Next.js Static Export
- `output: 'export'` means NO server-side features (no API routes, no middleware, no ISR)
- All pages must be `'use client'` since they depend on browser APIs (IndexedDB, localStorage)
- Images must be unoptimized (`images: { unoptimized: true }`)
- `next start` doesn't work with static export — use `npx serve out` or deploy to Cloudflare Pages

### Capacitor
- `webDir` must point to `out/` (Next.js static export output)
- Plugins must be synced with `npx cap sync` after adding
- Local notifications require `ic_stat_notify` icon in Android drawable resources
- StatusBar plugin needs dark style for the app's dark theme

### Mobile UI
- Use `md:` breakpoint for desktop vs. mobile differentiation
- Mobile FAB nav has filtered items (not all nav items shown)
- Detail modals on mobile use bottom-sheet style (middle-position)
- Table views on mobile collapse to minimal list views
- Buttons on mobile show icons only (no text labels) where appropriate

### GitHub Actions
- `setup-java@v6` does NOT exist — use `@v5`
- `actions/upload-artifact@v6` requires compression-level (set to 0 for APK to avoid corruption)
- Android gradlew needs `chmod +x` on Linux runners
- Node 24 is the default on GitHub Actions runners (as of 2026)

### CouchDB
- When hosted on Railway.app, all log levels are prefixed with `[err]` even for `200 OK` responses — ignore
- `401 unauthorized` from external IPs is normal — CouchDB is publicly accessible
- Ensure CouchDB has CORS enabled for browser-based access
- The app requires `_reader` access on the database

### Build (`prebuild` script)
- `prebuild` bumps the 4th version component on every `npm run build`
- In CI, this modifies files in the runner only — no commit back to repo
- Locally, this modifies `VERSION` and `package.json` — be aware of unintended changes

---

## 📊 Dashboard Calculations Reference

| Metric | Formula |
|---|---|
| Balance | `SUM(income) - SUM(expense)` across all cash/bank/upi transactions |
| Available to Spend | `SUM(income) - SUM(expense)` for current month, cash/bank/upi only |
| Carry Forward | `MAX(0, last month balance)` |
| Total Income | `SUM(amount)` WHERE `type='income'` |
| Total Expense | `SUM(amount)` WHERE `type='expense'` |
| Total Savings | `SUM(amount)` WHERE `type='saving'` |
| Total Investments | `SUM(amount)` WHERE `type='investment'` |
| Partner Net | `SUM(partner income) - SUM(partner expense)` |
| Budget Usage | `(spent / limit) * 100` for current period |
| Goal Progress | `(saved / target) * 100` |
| Monthly Summary | Grouped by year+month, per-type totals |

---

## 🔮 Future Considerations

1. **Exponential backoff** for PouchDB reconnect (currently fixed 30s)
2. **Push notifications** via Capacitor for recurring dues
3. **iOS support** — Capacitor iOS build needs macOS
4. **Encryption** at rest for local data
5. **Biometric auth** (fingerprint/face) as alternative to PINs
6. **Dark mode sync card** currently shows "Offline — set up sync" when not connected — consider "Set Up" button alignment
7. **PouchDB migration** to `pouchdb-core` + adapters for smaller bundle size
8. **Conflict resolution** — current strategy is last-write-wins based on `updatedAt`
9. **Automated tests** — currently no test suite
10. **Database backup** to cloud storage (Google Drive, iCloud)

---

## 📝 Recent Changes (v6.1.0.8)

### Android Fixes
- **Status bar overlap** — Added `viewport-fit=cover` meta tag + `env(safe-area-inset-*)` CSS + `StatusBar.setOverlaysWebView({ overlay: false })` to prevent content from hiding behind the Android status bar
- **Back button** — Added `@capacitor/app` plugin with `backButton` listener on all pages (DashboardLayout, landing, login, onboarding). Navigates back if history exists, otherwise exits app

### Cloud Sync Fixes
- **_entity field bug** — `pullAll()` was deleting `_entity` from docs before returning, causing `processRemoteChanges()` to skip all remote docs. Fixed by preserving `_entity`
- **Manual sync only** — Removed live replication and periodic 2-min pull. "Sync Now" button does one-shot push+pull. Auto-sync runs every 12 hours. Saves cloud quota

### UI Improvements
- **Welcome card** — Auto-hides after 5s with fade+collapse animation on dashboard. Uses `sessionStorage` so it shows once per app session (not on refresh)
- **Party dropdown** — Added to Income/Expenses/Investments Add+Edit forms (recent 3, search, create new)
- **Category dropdown** — Partners page and Recurring page use searchable dropdown with keyboard nav (ArrowUp/Down/Enter/Escape)
- **Recurring form** — Category shows 3 options by default, search shows all. Reminder is dropdown (1-7 days, default 3). Start date auto-sets end date to +1 month
- **Form field reorder** — Amount → Category+Date → Account → Description → Party
- **Keyboard nav** — All custom dropdowns support ArrowUp/Down/Enter/Escape navigation
