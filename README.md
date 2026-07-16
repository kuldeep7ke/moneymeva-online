# Money Meva

> **पैसे कुठे जातात? शोधूया.**  
> *Where does the money go? Let's find out.*

**v7.0.0** — A minimalistic, local-first personal finance companion.  
Built with Next.js 16, TypeScript, Dexie.js, PouchDB, and Tailwind CSS v4.  
Made in India.

---

## Memory Capsule

This README is a memory capsule — a snapshot of the project's philosophy, architecture, and soul. It exists so that years from now, the intent behind every line of code is knowable.

---

## Philosophy

Money Meva was built around a single belief: **financial clarity should not require surrendering privacy**. Every feature, every tradeoff, every line of code traces back to this.

- **Local-first by default** — your data lives in your browser's IndexedDB. No cloud required, no accounts to create, no subscription to maintain.
- **Sync is optional** — multi-device sync exists only so you are not chained to one device. It uses CouchDB + PouchDB, and you bring your own server.
- **PINs, not passwords** — sensitive operations (deletes, edits, exports) require a 4-digit PIN, not a backend call. Security without dependence.
- **Soft-delete everywhere** — nothing is truly gone. Every entity carries a `deletedAt` timestamp. The archive is your safety net.
- **Transitions are traceable** — every mutation carries a `transitionId`, linking lifecycles across entities. The ledger is the source of truth.

---

## Features

### Core
- **Income, Expenses, Investments** — Full CRUD with search, filter, sort, group by day/week/month, duplicate detection, category auto-suggest, PIN-protected deletion, archive/restore. Mobile: minimal ledger list with tap-to-view detail modal.
- **Dashboard** — Auto-hiding welcome card, 6 summary cards (Available to Spend, Balance, Income, Expenses, Investments, Partner Invested), 6-month cash flow AreaChart, balance carry-forward with rollover, spending breakdown donut chart, recent transactions, goals with progress bars, upcoming reminders, cloud sync status card with inline Sync Now.
- **Quick-add modals** — Tap the + button on any summary card to open an inline add form directly on the dashboard. No page navigation needed.
- **Investment Calculator** — Built-in calculator for FD (with compounding options), SIP, Lumpsum, RD, and PPF. Shows maturity amount, total returns, and year-wise breakdown. "Use this amount" fills the add form.
- **Savings & Goals** — Dual-tab page: savings list with source-of-funds tracking + goals grid with contribute/withdraw and progress bars.
- **Partner Accounts** — Vendor/Customer/Contact groups with P&L tracking, investment tracking, portfolio value, dual-entry transactions, mini ledger modal per party.
- **Recurring Transactions** — Automate bills and subscriptions with configurable frequencies and reminder days.
- **Adjustments** — Balance corrections between personal and partner accounts with amount guards.
- **Budgets** — Category-based monthly/yearly spending limits with overrun warnings at ≥80%.
- **Reminders** — One-time or recurring (daily to yearly) with "Mark as Paid" that creates expense transactions and auto-reschedules.
- **Archive** — Soft-delete across all entity types with bulk restore, permanent delete, or empty-all (PIN-protected).
- **Audit Ledger** — Full mutation log with entity type icons, action badges, expandable lifecycle chain, copy transition ID, CSV export, entity/action filters, search.
- **Export / Import** — CSV (transactions), PDF (jsPDF with auto-table), Excel (SheetJS), full JSON backup with cross-user detection and reassignment.

### Security & Privacy
- **PIN Security** — 10 one-time 4-digit PINs for sensitive operations (delete, edit, archive, export/import, clear data). Session auto-lock (1h–24h).
- **Password + PIN** — Email/password auth locally. Optional PIN gate on the account page for password changes and data clearing.
- **Activity Log** — Tracks 200 most recent security and CRUD events with color-coded timeline in Settings.
- **100% local-first** — no cookies, analytics, or tracking services. No external data transmission unless you explicitly export or enable sync.

### Multi-Device Sync
- **CouchDB + PouchDB** — Manual + live sync. Push your local IndexedDB to a remote CouchDB server, pull on another device.
- **Live replication** — Once connected, changes sync in real-time via PouchDB's live replication.
- **URL-based** — Enter the same `https://user:pass@host/db-name` on each device. Uses "Use Default" button for the pre-configured server.
- **Auto-sync** — Falls back to a 12-hour interval sync if live replication disconnects.
- **Sync URL history** — Last 5 URLs saved for quick reconnection.

