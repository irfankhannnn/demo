/**
 * Central runtime configuration, derived from build-time VITE_* variables.
 * The only place in the app that reads import.meta.env.
 */

import { buildServiceBaseUrl } from './lib/serviceUrl';

const stripTrailingSlash = (value: string) => value.replace(/\/+$/, '');

function resolveInstaApiBaseUrl(): { url: string; error: string | null } {
  try {
    return {
      url: buildServiceBaseUrl(
        import.meta.env.VITE_INSTA_API_DOMAIN_NAME,
        import.meta.env.VITE_INSTA_API_BASE_PATH,
        'VITE_INSTA_API_DOMAIN_NAME',
      ),
      error: null,
    };
  } catch (err) {
    // Not thrown at import time: a misconfigured build should still render the
    // shell and show a readable error on the first request, not a blank page.
    return { url: '', error: (err as Error).message };
  }
}

const insta = resolveInstaApiBaseUrl();

/** https://<VITE_INSTA_API_DOMAIN_NAME>/<VITE_INSTA_API_BASE_PATH>, or '' when misconfigured. */
export const INSTA_API_BASE_URL = insta.url;

/** Why INSTA_API_BASE_URL is empty, or null when it is configured. */
export const INSTA_API_CONFIG_ERROR = insta.error;

/** Origin of the CRM app, for the shell's "Back to CRM" link. A web app link, not an API. */
export const CRM_URL = stripTrailingSlash((import.meta.env.VITE_CRM_URL ?? '').trim());
