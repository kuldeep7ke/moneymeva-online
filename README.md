# Money Meva

> **पैसे कुठे जातात? शोधूया.**
> *Where does the money go? Let's find out.*

**v7.1.1.13** — A minimalistic, local-first personal finance companion.
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
- **Dashboard** — Auto-hiding welcome card, 6 summary cards (Balance, Income, Expenses, Investments, Available to Spend, Partner Invested), 6-month cash flow AreaChart, balance carry-forward with rollover, spending breakdown donut chart, recent transactions, goals with progress bars, upcoming reminders, cloud sync status card with inline Sync Now. Quick-add modals via the + button on any summary card — no page navigation needed.
- **Investment Calculator** — Built-in calculator with 4 scrollable pill tabs: FD (quarterly/half-yearly/yearly compounding), SIP, RD, PPF. Shows maturity amount, total returns, and year-wise breakdown. "Use this amount" fills the add form. Accessible from Investments page header.
- **Developer Zone** — Hidden diagnostic page with session timer (auto-expires), DB stats viewer, localStorage inspector, sync diagnostics, raw JSON export/import, quick brand switcher, PIN viewer, and danger zone for full data wipe.
- **Savings & Goals** — Dual-tab page: savings list with source-of-funds tracking + goals grid with contribute/withdraw and progress bars.
- **Partner Accounts** — Vendor/Customer/Contact groups with P&L tracking, investment tracking, portfolio value, dual-entry transactions, mini ledger modal per party.
- **Recurring Transactions** — Automate bills and subscriptions with configurable frequencies and reminder days.
- **Adjustments** — Balance corrections between personal and partner accounts with amount guards.
- **Budgets** — Category-based monthly/yearly spending limits with overrun warnings at ≥80%.
- **Reminders** — One-time or recurring (daily to yearly) with "Mark as Paid" that creates expense transactions and auto-reschedules.
- **Archive** — Soft-delete across all entity types with bulk restore, permanent delete, or empty-all (PIN-protected).
- **Audit Ledger** — Full mutation log with entity type icons, action badges, expandable lifecycle chain, copy transition ID, CSV export, entity/action filters, search.
- **Export / Import** — CSV (transactions), PDF (jsPDF with auto-table), Excel (SheetJS), full JSON backup/restore with cross-user detection and reassignment. Import from JSON file via Developer Zone to restore data across devices.

### Security & Privacy
- **PIN Security** — 10 one-time 4-digit PINs for sensitive operations (delete, edit, archive, export/import, clear data). Session auto-lock (1h–24h).
- **Password + PIN** — Email/password auth locally. Optional PIN gate on the account page for password changes and data clearing.
- **Activity Log** — Tracks 200 most recent security and CRUD events with color-coded timeline in Settings.
- **100% local-first** — no cookies, analytics, or tracking services. No external data transmission unless you explicitly export or enable sync.

### Multi-Device Sync
- **CouchDB + PouchDB** — Manual + live sync. Push your local IndexedDB to a remote CouchDB server, pull on another device.
- **Your own server** — Bring your own CouchDB URL (e.g., Railway, Cloudant, self-hosted). Enter `https://user:pass@host/db-name` in Settings → Cloud Sync.
- **Live replication** — Once connected, changes sync in real-time. Errors are logged but never kill the connection (`retry: true`).
- **Auto-reconnect** — If live sync disconnects, a 30-second interval timer attempts reconnection automatically.
- **Manual sync** — `manualSync()` returns `{ ok, pushed, pulled }` with actual doc counts. No infinite recursion (removed `notifyChange` call from push path).
- **`skip_setup: false`** — PouchDB auto-creates the remote database on connect. No manual DB creation needed.
- **Sync URL history** — Last 5 URLs saved for quick reconnection. Saved URLs always visible.

