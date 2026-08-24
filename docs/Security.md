# Security

## PIN System

- One-time 4-digit PINs generated at setup
- Auto-rotate after 10 uses
- Stored in `mm_pins` (localStorage)
- `PinPrompt` component for entry
- `PinSetupGuide` for first-time creation

## Local Auth

- Local profiles in `mm_users` (localStorage)
- Session in `mm_session`
- Multi-user support with profile switching

## Cloud Auth (Supabase)

- Optional: email + password via **Supabase Auth** (JWT under `sb-<project-ref>-auth-token`)
- Only used when the user enables **Multi-Device Sync**
- Row-Level Security: every `sync_docs` row is owned by `auth.uid()`
  - Select/insert/update/delete all scoped to the signed-in user
  - Cross-account access is **impossible at the database level**
- The anon key is public by design — it grants sign-up/sign-in only,
  and returns **0 rows** to unauthenticated queries
- No PII is stored remotely except the sync data the user chooses to upload

## Data Safety

- No PII stored remotely (only local, unless cloud sync enabled)
- Soft-delete with 30-day retention
- Archive for deleted items
- Data export anytime (JSON/PDF/Excel)

## Auto-Lock

- Configurable auto-lock timeout (default: inactivity)
- `getAutoLockMinutes()` / `setAutoLockMinutes()`

## Best Practices

- Never log secrets or keys
- Never commit secrets to repo (env vars are gitignored)
- PINs are for app access only, not encryption
- Password never leaves the app except in the sign-in request (HTTPS)
