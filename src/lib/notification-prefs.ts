import type { AppNotification } from './store';

// Per-category toggles for in-app notifications (bell) and on-screen popups.
// Everything defaults ON — the system-recommended baseline. Banner + broadcast
// are remote announcements and intentionally have NO setting here.

export const NOTIFICATION_KEYS = ['recurring', 'archive', 'budget', 'reminder', 'tips', 'sync', 'credit'] as const;
export type NotificationKey = (typeof NOTIFICATION_KEYS)[number];

export const POPUP_KEYS = ['whats-new', 'data-safety', 'install', 'security-tip', 'credit'] as const;
export type PopupKey = (typeof POPUP_KEYS)[number];

const STORAGE_KEY = 'mm_notify_prefs';

const ALL_DEFAULTS: Record<string, boolean> = {
  ...NOTIFICATION_KEYS.reduce((acc, k) => ({ ...acc, [k]: true }), {}),
  ...POPUP_KEYS.reduce((acc, k) => ({ ...acc, [k]: true }), {}),
};

export function getNotifyPrefs(): Record<string, boolean> {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    const merged: Record<string, boolean> = { ...ALL_DEFAULTS };
    for (const k of Object.keys(raw)) {
      if (k in merged) merged[k] = !!raw[k];
    }
    return merged;
  } catch {
    return { ...ALL_DEFAULTS };
  }
}

export function setNotifyPref(key: string, on: boolean) {
  try {
    const prefs = getNotifyPrefs();
    prefs[key] = on;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch { /* ignore */ }
}

export function isNotifyEnabled(key: string): boolean {
  return getNotifyPrefs()[key] !== false;
}

export function resetNotifyPrefs() {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}

// Maps a generated AppNotification to its settings key (id prefix for reminders
// vs tips, otherwise by type). Returns null when no toggle applies.
export function notificationKey(n: AppNotification): string | null {
  if (n.id.startsWith('weekend-')) return 'tips';
  switch (n.type) {
    case 'recurring': return 'recurring';
    case 'trash': return 'archive';
    case 'budget': return 'budget';
    case 'reminder': return 'reminder';
    case 'sync': return 'sync';
    case 'credit': return 'credit';
    default: return null;
  }
}

export function popupKey(id: string): string | null {
  const map: Record<string, string> = {
    'whats-new': 'whats-new',
    'data-safety': 'data-safety',
    'install-prompt': 'install',
    'security-tip': 'security-tip',
    'credit-alert': 'credit',
  };
  return map[id] ?? null;
}

export function isPopupEnabled(id: string): boolean {
  const key = popupKey(id);
  return key ? isNotifyEnabled(key) : true;
}