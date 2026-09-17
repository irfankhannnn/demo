import { getIdToken } from './authStorage';
import { CRM_API_URL } from '../config/apiConfig';

const API_URL = CRM_API_URL;
export const CONNECTED_PHONE_KEY = 'connectedWhatsAppPhone';

const WHATSAPP_STATUS_TIMEOUT_MS = 10000; // 10s timeout for network issues
const WHATSAPP_POLL_INTERVAL_MS = 30000; // 30s dashboard poll
const WHATSAPP_QR_POLL_INTERVAL_MS = 3000; // 3s QR polling
const WHATSAPP_QR_POLL_TIMEOUT_MS = 120000; // 2min QR timeout

// Constant for BroadcastChannel name (avoids magic string).
export const WHATSAPP_SYNC_CHANNEL_NAME = 'whatsapp-connection';

export type WhatsappErrorType = 'network' | 'auth' | 'api' | 'disconnected' | 'unknown';

export interface WhatsappStatusResult {
  connected: boolean;
  state?: string | null;
  error?: string;
  errorType?: WhatsappErrorType;
  sessionId?: string | null;
}

export interface WhatsappConnectionState {
  phone: string | null;
  connected: boolean;
  state: string | null;
  error: string | null;
  errorType: WhatsappErrorType | null;
  checking: boolean;
}

/**
 * Normalize a phone number to digits only for consistent storage and comparison.
 * Strips all non-digit characters, including +, spaces, dashes, and country prefixes.
 * Preserves a leading + if explicitly requested by the caller.
 */
export function normalizeWhatsAppPhone(phone: string | null | undefined): string {
  if (!phone) return '';
  const raw = String(phone);
  // Remove all non-digit characters (but keep the structure for parsing)
  const digitsOnly = raw.replace(/\D/g, '');
  return digitsOnly;
}

/**
 * Format a normalized phone number for display.
 * Accepts both normalized (digits-only) and formatted input.
 * Handles 10, 11, 12, and 13 digit Indian numbers, plus international fallback.
 */
export function formatWhatsAppPhone(phone: string | null): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (!digits) return ''; // No digits found in input
  
  // Handle 12 digits with India country code (91XXXXXXXXXX)
  if (digits.length === 12 && digits.startsWith('91')) {
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  }
  // Handle 10 digits (assume India country code)
  if (digits.length === 10) {
    return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  }
  // Handle 11 digits starting with 0 (Indian landline format: 0XXXXXXXXX)
  if (digits.length === 11 && digits.startsWith('0')) {
    return `+91 ${digits.slice(1, 6)} ${digits.slice(6)}`;
  }
  // Handle 13 digits with India country code (91XXXXXXXXXXX)
  if (digits.length === 13 && digits.startsWith('91')) {
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  }
  // Fallback: return normalized digits for international numbers or unusual formats
  return digits;
}

/**
 * Validate a phone number for the WhatsApp Business connection form.
 * Matches the backend rule: 10-15 digits after normalization.
 * Note: normalizeWhatsAppPhone already strips all non-digits, so the
 * digits-only check is implicit — empty result means no digits were present.
 */
export function validateWhatsAppPhone(phone: string | null | undefined): { valid: boolean; normalized: string; error?: string } {
  const normalized = normalizeWhatsAppPhone(phone);
  if (!normalized) {
    return { valid: false, normalized: '', error: 'Phone number is required' };
  }
  if (normalized.length < 10 || normalized.length > 15) {
    return { valid: false, normalized, error: 'Phone number must be 10-15 digits' };
  }
  // normalized is guaranteed digits-only by normalizeWhatsAppPhone
  return { valid: true, normalized };
}

/**
 * Detect whether localStorage is unreliable (e.g., private/incognito mode
 * where storage may not persist, or storage is disabled).
 *
 * Uses a simple write/read/remove test instead of navigator.storage.estimate()
 * because the latter is not supported in Safari and produces false positives.
 * This approach works across all browsers and only returns true when storage
 * is genuinely unavailable or throws on access.
 */
