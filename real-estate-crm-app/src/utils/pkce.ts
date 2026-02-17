/**
 * PKCE (Proof Key for Code Exchange) utilities for OAuth 2.0 Authorization Code flow.
 */

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

export function storeCodeVerifier(verifier: string): void {
  sessionStorage.setItem(PKCE_VERIFIER_KEY, verifier);
}

export function getStoredCodeVerifier(): string | null {
  return sessionStorage.getItem(PKCE_VERIFIER_KEY);
}

export function clearCodeVerifier(): void {
  sessionStorage.removeItem(PKCE_VERIFIER_KEY);
}
