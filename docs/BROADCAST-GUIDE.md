# Broadcast & Banner Guide

Send messages to all Money Meva users. Zero backend — edit JSON files and push to GitHub.

---

## Broadcast Pill

Small floating notification at the top of the screen. Does NOT block content.

### How to Broadcast

1. Edit `public/broadcast.json`
2. Commit + push to `master`
3. Cloudflare auto-deploys — all users see it on next page load

### JSON Format

Single broadcast:
```json
{
  "id": "broadcast-2026-08-19-v1",
  "title": "Money Meva v7.1.2",
  "message": "Success toasts now show entry summaries.",
  "type": "info",
  "pinned": false,
  "expires": "2026-09-19",
  "link": "https://github.com/kuldeep7ke/moneymeva-online/releases"
}
```

Multiple broadcasts (array):
```json
[
  {
    "id": "broadcast-2026-08-19-v1",
    "title": "Money Meva v7.1.2",
    "message": "Success toasts now show entry summaries.",
    "type": "info",
    "pinned": false,
    "expires": "2026-09-19"
  },
  {
    "id": "broadcast-2026-08-19-v1b",
    "message": "Exports now work on Android via share sheet.",
    "type": "success",
    "pinned": false,
    "expires": "2026-09-19"
  }
]
```

### Fields

| Field | Required | Description |
|---|---|---|
| `id` | Yes | Unique ID (use `broadcast-YYYY-MM-DD-vN` — change for each new broadcast) |
| `title` | No | Bold heading, 3-5 words |
| `message` | Yes | Main text, 1-2 lines. Supports emojis |
| `type` | No | `info` blue, `warning` amber, `success` green, `error` red (default: info) |
| `pinned` | No | `true` = always shown, no dismiss. `false` = dismissable (default) |
| `expires` | No | Auto-hide after this date (YYYY-MM-DD) |
| `link` | No | URL — makes entire pill clickable (opens in new tab) |

### Behavior

- Fetches `broadcast.json` with cache-busting on every page load
- Supports single object OR array of broadcasts
- Each broadcast is independently dismissable (X button per pill)
- Dismissed IDs stored in localStorage — won't show again
- Pinned messages have no X button — always visible
- Expired messages auto-hidden after `expires` date
- Multiple broadcasts stack vertically (44px apart)
- Centered floating pill at top of screen — does NOT push content down

---

## Banner Modal

Full-screen overlay popup in the center of the page. Blocks all content until dismissed.

### How to Banner

1. Edit `public/banner.json`
2. Commit + push to `master`
3. Cloudflare auto-deploys — all users see it on next page load

### JSON Format

```json
{
  "id": "banner-2026-08-19-v1",
  "title": "Welcome to Money Meva",
  "content": "Your personal finance companion. Track income, expenses, and investments.",
  "image": "https://example.com/image.jpg",
  "href": "https://github.com/kuldeep7ke/moneymeva-online",
  "width": "max-w-md",
  "startDate": "2026-08-19",
  "expires": "2026-09-19"
}
```

### Fields

| Field | Required | Description |
|---|---|---|
| `id` | Yes | Unique ID (use `banner-YYYY-MM-DD-vN`) |
| `title` | No | Bold heading at top of banner |
| `content` | Yes | Main text (supports newlines) |
| `image` | No | Image URL shown above content (auto-sizes to fit) |
| `href` | No | URL — makes entire banner clickable (opens in new tab) |
| `width` | No | Tailwind max-width class (default: `max-w-md`). Options: `max-w-sm`, `max-w-md`, `max-w-lg`, `max-w-xl`, `max-w-2xl` |
| `startDate` | No | Show banner only after this date (YYYY-MM-DD). Before this date, banner is hidden |
| `expires` | No | Auto-hide after this date (YYYY-MM-DD). After this date, banner is hidden |

### Scheduling Examples

Show for one week only:
```json
{
  "id": "banner-2026-08-20-v1",
  "title": "Weekend Sale",
  "content": "50% off premium features this weekend only!",
  "startDate": "2026-08-22",
  "expires": "2026-08-24"
}
```

Show starting next month:
```json
{
  "id": "banner-2026-08-21-v1",
  "title": "September Update",
  "content": "Big changes coming in September. Stay tuned!",
  "startDate": "2026-09-01",
  "expires": "2026-09-30"
}
```

Permanent banner (no expiry):
```json
{
  "id": "banner-2026-08-22-v1",
  "title": "Welcome",
  "content": "Thanks for using Money Meva!",
  "startDate": "2026-08-01"
}
```

Past banner (already expired, won't show):
```json
{
  "id": "banner-2026-07-01-v1",
  "title": "June Offer",
  "content": "Special June promotion.",
  "startDate": "2026-06-01",
  "expires": "2026-06-30"
}
```

### Behavior

- Fetches `banner.json` with cache-busting on every page load
- Shows full-screen overlay (black backdrop + centered card)
- X button in top-right corner with **5-second countdown** — disabled until timer reaches 0
- Click outside does NOT close (per app convention)
- Shows on every page refresh (no localStorage persistence)
- Hidden if before `startDate` or after `expires`
- Auto-sizes based on content (max-h with scroll)
- Optional: click banner opens `href` in new tab

---

## Tips

- **Broadcast pill** = quick info, does not block app
- **Banner modal** = important announcement, blocks app until dismissed
- Use emojis in both for visual appeal
- Keep messages short (1-2 lines for pills, 2-3 lines for banners)
- Use `pinned: true` for critical broadcast alerts (security, maintenance)
- Set `startDate` + `expires` for time-limited campaigns
- Change `id` for each new broadcast/banner (old IDs stay dismissed for broadcasts)
- `link`/`href` can be full URL or relative path (e.g. `/dashboard/settings`)
- Use array format for 2+ broadcasts; single object works for just one
- Banner shows on every refresh; broadcast pill stays dismissed until new ID
