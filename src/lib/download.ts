export async function downloadFile(content: string, filename: string, mimeType: string) {
  await downloadBlob(new Blob([content], { type: mimeType }), filename);
}

export async function downloadBlob(blob: Blob, filename: string) {
  try {
    const file = new File([blob], filename, { type: blob.type });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file] });
      return;
    }
  } catch {}

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.target = '_blank';
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 60000);
}

export function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
  } else {
    fallbackCopy(text);
  }
}

function fallbackCopy(text: string) {
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  } catch {}
}

export function printHtml(title: string, htmlContent: string) {
  const fullHtml = `<html><head><title>${title}</title></head><body>${htmlContent}</body></html>`;
  const win = window.open('', '_blank');
  if (win) {
    win.document.write(fullHtml);
    win.document.close();
    setTimeout(() => { try { win.print(); } catch {} }, 500);
  } else {
    const encoded = encodeURIComponent(fullHtml);
    window.open('data:text/html;charset=utf-8,' + encoded, '_blank');
  }
}
