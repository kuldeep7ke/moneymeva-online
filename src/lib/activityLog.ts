const LOG_KEY = 'mm_activity_log';
const MAX_ENTRIES = 200;

export type ActivityType =
  | 'pin_used'
  | 'login'
  | 'login_failed'
  | 'logout'
  | 'register'
  | 'session_lock'
  | 'session_unlock'
  | 'auto_lock_off'
  | 'data_cleared'
  | 'entry_created'
  | 'entry_deleted'
  | 'entry_restored'
  | 'entry_edited'
  | 'entry_exported'
  | 'entry_imported'
  | 'password_changed'
  | 'password_reset';

export interface ActivityEntry {
  type: ActivityType;
  timestamp: string;
  detail?: string;
}

function load(): ActivityEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(LOG_KEY) || '[]');
  } catch { return []; }
}

function save(log: ActivityEntry[]) {
  localStorage.setItem(LOG_KEY, JSON.stringify(log));
}

export function logActivity(type: ActivityType, detail?: string) {
  const log = load();
  log.unshift({ type, timestamp: new Date().toISOString(), detail });
  if (log.length > MAX_ENTRIES) log.length = MAX_ENTRIES;
  save(log);
}

export function getActivityLog(): ActivityEntry[] {
  return load();
}

export function clearActivityLog() {
  localStorage.removeItem(LOG_KEY);
}
