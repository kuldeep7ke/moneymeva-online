<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Money Meva — Agent Instructions

## Build & Dev Commands

```bash
npm run dev                  # Next.js dev server on localhost:3000
npm run build                # Static export to out/
npm run version:patch        # vX.Y.Z.N → vX.Y.Z.N+1
npx cap sync android         # Sync web build to Android project
npm run lint
npm run android:apk         # Full build → version → gradle assembleDebug
```

## Architecture

- Next.js 16.2.9 App Router (static export, `'use client'` everywhere)
- Dexie.js (IndexedDB) for local storage, PouchDB → Supabase `sync_docs` for optional cloud sync
- Tailwind CSS v4 + CSS variables for 3-brand theme
- All writes: cache → Dexie → mutation_log → PouchDB → (optional) Supabase `sync_docs` (fire-and-forget)
- Soft-delete with `deletedAt` on all entities
- `transitionId` links entity lifecycle mutations

## i18n System

- **Languages**: Marathi (mr, default), Hindi (hi), English (en)
- **Files**: `src/lib/i18n/translations.ts`, `src/lib/i18n/index.tsx`
- **Hook**: `useTranslation()` returns `{ lang, setLang, t }`
- **Pattern**: `t('key')` or `t('key', { param: value })` for interpolation
- **Provider**: `<I18nProvider>` wraps root layout

## i18n Translation Philosophy

- **Grammar stays native** (Marathi/Hindi SOV structure preserved)
- **English loanwords only** for tech/modern terms: Dashboard, Loading, Save, Sync, UPI, PIN, Google, Settings
- **Everyday words** for money concepts: खर्च, बचत, पैसे, रक्कम, तारीख, श्रेणी, व्यवहार, उत्पन्न
- **No awkward mixing** — if the word sounds natural in English to native speakers, use English
- **No repetition** — vary word choice across keys (e.g., ध्येय not गोल for goals in Marathi)
- **Marathi hero**: "पैसे कुठे जातात? शोधूया." (relatable hook)
- **English footer**: Copyright always `© 2026 Money Meva.` in all languages

## Nav Item Labels

### Marathi (mr)
- Dashboard → डॅशबोर्ड
- Income → उत्पन्न
- Expenses → खर्च
- Savings → ध्येय
- Investments → गुंतवणूक
- Partners → पार्टी
- Recurring → आवर्ती
- Accounts → खाती
- Adjustments → एडजस्टमेंट
- Summary → सारांश
- Ledger → लेजर
- Archive → आर्काइव्ह
- Settings → सेटिंग्ज
- About → माहिती
- Support → मदत
- Terms → अटी
- Privacy → गोपनीयता

### Hindi (hi)
- Dashboard → डैशबोर्ड
- Income → कमाई
- Expenses → खर्च
- Savings → बचत
- Investments → निवेश
- Partners → पार्टी
- Recurring → आवर्ती
- Accounts → खाते
- Adjustments → एडजस्टमेंट
- Summary → सारांश
- Ledger → लेजर
- Archive → आर्काइव्ह
- Settings → सेटिंग्स
- About → जानकारी
- Support → मदद
- Terms → शर्तें
- Privacy → गोपनीयता

## Language Selector Component

- `src/components/LanguageSelector.tsx`
- Two variants: `default` (settings) and `minimal` (landing footer)
- Default variant uses `createPortal` to render dropdown at `document.body` level — avoids parent `transform`/`overflow` clipping
- `fixed` positioning with `getBoundingClientRect()` for dropdown placement
- `z-[9999]` to ensure dropdown is above all content
- Click-outside dismissal via `mousedown` listener on document

## Party Field in Transaction Forms

- `src/components/TransactionPage.tsx`
- When no parties exist: disabled "None" input shown
- When parties exist: dropdown shows latest 3 most-used parties
- Typing searches all parties by name
- If typed name doesn't match any party: "Create Party (Name)" option appears
- Clicking "Create Party" opens inline modal (group, type, description)
- "Create & Select" button creates party via `addPartner()`, refreshes list, auto-selects new party
- Works in both Add and Edit transaction modals

## Sync Architecture

- **`src/lib/pouchdb.ts`** — Core sync module
  - `connectRemote(url)` returns `{ ok, error? }` — live sync with `{ live: true, retry: true }`
  - `manualSync()` returns `{ ok, pushed, pulled }` — does NOT call `notifyChange()` (no recursion)
  - `skip_setup: false` — PouchDB auto-creates remote DB
  - `startReconnectTimer(30s)` — auto-reconnect on disconnect
  - `putDoc(entity, data)` — write doc as `entity:id` with `entity` tag
  - Error handler uses `console.warn` — never kills connection
  - `checkConnection()` / `ensureConnected()` — utility guards
- **`src/lib/sync-notify.ts`** — CustomEvent-based sync status dispatch
  - `dispatchSyncEvent(ev)` — fires `mm-sync-event` CustomEvent
  - `listenSyncEvents(fn)` — subscribe to sync status changes
  - Events: `started | pushing | pulled | processing | complete | error`

## Sync URL
- Stored in `localStorage('mm_pouch_url')`
- History: last 5 URLs saved in `localStorage('mm_pouch_urls')` (managed by `saveSyncUrlHistory`)
- No hardcoded "Use Default" button — user brings their own URL
- Saved URLs always visible (no `syncStatus !== 'connected'` guard)

## Investment Calculator
- `src/components/InvestmentCalculator.tsx`
- 4 scrollable pill tabs: FD, SIP, RD, PPF (no Lumpsum)
- FD: quarterly/half-yearly/yearly compounding options
- SIP: monthly investment with annual return rate
- RD: quarterly compounding formula
- PPF: 15-year with current interest rate (7.1%)
- "Use this amount" button fills the add form
- Accessible from Investments page header (behind Archive, before Add)
- Only rendered when `type === 'investment'`

## Key Files

| File | Purpose |
|---|---|
| `src/lib/i18n/translations.ts` | All translation data for mr/hi/en |
| `src/lib/i18n/index.tsx` | I18nProvider + useTranslation hook |
| `src/components/LanguageSelector.tsx` | Language dropdown with portal |
| `src/components/TransactionPage.tsx` | Shared income/expenses/investments page with party field |
| `src/app/dashboard/partners/page.tsx` | Partner management page |
| `src/lib/store.ts` | Data layer (Dexie + cache + PouchDB) |
| `src/components/DashboardLayout.tsx` | Sidebar nav + layout |
| `src/components/Reveal.tsx` | Scroll-reveal animation wrapper |
| `src/lib/pouchdb.ts` | PouchDB remote connection and sync logic |
| `src/lib/sync-notify.ts` | Sync event dispatch system |
| `src/components/InvestmentCalculator.tsx` | FD/SIP/RD/PPF investment calculator |
