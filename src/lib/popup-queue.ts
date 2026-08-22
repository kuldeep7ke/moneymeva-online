// Sequential popup scheduler — only ONE notice modal shows at a time, with a
// fixed breathing gap between them. App startup never bombards the user with
// stacked dialogs; each waits its turn and pops in priority order.
// Banner + broadcast are remote announcements and intentionally NOT part of
// this queue (they have their own display rules).

const INITIAL_DELAY_MS = 5000; // first eligible popup once app has settled
const GAP_MS = 2500;           // pause between consecutive popups

type Entry = { id: string; priority: number; show: () => void };

let activeId: string | null = null;
let started = false;
let paused = false;
const queue: Entry[] = [];
let pendingTimer: ReturnType<typeof setTimeout> | null = null;

function clearPending() {
  if (pendingTimer !== null) {
    clearTimeout(pendingTimer);
    pendingTimer = null;
  }
}

function scheduleNext(delayMs: number) {
  clearPending();
  if (paused || activeId !== null || !queue.length) return;
  pendingTimer = setTimeout(() => {
    pendingTimer = null;
    if (paused || activeId !== null || !queue.length) return;
    const next = queue.shift()!;
    activeId = next.id;
    next.show();
  }, delayMs);
}

// Ask for a display slot. `show()` runs when it's this popup's turn.
export function requestPopup(id: string, priority: number, show: () => void) {
  cancelPopup(id);
  queue.push({ id, priority, show });
  queue.sort((a, b) => a.priority - b.priority);
  if (!started) {
    started = true;
    scheduleNext(INITIAL_DELAY_MS);
    return;
  }
  if (activeId === null && !paused) scheduleNext(GAP_MS);
}

// Called when a popup closes OR its component unmounts. Idempotent.
export function cancelPopup(id: string) {
  if (activeId === id) {
    activeId = null;
    scheduleNext(GAP_MS);
    return;
  }
  const i = queue.findIndex(e => e.id === id);
  if (i >= 0) queue.splice(i, 1);
}

// Session-lock coordination: nothing new pops while the app is locked.
export function pausePopups() {
  paused = true;
  clearPending();
}

export function resumePopups() {
  paused = false;
  if (activeId === null && queue.length) scheduleNext(GAP_MS);
}
