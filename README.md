# Money Meva

> *Where does the money go? Let's find out.*
> > **पैसे कुठे जातात? शोधूया.**

**v7.3.0.38** — A minimalistic, local-first personal finance companion.
Built with Next.js 16, TypeScript, Dexie.js, PouchDB, Supabase, and Tailwind CSS v4.
Made in India. Runs on Windows, Mac, Linux, Docker, and Android.

---

## Memory Capsule

This README documents the project surface — features, architecture, setup, and runbooks. For the deeper philosophical snapshot — *why* every decision was made — see **[MEMORY-CAPSULE.md](MEMORY-CAPSULE.md)**.

---

## Philosophy

Money Meva was built around a single belief: **financial clarity should not require surrendering privacy**. Every feature, every tradeoff, every line of code traces back to this.

- **Local-first by default** — your data lives in your browser's IndexedDB. No cloud required, no accounts to create, no subscription to maintain.
- **Sync is optional** — multi-device sync exists only so you are not chained to one device. It uses a shared Supabase database — every device with the same project URL + anon key reads and writes the same rows (link-only, like the original CouchDB model). No email/password, no accounts.
- **PINs, not passwords** — sensitive operations (deletes, edits, exports) require a 4-digit PIN, not a backend call. Security without dependence.
- **Soft-delete everywhere** — nothing is truly gone. Every entity carries a `deletedAt` timestamp. The archive is your safety net.
- **Transitions are traceable** — every mutation carries a `transitionId`, linking lifecycles across entities. The ledger is the source of truth.

---

## Features

