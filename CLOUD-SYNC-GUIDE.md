# Cloud Sync Guide (Money Meva Online)

Cloud sync backs up your Money Meva data to a shared cloud database (Supabase) and
keeps it in sync across your devices — privately, per account.

> **Users:** see the full manual in [`docs/USER-GUIDE.md`](docs/USER-GUIDE.md).
> This file is the sync-specific reference, including owner/developer setup.

---

## For App Users

### First time (create your account)

1. Open **Settings → Multi-Device Sync**
2. The Supabase URL and anon key are already filled in — don't change them
3. Enter **your email** and a **password** (min 6 characters)
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
4. Set build env vars:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon public key from Project Settings → API>
```

5. Build the app (`npm run build`) — the URL + key are baked in, users only
   enter email + password

> Users can also paste a different URL + anon key in Settings manually
> (overrides the baked-in values) — e.g. for testing another project.

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