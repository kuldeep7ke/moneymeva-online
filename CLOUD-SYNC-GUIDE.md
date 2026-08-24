# Cloud Sync Guide (Money Meva Online)

Cloud sync backs up your Money Meva data to a shared cloud database (Supabase) and
keeps it in sync across your devices — privately, per account.

> **Users:** see the full manual in [`docs/USER-GUIDE.md`](docs/USER-GUIDE.md).
> **Self-hosting?** To run the app against **your own** Supabase project with your
> own Google login and database, follow **[SELF-HOSTING.md](SELF-HOSTING.md)**.
> This file is the sync-specific reference, including owner/developer setup.

---

## For App Users

> **Which password?** The sync email + password are your **cloud account** credentials for Money Meva — you create them yourself the first time (any email, any password ≥ 6 chars). They are **not** your app unlock password and **not** your Google password. Signed in with Google? Use the same Google email and tap **Create account & sync** to pick a password.

### First time (create your account)

1. Open **Settings → Multi-Device Sync**
2. The Supabase URL and anon key fields start empty — fill them with **your own project's** values (create one free at supabase.com; guide: [`SELF-HOSTING.md`](SELF-HOSTING.md))
3. Enter **your email** and a **password you choose** (min 6 characters)
4. Tap **Create account & sync**
5. Done — your data is now backed up to the cloud

### On another device

1. Open **Settings → Multi-Device Sync** on the second device
2. Enter the **same email + password** you used before
3. Tap **Connect**
4. Your data appears on this device too

### Everyday use

- The app works **fully offline** — sync is optional and happens in the background
- Tap **Sync Now** any time for an instant push/pull
- **Disconnect** stops syncing this device (your local data stays)

### Data privacy

- Each account has its **own private space** (row-level security) — no user can
  see another user's data, and this is enforced at the database level
- Your email + password are the only thing protecting your cloud data —
  **don't share them**

---

## For App Owners / Developers

### Pointing the app at your own Supabase project

1. Create a project at https://supabase.com (free tier is enough)
2. Run `supabase/schema.sql` in **SQL Editor** (creates `sync_docs` + per-user security)
3. Optional: turn **OFF** "Confirm email" (Authentication → Sign In / Providers → Email)
   so new users sign up instantly
4. Add your keys: copy `.env.example` → `.env.local` and set
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL`
   (the repo ships with **no baked-in cloud**; see [SELF-HOSTING.md](SELF-HOSTING.md))

5. Build the app (`npm run build`) ?" the URL + key are embedded, users only
   enter email + password

> Users can also paste a different URL + anon key in Settings manually
> (overrides the baked-in values) — e.g. for testing another project.

### Enabling "Continue with Google" (login page)

The app has a Google sign-in button on the login page (web/PWA only — not in the Android APK).

1. **Google Cloud Console** (https://console.cloud.google.com) → APIs & Services →
   Credentials → **Create Credentials → OAuth client ID** (Application type: Web application):
   - Authorized redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`
   - Copy the **Client ID** + **Client Secret**
2. **Supabase dashboard** → Authentication → Providers → **Google** → Enable:
   - Paste Client ID + Client Secret → Save
3. **Supabase dashboard** → Authentication → URL Configuration → add the app URL to
   **Redirect URLs** (e.g. `http://localhost:3000/login`, `https://<your-domain>/login`)
4. Done — tapping "Continue with Google" creates/connects the cloud account and
   logs the user into the app automatically (new users go to onboarding).

> Google sign-in is only available in browsers (web/PWA). In the Android APK the
> button is disabled with a hint to use email & password.

### Troubleshooting

| Symptom | Fix |
|---|---|
| "Table 'sync_docs' not found" | Run `supabase/schema.sql` in the project's SQL Editor |
| "Email rate limit exceeded" | Disable "Confirm email" in Authentication settings |
| Sign-in says invalid credentials | User must tap **Create account & sync** first (or confirm their email) |
| Data missing on other device | Check both devices use the same email + password |
| Realtime updates not arriving | `ALTER PUBLICATION supabase_realtime ADD TABLE sync_docs;` + `REPLICA IDENTITY FULL` (both are in `schema.sql`) |

---

## Migrating from the old CouchDB setup

- The old sync used a **CouchDB URL** (e.g. Railway) with PouchDB replication.
- That path was **removed in v7.1.1.34** — the Railway instance is decommissioned.
- Local data is unaffected: connect to Supabase with the same app, and
  `pushAllToPouch` uploads your existing local PouchDB buffer to the cloud.