const PINS_KEY = 'mm_pins';
const PINS_USED_KEY = 'mm_pins_used_idx';
const PINS_SHOWN_KEY = 'mm_pins_shown';

function load<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
  catch { return fallback; }
}
function save(key: string, data: any) { localStorage.setItem(key, JSON.stringify(data)); }
import { logActivity } from './activityLog';

function generatePin(): string {
  let pin = '';
  for (let i = 0; i < 4; i++) pin += Math.floor(Math.random() * 10).toString();
  return pin;
}

export function generatePins(count = 10): string[] {
  const pins: string[] = [];
  for (let i = 0; i < count; i++) {
    let pin: string;
    do { pin = generatePin(); } while (pins.includes(pin));
    pins.push(pin);
  }
  save(PINS_KEY, pins);
  save(PINS_USED_KEY, 0);
  save(PINS_SHOWN_KEY, false);
  return pins;
}

export function getPins(): string[] { return load<string[]>(PINS_KEY, []); }
export function getUsedIndex(): number { return load<number>(PINS_USED_KEY, 0); }
export function arePinsShown(): boolean { return load<boolean>(PINS_SHOWN_KEY, false); }
export function markPinsShown() { save(PINS_SHOWN_KEY, true); }
export function hasPins(): boolean { return getPins().length > 0; }

export function validatePin(pin: string): boolean {
  const pins = getPins();
  const usedIdx = getUsedIndex();
  if (pins.length === 0) return false;
  const idx = pins.indexOf(pin, usedIdx);
  if (idx === -1) { logActivity('pin_used', 'failed attempt'); return false; }
  const nextIdx = idx + 1;
  save(PINS_USED_KEY, nextIdx >= pins.length ? 0 : nextIdx);
  logActivity('pin_used', 'successful');
  return true;
}

export function getRemainingPins(): number {
  const pins = getPins();
  const usedIdx = getUsedIndex();
  if (pins.length === 0 || usedIdx >= pins.length) return pins.length;
  return pins.length - usedIdx;
}

export function getNextPinHint(): string {
  const pins = getPins();
  const usedIdx = getUsedIndex();
  if (pins.length === 0 || usedIdx >= pins.length) return '';
  return pins[usedIdx];
}

// Session lock
const LOCK_TIMEOUT_KEY = 'mm_auto_lock_minutes';
const LAST_ACTIVITY_KEY = 'mm_last_activity';
const LOCKED_KEY = 'mm_locked';

export function getAutoLockMinutes(): number { return load<number>(LOCK_TIMEOUT_KEY, 0); }
export function setAutoLockMinutes(minutes: number) { save(LOCK_TIMEOUT_KEY, minutes); }
export function updateLastActivity() { save(LAST_ACTIVITY_KEY, new Date().toISOString()); }
export function getLastActivity(): string { return load<string>(LAST_ACTIVITY_KEY, new Date().toISOString()); }
export function isLocked(): boolean { return load<boolean>(LOCKED_KEY, false); }
export function setLocked(locked: boolean) { save(LOCKED_KEY, locked); }

export function checkAndLock(): boolean {
  if (isLocked()) return false;
  const timeout = getAutoLockMinutes();
  if (timeout <= 0) { setLocked(false); return false; }
  const last = new Date(getLastActivity()).getTime();
  const elapsed = (Date.now() - last) / 60000;
  if (elapsed >= timeout) { setLocked(true); return true; }
  return false;
}
