# OPENCODE-SYNC-SETUP.md

**AI-agent playbook:** give this file to opencode (or any coding assistant) opened in
the Money Meva repo folder, and it can connect **your own Supabase project** to the
app for you — editing config, building, and verifying — while you only supply values
and click dashboard buttons.

## How to use (paste this into your agent)

```
Read OPENCODE-SYNC-SETUP.md and follow it end to end to connect my Supabase project
to this app. Ask me for any value you need. Do not commit .env.local.
```

---

## Context for the agent

- Money Meva is an **offline-first** Next.js static export (`npm run build` → `out/`).
  All data lives on-device (IndexedDB). Cloud sync via Supabase is **optional**.
- The repo ships with **no cloud credentials baked in**. Sync + Google login work
  only after the app is pointed at a Supabase project — either build-time
  (`.env.local`, this playbook) or per-device (Settings → Multi-Device Sync).
- Target end state: `.env.local` contains the user's three values, `supabase/schema.sql`
  has been run in their project, a clean rebuild succeeds, and the built bundle
  contains their project URL.

## Ground rules for the agent

1. NEVER commit, print, or copy `.env.local` contents elsewhere; never log the anon key.
2. Do not edit `src/lib/env.ts` — overrides come exclusively from `.env.local`.
3. Ask before overwriting an existing `.env.local`.
4. If any step fails, jump to Troubleshooting; do not improvise schema changes.

## Step 1 — Pre-flight

```bash
node -v          # expect v18+
npm -v
git rev-parse --is-inside-work-tree   # expect true
Test-Path .env.local                  # note result; if true, ask user before overwrite
```

If `node_modules` missing: `npm install`.

## Step 2 — Collect the user's values

Ask the user for:

| Value | Format | Where the user finds it |
|---|---|---|
| Project URL | `https://<ref>.supabase.co` | Supabase Dashboard → Project Settings → API |
| Anon public key | starts with `eyJ…` | same page ("anon public", NOT service_role) |
| App site URL | no trailing slash | where they will browse the app, e.g. `http://localhost:3000` |

Validate before writing:
```bash
# URL must match ^https:\/\/[a-z0-9-]+\.supabase\.co$ ; key must start with eyJ ; site URL must not end with /
```

If the user has **no Supabase project yet**, walk them through SELF-HOSTING.md
Steps 2–4 (create project → SQL Editor → run `supabase/schema.sql` → optionally
enable Google provider) and wait for confirmation before continuing.

## Step 3 — Write `.env.local`

Template (fill from Step 2):

```ini
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_SITE_URL=
```

## Step 4 — Supabase dashboard checklist (user clicks, agent verifies)

1. SQL Editor → run contents of `supabase/schema.sql` (creates `sync_docs` + RLS + realtime).
2. Authentication → Sign In / Providers → Email → turn **off** "Confirm email"
   (one-liner for this also sits at the bottom of `schema.sql`).
3. Optional Google login: Authentication → Providers → Google → enable with their
   Google OAuth Client ID/Secret; redirect `https://<ref>.supabase.co/auth/v1/callback`;
   URL Configuration → Site URL = their app URL; add `<app-url>/**` to Redirect URLs.

## Step 5 — Build & verify

```bash
npx next build                       # must finish "Compiled successfully"
# bundle must contain the project URL now:
Get-ChildItem out\_next -Recurse -Include *.js | Select-String "<their-ref>.supabase.co" -List
# then serve & smoke-test:
cmd /c start.bat                     # or: node scripts/serve.cjs --port 3000
Invoke-WebRequest http://localhost:3000 -UseBasicParsing -TimeoutSec 5   # expect 200
```

Report success criteria to the user: build clean ✓ · URL in bundle ✓ · HTTP 200 ✓.
Tell them: open the app → Settings → Multi-Device Sync → enter email/password →
**Create account & sync** → repeat on other devices with the same account.

## Troubleshooting map

| Symptom | Agent action |
|---|---|
| `redirect_uri_mismatch` at Google | Site/Redirect URLs wrong — redo Step 4.3 exactly |
| "Google sign-in is not enabled on this cloud project" | Provider not enabled — Step 4.3 first switch |
| Login OK but no data syncs | Check schema ran (Step 4.1); check Settings shows their URL; check Sync status row |
| RLS violation toast | They used service_role key or skipped schema — re-run schema.sql, use anon key |
| Build fine but URL absent from `out/` | `.env.local` malformed (spaces/quotes) — rewrite plainly, rebuild |
| OAuth loops back to moneymevaonline.pages.dev | Stale build — ensure `NEXT_PUBLIC_SITE_URL` set to THEIR url, rebuild |

## Also useful

- Full manual guide: `SELF-HOSTING.md`
- End-user sync reference: `CLOUD-SYNC-GUIDE.md`
- Schema: `supabase/schema.sql`
