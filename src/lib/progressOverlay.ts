export type ProgressOverlayHandle = {
  update: (label: string, done: number, total: number) => void;
  finish: (label: string, onDone?: () => void) => void;
  error: (label: string, onDone?: () => void) => void;
  close: () => void;
};

export function createProgressOverlay(initialLabel = 'Working…'): ProgressOverlayHandle {
  const dark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
  const el = document.createElement('div');
  el.style.cssText = `position:fixed;inset:0;z-index:300;display:flex;flex-direction:column;align-items:center;justify-content:center;${dark ? 'background:#020617;' : 'background:#F8F6F3;'}`;
  el.innerHTML = `
    <div style="margin-bottom:24px;position:relative">
      <img src="/favicon.jpg" alt="" style="width:64px;height:64px;border-radius:16px;box-shadow:0 10px 25px rgba(0,0,0,0.15)" />
      <span style="position:absolute;top:-4px;right:-4px;width:16px;height:16px;border-radius:50%;background:#10b981;animation:ping 1s cubic-bezier(0,0,0.2,1)infinite"></span>
    </div>
    <p id="mm-prog-label" style="font-size:15px;font-weight:600;${dark ? 'color:#e2e8f0;' : 'color:#1e293b;'}margin-bottom:16px;text-align:center;padding:0 24px">${initialLabel}</p>
    <div style="width:min(320px,70vw);height:10px;border-radius:999px;${dark ? 'background:#1e293b;' : 'background:#e2e8f0;'}overflow:hidden">
      <div id="mm-prog-bar" style="height:100%;width:0%;border-radius:999px;background:#3b82f6;transition:width .25s ease"></div>
    </div>
    <p id="mm-prog-pct" style="font-size:13px;font-weight:500;${dark ? 'color:#64748b;' : 'color:#94a3b8;'}margin-top:12px;font-variant-numeric:tabular-nums">0% · 0 / 0</p>
    <style>@keyframes ping{75%,to{transform:scale(2);opacity:0}}</style>`;
  document.body.appendChild(el);
  const labelEl = el.querySelector('#mm-prog-label') as HTMLElement;
  const barEl = el.querySelector('#mm-prog-bar') as HTMLElement;
  const pctEl = el.querySelector('#mm-prog-pct') as HTMLElement;

  const clearPct = () => { pctEl.textContent = ''; };

  return {
    update(label, done, total) {
      const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
      labelEl.textContent = label;
      barEl.style.width = pct + '%';
      barEl.style.background = '#3b82f6';
      pctEl.textContent = `${pct}% · ${Math.min(done, total).toLocaleString()} / ${total.toLocaleString()}`;
    },
    finish(label, onDone) {
      barEl.style.width = '100%';
      barEl.style.background = '#10b981';
      labelEl.textContent = label;
      clearPct();
      if (onDone) setTimeout(onDone, 900);
    },
    error(label, onDone) {
      barEl.style.background = '#ef4444';
      labelEl.textContent = label;
      clearPct();
      if (onDone) setTimeout(onDone, 1800);
    },
    close() {
      try { el.remove(); } catch {}
    },
  };
}
