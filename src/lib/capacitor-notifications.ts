import { LocalNotifications } from '@capacitor/local-notifications';
import type { AppNotification } from './store';
import { getAllNotifications } from './store';

const SHOWN_KEY = 'mm_cap_shown_notifs';

function getShownIds(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(SHOWN_KEY) || '[]')); }
  catch { return new Set(); }
}

function saveShownIds(set: Set<string>) {
  localStorage.setItem(SHOWN_KEY, JSON.stringify([...set]));
}

let idCounter = 2000;

function nextId(): number {
  const n = idCounter;
  idCounter = (idCounter + 1) % 2147483647;
  return n;
}

function isNative(): boolean {
  return typeof window !== 'undefined' && !!(window as any).Capacitor?.isNativePlatform();
}

export async function initLocalNotifications() {
  try {
    const perm = await LocalNotifications.checkPermissions();
    if (perm.display === 'prompt') {
      await LocalNotifications.requestPermissions();
    }
  } catch {
    // not on native
  }
}

export async function syncLocalNotifications() {
  if (!isNative()) return;
  try {
    const notifs = getAllNotifications();
    const shown = getShownIds();
    const newNotifs = notifs.filter(n => !shown.has(n.id));
    if (newNotifs.length === 0) return;
    const updated = new Set(shown);
    newNotifs.forEach(n => updated.add(n.id));
    saveShownIds(updated);
    const toShow = newNotifs.slice(0, 3);
    await LocalNotifications.schedule({
      notifications: toShow.map(n => ({
        id: nextId(),
        title: n.title,
        body: n.message,
        smallIcon: 'ic_stat_notify',
        iconColor: n.severity === 'danger' ? '#EF4444' : n.severity === 'warning' ? '#F59E0B' : '#3B82F6',
        autoCancel: true,
      })),
    });
  } catch {
    // ignore
  }
}