### User Experience
- **Multi-user** — Multiple profiles with quick-switch from login screen.
- **Dark / Light Theme** — Toggleable, persisted in localStorage.
- **3 Brand Colors** — Orange (default), Royal Blue, Emerald Green — changeable in Settings.
- **i18n** — Marathi (default), Hindi, English. Grammar-preserving translations with context-appropriate vocabulary. English loanwords only for tech/modern terms.
- **Scroll Animations** — Staggered Reveal animations on all major sections.
- **Animated Icons** — Key UI elements (sync spinner, loading states, status dots, nav indicators) use CSS animations (spin, bounce, pulse) for visual feedback.
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
| Auth | Local (email/password) — Supabase removed, fully local-first |
| Mobile | Capacitor 8 (Android) |
| Linting | ESLint 9 |

---

## Data Architecture

```
                        ┌─────────────────────────────────────┐
                        │         User Action (UI)            │
                        │  add / update / delete / restore    │
                        └──────────────┬──────────────────────┘
                                       │
                                       ▼
                        ┌──────────────────────────────┐
                        │   In-Memory Cache (sync)     │
                        │   UI reads instantly from    │
                        │   cache — no async wait      │
                        └──────────────┬───────────────┘
                                       │
                         ┌─────────────▼──────────────┐
                         │     Dexie.js (IndexedDB)   │
                         │   Persistent local store   │
                         │   Cache hydrates from here │
                         │   on page load             │
                         └─────────────┬──────────────┘
                                       │
                         ┌─────────────▼──────────────┐
                         │    Mutation Log (Dexie)    │
                         │   logMutation() writes     │
                         │   every CRUD action with   │
                         │   transitionId tracking    │
                         └─────────────┬──────────────┘
                                       │
                         ┌─────────────▼──────────────┐
                         │   PouchDB (local .pouch)   │
                         │   Fire-and-forget write    │
                         │   putDoc()/removeDoc()     │
                         │   ID format: entity:id     │
                         │   entity tag on every doc  │
                         └─────────────┬──────────────┘
                                       │
                         ┌─────────────▼──────────────┐
                         │  CouchDB (remote — opt-in) │
                         │  Live replication (sync)   │
                         │  Manual push/pull          │
                         │  Auto-reconnect (30s)      │
                         └────────────────────────────┘

Write path:  Cache → Dexie → Mutation Log → PouchDB ──→ CouchDB (fire-and-forget)
Read path:   Cache ← Dexie (hydration on load)
Sync path:   PouchDB ↔ CouchDB (bidirectional, live + manual)
```

Every entity carries: `id`, `transitionId`, `userId`, `createdAt`, `updatedAt`, `deletedAt`.

### Sync Architecture Details

```
manualSync():
  localDB.replicate.to(remoteDB)     ← push local changes
  localDB.replicate.from(remoteDB)   ← pull remote changes
  returns { ok, pushed, pulled }

connectRemote(url):
  createRemote(Pouch, url) with { skip_setup: false }
    → PouchDB auto-creates remote DB on connect
  localDB.sync(remoteDB, { live: true, retry: true })
    → live replication with built-in retry
  syncHandler.on('error', console.warn)
    → errors logged, connection never killed
  On disconnect: startReconnectTimer(30s interval)
    → attempts reconnection until successful
```

---

## Project Structure

