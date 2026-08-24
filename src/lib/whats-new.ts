export interface WhatsNewItem {
  version: string;
  date: string;
  items: string[];
}

export const RELEASE_NOTES: WhatsNewItem = {
  version: 'v7.2.0.1',
  date: '23 Aug 2026',
  items: [
    'NEW: Works (कामे) — record farm & other jobs with pending payment tracking',
    'Works: crop, season, area, duration, party and per-payment history',
    'NEW: Partnership (भागीदारी) tab in Party Accounts for shared income/expense splits',
    'Partnership: member shares must total 100% with automatic settlement balances',
    'Partnership members: type any name or pick from your recent parties',
    'Payments can auto-create matching Income or Expense ledger entries',
    'Farmer added as a profession during onboarding, with farming categories',
    'Categories page: tap any category to see all its entries with totals',
    'Dashboard: compact single-line summary cards with combined Party totals',
    'Performance: faster dashboard, less loading stutter',
    'Removed Tasks section — Savings is now Goals only',
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
