# Remote Broadcast & Banner Guide (jsonbin.io)

Send messages and banners to ALL Money Meva users (web + Android APK) by editing JSON online.
**No commit, no build, no deploy needed** — changes appear when users open/refresh the app.

---

## How It Works

```
You edit JSON on jsonbin.io  →  app fetches on every page load  →  pill/banner renders
```

- The app fetches from jsonbin.io with cache-busting on every dashboard load
- Works everywhere the app runs — web AND the Android APK (no app-store update required)
- Local `public/broadcast.json` / `public/banner.json` are legacy fallbacks only — jsonbin.io is now the source of truth

---

## Your Bins

| Content | Bin ID | API URL |
|---|---|---|
| Broadcast pills | `6a89f038f5f4af5e29363c79` | https://api.jsonbin.io/v3/b/6a89f038f5f4af5e29363c79/latest |
| Banner modal | `6a89f053f5f4af5e29363cb3` | https://api.jsonbin.io/v3/b/6a89f053f5f4af5e29363cb3/latest |

Dashboard: https://jsonbin.io → **Bins** → click a bin → edit → **Save (Ctrl+S)**

The Bin IDs live obfuscated (XOR + base64) in `src/lib/env.ts` (`BROADCAST_BIN_ID`, `BANNER_BIN_ID`) — they are decoded at runtime and never appear as plain text in the web/APK bundles. To change bins, edit `env.ts` and rebuild.

---

## Broadcast Pill

Small floating notification centered at the top of the screen. Does NOT block content.

### Current Format (array — one object per message)

```json
[
  {
    "id": "broadcast-2026-08-19-v5",
    "title": "Money Meva v7.1.2",
    "message": "Success toasts now show entry summaries.",
    "type": "info",
    "pinned": false,
    "expires": "2026-09-30",
    "link": "https://github.com/kuldeep7ke/moneymeva-online/releases"
  }
]
```

### Fields

| Field | Required | Description |
|---|---|---|
| `id` | Yes | Unique ID (`broadcast-YYYY-MM-DD-vN`). **Change it for each new message** — dismissed users only see new IDs |
| `title` | No | Bold heading, 3–5 words |
| `message` | Yes | Main text, 1–2 lines. Emojis work |
| `type` | No | `info` blue · `warning` amber · `success` green · `error` red (default info) |
| `pinned` | No | `true` = always shown, NO dismiss button. Default `false` = user can dismiss |
| `expires` | No | Auto-hidden after this date (YYYY-MM-DD) |
| `link` | No | URL — whole pill becomes clickable, opens in new tab |

### Behavior
- Multiple broadcasts: just add more objects to the array — they stack vertically (44px apart)
- Each pill has its own X (dismiss); dismissed IDs stored per-device in localStorage `mm_dismissed_broadcasts`
- Pinned messages never show an X — always visible until removed from JSON or expired
- Expired messages hidden after `expires` (inclusive local calendar day)
- Centered floating pill, `max-w-lg`, does not push page content down
- Fetched once per app load and cached — navigating between pages never re-requests it

---

## Banner Modal

Full-screen overlay popup, centered card. Blocks content until dismissed (X appears after 5s).

### Current Format (single object)

```json
{
  "id": "banner-2026-08-19-v3",
  "title": "Money Meva v7.1.2 is Live!",
  "content": "Track your income, expenses, and investments — all offline-first.",
  "image": "https://placehold.co/800x400/FF8A3D/FFFFFF?text=Money+Meva+v7.1.2",
  "href": "https://github.com/kuldeep7ke/moneymeva-online/releases",
  "width": "max-w-xl",
  "startDate": "2026-08-19",
  "expires": "2026-09-19"
}
```

### Fields

| Field | Required | Description |
|---|---|---|
| `id` | Yes | Unique ID (`banner-YYYY-MM-DD-vN`) |
| `title` | No | Bold heading at top |
| `content` | Yes | Main text (newlines preserved) |
| `image` | No | Image URL above content, auto-sizes (`max-h-64 object-cover`) |
| `href` | No | URL — entire card clickable (opens new tab) |
| `width` | No | Tailwind max-width class. Options: `max-w-sm` `max-w-md` `max-w-lg` `max-w-xl` `max-w-2xl`. Default `max-w-md` |
| `startDate` | No | Show ON and after this local calendar day (YYYY-MM-DD). Before it → hidden |
| `expires` | No | Show THROUGH this local calendar day. From the next day → hidden |

Both dates are inclusive calendar days in the viewer's timezone: a banner with `2026-08-22 → 2026-08-24` shows all three days, then disappears.

### Scheduling Recipes

One-week campaign:
```json
{ "startDate": "2026-08-22", "expires": "2026-08-24" }
```

Starts next month:
```json
{ "startDate": "2026-09-01", "expires": "2026-09-30" }
```

Permanent (always shows): omit both fields.
Never shows again: set `expires` in the past.

### Behavior
- **Shows once per app start/refresh/reload** — in-app menu navigation never re-shows it; a real reload does
- While the JSON fetches, a skeleton loading card shows (spinner + pulsing blocks)
- The X button (top-right) appears only after the banner FULLY displays — if there's an image, it waits for the image to finish loading — then counts down **7 seconds** (number badge → spinner → X)
- Backdrop click does NOT close (app convention)
- If `href` set, tapping the card opens the link (X still closes)
- Only visible inside its `startDate` → `expires` window (inclusive local calendar days)

---

## Editing Workflow (Day to Day)

1. Open https://jsonbin.io → login
2. **Bins** → click the bin (Broadcast or Banner)
3. Edit the JSON in the editor
4. **Ctrl+S / Save**
5. Done — every user gets it next time the app opens

Common edits:
| Goal | Do this |
|---|---|
| New announcement | Change `id` (bump vN) + `message`/`title` in the broadcast array |
| Remove old announcement | Delete its object from the array |
| Stop a banner | Set `expires` to yesterday (or delete its content) |
| Schedule a banner | Set `startDate` (+ optional `expires`) |
| Make banner clickable ad | Set `href` + optional `image` |

> **Note:** changing the broadcast `id` re-shows the pill even for users who dismissed an older one. Same `id` stays hidden after dismissal.

---

## Technical Notes

- Fetch: `https://api.jsonbin.io/v3/b/<BIN_ID>/latest?_=` (cache-busted, `cache: 'no-store'`)
- Response wrapper handled automatically — jsonbin returns `{ record: <your JSON>, metadata: {...} }`; the app reads `.record ?? raw`
- Components: `src/components/BroadcastBanner.tsx`, `src/components/BannerModal.tsx`
- Config: `src/lib/env.ts` (`BROADCAST_BIN_ID`, `BANNER_BIN_ID`, `JSONBIN_BASE` — XOR-obfuscated, decoded at runtime; Developer Zone → Remote Announcements shows masked IDs + a live bin-fetch test)
- Free tier: ~10,000 requests/month per bin (each dashboard load = 2 requests total). Plenty for current scale; if exceeded, bins simply stop updating — app keeps working
- To switch services later: change the URLs in the two components' fetch calls

## Troubleshooting

| Symptom | Check |
|---|---|
| Pill/banner not showing | JSON valid? `id` present? Outside `startDate`–`expires` window? Banner already shown once this app load (reload to see again)? |
| Changes not appearing | Saved in jsonbin (Ctrl+S)? Hard-refresh app (Ctrl+F5)? Wait a few seconds |
| Banner shows but X disabled | Normal — countdown starts only after full display (image included) and runs 7s |
| Pill keeps coming back | Its `id` changed since last dismiss — that's by design |
