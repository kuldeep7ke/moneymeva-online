# Self-Hosting Guide (Money Meva)

Money Meva is **offline-first**: every feature works with zero cloud setup and all
data lives on your device (IndexedDB). This guide is for people who want to run
their **own private copy** of the app with **their own database** — for online
backup and multi-device sync — instead of using the built-in default project.

> **TL;DR** — clone → `npm install` → app already works offline.
> Want cloud sync? Create a free Supabase project, paste 3 values into `.env.local`,
> rebuild. Details below.

---

## How it works

```
Your device                    Your Supabase project
┌───────────────────┐          ┌──────────────────────┐
│ App UI            │          │  auth.users (Google) │
│   ↓               │  sync    │  sync_docs (data)    │
│ Dexie (IndexedDB) │ ───────► │  RLS: your rows only │
│ mutation_log      │ ◄─────── │  realtime channel    │
└───────────────────┘          └──────────────────────┘
```

- Every write goes to local storage first — the app never waits for the network.
- If a cloud project is configured, changes are pushed in the background and
  other devices signed into the same account pull them (realtime + reconnect).
- Sign out or delete your Supabase project → local data on each device remains.

---

## Prerequisites

| Tool | Check | Get it |
|---|---|---|
| Node.js 18+ | `node -v` | https://nodejs.org |
| Git | `git --version` | https://git-scm.com |
| Supabase account | — | https://supabase.com (free tier is enough) |
| Google Cloud account | only for Google sign-in | https://console.cloud.google.com |

---

## Step 1 — Run the app offline (no cloud needed)

```bash
git clone https://github.com/kuldeep7ke/moneymeva-online.git
cd moneymeva-online
npm install
npm run build        # static export → out/
npx serve out        # or double-click start.bat on Windows
```

Open http://localhost:3000. Create an **email + password account** inside the app —
this works fully offline. Stop here if you don't want cloud features.

---

## Step 2 — Create your Supabase project

1. Go to https://supabase.com → **New project**
2. Pick any name (e.g. `moneymeva`), set a **database password** (save it), choose a region near you
3. When ready, open **Project Settings → API** and keep this tab open — you will need:
   - **Project URL** — looks like `https://xxxxxxxxxxxx.supabase.co`
   - **anon public key** — long `eyJ...` string

---

## Step 3 — Create the tables

1. In your Supabase dashboard open **SQL Editor → New query**
2. Copy the entire contents of [`supabase/schema.sql`](supabase/schema.sql) from this repo, paste, **Run**
3. This creates the `sync_docs` table, row-level security ("each account sees only
   its own rows") and the realtime publication

---

## Step 4 — Enable Google sign-in (optional but recommended)

Skip this step to use only email+password accounts. For "Continue with Google":

### 4a. Google Cloud Console

1. https://console.cloud.google.com → create a project (any name)
2. **APIs & Services → OAuth consent screen** → External → fill app name/email → publish
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**
   - Type: **Web application**
   - Authorized redirect URI: `https://YOUR-PROJECT-REF.supabase.co/auth/v1/callback`
     (exact value also shown in Supabase → Authentication → Providers → Google)
4. Copy the **Client ID** and **Client Secret**

### 4b. Supabase Dashboard

1. **Authentication → Providers → Google** → enable, paste Client ID + Secret → Save
2. **Authentication → URL Configuration**:
   - **Site URL**: where YOUR app runs, e.g. `http://localhost:3000` (change later to your domain)
   - **Redirect URLs**: add each address you'll open the app from, e.g.
     - `http://localhost:3000/**`
     - `https://your-domain.example/**`

---

## Step 5 — Point the app at YOUR project

Copy `.env.example` → `.env.local` and fill in:

```ini
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your project — used for login **and** sync |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public client key (safe to ship; RLS protects data) |
| `NEXT_PUBLIC_SITE_URL` | Where THIS app is served — used as the Google redirect target. No trailing slash. |

Then rebuild (values are baked into the static export at build time):

```bash
npm run build
```

That's it — Google sign-in now creates users in **your** project and every device
that signs in syncs through **your** `sync_docs` table automatically.
You can still override the sync target per device later in **Settings → Multi-Device Sync**.

---

## Step 6 — Sync across devices

On each phone/computer where you use the app:

1. Open the app → sign in with the **same Google account** (or same email+password)
2. Cloud connection starts automatically; check status under **Settings → Multi-Device Sync**
3. **Sync Now** forces an immediate push/pull; edits made offline reconcile next time online

Conflicts resolve last-write-wins per field; deletions propagate as tombstones so
removing an entry on one device removes it everywhere.

---

## Android APK (optional)

```bash
npm run android:apk   # builds web → bumps version → gradle assembleDebug
```

APK output: `android/app/build/outputs/apk/debug/app-debug.apk`.
The same `.env.local` values are baked in. On devices the OAuth round-trip uses the
`moneymeva://` deep link — no extra configuration needed beyond Step 4.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| "Google sign-in is not enabled on this cloud project yet" | Provider not switched on | Step 4b |
| Browser error `redirect_uri_mismatch` | Redirect URI typo | Must be exactly `https://<ref>.supabase.co/auth/v1/callback` |
| After Google login you land on the wrong site | Wrong `NEXT_PUBLIC_SITE_URL` | Set it to the address you actually browse the app from, rebuild |
| Login works but nothing syncs | `.env.local` missing/typo, or table not created | Re-run Step 3, confirm Step 5, check Settings → Sync status |
| `new row violates row-level security policy` | Using a non-anon key or schema not applied | Re-run `schema.sql`; use the **anon** key only |
| Sync stops after laptop sleep | Socket dropped | Auto-reconnects within ~30 s, or tap **Sync Now** |

---

## Owning your data

- Free Supabase tier: 500 MB database, 50k monthly active users — years of personal finance data
- Back up anytime: Supabase Dashboard → Database → Backups, or export CSVs from the app
- Deleting your Supabase project deletes cloud copies; device-local data survives
- The anon key appearing in the app bundle is normal — it's a public key by design;
  row-level security is what keeps each account's rows private