```
src/
├── app/                          # Next.js App Router pages
│   ├── auth/
│   │   └── callback/            # OAuth callback handler
│   ├── dashboard/               # All dashboard sub-pages
│   │   ├── about/               # App info + version
│   │   ├── account/             # PIN-gated user account page
│   │   ├── accounts/            # Bank/cash account management
│   │   ├── adjustments/         # Balance corrections
│   │   ├── archive/             # Soft-delete management
│   │   ├── expenses/            # Expense CRUD
│   │   ├── income/              # Income CRUD
│   │   ├── investments/         # Investment CRUD
│   │   ├── ledger/              # Audit mutation log
│   │   ├── partners/            # Vendor/Customer/Contact mgmt
│   │   ├── privacy/             # Public privacy page
│   │   ├── recurring/           # Recurring transactions
│   │   ├── savings/             # Savings + Goals
│   │   ├── settings/            # Sync, theme, language, danger zone
│   │   ├── summary/             # Monthly/yearly summaries
│   │   ├── developer/           # Developer Zone with timer, diagnostics, import
│   │   ├── support/             # Public support page
│   │   ├── terms/               # Public terms page
│   │   ├── page.tsx             # Dashboard home (cards, charts, quick-add)
│   │   └── layout.tsx           # Dashboard layout wrapper
│   ├── login/                   # Sign in / Sign up
│   ├── onboarding/              # 6-step setup wizard
│   ├── terms/                   # Public terms page
│   ├── privacy/                 # Public privacy page
│   ├── layout.tsx               # Root layout with version meta tag
│   ├── page.tsx                 # Landing/redirect page
│   ├── loading.tsx              # Global loading state
│   └── globals.css              # Tailwind + CSS variables
├── components/                  # Shared React components
│   ├── AuthProvider.tsx         # Auth context provider
│   ├── DashboardLayout.tsx      # Sidebar nav + layout wrapper
│   ├── TransactionPage.tsx      # Shared income/expense/investment CRUD page
│   ├── InvestmentCalculator.tsx # FD/SIP/RD/PPF calculator (4 pill tabs)
│   ├── LanguageSelector.tsx     # i18n language dropdown (portal)
│   ├── PinPrompt.tsx            # PIN entry modal
│   ├── PinSetupGuide.tsx        # PIN setup instructions
│   ├── SyncStatusBar.tsx        # Sync status indicator
│   ├── NotificationPanel.tsx    # Notification display
│   ├── ThemeProvider.tsx        # Dark/light theme provider
│   ├── LoadingOverlay.tsx       # Full-screen loading overlay
│   ├── InstallPrompt.tsx        # PWA install prompt
│   ├── RegisterSW.tsx           # Service worker registration
│   ├── DataSafetyNotice.tsx     # Data privacy notice
│   ├── SecurityTipNotice.tsx    # Security tip banner
│   ├── ShareButton.tsx          # Share functionality
│   ├── Reveal.tsx               # Scroll-reveal animation wrapper
│   └── ui/
│       └── button.tsx           # Reusable button component
├── lib/                         # Core logic
│   ├── store.ts                 # Data layer (cache + Dexie + sync + CRUD)
│   ├── pouchdb.ts               # PouchDB remote connection + sync + PIN pouch
│   ├── db.ts                    # Dexie schema (tables, indexes)
│   ├── localAuth.ts             # Email/password auth (local)
│   ├── supabase.ts              # Legacy (removed, kept for reference)
│   ├── pinStore.ts              # PIN generation and validation
│   ├── sync-notify.ts           # CustomEvent-based sync status dispatch
│   ├── activityLog.ts           # Security + CRUD event history
│   ├── export.ts                # PDF + Excel + CSV export
│   ├── defaultCategories.ts     # Default category seed data
│   ├── capacitor-notifications.ts # Local notification scheduling
│   ├── utils.ts                 # cn(), useInView, date helpers
│   └── i18n/
│       ├── index.tsx            # I18nProvider + useTranslation hook
│       └── translations.ts      # All translation data (mr, hi, en)
└── types/
    └── index.ts                 # All TypeScript interfaces/types
```

---

## Commands

| Command | Description |
|---|---|
| `npm run dev` | Start dev server at localhost:3000 |
| `npm run build` | Production build (static export to `out/`) |
| `npm run start` | Serve production build |
| `npm run lint` | Run ESLint |
| `npm run version:patch` | Bump patch version (vX.Y.Z.N → vX.Y.Z.N+1) |
| `npm run version:minor` | Bump minor version |
| `npm run version:major` | Bump major version |
| `npx cap sync android` | Sync web build to Android project |
| `npx cap copy android` | Copy web assets to Android |
| `npx cap build android` | Build Android release |
| `npm run android:apk` | Full APK build: build → version:patch → gradle assembleDebug |

---

## Cloud Sync Setup

