/**
 * Native camera capture.
 *
 * The app has 21 file inputs and not one carries a `capture` attribute, so
 * every photo has to come through the OS file picker — a broker standing in
 * front of a property has to leave the app, open the camera, then come back and
 * find the shot. The native path opens the camera directly.
 *
 * Everything returns a File so the existing upload handlers, which all take
 * File[], work unchanged.
 */
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { hasNativeRuntime } from './platform';

export type PhotoSource = 'camera' | 'gallery';

/** True when the native camera path is usable. */
export function canUseNativeCamera(): boolean {
  return hasNativeRuntime();
}

/**
 * Capture or pick a single photo and return it as a File.
 *
 * Returns null when the user cancels, which the plugin reports by rejecting —
 * a cancellation is not an error worth surfacing to the caller.
 */
export async function capturePhoto(source: PhotoSource = 'camera'): Promise<File | null> {
  if (!hasNativeRuntime()) return null;

  try {
    const photo = await Camera.getPhoto({
      quality: 80,
      allowEditing: false,
      // A data URI keeps this self-contained: no filesystem read, no
      // permission to read back a saved file, and it converts to a File
      // directly. Quality 80 keeps a phone photo to a sensible upload size.
      resultType: CameraResultType.DataUrl,
      source: source === 'camera' ? CameraSource.Camera : CameraSource.Photos,
      saveToGallery: false,
      correctOrientation: true,
    });

    if (!photo.dataUrl) return null;

    const extension = photo.format || 'jpeg';
    return dataUrlToFile(photo.dataUrl, `photo-${Date.now()}.${extension}`);
  } catch (err) {
    // The plugin rejects on user cancellation as well as on real failures.
    // Treat a cancel as "no photo" and only log anything unexpected.
    const message = err instanceof Error ? err.message : String(err);
    if (!/cancel/i.test(message)) {
      console.warn('Camera capture failed:', err);
    }
    return null;
  }
}

/** Pick several photos at once from the gallery. */
export async function pickPhotos(limit = 10): Promise<File[]> {
  if (!hasNativeRuntime()) return [];

  try {
    const result = await Camera.pickImages({ quality: 80, limit });
    const files = await Promise.all(
      result.photos.map(async (photo, index) => {
        const response = await fetch(photo.webPath);
        const blob = await response.blob();
        return new File([blob], `photo-${Date.now()}-${index}.${photo.format || 'jpeg'}`, {
          type: blob.type || 'image/jpeg',
        });
      })
    );
    return files;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!/cancel/i.test(message)) {
      console.warn('Photo picking failed:', err);
    }
    return [];
  }
}

function dataUrlToFile(dataUrl: string, filename: string): File {
  const [header, base64] = dataUrl.split(',');
  const mimeMatch = header.match(/data:([^;]+)/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return new File([bytes], filename, { type: mime });
}
