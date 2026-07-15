const SYNC_EVENT = 'mm-sync-event';

export interface SyncEvent {
  status: 'started' | 'pushing' | 'pulled' | 'processing' | 'complete' | 'error';
  message: string;
  pushed?: number;
  pulled?: number;
  error?: string;
}

let _lastEvent: SyncEvent | null = null;

export function getLastSyncEvent(): SyncEvent | null {
  return _lastEvent;
}

export function dispatchSyncEvent(ev: SyncEvent) {
  _lastEvent = ev;
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(SYNC_EVENT, { detail: ev }));
}

export function listenSyncEvents(fn: (ev: SyncEvent) => void) {
  const handler = (e: Event) => fn((e as CustomEvent).detail);
  window.addEventListener(SYNC_EVENT, handler);
  return () => window.removeEventListener(SYNC_EVENT, handler);
}
