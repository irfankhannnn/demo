import crypto from 'crypto';

/**
 * Generate PKCE code verifier
 * Returns a base64url-encoded random string
 */
export function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString('base64url');
}

/**
 * Generate PKCE code challenge from verifier
 * Uses SHA-256 hash and base64url encoding
 */
export function generateCodeChallenge(verifier: string): string {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}
