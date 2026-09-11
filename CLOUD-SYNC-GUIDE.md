# Cloud Sync Guide (Money Meva Online)

Cloud sync backs up your Money Meva data to a shared cloud database (Supabase) and
keeps it in sync across your devices — using the classic link-only model (like the
original CouchDB sync). Every device that connects with the same project URL + anon
key reads and writes the **same rows**. No email/password, no accounts.

> **Users:** see the full manual in [`docs/USER-GUIDE.md`](docs/USER-GUIDE.md).
> **Self-hosting?** To run the app against **your own** Supabase project,
> follow **[SELF-HOSTING.md](SELF-HOSTING.md)**.

---

## For App Users

### First time (connect to a shared database)

1. Create a free Supabase project at https://supabase.com (or use an existing one)
2. In the project's SQL Editor, paste and run the contents of [`supabase/schema.sql`](supabase/schema.sql)
   — this creates the shared `sync_docs` table with open access for the anon key
3. Open **Settings → Multi-Device Sync**
4. Paste your **Supabase project URL** (e.g. `https://xxxxxxxxxxxx.supabase.co`)
   and the **anon key** (from Project Settings → API)
5. Tap **Connect** — your local data is pushed to the cloud

### On another device

1. Open **Settings → Multi-Device Sync** on the second device
2. Paste the **same URL + anon key**
3. Tap **Connect** — your data appears on this device

> **Both devices now share the same rows.** Edits on one device appear on the other
> within seconds (realtime) or when you tap **Sync Now**.

### Everyday use

- The app works **fully offline** — sync is optional and happens in the background
- Tap **Sync Now** any time for an instant push/pull
- **Disconnect** stops syncing this device (your local data stays)

### Data privacy

- Anyone with the project URL + anon key can read and write the data — this is the
  same model as the original CouchDB sync. **Don't share the URL + key publicly.**
- The anon key is public by design (it's safe to ship in app bundles); the protection
  is keeping the URL private.

---

## For App Owners / Developers

### Pointing the app at your own Supabase project

1. Create a project at https://supabase.com (free tier is enough)
2. Run `supabase/schema.sql` in **SQL Editor** (creates shared `sync_docs` + open RLS policies)
3. Copy `.env.example` → `.env.local` and set:
   - `NEXT_PUBLIC_SUPABASE_URL` — your project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — your anon key
   - `NEXT_PUBLIC_SITE_URL` — where the app is served (for Google redirect if needed)
4. Rebuild (`npm run build`) — the URL + key are embedded; users only paste them in Settings

> Users can override the URL + key per device in Settings → Multi-Device Sync.

### Troubleshooting

| Symptom | Fix |
|---|---|
| "Table 'sync_docs' not found" | Run `supabase/schema.sql` in the project's SQL Editor |
| Push shows "ON CONFLICT specification" error | The table still has the old per-user schema — run `supabase/schema.sql` |
| Pull says "failed to store them locally" | This was a false alarm in older versions (v7.3.0.37+ fixed it) |
| "Cloud rows in database: 0" after Connect | Run the migration SQL (Settings → Setup Guide → Copy SQL), then Disconnect + Connect again |
| Realtime updates not arriving | `ALTER PUBLICATION supabase_realtime ADD TABLE sync_docs;` + `REPLICA IDENTITY FULL` (both in `schema.sql`) |
| Data missing on other device | Make sure both devices use the **same** project URL + anon key |

---

## Migration from the old per-user model

Pre-v7.3.0.33 projects had `sync_docs` with a `user_id` column, composite PK
`(user_id, id)`, and per-user RLS. The migration SQL (`supabase/schema.sql`)
handles this automatically:

1. Drops all existing RLS policies on `sync_docs`
2. Drops the composite PK and all foreign key constraints
3. Drops the `user_id` column
4. Dedupes rows (newest `updated_at` wins per `id`)
5. Creates a single-column PK on `id`
6. Creates open anon policies (any device with the key can read/write)

Run it once in the SQL Editor — it's idempotent and safe to re-run.
