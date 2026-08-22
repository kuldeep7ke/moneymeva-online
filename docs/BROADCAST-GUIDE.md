# Broadcast Guide

Send messages to all Money Meva users. Zero backend — just edit a JSON file and push to GitHub.

## How to Broadcast

1. Edit `public/broadcast.json`
2. Commit + push to `master`
3. Cloudflare auto-deploys → all users see it on next page load

## JSON Format

```json
{
  "id": "broadcast-2026-08-19",
  "title": "Money Meva v7.1.2",
  "message": "Success toasts now show entry summaries. Exports work on Android.",
  "type": "info",
  "pinned": false,
  "expires": "2026-09-19"
}
```

## Fields

| Field | Required | Description |
|---|---|---|
| `id` | Yes | Unique identifier (use `broadcast-YYYY-MM-DD` format) |
| `title` | No | Bold heading (keep short, 3-5 words) |
| `message` | Yes | Main message (1-2 lines recommended) |
| `type` | No | `info` (blue), `warning` (amber), `success` (green), `error` (red) — default: `info` |
| `pinned` | No | `true` = always shown, no dismiss button; `false` = dismissable (default) |
| `expires` | No | Auto-hide after this date (`YYYY-MM-DD`) |

## Examples

### New Version Release
```json
{
  "id": "broadcast-2026-08-20",
  "title": "v7.1.3 Released",
  "message": "New investment calculator with FD/SIP/RD/PPF support.",
  "type": "success",
  "pinned": false,
  "expires": "2026-09-20"
}
```

### Maintenance Notice
```json
{
  "id": "broadcast-2026-08-21",
  "title": "Scheduled Maintenance",
  "message": "Cloud sync will be unavailable for 2 hours on Aug 22, 2-4 AM IST.",
  "type": "warning",
  "pinned": true
}
```

### Security Alert
```json
{
  "id": "broadcast-2026-08-22",
  "title": "Security Update",
  "message": "Please update to v7.1.4+ for important security fixes.",
  "type": "error",
  "pinned": true
}
```

### Feature Announcement
```json
{
  "id": "broadcast-2026-08-23",
  "message": "Multi-device sync is now available! Enable it in Settings.",
  "type": "info"
}
```

## Behavior

- **First load**: Fetches `broadcast.json` with cache-busting (`?t=Date.now()`)
- **Dismissed**: User taps X → stored in `mm_dismissed_broadcasts` localStorage → won't show again
- **Pinned**: Always shown, no X button
- **Expired**: Auto-hidden after `expires` date
- **Position**: Static full-width banner at the top of the dashboard, centered content, color-coded background

## Tips

- Keep messages short (1-2 lines max)
- Use `pinned: true` for critical alerts (security, maintenance)
- Use `pinned: false` for informational messages (new features, tips)
- Set `expires` for time-sensitive messages (events, deadlines)
- Change `id` for each new broadcast (old dismissed IDs won't show again)
