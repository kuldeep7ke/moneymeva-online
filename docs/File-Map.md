# 📂 File Map

> Find any file in the project instantly.

---

## App Pages

| Route | File | Notes |
|---|---|---|
| `/` | `src/app/page.tsx` | Landing page |
| `/login` | `src/app/login/page.tsx` | Auth |
| `/onboarding` | `src/app/onboarding/page.tsx` | First-run |
| `/dashboard` | `src/app/dashboard/page.tsx` | Home dashboard |
| `/dashboard/income` | `src/components/TransactionPage.tsx` | Income list |
| `/dashboard/expenses` | `src/components/TransactionPage.tsx` | Expense list |
| `/dashboard/investments` | `src/components/TransactionPage.tsx` | Investment list |
| `/dashboard/savings` | `src/app/dashboard/savings/page.tsx` | Goals |
| `/dashboard/partners` | `src/app/dashboard/partners/page.tsx` | Party management (+ Partnership tab) |
| `/dashboard/works` | `src/app/dashboard/works/page.tsx` | Work register & pending payments |
| `/dashboard/recurring` | `src/app/dashboard/recurring/page.tsx` | Recurring txns |
| `/dashboard/accounts` | `src/app/dashboard/accounts/page.tsx` | Accounts |
| `/dashboard/adjustments` | `src/app/dashboard/adjustments/page.tsx` | Adjustments |
| `/dashboard/summary` | `src/app/dashboard/summary/page.tsx` | Monthly summary |
| `/dashboard/ledger` | `src/app/dashboard/ledger/page.tsx` | Audit trail |
| `/dashboard/archive` | `src/app/dashboard/archive/page.tsx` | Deleted items |
| `/dashboard/categories` | `src/app/dashboard/categories/page.tsx` | Categories |
| `/dashboard/settings` | `src/app/dashboard/settings/page.tsx` | Settings |
| `/dashboard/developer` | `src/app/dashboard/developer/page.tsx` | Dev tools |

## Components

| File | Used By |
|---|---|
| `DashboardLayout.tsx` | All dashboard pages |
| `TransactionPage.tsx` | Income, Expenses, Investments |
| `Toast.tsx` | Global (via layout) |
| `Skeleton.tsx` | Loading states |
| `Reveal.tsx` | Scroll animations |
| `LanguageSelector.tsx` | Settings, footer |
| `InvestmentCalculator.tsx` | Investments page |
| `PartnershipTab.tsx` | Partners page (भागीदारी tab) |
| `popup-queue.ts` (`src/lib/`) | Sequential startup popups |
| `defaultCategories.ts` (`src/lib/`) | Profession categories + WORK_PROFILES registry |
| `PinPrompt.tsx` | PIN entry |
| `PinSetupGuide.tsx` | PIN creation |
| `DataSafetyNotice.tsx` | First-run |
| `InstallPrompt.tsx` | PWA install |
| `NotificationPanel.tsx` | Dashboard header |
| `LoadingOverlay.tsx` | Full-screen loading |

## Lib

| File | Purpose |
|---|---|
| `store.ts` | All CRUD operations |
| `db.ts` | Dexie schema |
| `pouchdb.ts` | Cloud sync (Supabase + local PouchDB buffer) |
| `sync-notify.ts` | Sync events |
| `pinStore.ts` | PIN management |
| `localAuth.ts` | Multi-user auth |
| `activityLog.ts` | Activity tracking |
| `export.ts` | PDF/Excel export |
| `download.ts` | File downloads |
| `utils.ts` | Shared utilities |
| `i18n/translations.ts` | Translation strings |
| `i18n/index.tsx` | i18n provider |
| `ThemeProvider.tsx` | Theme system |

## Sync / Cloud

| File | Purpose |
|---|---|
| `supabase/schema.sql` | `sync_docs` table + RLS + realtime (run in Supabase SQL Editor); header lists all 12 synced doc types (11 entities + pin batch) |
| `src/lib/env.ts` | Runtime config — Supabase URL/key + jsonbin Bin IDs as XOR+base64 obfuscated constants (decoded at runtime) |
| `CLOUD-SYNC-GUIDE.md` | Owner setup + troubleshooting (includes the secret-encoder one-liner) |

## Config

| File | Purpose |
|---|---|
| `next.config.ts` | Next.js config |
| `capacitor.config.ts` | Android config |
| `tailwind.config.ts` | Tailwind config |
| `tsconfig.json` | TypeScript config |
| `package.json` | Dependencies |
| `AGENTS.md` | AI instructions |
| `From-Scratch.md` | Build guide |
| `docs/USER-GUIDE.md` | End-user manual |
| `data/memory-capsule.md` | AI context |

---

#money-meva #reference #file-map