export async function isStorageUnreliable(): Promise<boolean> {
  if (typeof window === 'undefined') return true;
  const testKey = '__whatsapp_storage_test__';
  try {
    localStorage.setItem(testKey, 'test');
    const value = localStorage.getItem(testKey);
    localStorage.removeItem(testKey);
    // If we couldn't read back what we wrote, storage is unreliable.
    return value !== 'test';
  } catch {
    // localStorage access threw — storage is unavailable (incognito in some
    // browsers, or storage disabled by the user).
    return true;
  }
}

export function safeLocalStorageGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch (err) {
    console.warn('localStorage.getItem failed', err);
    return null;
  }
}

export function safeLocalStorageSet(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (err) {
    console.warn('localStorage.setItem failed', err);
    return false;
  }
}

export function safeLocalStorageRemove(key: string): boolean {
  try {
    localStorage.removeItem(key);
    return true;
  } catch (err) {
    console.warn('localStorage.removeItem failed', err);
    return false;
  }
}

/**
 * Fetch with a timeout using AbortController.
 */
async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number = WHATSAPP_STATUS_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Fetch the WhatsApp connection status for a given phone number.
 * Returns a typed result that distinguishes network errors from disconnected state.
 */
export async function fetchConnectionStatus(phoneNumber: string): Promise<WhatsappStatusResult> {
  try {
    const idToken = getIdToken();
    const res = await fetchWithTimeout(
      `${API_URL}/auth/whatsapp/status/${encodeURIComponent(phoneNumber)}`,
      {
        headers: { Authorization: `Bearer ${idToken}` },
      }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const errorMessage = err.error || `status_check_failed`;
      
      // Check if backend detected a network error (ECONNREFUSED, ENOTFOUND, etc.)
      if (err.networkError) {
        return { connected: false, state: 'unknown', error: errorMessage, errorType: 'network', sessionId: null };
      }
      
      const errorType: WhatsappErrorType = res.status === 401 ? 'auth' : 'api';
      return { connected: false, state: 'unknown', error: errorMessage, errorType, sessionId: null };
    }

    const data = await res.json();
    const connected = !!data.connected;
    
    // Edge case 7: Detect session expiration from backend response.
    if (data.sessionExpired) {
      return {
        connected: false,
        state: data.state || 'unknown',
        error: 'WhatsApp session expired. Please scan a new QR code.',
        errorType: 'disconnected',
        sessionId: data.sessionId || null,
      };
    }
    
    return {
      connected,
      state: data.state || 'unknown',
      error: data.error || undefined,
      errorType: connected ? undefined : 'disconnected',
      sessionId: data.sessionId || null,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'unknown';
    const errorType: WhatsappErrorType = errorMessage.includes('abort') || errorMessage.includes('Abort') ? 'network' : 'unknown';
    return { connected: false, state: 'unknown', error: errorMessage, errorType, sessionId: null };
  }
}

/**
 * API-config-aware helpers for saving/clearing the connected phone.
 * These keep localStorage in sync with the server-side AI employee config.
 * On API failure, they roll back localStorage to avoid a desync.
 */
export async function saveConnectedPhone(
  phone: string,
  apiUpdate: (config: { connectedWhatsAppPhone?: string | null }) => Promise<unknown>
): Promise<{ success: boolean; localStorageOk: boolean }> {
  const normalized = normalizeWhatsAppPhone(phone);
  const previous = safeLocalStorageGet(CONNECTED_PHONE_KEY);
  const storageOk = safeLocalStorageSet(CONNECTED_PHONE_KEY, normalized);
  try {
    await apiUpdate({ connectedWhatsAppPhone: normalized });
    return { success: true, localStorageOk: storageOk };
  } catch (err) {
    console.error('Failed to save connected phone to config:', err);
    // Roll back localStorage to avoid desync
    if (previous) safeLocalStorageSet(CONNECTED_PHONE_KEY, previous);
    else safeLocalStorageRemove(CONNECTED_PHONE_KEY);
    return { success: false, localStorageOk: false };
  }
}

export async function clearConnectedPhone(
  apiUpdate: (config: { connectedWhatsAppPhone?: string | null }) => Promise<unknown>
): Promise<{ success: boolean; localStorageOk: boolean }> {
  const previous = safeLocalStorageGet(CONNECTED_PHONE_KEY);
  const storageOk = safeLocalStorageRemove(CONNECTED_PHONE_KEY);
  try {
    await apiUpdate({ connectedWhatsAppPhone: null });
    return { success: true, localStorageOk: storageOk };
  } catch (err) {
    console.error('Failed to clear connected phone from config:', err);
    // Restore localStorage to avoid losing the connection state
    if (previous) safeLocalStorageSet(CONNECTED_PHONE_KEY, previous);
    return { success: false, localStorageOk: false };
  }
}

/**
 * Resolve the connected phone number from the server-side AI employee config.
 * Falls back to localStorage only if the API call fails.
 * This makes the API config the single source of truth.
 */
export async function resolveConnectedPhone(
  apiGet: () => Promise<{ connectedWhatsAppPhone?: string | null }>
): Promise<string | null> {
  try {
    const config = await apiGet();
    if (config?.connectedWhatsAppPhone) {
      const normalized = normalizeWhatsAppPhone(config.connectedWhatsAppPhone);
      if (normalized) {
        safeLocalStorageSet(CONNECTED_PHONE_KEY, normalized);
        return normalized;
      }
    }
  } catch (err) {
    console.warn('Failed to fetch connected phone from config, falling back to localStorage:', err);
  }
  return safeLocalStorageGet(CONNECTED_PHONE_KEY);
}

/**
 * Cross-tab state synchronization using BroadcastChannel.
 * Falls back to a no-op if BroadcastChannel is unavailable.
 */
export class WhatsappConnectionSync {
  private channel: BroadcastChannel | null = null;
  private listeners: Array<(state: Partial<WhatsappConnectionState>) => void> = [];

  constructor(channelName: string = WHATSAPP_SYNC_CHANNEL_NAME) {
    if (typeof BroadcastChannel !== 'undefined') {
      this.channel = new BroadcastChannel(channelName);
      this.channel.onmessage = (event) => {
        const state = event.data as Partial<WhatsappConnectionState>;
        this.listeners.forEach((cb) => cb(state));
      };
    }
  }

  onChange(callback: (state: Partial<WhatsappConnectionState>) => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((cb) => cb !== callback);
    };
  }

  publish(state: Partial<WhatsappConnectionState>) {
    this.channel?.postMessage(state);
  }

  close() {
    this.channel?.close();
    this.channel = null;
    this.listeners = [];
  }
}

