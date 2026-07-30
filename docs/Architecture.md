# Architecture

## Stack

| Layer | Tech | Why |
|---|---|---|
| Framework | Next.js 16.2.9 App Router | Static export, React 19 |
| Styling | Tailwind CSS v4 + CSS vars | 3-brand theme |
| i18n | Custom hook | mr/hi/en, no external lib |
| Database | Dexie.js (IndexedDB) | Offline-first, 9 tables |
| Sync | PouchDB ↔ CouchDB | Live + manual sync |
| State | In-memory cache + Dexie | Instant reads |
| Auth | localStorage | Multi-user, no server |
| Security | One-time 4-digit PINs | Simple, auto-rotate |
| Mobile | Capacitor v8 | Android APK |
| Charts | Recharts | Lightweight |
| PDF | jsPDF + autotable | Client-side |
| Excel | SheetJS (xlsx) | Client-side |

## Why Not...

- **Supabase/Firebase** → Removed. Fully local-first.
- **Server components** → Browser-only (Dexie/PouchDB).
- **Zustand/Redux** → Cache arrays are simpler.
- **Prisma/SQLite** → Dexie is the only browser option.
- **react-i18next** → Overkill for 3 languages.

## File Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── layout.tsx          # Root layout + providers
│   ├── page.tsx            # Landing page
│   ├── login/page.tsx      # Auth
│   ├── onboarding/page.tsx # First-run setup
│   └── dashboard/          # All authenticated pages
├── components/             # React components
├── lib/                    # Utilities, store, i18n
└── types/                  # TypeScript types
```
