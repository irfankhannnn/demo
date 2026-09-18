/**
 * Response headers every route gets.
 *
 * This is a JSON API plus one HTML page (the share page), so the policy is
 * simpler than the pages service's: no scripts, no frames, nothing loaded
 * from anywhere. The share page's only "script" is a JSON-LD block, which
 * browsers never execute, and its redirect is a meta refresh, which CSP does
 * not govern. If a future route ever needs to render real HTML with
 * behaviour, loosen this there, not here.
 */

export function securityHeaders(_req, res, next) {
  res.set({
    'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; img-src 'self' https: data:; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=(), interest-cohort=()',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    // Anything under /me or /internal is per-user; public routes that are
    // safe to cache set their own Cache-Control explicitly and override this.
    'Cache-Control': 'no-store',
  });
  next();
}
