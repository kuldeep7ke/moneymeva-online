export interface WhatsNewItem {
  version: string;
  date: string;
  items: string[];
}

export const RELEASE_NOTES: WhatsNewItem = {
  version: 'v7.1.2',
  date: '19 Aug 2026',
  items: [
    'Success toast now shows entry summary after saving (type, category, amount)',
    'Category and account badges (Cash/Bank/UPI/Invest) on mobile transaction list',
    'Exports (PDF/Excel/CSV) open the Android share sheet instead of silently failing',
    'Sync status no longer flickers between "Sync Now" and the create-account form on Android',
    '30-day default date filter restored on Income & Expenses pages',
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
