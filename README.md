# Money Meva Premium

**v6.1.0** — The premium edition of Money Meva, featuring CouchDB cloud sync for seamless multi-device access. Built with Next.js.

Track income, expenses, savings, investments, and partner accounts with real-time synchronization across all your devices. Your financial data, everywhere you need it.

---

## Features

- **Cloud Sync** — Real-time synchronization across devices using PouchDB with CouchDB remote database support. Configure via Settings → Multi-Device Sync (supports Railway.app, custom servers). Sync Now, auto-reconnect, and live bi-directional replication.
- **Dashboard** — Summary cards (Available to Spend, Balance, Income, Expenses, Investments, Partner Invested), 6-month cash flow AreaChart, balance carry-forward with rollover, spending breakdown donut chart, recent transactions, goals with progress bars, upcoming reminders, cloud sync status card with Sync Now button
- **Income / Expenses / Investments** — Full CRUD with search, filter, sort (newest/oldest), group (day/week/month), duplicate detection, category auto-suggest, PIN-protected deletion, archive/restore. Mobile: minimal ledger list with tap-to-view detail modal
- **Savings & Goals** — Dual-tab page: savings list with source-of-funds tracking + goals grid with contribute/withdraw and progress bars
- **Partner Accounts** — Vendor/Customer/Contact groups with P&L tracking, investment tracking, portfolio value, dual-entry transactions (reflect in personal account), mini ledger modal per party with transaction history
- **Recurring Transactions** — Automate bills and subscriptions with configurable frequencies and reminder days
- **Adjustments** — Balance corrections between personal and partner accounts with amount guards (±₹99Cr)
- **Budgets** — Category-based monthly/yearly spending limits with overrun warnings (≥80%)
- **Reminders** — One-time or recurring (daily to yearly) with "Mark as Paid" that creates expense transactions and auto-reschedules
- **Archive** — Soft-delete across all entity types with bulk restore, permanent delete, or empty-all (PIN-protected)
- **Audit Ledger** — Full mutation log with entity type icons, action badges, expandable life-cycle chain, copy transition ID, CSV export, entity/action filters, search
- **Export / Import** — CSV (transactions), PDF (jsPDF with auto-table), Excel (SheetJS), and full JSON backup with cross-user detection and reassignment
- **PIN Security** — 10 one-time 4-digit PINs for sensitive operations (delete, edit, archive, export/import, clear data); session auto-lock (1h–24h)
- **Activity Log** — Tracks 200 most recent security and CRUD events with color-coded timeline in Settings
- **Notifications** — In-app notification panel: recurring due alerts, budget overruns, archive notifications, pending reminders, weekend backup reminder
- **Onboarding Wizard** — 6-step setup (Personal Info, Financial Profile, Work/Business, Partner Accounts, Savings Goal, Complete) with optional steps, T&C agreement, and re-edit support
- **Edit Profile** — Re-open onboarding from About page or landing page (PIN-protected) to update registration info
- **Incomplete Registration Cleanup** — Unfinished onboarding sessions are auto-cleared on next visit
- **Landing Page Redirect** — Logged-in users skip landing page; existing users can visit via `/?from=dashboard`
- **Public Terms, Privacy & About Pages** — Standalone `/terms`, `/privacy`, and `/about` pages accessible without login
- **Name Autofill** — Full name remembered from registration and auto-filled on subsequent sign-ups
- **Multi-User** — Multiple profiles with quick-switch from login screen
- **Dark / Light Theme** — Toggleable, persisted in localStorage
- **3 Brand Colors** — Orange (default), Royal Blue, Emerald Green — changeable in Settings
- **Scroll Animations** — Staggered Reveal animations on all major sections
- **PWA Ready** — Install as a standalone app with service worker caching
- **Floating Mobile Nav** — Bottom-right FAB with filtered nav (Dashboard, Income, Expenses, Savings, Investments, Partners, Settings)

---

## Cloud Sync Setup

Money Meva Premium uses **PouchDB** (local) + **CouchDB** (remote) for real-time, bi-directional sync across all your devices.

### How it works

