# Memory Capsule — Money Meva

This file is a snapshot of the project's soul — the philosophy, architecture, and
decisions that shaped every line. It exists so that years from now, the intent is
knowable by anyone who reads it.

---

## Why This Exists

Money Meva was born from a simple frustration: every finance app wants your data.
They store it on their servers, sell ads against it, or lock it behind subscriptions.
For a small business owner or a farmer tracking seasonal income and expenses, that's
not just inconvenient — it's a privacy violation.

So we built one that doesn't.

**Core belief: financial clarity should not require surrendering privacy.**

---

## The Three Principles

1. **Local-first** — every byte of data lives in the user's browser (IndexedDB).
   No cloud account required. No server to trust. The app works fully offline.

2. **Sync is optional** — multi-device sync exists only so you aren't chained to one
   device. It uses a shared Supabase database with per-user isolation, and you bring
   your own. No credentials are baked into the code.

3. **Traceable** — every mutation carries a `transitionId`, linking the full lifecycle
   of every entity. The audit ledger is the source of truth. Soft-delete everywhere.
   Nothing is ever truly gone.

---

## How Data Flows

```
User Action (UI)
    │
    ▼
In-Memory Cache ─── UI reads instantly (no async wait)
    │
    ▼
Dexie.js (IndexedDB) ─── persistent local store
    │
    ▼
Mutation Log (Dexie) ─── logMutation() writes every CRUD action
    │                      with transitionId tracking + audit sync
    ▼
PouchDB (local buffer) ─── fire-and-forget write to local PouchDB
    │
    ▼
Supabase sync_docs (opt-in) ─── cloud hub + backup
                                 per-user rows (user_id)
                                 row-level security
                                 realtime subscription
                                 auto-reconnect (30s)
```

Write path:  Cache → Dexie → Mutation Log → PouchDB → Supabase (fire-and-forget)
Read path:   Cache ← Dexie (hydration on load)
Sync path:   PouchDB ↔ Supabase (bidirectional, realtime + manual)

---

## What We Built

### Core Finance
- **Income / Expenses / Investments** — full CRUD with search, filter, sort, group by
  day/week/month, duplicate detection, category auto-suggest, PIN-protected deletion,
  archive/restore. Account badges (Cash/Bank/UPI/Invest). Future-dated entries blocked.
- **Dashboard** — summary cards (Balance, Income, Expenses, Investments, Available to
  Spend, Partner Invested), 6-month cash flow chart, spending breakdown donut, goals
  with progress bars, upcoming reminders, cloud sync status card, quick-add modals.
- **Investment Calculator** — FD (quarterly/half-yearly/yearly compounding), SIP, RD, PPF.
  Shows maturity amount, total returns, year-wise breakdown. "Use this amount" fills the
  add form.
- **Savings & Goals** — goals grid with contribute/withdraw + progress bars.
  Goal contributions record as transactions.

### Partners & Work
- **Partner Accounts** — Vendor/Customer/Contact groups with P&L tracking, investment
  tracking, portfolio value, dual-entry transactions, mini ledger modal per party.
- **Partnership (भागीदारी)** — shared work: members with % shares (must total 100%),
  shared income/expense entries with "who paid" tracking, automatic settlement balances.
- **Works (कामे)** — work register for farm jobs, labour, hired work. Profession-driven:
  each onboarding profession maps to a matching work profile (Employee, Employer,
  Freelancer, Student, Homemaker, Investor, Retired, Shop/Business, Farmer, General),
  so a salaried user adds a Salary-style work, not a farmer default. Farmer-specific
  fields (crop, season, year, area) appear only for the farmer/farm-services profiles.
  Records direction, profile, work type, dates, party and partnership links, agreed
  amount. Payment tracking with full history and progress bar.

### Automation
- **Recurring Transactions** — automate bills and subscriptions with configurable
  frequencies and reminder days.
- **Budgets** — category-based monthly/yearly spending limits with overrun warnings.
- **Reminders** — one-time or recurring with "Mark as Paid" that creates expense
  transactions and auto-reschedules.

### Audit & Compliance
- **Audit Ledger** — full mutation log with entity type icons, action badges,
  expandable lifecycle chain, copy transition ID, CSV export, entity/action filters,
  search. Syncs across devices.
- **Archive** — soft-delete across all entity types with bulk restore, permanent delete,
  or empty-all (PIN-protected).
- **Activity Log** — tracks 200 most recent security and CRUD events.

### Data Portability
- **Export / Import** — CSV, PDF (jsPDF), Excel (SheetJS), full JSON backup/restore
  with cross-user detection and reassignment. Audit trail + activity log included in
  backups and restored on import.
- **Cloud Sync** — PouchDB → Supabase sync_docs. Manual + live (realtime). All 10 data
  entities + audit log sync across devices. Per-user isolation via row-level security.
