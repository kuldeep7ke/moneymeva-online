# Security

## PIN System

- One-time 4-digit PINs generated at setup
- Auto-rotate after 10 uses
- Stored in `mm_pins` (localStorage)
- `PinPrompt` component for entry
- `PinSetupGuide` for first-time creation

## Auth

- Fully local — no server
- Users in `mm_users` (localStorage)
- Session in `mm_session`
- Multi-user support with profile switching

## Data Safety

- No PII stored remotely (only local)
- Soft-delete with 30-day retention
- Archive for deleted items
- Data export anytime (JSON/PDF/Excel)

## Auto-Lock

- Configurable auto-lock timeout (default: inactivity)
- `getAutoLockMinutes()` / `setAutoLockMinutes()`

## Best Practices

- Never log secrets or keys
- Never commit secrets to repo
- PINs are for app access only, not encryption
