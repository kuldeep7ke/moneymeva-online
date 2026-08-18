import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

export async function downloadFile(content: string, filename: string, mimeType: string) {
  await downloadBlob(new Blob([content], { type: mimeType }), filename);
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function downloadBlob(blob: Blob, filename: string) {
  if (Capacitor.isNativePlatform()) {
    try {
      const base64 = await blobToBase64(blob);
      const path = `exports/${Date.now()}_${filename}`;
      await Filesystem.writeFile({ path, data: base64, directory: Directory.Cache, recursive: true });
      const { uri } = await Filesystem.getUri({ path, directory: Directory.Cache });
      await Share.share({ url: uri, title: filename, dialogTitle: filename });
      setTimeout(() => {
        Filesystem.deleteFile({ path, directory: Directory.Cache }).catch(() => {});
      }, 60000);
      return;
    } catch {
      // Share sheet unavailable or dismissed — fall through to web path
    }
  }

  try {
    const file = new File([blob], filename, { type: blob.type });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file] });
      return;
    }
  } catch {}

  try {
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
  } catch {}
}

export async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    try { await navigator.clipboard.writeText(text); } catch { fallbackCopy(text); }
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
  const win = window.open('', '_blank');
  if (win) {
    win.document.write(htmlContent);
    win.document.close();
    setTimeout(() => { try { win.print(); } catch {} }, 500);
  }
}