/**
 * Polling utility with proper cancellation and request deduplication.
 */
export class WhatsappPoller {
  private timer: ReturnType<typeof setInterval> | null = null;
  private inFlight: AbortController | null = null;
  private cancelled = false;

  async start(
    phone: string,
    intervalMs: number,
    callback: (result: WhatsappStatusResult) => void,
    timeoutMs: number = WHATSAPP_STATUS_TIMEOUT_MS
  ): Promise<void> {
    this.cancelled = false;

    const check = async () => {
      if (this.cancelled) return;
      // Cancel any previous in-flight request
      this.inFlight?.abort();
      this.inFlight = new AbortController();
      try {
        const res = await fetchConnectionStatus(phone);
        if (!this.cancelled) callback(res);
      } catch (err) {
        // fetchConnectionStatus already catches errors, this is a defensive guard.
        // Detect abort errors (from AbortController timeout) as network errors
        // so the error type is propagated correctly to the UI.
        if (!this.cancelled) {
          const errorMessage = err instanceof Error ? err.message : 'unknown';
          const isAbort = errorMessage.includes('abort') || errorMessage.includes('Abort');
          const errorType: WhatsappErrorType = isAbort ? 'network' : 'unknown';
          callback({
            connected: false,
            state: 'unknown',
            error: errorMessage,
            errorType,
          });
        }
      } finally {
        this.inFlight = null;
      }
    };

    await check();
    this.timer = setInterval(check, intervalMs);
  }

  stop() {
    this.cancelled = true;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.inFlight?.abort();
    this.inFlight = null;
  }
}

export {
  WHATSAPP_STATUS_TIMEOUT_MS,
  WHATSAPP_POLL_INTERVAL_MS,
  WHATSAPP_QR_POLL_INTERVAL_MS,
  WHATSAPP_QR_POLL_TIMEOUT_MS,
};
