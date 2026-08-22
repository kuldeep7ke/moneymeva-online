export interface WhatsNewItem {
  version: string;
  date: string;
  items: string[];
}

export const RELEASE_NOTES: WhatsNewItem = {
  version: 'v7.1.1.98',
  date: '23 Aug 2026',
  items: [
    'Startup popups now appear one at a time, in order — no more stacking',
    'Welcome card starts its fade timer only after the announcement banner closes',
    'Dashboard Partners card renamed to Party',
    'Announcements load through our own server cache — faster and lighter',
  ],
};

const STORAGE_KEY = 'mm_seen_release';

export function getLastSeenVersion(): string | null {
  try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
}

export function markVersionSeen(version: string): void {
  try { localStorage.setItem(STORAGE_KEY, version); } catch {}
}

export function shouldShowWhatsNew(currentVersion: string): boolean {
  const lastSeen = getLastSeenVersion();
  if (!lastSeen) return true;
  return lastSeen !== currentVersion;
}