- **Cloud Setup Wizard** — auto-checking 4-step wizard (project, schema, Google
  provider, redirect URL) with live validation.

### Developer Tools
- **Developer Zone** — hidden diagnostic page with session timer, live version +
  release-notes tracking, DB stats (all 11 tables), localStorage inspector, storage
  usage, sync diagnostics, remote announcement diagnostics, raw JSON export/import,
  brand switcher, PIN viewer, danger zone for full data wipe.

### User Experience
- **i18n** — Marathi (default), Hindi, English. Grammar-preserving translations.
- **Dark / Light Theme** — toggleable, persisted.
- **3 Brand Colors** — Orange, Royal Blue, Emerald Green.
- **PIN Security** — 10 one-time 4-digit PINs for sensitive operations.
- **Multi-user** — multiple profiles with quick-switch.
- **Onboarding Wizard** — 6-step setup.
- **Skeleton Loading** — animated placeholders on data-heavy pages.
- **Remote Announcements** — broadcast pills and banner modals via jsonbin.io.
- **What's New Modal** — release notes, once per version.

---

## Tech Stack

| Category | Technology |
|---|---|
| Framework | Next.js 16 (App Router, static export) |
| Language | TypeScript 5 |
| UI | React 19, Tailwind CSS v4, Lucide React |
| Local DB | Dexie.js 4 (IndexedDB) |
| Sync | PouchDB 9 (local buffer) + Supabase Postgres |
| Charts | Recharts 3 |
| PDF | jsPDF + jspdf-autotable |
| Excel | SheetJS (xlsx) |
| Dates | date-fns 4 |
| Auth | Local (email/password) + Supabase Auth |
| Mobile | Capacitor 8 (Android) |

---

## Platform Support

| Platform | Status |
|---|---|
| Windows | Full support — .bat launchers |
| macOS | Full support — .sh launchers, Homebrew |
| Linux (Ubuntu, Debian, Fedora, RHEL, Mint, Arch) | Full support — .sh launchers |
| Docker | Prebuilt image on ghcr.io |
| Android | Capacitor APK (Android 7+) |
| Web (any browser) | Static export — works anywhere |

---

## What Changed Recently (v7.2.x)

- **Cloud-free by default** — repo ships zero Supabase credentials
- **Audit trail sync** — mutation_log now syncs across devices via PouchDB
- **Audit trail in backups** — JSON export/import includes full audit + activity log
- **Calendar month filter** — Accounts page uses proper month picker (not rolling window)
- **GitHub Pages hosting** — static export deployed at `/moneymeva-online`
  (`https://kuldeep7ke.github.io/moneymeva-online/`)
- **Cloudflare Pages hosting** — Cloudflare project `moneymevaonline`
  (`https://moneymevaonline.pages.dev`); its workflow is gated on
  `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` repo secrets, which are unset, so
  it currently reports success without uploading
- **Docker image** — published to ghcr.io on every version tag
- **Cloud Setup Wizard** — auto-checking 4-step wizard for new users
- **Session auto-restore** — landing page restores cloud session, skips to dashboard
- **OAuth redirect fix** — Google login returns to correct origin (not hardcoded)
- **Cross-platform scripts** — .sh launchers for Mac/Linux alongside Windows .bat
- **Ledger filter completeness** — all 11 entity types filterable in Audit Ledger
- **Todos removed** — the to-do list feature was deleted end-to-end (types, db, store,
  sync, pages); savings & goals now own the savings experience
- **Profession-driven Works** — each onboarding profession gets a matching work profile
  (Employee/Employer/Freelancer/…), farmer-form fields restricted to farmer profiles
- **Full data-clear wipes cloud session** — settings + developer clear-all now sign out
  of Supabase, strip `sb-` tokens and hard-nav to login so no stuck overlay
- **In-app confirm modals** — native `confirm()`/`alert()` replaced by the app's own
  themed modals and toasts

---

## The Numbers

- **11 Dexie tables** — transactions, partners, recurring, budgets, reminders,
  adjustments, goals, works, partnerships, partnership_entries, mutation_log
- **1 Supabase table** — sync_docs (composite PK: user_id + entity:id)
- **10 synced data entities + audit entries** — transactions, partners, recurring,
  budgets, reminders, adjustments, goals, works, partnerships, partnership_entries
  all push through one doc store, plus the mutation_log audit trail
- **3 languages** — Marathi, Hindi, English
- **3 brand colors** — Orange, Blue, Green
- **10 one-time PINs** — for sensitive operations

---

## Author

Made by Kuldeep7ke with care for Indian users — farmers, traders, small business
owners, and anyone who wants financial clarity without privacy compromise.

© 2026 Money Meva. All rights reserved.

---

*This file is the project's memory. Update it when the soul changes.*
