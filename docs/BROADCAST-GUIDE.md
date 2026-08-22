# Broadcast Guide

Send messages to all Money Meva users. Zero backend — edit a JSON file and push to GitHub.

## How to Broadcast

1. Edit `public/broadcast.json`
2. Commit + push to `master`
3. Cloudflare auto-deploys — all users see it on next page load

## Fields

| Field | Required | Description |
|---|---|---|
| `id` | Yes | Unique ID (use `broadcast-YYYY-MM-DD-vN` — change for each new broadcast) |
| `title` | No | Bold heading, 3-5 words |
| `message` | Yes | Main text, 1-2 lines. Supports emojis |
| `type` | No | `info` blue, `warning` amber, `success` green, `error` red (default: info) |
| `pinned` | No | `true` = always shown, no dismiss. `false` = dismissable (default) |
| `expires` | No | Auto-hide after this date (YYYY-MM-DD) |
| `link` | No | URL — makes entire pill clickable (opens in new tab) |

## Examples

New version release:
```json
{
  "id": "broadcast-2026-08-20-v1",
  "title": "v7.1.3 Released",
  "message": "New investment calculator with FD/SIP/RD/PPF support.",
  "type": "success",
  "pinned": false,
  "expires": "2026-09-20",
  "link": "https://github.com/kuldeep7ke/moneymeva-online/releases"
}
```

Maintenance notice:
```json
{
  "id": "broadcast-2026-08-21-v1",
  "title": "Scheduled Maintenance",
  "message": "Cloud sync unavailable for 2 hours on Aug 22, 2-4 AM IST.",
  "type": "warning",
  "pinned": true
}
```

Security alert:
```json
{
  "id": "broadcast-2026-08-22-v1",
  "title": "Security Update",
  "message": "Please update to v7.1.4+ for important security fixes.",
  "type": "error",
  "pinned": true,
  "link": "https://github.com/kuldeep7ke/moneymeva-online/releases"
}
```

Feature announcement with link:
```json
{
  "id": "broadcast-2026-08-23-v1",
  "message": "Multi-device sync is now available! Enable it in Settings.",
  "type": "info",
  "link": "/dashboard/settings"
}
```

Quick tip with emoji:
```json
{
  "id": "broadcast-2026-08-24-v1",
  "message": "Did you know? Long-press any transaction to edit it quickly.",
  "type": "info"
}
```

## Behavior

- Fetches `broadcast.json` with cache-busting on every page load
- Dismissed via X button — stored in localStorage, won't show again
- Pinned messages have no X button — always visible
- Expired messages auto-hidden after `expires` date
- Centered floating pill at top of screen — does NOT push content down
- If `link` is set, entire pill is clickable (opens in new tab, shows link icon)

## Tips

- Use emojis in title or message for visual appeal
- Keep messages short (1-2 lines max)
- Use `pinned: true` for critical alerts (security, maintenance)
- Use `pinned: false` for informational messages (new features, tips)
- Set `expires` for time-sensitive messages
- Change `id` for each new broadcast (old IDs stay dismissed)
- `link` can be a full URL or relative path (e.g. `/dashboard/settings`)
