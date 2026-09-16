/**
 * Audio upload constraints for the call-recording flow.
 *
 * Extracted so the Call Recordings page and the assistant's "+" menu enforce
 * the *same* list. These mirror `ALLOWED_AUDIO_MIME_TYPES` and the upload size
 * cap on the server, and two copies of a security-relevant allowlist drift —
 * one of them ends up permissive.
 *
 * The client checks are a courtesy, not a control: the server re-validates the
 * content type and size before it issues a presigned URL. What these buy is a
 * clear error before a 200 MB upload starts.
 */

/** Mirrors ALLOWED_AUDIO_MIME_TYPES on the server. */
export const ALLOWED_AUDIO_CONTENT_TYPES = [
  'audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/m4a', 'audio/x-m4a', 'audio/aac',
  'audio/wav', 'audio/x-wav', 'audio/wave', 'audio/webm', 'audio/ogg', 'audio/opus',
  'audio/flac', 'audio/amr', 'video/mp4',
];

/** `accept` attribute for the file picker. */
export const ACCEPTED_AUDIO_EXTENSIONS = '.mp3,.m4a,.wav,.aac,.ogg,.opus,.amr,.webm,.flac,.mp4';

/** Mirrors CALL_INTEL_MAX_UPLOAD_BYTES (209715200) on the server. */
export const MAX_AUDIO_UPLOAD_MB = 200;

const CONTENT_TYPE_BY_EXTENSION: Record<string, string> = {
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  mp4: 'audio/mp4',
  wav: 'audio/wav',
  aac: 'audio/aac',
  ogg: 'audio/ogg',
  opus: 'audio/opus',
  amr: 'audio/amr',
  webm: 'audio/webm',
  flac: 'audio/flac',
};

/**
 * Decide the content type to declare for a picked file.
 *
 * Browsers report no MIME type for some recorder formats (.amr, .opus) and an
 * unsupported one for others (.amr as audio/3gpp), so the extension decides
 * whenever the reported type is not one the API accepts.
 */
export function resolveAudioContentType(file: File): string {
  const reported = (file.type || '').toLowerCase();
  if (ALLOWED_AUDIO_CONTENT_TYPES.includes(reported)) return reported;
  const extension = file.name.toLowerCase().split('.').pop() || '';
  return CONTENT_TYPE_BY_EXTENSION[extension] || 'audio/mpeg';
}

/** `null` when the file is acceptable, otherwise the reason to show the user. */
export function rejectAudioFile(file: File): string | null {
  if (file.size === 0) return 'That file is empty.';
  if (file.size > MAX_AUDIO_UPLOAD_MB * 1024 * 1024) {
    return `File is larger than ${MAX_AUDIO_UPLOAD_MB} MB.`;
  }
  return null;
}
