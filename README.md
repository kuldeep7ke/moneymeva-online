# Money Meva

> *Where does the money go? Let's find out.*
> > **पैसे कुठे जातात? शोधूया.**

**v7.1.1.91** — A minimalistic, local-first personal finance companion.
Built with Next.js 16, TypeScript, Dexie.js, PouchDB, Supabase, and Tailwind CSS v4.
Made in India.

---

## Memory Capsule

This README is a memory capsule — a snapshot of the project's philosophy, architecture, and soul. It exists so that years from now, the intent behind every line of code is knowable.

---

## Philosophy

Money Meva was built around a single belief: **financial clarity should not require surrendering privacy**. Every feature, every tradeoff, every line of code traces back to this.

- **Local-first by default** — your data lives in your browser's IndexedDB. No cloud required, no accounts to create, no subscription to maintain.
- **Sync is optional** — multi-device sync exists only so you are not chained to one device. It uses a shared Supabase database with per-user isolation (email + password), and you can bring your own Supabase project.
- **PINs, not passwords** — sensitive operations (deletes, edits, exports) require a 4-digit PIN, not a backend call. Security without dependence.
- **Soft-delete everywhere** — nothing is truly gone. Every entity carries a `deletedAt` timestamp. The archive is your safety net.
- **Transitions are traceable** — every mutation carries a `transitionId`, linking lifecycles across entities. The ledger is the source of truth.

---

## Features