### Core
- **Income, Expenses, Investments** — Full CRUD with search, filter, sort, group by day/week/month, duplicate detection, category auto-suggest, PIN-protected deletion, archive/restore. Mobile: minimal ledger list with tap-to-view detail modal. **Account badges** (Cash/Bank/UPI/Invest) next to the description on desktop and beside the date in the mobile list — including in the Android APK. Transaction types are exactly three: `income`, `expense`, `investment` (no savings type). Categories stay separate per type (income/expense/investment lists). Future-dated entries are blocked — date pickers cap at today and submit validates with a warning toast.
- **Dashboard** — Auto-hiding welcome card, 6 summary cards (Balance, Income, Expenses, Investments, Available to Spend, Partner Invested), 6-month cash flow AreaChart, balance carry-forward with rollover, spending breakdown donut chart, recent transactions, goals with progress bars, upcoming reminders, cloud sync status card with inline Sync Now. Quick-add modals via the + button on any summary card — no page navigation needed.
- **Investment Calculator** — Built-in calculator with 4 scrollable pill tabs: FD (quarterly/half-yearly/yearly compounding), SIP, RD, PPF. Shows maturity amount, total returns, and year-wise breakdown. "Use this amount" fills the add form. Accessible from Investments page header.
- **Savings & Goals** — goals page with contribute/withdraw + progress bars. Goal contributions record as `expense` transactions (withdrawals as `income`).
- **Partner Accounts** — 7 party groups (Personal, Services, Financial, Business, Government, Agriculture, Office) with per-group types, P&L tracking, investment tracking, portfolio value, dual-entry transactions, mini ledger modal per party, full edit from the partners page, and **credit limit + settle-within-days** per party (defaults ₹10,000 / 30 days) with near/reached-limit badges. Includes a **Partnership (भागीदारी) tab** for shared work: members with % shares (must total 100%), shared income/expense entries with "who paid" tracking (lists **all** members — party-linked or free-text), automatic settlement balances (gets/owes), optional mirroring into the main Income/Expense ledger. The **current user is auto-added** as the first member of any new partnership. Partnerships are **type-aware** — the Add/Edit form has a partnership-type picker (Farm, Livestock/Poultry, Business, Startup, Shop, Transport, Contractor, Freelance/Services, Investment/Trading, Rental/Property, Other): Farm keeps crop+season, every other kind hides them and uses Notes for the industry/description, and cards show the chosen type as a badge.
- **Credit (उधार) Tracking** — accrual-basis: a credit purchase counts as an expense and a credit sale as income at the moment it's recorded (no waiting until the money moves). Entering a credit entry in a party transaction automatically creates a **payment-pending Adjustment** (Adjustments → Source/Status columns show "Credit purchase/sale · Party" with a Pending/Settled badge). Settling or receiving payment in the Party Account updates those adjustments **FIFO** — a partial payment stays Pending with a tracked settled amount, a full payment flips to Settled. **Settlement rows never count twice**: all `Credit Settlement` rows are excluded from every income/expense total (dashboard, lists, summary, export, accounts), the real cash/bank/UPI payment leg is hidden from the list but still moves balances, and the opposite-section clearing row shows as a visible entry with an amber **"Credit settled"** badge plus a "Credit only" filter chip. Existing credit entries are backfilled into pending adjustments automatically on first load of the new version (idempotent).
- **Works (कामे)** — Work register for farm jobs, labour and hired work. **Profession-driven:** each onboarding profession maps to a matching work profile — Salaried → Employee + Employer, Freelancer, Student, Homemaker, Investor/Trader, Retired, Business → Shop (+ Employer), Farmer, Other → General (plus trade profiles: farm services, labour, contractor, transport). The add-form surfaces the user's profile first, and switching profile swaps the work-type list. Farmer-specific fields (crop, season, area) appear **only** for the farmer/farm-services profiles. Each work records direction (I will receive / I will pay), a preset work type or free-text, start/end dates (auto duration), party and partnership links, and an agreed amount. Record payments per work — optionally auto-creating a matching Income or Expense ledger entry — with a full payment history and progress bar.
- **Farmer Onboarding** — Farmer added as a profession choice during onboarding; selects farming income/expense/investment categories (Farm Sale, Seeds, Fertilizer, Diesel/Fuel…) and maps to the farmer work profile in Works.
- **Recurring Transactions** — Automate bills and subscriptions with configurable frequencies and reminder days. Future start/end dates allowed. The category field follows the selected type: **income** suggests Salary/Business/Freelance/Interest/Dividend/Rental/Pension…, **expense** suggests Bills/Premium/Subscription/Shopping/Credit Card… — switching type swaps the suggestions and resets the selection.
- **Adjustments** — Balance corrections between personal and partner accounts with amount guards, plus the auto-tracked credit payments above. Deleting a credit transaction also archives its linked adjustment; restoring brings both back.
- **Budgets** — Category-based monthly/yearly spending limits with overrun warnings at ≥80%.
- **Reminders** — One-time or recurring (daily to yearly) with "Mark as Paid" that creates expense transactions and auto-reschedules.
- **Archive** — Soft-delete across all entity types with bulk restore, permanent delete, or empty-all (PIN-protected).
- **Audit Ledger** — Full mutation log with entity type icons, action badges, expandable lifecycle chain, copy transition ID, CSV export, entity/action filters, search.
- **Categories Page** — Dedicated management page with Income/Expense/Investment tabs; inline edit, delete, add; PIN-protected batch save to localStorage.
- **Export / Import** — CSV (transactions), PDF (jsPDF with auto-table), Excel (SheetJS), full JSON backup/restore with cross-user detection and reassignment. On Android, exports open the **native share sheet** (file written to app Cache, then shared — blob downloads don't work inside the WebView).
- **Save Toasts** — every successful income/expense/investment/partner save shows a summary toast (`{Type} added · {category} · {amount}`) across add, duplicate-confirm, and edit flows.

### Remote Announcements (jsonbin.io)
- **Broadcast Pills** — floating color-coded notifications top-center over the **content area** (info/warning/success/error), automatically offset past the desktop sidebar. Multiple messages stack 44px apart; each is independently dismissable per device (tap X **or swipe-left**); `pinned` messages have no dismiss; optional `link` makes the whole pill clickable; `expires` auto-hides old messages. Emojis supported.
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
- **Every section syncs** — all 10 data entities (transactions, partners, recurring, budgets, reminders, adjustments, goals, works, partnerships, partnership_entries) plus the audit trail (mutation_log) push through one doc store (`entity:id` rows). UI preferences stay on-device.
- **Link-only (no accounts)** — every device with the same project URL + anon key reads and writes the **same rows**. No email/password, no Google sign-in, no anonymous accounts. Same model as the original CouchDB sync.
- **Setup** — owner creates a Supabase project, runs `supabase/schema.sql` once (shared table + open RLS), then shares the project URL + anon key with devices. Users paste them in Settings → Multi-Device Sync → Connect.
- **Live sync** — realtime subscription pushes remote changes into the local buffer within seconds; a 30-second reconnect timer handles drops.
- **Manual sync** — `manualSync()` returns `{ ok, pushed, pulled }` with actual doc counts. Push errors now surface the real underlying Postgres error for debugging.
- **Bring your own Supabase** — users can paste a different URL + anon key per device in Settings to point at their own project.

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
| Auth | Local (email/password) for app; Supabase anon key for cloud sync |
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
                          │  Shared rows (link-only)    │
                          │  Open RLS (anon key)        │
                         │  Realtime subscription      │
                         │  Auto-reconnect (30s)       │
                         └────────────────────────────┘

Write path:  Cache → Dexie → Mutation Log → PouchDB ──→ Supabase (fire-and-forget)
Read path:   Cache ← Dexie (hydration on load)
Sync path:   PouchDB ↔ Supabase (bidirectional, realtime + manual)
Audit sync:  Mutation Log → PouchDB (audit entries pushed with last-write timestamp)
```

Every entity carries: `id`, `transitionId`, `userId`, `createdAt`, `updatedAt`, `deletedAt`.

### Sync Architecture Details

```
connectRemote(url, key):
  init Supabase client (url + anon key)
  lightweight ping → { ok, error? }        ← no sign-in, no auth session
  saveConfig(url, key)                      ← persist for reconnection
  subscribe to sync_docs_realtime (replica identity full)
  → startReconnectTimer(30s interval) on disconnect

manualSync():
  pushLocalToRemote()  ← upsert local changes (onConflict 'id', chunks of 200)
  pullRemoteToLocal()  ← select all rows, apply to local PouchDB
    → apply/skip/fail per row (skip = already up-to-date locally)
  returns { ok, pushed, pulled, pushErr?, pullErr? }

checkConnection():
  lightweight ping → true/false (no auth session to refresh)

Reconnect timer (30s):  pings the server; on success dispatches sync event
  "Sync reconnected" → Settings UI updates live (listenSyncEvents).
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
│   │   ├── partners/            # Party accounts (7 groups) + partnership
│   │   ├── privacy/             # Public privacy page
│   │   ├── recurring/           # Recurring transactions
│   │   ├── savings/             # Savings + Goals
│   │   ├── settings/            # Sync, theme, language, danger zone
│   │   ├── summary/             # Monthly/yearly summaries
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
│   ├── CreditAlertModal.tsx     # Overdue/near-limit credit alert popup
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
│   ├── notification-prefs.ts    # Notification & popup preference toggles
│   ├── activityLog.ts           # Security + CRUD event history
│   ├── export.ts                # PDF + Excel + CSV export
│   ├── download.ts              # downloadBlob (native share sheet on Android), copyText, printHtml
│   ├── env.ts                   # Runtime config — Supabase URL/key empty by default (bring-your-own via NEXT_PUBLIC_* build env or Settings → Sync), jsonbin Bin IDs XOR-obfuscated
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

**Cross-platform launchers:**

| Platform | Production | Dev | Stop |
|---|---|---|---|
| Windows | `start.bat` | `start-dev.bat` | `stop-server.bat` |
| Mac / Linux | `./start.sh` | `./start-dev.sh` | `./stop-server.sh` |
| Any OS | `npm run build && npx serve out` | `npm run dev` | Kill port 3000 |

All launchers auto-install deps, rebuild when src/ is newer than out/, and open the browser. See [CROSS-PLATFORM.md](CROSS-PLATFORM.md) for OS-specific setup and troubleshooting.

**npm scripts:**

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

Cloud sync uses **Supabase** (Postgres + Realtime) — every device that connects with the project URL + anon key reads and writes the same rows. No email/password, no accounts.

> **Self-hosting the app with your own database?**
> Follow the step-by-step guide: **[SELF-HOSTING.md](SELF-HOSTING.md)** — clone → create a free Supabase project → run `supabase/schema.sql` → fill 3 values in `.env.local` → rebuild. Offline-first by default; cloud sync is optional.

1. **Create a Supabase project** at https://supabase.com (free tier is enough)
2. **Create the shared sync table** — open SQL Editor, run the contents of [`supabase/schema.sql`](supabase/schema.sql)
3. **Get your keys** — Project Settings → API:
   - Project URL: `https://<project-ref>.supabase.co`
   - anon public key (starts with `eyJ…`)
4. **Keys are NOT baked in** — the repo ships cloud-free. Create `.env.local` from [`.env.example`](.env.example) with `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL` and rebuild (full walkthrough: [SELF-HOSTING.md](SELF-HOSTING.md)). End users can also paste a project URL + key per device in Settings at runtime.
5. **In-app** — Settings → Multi-Device Sync:
   - Paste the **Supabase project URL** + **anon key**
   - Tap **Connect** — your local data is pushed to the cloud
6. **Repeat on each device** — same URL + anon key on every device → all share the same data

The app works fully offline without sync; sync is optional. Keep the project URL private — anyone with the URL + anon key can read/write the data.

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
| English | Marathi |
|---|---|
| Dashboard | डॅशबोर्ड |
| Income | उत्पन्न |
| Expenses | खर्च |
| Savings | ध्येय |
| Investments | गुंतवणूक |
| Partners | पार्टी |
| Recurring | आवर्ती |
| Accounts | खाती |
| Adjustments | एडजस्टमेंट |
| Summary | सारांश |
| Ledger | लेजर |
| Archive | आर्काइव्ह |
| Settings | सेटिंग्ज |
| Categories | वर्ग |
| About | माहिती |
| Support | मदत |
| Terms | अटी |
| Privacy | गोपनीयता |

### Nav Item Labels — Hindi (hi)
| English | Hindi |
|---|---|
| Dashboard | डैशबोर्ड |
| Income | कमाई |
| Expenses | खर्च |
| Savings | बचत |
| Investments | निवेश |
| Partners | पार्टी |
| Recurring | आवर्ती |
| Accounts | खाते |
| Adjustments | एडजस्टमेंट |
| Summary | सारांश |
| Ledger | लेजर |
| Archive | आर्काइव्ह |
| Settings | सेटिंग्स |
| Categories | वर्ग |
| About | जानकारी |
| Support | मदद |
| Terms | शर्तें |
| Privacy | गोपनीयता |

---

## License

All Rights Reserved. Copyright © 2026 Money Meva.

---

*Made in India. Built with Next.js, TypeScript, Tailwind CSS, Dexie.js, PouchDB, Supabase, and love.*
