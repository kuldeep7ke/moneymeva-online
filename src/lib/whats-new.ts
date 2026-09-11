export interface WhatsNewItem {
  version: string;
  date: string;
  items: string[];
}

export const RELEASE_NOTES: WhatsNewItem = {
  version: 'v7.3.0.38',
  date: '11 Sep 2026',
  items: [
    'Shared sync database — every device with the same URL + anon key shares one database',
    'No accounts needed: connect with just a project URL + anon key (like the old CouchDB model)',
    'Settings now shows "Shared database" and total cloud row count',
    'Setup Guide simplified: 2 steps (create project, run SQL)',
    'Push errors now show the real underlying issue (e.g. schema not applied)',
    'Sync no longer shows false "failed to store" errors after a healthy sync',
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
