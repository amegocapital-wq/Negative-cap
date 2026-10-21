/**
 * Thin wrappers so the same code works in a browser and inside the APK.
 * Capacitor plugins are imported lazily to keep the web bundle lean.
 */

import { Capacitor } from '@capacitor/core';

export const isNative = () => Capacitor.isNativePlatform();

export async function copyText(text: string): Promise<boolean> {
  try {
    if (isNative()) {
      const { Clipboard } = await import('@capacitor/clipboard');
      await Clipboard.write({ string: text });
      return true;
    }
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    // Fallback for non-secure contexts.
    const el = document.createElement('textarea');
    el.value = text;
    el.style.position = 'fixed';
    el.style.opacity = '0';
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(el);
    return ok;
  } catch {
    return false;
  }
}

export async function shareText(title: string, text: string): Promise<'shared' | 'copied' | 'failed'> {
  try {
    if (isNative()) {
      const { Share } = await import('@capacitor/share');
      await Share.share({ title, text, dialogTitle: title });
      return 'shared';
    }
    if (navigator.share) {
      await navigator.share({ title, text });
      return 'shared';
    }
  } catch (error) {
    // A user cancelling the share sheet is not an error worth surfacing.
    if ((error as Error)?.name === 'AbortError') return 'shared';
  }
  return (await copyText(text)) ? 'copied' : 'failed';
}

/** Trigger a file download (web) — used for the Markdown export. */
export function downloadFile(filename: string, content: string, mime = 'text/markdown') {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Read the clipboard (used by the "Paste" button). */
export async function readClipboard(): Promise<string> {
  try {
    if (isNative()) {
      const { Clipboard } = await import('@capacitor/clipboard');
      const { value } = await Clipboard.read();
      return value ?? '';
    }
    return (await navigator.clipboard.readText()) ?? '';
  } catch {
    return '';
  }
}