1. **Get a CouchDB URL** — e.g., `https://admin:pass@your-host.up.railway.app/money_meva`
2. **Settings → Cloud Sync** — paste your URL into the input field
3. **Tap Connect** — data pushes to cloud, then pulls from cloud
4. **Repeat on each device** — same URL on every device

The app works fully offline without sync. Sync is optional.

### CORS Configuration (if self-hosting)
If you host your own CouchDB, enable CORS:
```bash
curl -X PUT https://admin:pass@your-host/_node/_config/couchdb/httpd/enable_cors \
  -H "Content-Type: application/json" -d '"true"'
curl -X PUT https://admin:pass@your-host/_node/_config/chttpd/enable_cors \
  -H "Content-Type: application/json" -d '"true"'
curl -X PUT https://admin:pass@your-host/_node/_config/chttpd/cors/origins \
  -H "Content-Type: application/json" -d '"*"'
curl -X PUT https://admin:pass@your-host/_node/_config/chttpd/cors/credentials \
  -H "Content-Type: application/json" -d '"true"'
curl -X PUT https://admin:pass@your-host/_node/_config/chttpd/cors/headers \
  -H "Content-Type: application/json" -d '"accept, authorization, content-type, origin, referer, x-requested-with"'
curl -X PUT https://admin:pass@your-host/_node/_config/chttpd/cors/methods \
  -H "Content-Type: application/json" -d '"GET, PUT, POST, HEAD, DELETE"'
```

---

## Android APK

```bash
npm run android:apk
# Or step by step:
npm run build
npx cap sync android
cd android
./gradlew assembleDebug
```

The APK is at `android/app/build/outputs/apk/debug/app-debug.apk`.
Requires Android 7+ (API 24). Features back button navigation, status bar handling, and local notifications.

A GitHub Actions workflow also builds the APK automatically on every push to master:
[Build Android APK](https://github.com/kuldeep7ke/money-meva-premium/actions/workflows/build-apk.yml)

---

## i18n Philosophy

- **Grammar stays native** (Marathi/Hindi SOV structure preserved)
- **English loanwords only** for tech/modern terms: Dashboard, Loading, Save, Sync, UPI, PIN, Google, Settings
- **Everyday words** for money concepts: खर्च, बचत, पैसे, रक्कम, तारीख, श्रेणी, व्यवहार, उत्पन्न
- **No awkward mixing** — if the word sounds natural in English to native speakers, use English
- **No repetition** — vary word choice across keys (e.g., ध्येय not गोल for goals in Marathi)
- **Marathi hero**: "पैसे कुठे जातात? शोधूया." (relatable hook)
- **English footer**: Copyright always `© 2026 Money Meva.` in all languages

### Nav Item Labels — Marathi (mr)
| English | Marathi | | English | Marathi |
|---|---|---|---|---|
| Dashboard | डॅशबोर्ड | Adjustments | एडजस्टमेंट |
| Income | उत्पन्न | Summary | सारांश |
| Expenses | खर्च | Ledger | लेजर |
| Savings | ध्येय | Archive | आर्काइव्ह |
| Investments | गुंतवणूक | Settings | सेटिंग्ज |
| Partners | पार्टी | About | माहिती |
| Recurring | आवर्ती | Support | मदत |
| Accounts | खाती | Terms | अटी |
| | | Privacy | गोपनीयता |

### Nav Item Labels — Hindi (hi)
| English | Hindi | | English | Hindi |
|---|---|---|---|---|
| Dashboard | डैशबोर्ड | Adjustments | एडजस्टमेंट |
| Income | कमाई | Summary | सारांश |
| Expenses | खर्च | Ledger | लेजर |
| Savings | बचत | Archive | आर्काइव्ह |
| Investments | निवेश | Settings | सेटिंग्स |
| Partners | पार्टी | About | जानकारी |
| Recurring | आवर्ती | Support | मदद |
| Accounts | खाते | Terms | शर्तें |
| | | Privacy | गोपनीयता |

---

## License

All Rights Reserved. Copyright © 2026 Money Meva.

---

*Made in India. Built with Next.js, TypeScript, Tailwind CSS, Dexie.js, PouchDB, and love.*
