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
  "expires": "2026-09-19"
}
```

### Fields

| Field | Required | Description |
|---|---|---|
| `id` | Yes | Unique ID (use `banner-YYYY-MM-DD-vN`) |
| `title` | No | Bold heading at top of banner |
| `content` | Yes | Main text (supports newlines). Can include embed code or HTML |
| `image` | No | Image URL shown above content (auto-sizes to fit) |
| `href` | No | URL — makes entire banner clickable (opens in new tab) |
| `width` | No | Tailwind max-width class (default: `max-w-md`). Options: `max-w-sm`, `max-w-md`, `max-w-lg`, `max-w-xl`, `max-w-2xl` |
| `expires` | No | Auto-hide after this date (YYYY-MM-DD) |

### Behavior

- Fetches `banner.json` with cache-busting on every page load
- Shows full-screen overlay (black backdrop + centered card)
- Close button has **5-second countdown** — disabled until timer reaches 0
- Click outside does NOT close (per app convention)
- Dismissed via X button — stored in localStorage, won't show again
- Expired banners auto-hidden after `expires` date
- Auto-sizes based on content (max-h with scroll)
- Optional: click banner opens `href` in new tab

### Examples

Simple announcement:
```json
{
  "id": "banner-2026-08-20-v1",
  "title": "New Feature",
  "content": "Multi-device sync is now available! Go to Settings to enable it.",
  "width": "max-w-md"
}
```

Image banner with link:
```json
{
  "id": "banner-2026-08-21-v1",
  "title": "Diwali Offer",
  "content": "Track your festival spending with Money Meva!",
  "image": "https://example.com/diwali.jpg",
  "href": "https://example.com/offer",
  "width": "max-w-lg",
  "expires": "2026-11-15"
}
```

Social media embed:
```json
{
  "id": "banner-2026-08-22-v1",
  "title": "Follow Us",
  "content": "https://twitter.com/moneymeva/status/123456789",
  "width": "max-w-sm"
}
```

Large promo banner:
```json
{
  "id": "banner-2026-08-23-v1",
  "title": "Money Meva v8.0",
  "content": "Complete redesign with new features. Update now!",
  "image": "https://example.com/v8-banner.jpg",
  "href": "https://github.com/kuldeep7ke/moneymeva-online/releases",
  "width": "max-w-2xl",
  "expires": "2026-10-01"
}
```

---

## Tips

- **Broadcast pill** = quick info, does not block app
- **Banner modal** = important announcement, blocks app until dismissed
- Use emojis in both for visual appeal
- Keep messages short (1-2 lines for pills, 2-3 lines for banners)
- Use `pinned: true` or no close timer for critical alerts
- Set `expires` for time-sensitive messages
- Change `id` for each new broadcast/banner (old IDs stay dismissed)
- `link`/`href` can be full URL or relative path (e.g. `/dashboard/settings`)
- Use array format for 2+ broadcasts; single object works for just one
