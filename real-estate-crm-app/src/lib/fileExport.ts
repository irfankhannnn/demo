/**
 * Saving generated files (CSV, XLSX) on both web and native.
 *
 * The web pattern — create a Blob, make an object URL, click a hidden anchor
 * with a `download` attribute — does nothing at all in an Android WebView. The
 * WebView has no DownloadListener wired up and ignores the download attribute,
 * so the click is silently swallowed: no file, no error, no feedback. Every
 * export in the app failed this way.
 *
 * Native instead writes to the app's Documents directory and opens the system
 * share sheet, which is both the working path and the expected mobile gesture.
 */
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { hasNativeRuntime } from './platform';

export interface ExportFileOptions {
  /** Filename including extension, e.g. "leads-2026-08-15.csv". */
  filename: string;
  /** File contents. */
  data: string;
  /** MIME type, used for the Blob on web and the share sheet on native. */
  mimeType: string;
  /** Title shown on the native share sheet. */
  shareTitle?: string;
}

/**
 * Save a generated text file, or share it on native.
 *
 * Resolves once the file is saved (web) or the share sheet has been dismissed
 * (native). Throws if the write fails, so callers can surface a real error
 * rather than leaving the user wondering whether anything happened.
 */
export async function exportTextFile({
  filename,
  data,
  mimeType,
  shareTitle,
}: ExportFileOptions): Promise<void> {
  if (!hasNativeRuntime()) {
    const blob = new Blob([data], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
    return;
  }

  // Cache rather than Documents: these are regenerated on demand, so they
  // should not count against the user's storage forever or sync to iCloud.
  const written = await Filesystem.writeFile({
    path: filename,
    data,
    directory: Directory.Cache,
    encoding: Encoding.UTF8,
    recursive: true,
  });

  await Share.share({
    title: shareTitle ?? filename,
    url: written.uri,
    dialogTitle: shareTitle ?? 'Export',
  });
}

/**
 * Save a binary file produced as a Blob (for example an XLSX from SheetJS).
 *
 * Native needs base64 rather than a Blob, and Filesystem rejects a data: URI
 * prefix, so the reader output is trimmed to the payload.
 */
export async function exportBlobFile({
  filename,
  blob,
  shareTitle,
}: {
  filename: string;
  blob: Blob;
  shareTitle?: string;
}): Promise<void> {
  if (!hasNativeRuntime()) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
    return;
  }

  const base64 = await blobToBase64(blob);

  const written = await Filesystem.writeFile({
    path: filename,
    data: base64,
    directory: Directory.Cache,
    recursive: true,
  });

  await Share.share({
    title: shareTitle ?? filename,
    url: written.uri,
    dialogTitle: shareTitle ?? 'Export',
  });
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
    reader.onload = () => {
      const result = String(reader.result ?? '');
      // Strip the "data:<mime>;base64," prefix; Filesystem wants raw base64.
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.readAsDataURL(blob);
  });
}
