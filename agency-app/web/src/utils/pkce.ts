/**
 * PKCE (Proof Key for Code Exchange) utilities for OAuth 2.0 Authorization Code flow.
 */

import { hasNativeRuntime } from '../lib/platform';
import { setSecret, getSecret, removeSecret, SECURE_KEY_PKCE_VERIFIER } from '../lib/secureStore';

function dec2hex(dec: number): string {
  return ('0' + dec.toString(16)).slice(-2);
}

function generateRandomString(length: number): string {
  const array = new Uint32Array(length / 2);
  crypto.getRandomValues(array);
  return Array.from(array, dec2hex).join('');
}

function sha256(plain: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  return crypto.subtle.digest('SHA-256', data);
}

function base64UrlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let str = '';
  bytes.forEach((b) => {
    str += String.fromCharCode(b);
  });
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function generateCodeChallenge(codeVerifier: string): Promise<string> {
  const hashed = await sha256(codeVerifier);
  return base64UrlEncode(hashed);
}

export function generateCodeVerifier(): string {
  return generateRandomString(128);
}

const PKCE_VERIFIER_KEY = 'pkce_code_verifier';

/*
 * Storage differs by platform.
 *
 * Web keeps sessionStorage: the tab that starts the flow is the tab that
 * receives the redirect, so the verifier is always there.
 *
 * Native uses the keystore instead. Sign-in happens in a separate browser
 * (Chrome Custom Tabs / SFSafariViewController) and the OS is free to evict the
 * backgrounded app while the user is typing their password. sessionStorage does
 * not survive that; the keystore does, so the user returns to a working callback
 * rather than "PKCE code verifier not found. Please try logging in again."
 */
export async function storeCodeVerifier(verifier: string): Promise<void> {
  if (hasNativeRuntime()) {
    await setSecret(SECURE_KEY_PKCE_VERIFIER, verifier);
    return;
  }
  sessionStorage.setItem(PKCE_VERIFIER_KEY, verifier);
}

export async function getStoredCodeVerifier(): Promise<string | null> {
  if (hasNativeRuntime()) {
    return getSecret(SECURE_KEY_PKCE_VERIFIER);
  }
  return sessionStorage.getItem(PKCE_VERIFIER_KEY);
}

export async function clearCodeVerifier(): Promise<void> {
  if (hasNativeRuntime()) {
    await removeSecret(SECURE_KEY_PKCE_VERIFIER);
    return;
  }
  sessionStorage.removeItem(PKCE_VERIFIER_KEY);
}
