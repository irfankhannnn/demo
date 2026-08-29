/**
 * Shared service account identifier used when the real user context is unknown
 * (e.g. background jobs, webhooks, automated imports).
 * Controlled via SERVICE_ACCOUNT_USER environment variable.
 */
export const SERVICE_ACCOUNT_USER = process.env.SERVICE_ACCOUNT_USER || 'system';
