# Self-Hosting Guide (Money Meva)

Money Meva is **offline-first**: every feature works with zero cloud setup and all
data lives on your device (IndexedDB). This guide is for people who want **online
backup and multi-device sync** through **their own private Supabase project**.
The app ships with **no cloud credentials** — you create the database, you own the data.

> **TL;DR** — clone → `npm install` → app already works offline.
> Want sync? Create a free Supabase project, run one SQL file, put 3 values in
> `.env.local`, rebuild. Details below.
>
> **Using opencode or another AI agent?** Open it in this folder and say:
> *"Read OPENCODE-SYNC-SETUP.md and follow it to connect my Supabase project."*

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

This step is **required for any cloud feature** (sync and Google sign-in). Without
it the app stays fully offline and Google sign-in will say cloud isn't configured.

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
You can also override the sync target per device later in **Settings → Multi-Device Sync**.

> **Deploying the web app somewhere (Cloudflare Pages, Netlify…)?** Add the same
> three values as build environment variables in that service's dashboard — remote
> builds never see your local `.env.local`. See the next section.

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

## Deploying your own web copy (Cloudflare Pages, GitHub Pages or similar)

Anyone can turn their fork/copy of this repo into its own hosted web app — with
**their own** database and **their own** environment variables. Every deployment is
independent: you set your values in *your* project's dashboard and never touch
another deployment's variables (and nobody can touch yours).

### Cloudflare Pages

1. Push your copy to GitHub (a fork works fine)
2. Cloudflare Dashboard → **Workers & Pages → Create → Pages → Connect to Git**
   - Build command: `npm run build`
   - Output directory: `out`
3. **Settings → Environment variables (Production)** → add the same three values
   from Step 5:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_SITE_URL` = `https://<your-project>.pages.dev` (no trailing slash)
4. **Deploy**, then open `https://<your-project>.pages.dev` — your app, your cloud
5. Back in Supabase → Authentication → URL Configuration, allow the new address:
   - Site URL: `https://<your-project>.pages.dev`
   - Redirect URLs: add `https://<your-project>.pages.dev/**`

### GitHub Pages

The repo ships a ready-made workflow (`.github/workflows/deploy-gh-pages.yml`)
that publishes your copy to `https://<your-username>.github.io/moneymeva-online/`:

1. Fork/push the repo, then open **Settings → Pages → Build and deployment →
   Source** and select **GitHub Actions** (the workflow deploys automatically on
   every push to `master`, or via **Run workflow**)
2. Optional — for Google sign-in/sync on your copy, add repo variables/secrets
   (**Settings → Secrets and variables → Actions**):
   - Secret `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` (your project's values from Step 5)
   - Variable `NEXT_PUBLIC_SITE_URL` = `https://<your-username>.github.io/moneymeva-online`
3. Re-run the workflow after adding them (build-time injection), then in Supabase
   → Authentication → URL Configuration add:
   - Redirect URL: `https://<your-username>.github.io/moneymeva-online/**`

Notes:

- Without secrets the Pages copy builds **cloud-free** (offline app) — same as any other host.
- First deploy can take a few minutes; check the **Actions** tab for progress.
- Skip this by disabling the workflow or leaving Pages source as "Deploy from a branch".

Notes (all hosts):

- Env vars are injected at **build time** — after changing them, trigger
  **Retry deployment** / redeploy.
- Netlify/Vercel work identically: same build command, output dir, three variables.
- Skip the variables and your deployment builds **cloud-free**: fully offline app,
  no Google sign-in/sync — exactly as designed.
- The original author's live deployment (`moneymevaonline.pages.dev`) uses the
  author's own environment variables configured privately in their dashboard; it is
  unrelated to your copy.

### Docker (prebuilt image)

A ready-to-run image of the web app is published to GitHub Packages on every
version tag (workflow: `.github/workflows/publish-package.yml`):

```bash
docker run -d -p 8080:80 ghcr.io/kuldeep7ke/moneymeva-online:latest
# open http://localhost:8080 — cloud-free build by default
```

To bake your own cloud values in, build locally instead:

```bash
docker build \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ... \
  --build-arg NEXT_PUBLIC_SITE_URL=http://localhost:8080 \
  -t moneymeva . && docker run -d -p 8080:80 moneymeva
```

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