```
Device A ──→ Local PouchDB ──→ Remote CouchDB ──→ Local PouchDB ──→ Device B
                 │                                        │
            IndexedDB                                IndexedDB
           (offline-capable)                      (offline-capable)
```

Every change you make (add/edit/delete transaction, partner, budget, etc.) is written to local IndexedDB, then synced to the remote CouchDB server via PouchDB. Other connected devices receive the changes in real-time via live replication.

### Prerequisites

A CouchDB server URL (e.g., deployed on [Railway.app](https://railway.app), or any CouchDB-compatible host). The server must be reachable from all your devices.

### Step-by-Step

1. **Set up a CouchDB server** – Deploy CouchDB on Railway.app, Fly.io, or your own server. Create a database (e.g., `mm_sync`).
2. **Get the database URL** – The URL format is `https://username:password@your-server.railway.app/db-name`.
3. **Open Settings → Multi-Device Sync** in the app.
4. **Enter the URL** – Paste your CouchDB URL in the input field.
5. **Tap Connect** – The app will test the connection and begin live sync.
6. **Repeat on other devices** – Log in to the same account on another device and enter the same URL.

### Status Indicators

| Indicator | Meaning |
|---|---|
| 🟢 Green dot | Connected — real-time sync active |
| 🟡 Amber dot (pulse) | Connecting — attempting to reach server |
| 🔴 Red dot | Offline — connection failed or no URL configured |

### Dashboard Sync Card

A sync status card appears on the dashboard showing:
- Current connection status with colored indicator
- **Sync Now** button — tap to force a re-sync or reconnect

### Notes

- Sync is **optional** — the app works fully offline without it
- All data is stored locally first (IndexedDB); the remote is a replica
- Clearing data while sync is enabled may cause conflicts — disable sync first in Danger Zone
- CouchDB authentication (username/password) is supported in the URL

---

## Tech Stack

| Category | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| UI | React 19, Tailwind CSS v4, Lucide React |
| Local DB | Dexie.js 4 (IndexedDB) |
| Sync DB | PouchDB (multi-device sync) |
| Charts | Recharts 3 |
| PDF | jsPDF 4 + jspdf-autotable |
| Excel | SheetJS (xlsx) |
| Dates | date-fns 4 |
| Auth | Local (email/password) + optional Supabase Google OAuth |
| Linting | ESLint 9 |
| Deployment | Static export (`output: 'export'`), Netlify, Node server |

---

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser. The app runs entirely client-side — no server database required.

### Production Build

```bash
npm run build
npm run start
```

### Standalone Package

```powershell
npm run package:webapp
```

Extract `dist/money-meva-webapp-<version>.zip` and run `node server.js`.

### Android APK

An Android APK can be built on-demand via **GitHub Actions**:

1. Go to [Build Android APK](https://github.com/kuldeep7ke/money-meva/actions/workflows/build-apk.yml) workflow
2. Click **"Run workflow"** → select branch `master` → click **"Run workflow"**
3. Wait ~2–3 minutes for the build to finish
4. Download `MoneyMeva-APK.zip` from the run's **Summary** page under **Artifacts**

The APK is a debug build (unsigned) and works on Android 7+ (API 24+).

You can also trigger a build directly from the app's **Settings → Android APK** section.

---

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build (auto-bumps patch) |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run package:webapp` | Create standalone zip |
| `npm run version:patch` | Bump patch version |
| `npm run version:minor` | Bump minor version |
| `npm run version:major` | Bump major version |

---

## Build Specification

A detailed step-by-step build prompt (`From-Scratch.md`) is included in the repo. It covers the complete architecture, all 40 build steps, data flow, security model, edge cases, and UI patterns — allowing regeneration of the entire app from scratch using any AI coding agent.

---

## Privacy

- **100% local-first** — all data stays in your browser's IndexedDB
- **Cloud sync** — optional PouchDB synchronization for multi-device access
- No cookies, analytics, or tracking services
- No external data transmission unless you explicitly export or enable sync

---

## License

All Rights Reserved. Copyright © 2026 Money Meva Premium. Unauthorized copying, distribution, or use of this software is strictly prohibited.

---

*Money Meva Premium — Built with Next.js, TypeScript, Tailwind CSS, Dexie.js, and PouchDB. Made in India.*
