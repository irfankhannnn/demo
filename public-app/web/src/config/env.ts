/**
 * Runtime configuration — every value is baked in by Vite at build time from
 * .env.<mode>. Trailing slashes are stripped so path joins stay predictable.
 */

function trimSlash(value: string | undefined, fallback: string): string {
  const v = (value ?? '').trim() || fallback;
  return v.replace(/\/+$/, '');
}

export const env = {
  siteName: (import.meta.env.VITE_SITE_NAME ?? '').trim() || 'RealEstateFlow Homes',
  apiUrl: trimSlash(import.meta.env.VITE_MARKETPLACE_API_URL, 'http://localhost:3006'),
  authUrl: trimSlash(import.meta.env.VITE_MARKETPLACE_AUTH_URL, 'http://localhost:3007'),
  googleMapsEmbedKey: (import.meta.env.VITE_GOOGLE_MAPS_EMBED_KEY ?? '').trim(),
  hcaptchaSiteKey: (import.meta.env.VITE_HCAPTCHA_SITE_KEY ?? '').trim(),
} as const;

/** Public image URL for a listing photo (302 → presigned S3 URL, cached 300 s). */
export function listingImageUrl(slug: string, propertyId: string, index: number): string {
  return `${env.apiUrl}/i/${encodeURIComponent(slug)}/${encodeURIComponent(propertyId)}/${index}`;
}

/** Public document URL (brochure etc.). */
export function listingDocumentUrl(slug: string, propertyId: string, index: number): string {
  return `${env.apiUrl}/d/${encodeURIComponent(slug)}/${encodeURIComponent(propertyId)}/${index}`;
}

/** Share URL: server-rendered OG/JSON-LD page that meta-refreshes to the SPA. */
export function listingShareUrl(slug: string, propertyId: string): string {
  return `${env.apiUrl}/share/p/${encodeURIComponent(slug)}/${encodeURIComponent(propertyId)}`;
}

/** SPA route for a listing. */
export function listingPath(slug: string, propertyId: string): string {
  return `/p/${encodeURIComponent(slug)}/${encodeURIComponent(propertyId)}`;
}

/** Google OAuth redirect — must match what is registered on the auth service. */
export function googleRedirectUri(): string {
  return `${window.location.origin}/auth/callback`;
}
