import crypto from 'crypto';

/** PKCE code verifier: 43-char base64url string. */
export function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString('base64url');
}

/** S256 code challenge for a verifier. */
export function generateCodeChallenge(verifier: string): string {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

/** Opaque CSRF state for the OAuth round-trip. */
export function generateState(): string {
  return crypto.randomBytes(16).toString('base64url');
}