### Core
- **Income, Expenses, Investments** — Full CRUD with search, filter, sort, group by day/week/month, duplicate detection, category auto-suggest, PIN-protected deletion, archive/restore. Mobile: minimal ledger list with tap-to-view detail modal. **Account badges** (Cash/Bank/UPI/Invest) next to the description on desktop and beside the date in the mobile list — including in the Android APK. Transaction types are exactly three: `income`, `expense`, `investment` (no savings type). Categories stay separate per type (income/expense/investment lists). Future-dated entries are blocked — date pickers cap at today and submit validates with a warning toast.
- **Dashboard** — Auto-hiding welcome card, 6 summary cards (Balance, Income, Expenses, Investments, Available to Spend, Partner Invested), 6-month cash flow AreaChart, balance carry-forward with rollover, spending breakdown donut chart, recent transactions, goals with progress bars, upcoming reminders, cloud sync status card with inline Sync Now. Quick-add modals via the + button on any summary card — no page navigation needed.
- **Investment Calculator** — Built-in calculator with 4 scrollable pill tabs: FD (quarterly/half-yearly/yearly compounding), SIP, RD, PPF. Shows maturity amount, total returns, and year-wise breakdown. "Use this amount" fills the add form. Accessible from Investments page header.
- **Developer Zone** — Hidden diagnostic page with session timer (auto-expires), live version + release-notes tracking status, DB stats viewer, localStorage inspector, storage usage, sync diagnostics (masked URL, sync account email, connection test, last sync event, timing hints), remote announcement diagnostics (masked Bin IDs, live bin fetch test, dismissed-pills counter + clear), raw JSON export/import, quick brand switcher, PIN viewer, and danger zone for full data wipe.
- **Savings & Goals** — Dual-tab page: goals grid with contribute/withdraw + progress bars, and a finance to-do list. Goal contributions record as `expense` transactions (withdrawals as `income`).
- **Partner Accounts** — Vendor/Customer/Contact groups with P&L tracking, investment tracking, portfolio value, dual-entry transactions, mini ledger modal per party, and full edit (name, group, type, investment, description) from the partners page. Includes a **Partnership (भागीदारी) tab** for shared work: members with % shares (must total 100%), shared income/expense entries with "who paid" tracking, automatic settlement balances (gets/owes), and optional mirroring into the main Income/Expense ledger.
- **Works (कामे)** — Work register for farm jobs, labour and hired work. Each work records direction (I will receive / I will pay), trade profile with preset work types (farmer, farm services, labour, shop, contractor, transport, general), crop, season (kharif/rabi/summer/annual), year, area (acre/hectare/guntha/are), start/end dates (auto duration), party and partnership links, and an agreed amount. Record payments per work — optionally auto-creating a matching Income or Expense ledger entry — with a full payment history and progress bar. Dashboard shows a Pending Works card when receivables exist.
- **Farmer Onboarding** — Farmer added as a profession choice during onboarding; selects farming income/expense/investment categories (Farm Sale, Seeds, Fertilizer, Diesel/Fuel…) and maps to the farmer work profile in Works.
- **Recurring Transactions** — Automate bills and subscriptions with configurable frequencies and reminder days. Future start/end dates allowed.
- **Adjustments** — Balance corrections between personal and partner accounts with amount guards.
- **Budgets** — Category-based monthly/yearly spending limits with overrun warnings at ≥80%.
- **Reminders** — One-time or recurring (daily to yearly) with "Mark as Paid" that creates expense transactions and auto-reschedules.
- **Archive** — Soft-delete across all entity types with bulk restore, permanent delete, or empty-all (PIN-protected).
- **Audit Ledger** — Full mutation log with entity type icons, action badges, expandable lifecycle chain, copy transition ID, CSV export, entity/action filters, search.
- **Categories Page** — Dedicated management page with Income/Expense/Investment tabs; inline edit, delete, add; PIN-protected batch save to localStorage.
- **Export / Import** — CSV (transactions), PDF (jsPDF with auto-table), Excel (SheetJS), full JSON backup/restore with cross-user detection and reassignment. Import from JSON file via Developer Zone to restore data across devices. On Android, exports open the **native share sheet** (file written to app Cache, then shared — blob downloads don't work inside the WebView).
- **Save Toasts** — every successful income/expense/investment/partner save shows a summary toast (`{Type} added · {category} · {amount}`) across add, duplicate-confirm, and edit flows.

### Remote Announcements (jsonbin.io)
- **Broadcast Pills** — floating color-coded notifications centered at the top of the screen (info/warning/success/error). Multiple messages stack; each is independently dismissable per device; `pinned` messages have no dismiss; optional `link` makes the whole pill clickable; `expires` auto-hides old messages. Emojis supported.
- **Banner Modal** — full-screen ad-style overlay with centered card: title, content, image, optional click-through `href`, configurable width (`max-w-sm`…`max-w-2xl`). Shows a skeleton loading card while fetching; the X close button appears in the top-right only after the banner fully displays (image included), then counts down 7 seconds before enabling. Shows once per app start/refresh/reload — never on in-app menu navigation. Scheduled via inclusive local-calendar-day `startDate` + `expires`.
- **Zero-deploy editing** — both are driven by JSON bins on jsonbin.io. Edit in the jsonbin dashboard → save → all users (web AND installed APKs) see changes within ~10 min. No commit, no build, no store update. See [`docs/BROADCAST-GUIDE.md`](docs/BROADCAST-GUIDE.md).
- **Quota-protecting edge proxy** — apps fetch from the site's own `/api/announcements` Cloudflare Pages Function (`functions/api/announcements.js`), which edge-caches responses for 10 minutes (`TTL_MINUTES`). jsonbin request volume is time-bound, not user-bound — direct-jsonbin fallback keeps announcements live if the proxy ever fails.
- **What's New Modal** — on dashboard load the app compares its version against `mm_seen_release` and shows release notes once per version (fires after APK installs too).

### Security & Privacy
- **PIN Security** — 10 one-time 4-digit PINs for sensitive operations (delete, edit, archive, export/import, clear data). Session auto-lock (1h–24h).
- **Password + PIN** — Email/password auth locally. Optional PIN gate on the account page for password changes and data clearing.
- **Activity Log** — Tracks 200 most recent security and CRUD events with color-coded timeline in Settings.
- **100% local-first** — no cookies, analytics, or tracking services. No external data transmission unless you explicitly export or enable sync.

### Multi-Device Sync (Supabase)
- **PouchDB + Supabase** — a local PouchDB buffer (`mm_pouch`) syncs to a shared Supabase `sync_docs` table. Manual + live (realtime) sync. Data is stored on the cloud — it doubles as a backup.
- **Every section syncs** — all 11 data entities (transactions, partners, recurring, budgets, reminders, adjustments, goals, todos, works, partnerships, partnership_entries) plus the PIN batch push through one doc store (`entity:id` rows). Only the device-local audit log and UI preferences stay on-device.
- **Per-user isolation** — every row carries `user_id`; Row-Level Security guarantees no account can read or write another account's data.
- **Email + password login** — Supabase Auth. URL + anon key are pre-configured from the build; users just enter their email + password.
- **Create account & sync** — first-time sign-up connects instantly; **Connect** re-uses an existing account on another device. **Google sign-in connects automatically** — no email/password needed.
- **Live sync** — realtime subscription pushes remote changes into the local buffer within seconds; a 30-second reconnect timer handles drops.
- **Manual sync** — `manualSync()` returns `{ ok, pushed, pulled }` with actual doc counts. No infinite recursion.
- **Bring your own Supabase** — advanced users can paste a different URL + anon key in Settings to use their own project (see `CLOUD-SYNC-GUIDE.md`).

### User Experience
- **Multi-user** — Multiple profiles with quick-switch from login screen.
- **Dark / Light Theme** — Toggleable, persisted in localStorage.
- **3 Brand Colors** — Orange (default), Royal Blue, Emerald Green — changeable in Settings.
- **i18n** — Marathi (default), Hindi, English. Grammar-preserving translations with context-appropriate vocabulary. English loanwords only for tech/modern terms.
- **Global Toast System** — Success/error/warning/info toasts via `useToast()` (replaces all native `alert()` calls).
- **Skeleton Loading** — Animated skeleton components (`SkeletonCard`, `SkeletonTable`, `SkeletonChart`, `SkeletonList`) replace spinners on data-heavy pages.
- **Empty States** — Every list/table/chart shows an icon + heading + hint CTA when empty.
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
| Sync | PouchDB 9 (local buffer) + Supabase Postgres (cloud hub, realtime) |
| Charts | Recharts 3 |
| PDF | jsPDF 4 + jspdf-autotable |
| Excel | SheetJS (xlsx) |
| Dates | date-fns 4 |
| Auth | Local (email/password) + optional Supabase Auth for cloud sync |
| Mobile | Capacitor 8 (Android) — app, browser, filesystem, share, local-notifications, status-bar |
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
                         │  Supabase sync_docs (opt-in)│
                         │  Cloud hub + backup         │
                         │  Per-user rows (user_id)    │
                         │  Row-Level Security         │
                         │  Realtime subscription      │
                         │  Auto-reconnect (30s)       │
                         └────────────────────────────┘

Write path:  Cache → Dexie → Mutation Log → PouchDB ──→ Supabase (fire-and-forget)
Read path:   Cache ← Dexie (hydration on load)
Sync path:   PouchDB ↔ Supabase (bidirectional, realtime + manual)
```

Every entity carries: `id`, `transitionId`, `userId`, `createdAt`, `updatedAt`, `deletedAt`.

### Sync Architecture Details

```
signUpUser(url, key, email, password):
  supabase.auth.signUp({ email, password })
    → creates account (JWT session)
    → connectRemote(...) on success

connectRemote(url, key, email, password):
  init Supabase client (url + anon key)
  supabase.auth.signInWithPassword({ email, password })
    → session stored under sb-<project-ref>-auth-token (Supabase JS standard)
  pushAllToPouch()      ← push local PouchDB → sync_docs (upsert, onConflict user_id,id)
  subscribe to sync_docs_realtime (replica identity full)
  pullAll() → processRemoteChanges()   ← pull remote rows into local PouchDB
  → onRemoteChange(fn) fires live UI updates
  → startReconnectTimer(30s interval) on disconnect

manualSync():
  pushAllToPouch()  ← upsert local changes (onConflict 'user_id,id')
  pullAll() + processRemoteChanges()  ← apply remote changes
  returns { ok, pushed, pulled }

checkConnection():
  session valid → lightweight ping → true
  session dead (expired token / stale client):
    → recreate client → getSession() (auto-refreshes token)
    → ping → re-subscribe realtime → true; else false
  → self-healing, no false negatives
ensureConnected():  ← re-subscribe if session exists but subscription dropped

Reconnect timer (30s):  detects dead sessions, recreates client, refreshes session,
  re-subscribes, dispatches sync event "Sync reconnected" → Settings UI updates live
  (listenSyncEvents) — no stale "create account" form on flaky Android networks.
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
│   ├── BroadcastBanner.tsx      # Remote broadcast pills (jsonbin.io)
│   ├── BannerModal.tsx          # Remote ad-style banner overlay (jsonbin.io)
│   ├── WhatsNewModal.tsx        # Release notes modal, once per version
│   ├── Toast.tsx                # Global toast system (context + container)
│   ├── Skeleton.tsx             # Skeleton loading components (card/table/chart/list)
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
│   ├── pouchdb.ts               # Cloud sync: Supabase Auth + sync_docs + local PouchDB buffer
│   ├── db.ts                    # Dexie schema (tables, indexes)
│   ├── localAuth.ts             # Email/password auth (local)
│   ├── pinStore.ts              # PIN generation and validation
│   ├── sync-notify.ts           # CustomEvent-based sync status dispatch
│   ├── activityLog.ts           # Security + CRUD event history
│   ├── export.ts                # PDF + Excel + CSV export
│   ├── download.ts              # downloadBlob (native share sheet on Android), copyText, printHtml
│   ├── env.ts                   # Runtime config (Supabase URL/key, site URL, jsonbin Bin IDs) — XOR-obfuscated, never plain text in the bundle
│   ├── whats-new.ts             # Release notes + version tracking for What's New modal
│   ├── defaultCategories.ts     # Default category seed data
│   ├── capacitor-notifications.ts # Local notification scheduling
│   ├── utils.ts                 # cn(), useInView, date helpers
│   └── i18n/
│       ├── index.tsx            # I18nProvider + useTranslation hook
│       └── translations.ts      # All translation data (mr, hi, en)
└── types/
    └── index.ts                 # All TypeScript interfaces/types
```

The project also contains a **documentation vault** at `docs/` (Obsidian-compatible):
```
docs/
├── Home.md             # Dashboards the vault
├── Start-Here.md       # Onboarding
├── USER-GUIDE.md       # End-user manual
├── Active-Tasks.md     # Current work tracker
├── Bug-Tracker.md      # Open issues
├── File-Map.md         # Every source file linked
├── Architecture.md · Data-Flow.md · i18n.md · Sync.md · Security.md · Capacitor.md · Changelog.md
├── templates/          # Feature / Bug Report / Daily Dev Log / Quick Note
└── dev/                # Daily development logs
```
Cloud sync schema lives in [`supabase/schema.sql`](supabase/schema.sql). Owner setup + troubleshooting: [`CLOUD-SYNC-GUIDE.md`](CLOUD-SYNC-GUIDE.md). Remote broadcast/banner editing: [`docs/BROADCAST-GUIDE.md`](docs/BROADCAST-GUIDE.md).

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

Cloud sync uses **Supabase** (Postgres + Auth + Realtime) — every user gets their own private data space with email + password login.

> **Self-hosting the app with your own database and Google login?**
> Follow the step-by-step guide: **[SELF-HOSTING.md](SELF-HOSTING.md)** — clone → create a free Supabase project → run `supabase/schema.sql` → fill 3 values in `.env.local` → rebuild. Offline-first by default; cloud sync is optional.

1. **Create a Supabase project** at https://supabase.com (free tier is enough)
2. **Create the sync table** — open SQL Editor, run the contents of [`supabase/schema.sql`](supabase/schema.sql)
3. **Get your keys** — Project Settings → API:
   - Project URL: `https://<project-ref>.supabase.co`
   - anon public key (starts with `eyJ…`)
4. **Keys are NOT baked in** — the repo ships cloud-free. For sync/Google login, create `.env.local` from [`.env.example`](.env.example) with `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL` and rebuild (full walkthrough: [SELF-HOSTING.md](SELF-HOSTING.md)). End users can also paste a project URL + key per device in Settings at runtime.
5. **In-app** — Settings → Multi-Device Sync:
   - **New user:** enter an email + a **password you choose** (min 6 characters — this is your *cloud account* password, unrelated to the app unlock password or your Google password) → tap **Create account & sync**
   - **Existing user:** enter the same email + password → tap **Connect**
   - **Signed in with Google:** use the same Google email and tap **Create account & sync** to pick a password for that account
6. **Repeat on each device** — same email + password on every device

Each account's data is isolated in the cloud (row-level security) — no user can see another user's data. The app works fully offline without sync; sync is optional.

> **Tip:** to let new users sign up instantly without email confirmation, turn off **Authentication → Sign In / Providers → Email → "Confirm email"** in the Supabase dashboard (or run the one-liner at the bottom of `supabase/schema.sql`).

> **Advanced:** users can paste a different URL + anon key directly in Settings to point at their own Supabase project (bring-your-own-Supabase).

---

## Remote Announcements Setup (jsonbin.io + edge cache)

Broadcast pills and banner modals are driven by [jsonbin.io](https://jsonbin.io) — edit them online without touching this repo:

1. **Create bins** — jsonbin.io → Bins → Create Bin (Public): one for broadcasts (array of pill objects), one for the banner (single object)
2. **Wire the Bin IDs** — put them in [`functions/api/announcements.js`](functions/api/announcements.js) (server-side only; override with Pages env vars `BROADCAST_BIN_ID`/`BANNER_BIN_ID`) and in [`src/lib/env.ts`](src/lib/env.ts) as XOR+base64 obfuscated fallbacks
3. **Build once** — after that, editing the JSON online is enough. Apps fetch `/api/announcements?type=broadcast|banner`, which the Cloudflare Function serves from an edge cache (10 min, tunable via `TTL_MINUTES`) → jsonbin volume stays time-bound regardless of user count

Full field reference, scheduling recipes, and day-to-day workflow: [`docs/BROADCAST-GUIDE.md`](docs/BROADCAST-GUIDE.md).

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
Requires Android 7+ (API 24). Features back button navigation, status bar handling, local notifications, and native share-sheet exports (PDF/Excel/CSV write to app Cache then open the share sheet).

A GitHub Actions workflow also builds the APK automatically on every push to master:
[Build Android APK](https://github.com/kuldeep7ke/moneymeva-online/actions/workflows/build-apk.yml)

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
| Accounts | खाती | Categories | वर्ग |
| Terms | अटी | Privacy | गोपनीयता |

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
| Accounts | खाते | Categories | वर्ग |
| Terms | शर्तें | Privacy | गोपनीयता |

---

## License

All Rights Reserved. Copyright © 2026 Money Meva.

---

*Made in India. Built with Next.js, TypeScript, Tailwind CSS, Dexie.js, PouchDB, Supabase, and love.*
