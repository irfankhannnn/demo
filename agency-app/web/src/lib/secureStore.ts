/**
 * Secure device storage for auth secrets on the native builds.
 *
 * Backed by the iOS Keychain and the Android Keystore / EncryptedSharedPreferences.
 * Deliberately NOT @capacitor/preferences, which writes to UserDefaults on iOS and
 * plain SharedPreferences on Android — neither is encrypted, and UserDefaults is
 * included in device backups. A refresh token here grants 30 days of access to a
 * CRM holding Aadhaar numbers, PAN numbers and bank account details, so it belongs
 * in the platform keystore.
 *
 * On web every function is a no-op returning null. The web app keeps its httpOnly
 * refresh cookie and must never hold a refresh token in JS-reachable storage.
 */
import { SecureStorage } from '@aparajita/capacitor-secure-storage';
import { hasNativeRuntime } from './platform';

/** Refresh token, native only. The web equivalent is an httpOnly cookie. */
export const SECURE_KEY_REFRESH_TOKEN = 'auth_refresh_token';

/** PKCE verifier. Outlives the OAuth round trip even if the OS kills the app. */
export const SECURE_KEY_PKCE_VERIFIER = 'pkce_code_verifier';

export async function setSecret(key: string, value: string): Promise<void> {
  if (!hasNativeRuntime()) return;
  try {
    await SecureStorage.set(key, value);
  } catch (err) {
    console.error(`secureStore.set failed for ${key}:`, err);
    throw err;
  }
}

export async function getSecret(key: string): Promise<string | null> {
  if (!hasNativeRuntime()) return null;
  try {
    const value = await SecureStorage.get(key);
    return typeof value === 'string' ? value : null;
  } catch (err) {
    // A miss throws on some platforms rather than returning null.
    console.warn(`secureStore.get miss for ${key}:`, err);
    return null;
  }
}

export async function removeSecret(key: string): Promise<void> {
  if (!hasNativeRuntime()) return;
  try {
    await SecureStorage.remove(key);
  } catch (err) {
    // Removing something that was never stored is not an error worth surfacing.
    console.warn(`secureStore.remove failed for ${key}:`, err);
  }
}

/** Wipe every stored secret. Called on logout and on account deletion. */
export async function clearSecrets(): Promise<void> {
  await Promise.all([
    removeSecret(SECURE_KEY_REFRESH_TOKEN),
    removeSecret(SECURE_KEY_PKCE_VERIFIER),
  ]);
}