### User Experience
- **Multi-user** — Multiple profiles with quick-switch from login screen.
- **Dark / Light Theme** — Toggleable, persisted in localStorage.
- **3 Brand Colors** — Orange (default), Royal Blue, Emerald Green — changeable in Settings.
- **i18n** — Marathi (default), Hindi, English. Grammar-preserving translations with context-appropriate vocabulary.
- **Scroll Animations** — Staggered Reveal animations on all major sections.
- **Floating Mobile Nav** — Bottom-right FAB with filtered nav.
- **Keyboard Navigation** — ArrowUp/Down/Enter/Escape for all custom dropdowns (category, party).
- **Onboarding Wizard** — 6-step setup with optional steps and re-edit support.
- **Public Pages** — Terms, Privacy, About — accessible without login.

---

## Tech Stack

| Category | Technology |
|---|---|
| Framework | Next.js 16 (App Router, static export) |
| Language | TypeScript 5 |
| UI | React 19, Tailwind CSS v4, Lucide React |
| Local DB | Dexie.js 4 (IndexedDB) |
| Sync DB | PouchDB 9 + CouchDB 3 (multi-device) |
| Charts | Recharts 3 |
| PDF | jsPDF 4 + jspdf-autotable |
| Excel | SheetJS (xlsx) |
| Dates | date-fns 4 |
| Auth | Local (email/password) |
| Mobile | Capacitor 8 (Android) |
| Linting | ESLint 9 |

---

## Data Architecture

```
User Action → In-memory Cache → Dexie (IndexedDB) → PouchDB (local) ↔ CouchDB (remote)
                    │                                                    │
                UI reads                                            Other devices
            (synchronous)                                       (live replication)
```

- **Cache** — All reads hit an in-memory cache for instant UI. No async wait.
- **Dexie** — Persistent storage. Cache hydrates from Dexie on page load.
- **PouchDB** — Local CouchDB-compatible DB. Written to on every mutation (fire-and-forget).
- **CouchDB** — Optional remote. Sync is push + pull with live replication.

Every entity carries: `id`, `transitionId`, `userId`, `createdAt`, `updatedAt`, `deletedAt`.

---

## Project Structure

```
src/
├── app/                     # Next.js App Router pages
│   ├── dashboard/           # All dashboard sub-pages
│   │   ├── account/         # PIN-gated user account page
│   │   ├── settings/        # Settings (sync, theme, language, danger zone)
│   │   └── ...              # income, expenses, investments, partners, etc.
│   ├── login/               # Sign in / Sign up / Forgot password
│   ├── onboarding/          # 6-step setup wizard
│   ├── terms/               # Public terms page
│   ├── privacy/             # Public privacy page
│   └── layout.tsx           # Root layout with version meta tag
├── components/              # Shared React components
│   ├── DashboardLayout.tsx  # Sidebar nav + layout wrapper
│   ├── TransactionPage.tsx  # Shared income/expense/investment CRUD page
│   ├── InvestmentCalculator.tsx  # FD/SIP/Lumpsum/RD/PPF calculator
│   ├── PinPrompt.tsx        # PIN entry modal
│   ├── LanguageSelector.tsx # i18n language dropdown
│   └── ...
├── lib/                     # Core logic
│   ├── store.ts             # Data layer (cache + Dexie + sync)
│   ├── pouchdb.ts           # PouchDB remote connection and sync
│   ├── localAuth.ts         # Email/password auth
│   ├── pinStore.ts          # PIN generation and validation
│   ├── db.ts               # Dexie schema definition
│   ├── i18n/               # Translation files (mr, hi, en)
│   └── ...
└── types/                   # TypeScript type definitions
```

---

## Commands

| Command | Description |
|---|---|
| `npm run dev` | Start dev server at localhost:3000 |
| `npm run build` | Production build (static export to `out/`) |
| `npm run start` | Serve production build |
| `npm run lint` | Run ESLint |
| `npx cap sync android` | Sync web build to Android project |
| `cd android && ./gradlew assembleDebug` | Build debug APK |
| `npm run version:patch` | Bump patch version |
| `npm run version:minor` | Bump minor version |
| `npm run version:major` | Bump major version |

---

## Cloud Sync Setup

1. **Get a CouchDB URL** — e.g., `https://admin:123@couchdb-production-bceb.up.railway.app/money_meva`
2. **Settings → Cloud Sync** → tap **Use Default** or paste your URL
3. **Tap Connect** — data pushes to cloud, then pulls from cloud
4. **Repeat on each device** — same URL on every device

The app works fully offline without sync. Sync is optional.

---

## Android APK

```bash
npm run build
npx cap sync android
cd android
./gradlew assembleDebug
```

The APK is at `android/app/build/outputs/apk/debug/app-debug.apk`.  
Requires Android 7+ (API 24). Features back button navigation and status bar handling.

A GitHub Actions workflow also builds the APK automatically on every push to master:  
[Build Android APK](https://github.com/kuldeep7ke/money-meva-premium/actions/workflows/build-apk.yml)

---

## License

All Rights Reserved. Copyright © 2026 Money Meva.

---

*Made in India. Built with Next.js, TypeScript, Tailwind CSS, Dexie.js, PouchDB, and love.*
