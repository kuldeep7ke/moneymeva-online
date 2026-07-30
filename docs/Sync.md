# Sync

## How It Works

PouchDB (browser) ↔ CouchDB (remote server)

## Connection

```ts
// src/lib/pouchdb.ts
connectRemote(url)  // returns { ok, error? }
// Live sync: { live: true, retry: true }
// Auto-reconnect: 30s interval
```

## Sync Modes

| Mode | Trigger | Behavior |
|---|---|---|
| Live | Auto on connect | Continuous push+pull |
| Manual | "Sync Now" button | One-shot push+pull |

## URL Storage

- `localStorage('mm_pouch_url')` — current URL
- `localStorage('mm_pouch_urls')` — last 5 URLs

## Error Handling

- `console.warn` on errors — never kills connection
- `checkConnection()` / `ensureConnected()` — utility guards

## Events

```ts
// src/lib/sync-notify.ts
dispatchSyncEvent(ev)  // fires mm-sync-event CustomEvent
listenSyncEvents(fn)   // subscribe to status
// Types: started | pushing | pulled | processing | complete | error
```

## Setup

User provides their own CouchDB URL. No hardcoded defaults.
