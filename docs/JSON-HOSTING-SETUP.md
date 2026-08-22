# JSON Hosting Setup Guide (jsonbin.io)

No commit needed — edit via web dashboard, changes reflect instantly in the app.

---

## Step 1: Create Broadcast Bin

1. Go to https://jsonbin.io
2. Click **"Quick Create JSON"** (no account required)
3. Delete the default content and paste your broadcast JSON:

```json
[
  {
    "id": "broadcast-2026-08-19-v1",
    "title": "Money Meva v7.1.2",
    "message": "Success toasts now show entry summaries.",
    "type": "info",
    "pinned": false,
    "expires": "2026-09-19",
    "link": "https://github.com/kuldeep7ke/moneymeva-online/releases"
  }
]
```

4. Click **"Save"**
5. Copy the **Bin ID** from the URL (e.g., `66a1b2c3d4e5f6a7b8c9d0e1`)

---

## Step 2: Create Banner Bin

1. Go to https://jsonbin.io
2. Click **"Quick Create JSON"** again
3. Paste your banner JSON:

```json
{
  "id": "banner-2026-08-19-v1",
  "title": "Money Meva v7.1.2 is Live!",
  "content": "Track your income, expenses, and investments — all offline-first.",
  "image": "https://placehold.co/800x400/FF8A3D/FFFFFF?text=Money+Meva+v7.1.2",
  "href": "https://github.com/kuldeep7ke/moneymeva-online/releases",
  "width": "max-w-xl",
  "startDate": "2026-08-19",
  "expires": "2026-09-19"
}
```

4. Click **"Save"**
5. Copy the **Bin ID** from the URL

---

## Step 3: Update App Config

Edit `src/lib/config.ts` and add your Bin IDs:

```ts
export const BROADCAST_BIN_ID = 'YOUR_BROADCAST_BIN_ID_HERE';
export const BANNER_BIN_ID = 'YOUR_BANNER_BIN_ID_HERE';
```

---

## Step 4: Edit Anytime

### Via Web Dashboard
1. Go to https://jsonbin.io
2. Click on your bin
3. Edit the JSON content
4. Click **"Save"**
5. Changes reflect in app on next page load

### Via API (optional)
```bash
# Update broadcast
curl -X PUT "https://api.jsonbin.io/v3/broadcasts/YOUR_BIN_ID" \
  -H "Content-Type: application/json" \
  -d '[{"id":"broadcast-2026-08-20-v1","message":"New update!","type":"success"}]'

# Update banner
curl -X PUT "https://api.jsonbin.io/v3/banners/YOUR_BIN_ID" \
  -H "Content-Type: application/json" \
  -d '{"id":"banner-2026-08-20-v1","title":"New Feature","content":"Check it out!"}'
```

---

## Step 5: Verify

1. Open the app
2. Broadcast pill should appear at top
3. Banner modal should appear (if within date range)
4. Edit via jsonbin.io dashboard
5. Refresh app — changes should appear

---

## Troubleshooting

### Broadcast/Banner not showing
- Check Bin IDs are correct in config
- Check JSON is valid (no syntax errors)
- Check `startDate` and `expires` dates
- Open browser console for errors

### Changes not reflecting
- Wait 5-10 seconds after saving
- Hard refresh the app (Ctrl+F5)
- Check network tab for failed requests

### CORS errors
- jsonbin.io allows CORS by default
- If blocked, check your browser extensions

---

## Limits (Free Tier)

- **10,000 requests/month** per bin
- **No account required** for public bins
- **Version control** — see edit history
- **Collaboration** — share edit links

---

## Alternative: Paid Features

If you need more:
- **Private bins** — password protected
- **More requests** — upgrade plan
- **Schema validation** — ensure JSON structure
- **Webhooks** — notify on changes

---

## Quick Reference

| Task | How |
|---|---|
| Edit broadcast | jsonbin.io dashboard → edit JSON → save |
| Edit banner | jsonbin.io dashboard → edit JSON → save |
| Add new broadcast | Add object to array in broadcast bin |
| Remove broadcast | Delete object from array |
| Schedule banner | Set `startDate` and `expires` dates |
| Make banner permanent | Remove `expires` field |
