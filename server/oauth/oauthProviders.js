/**
 * Shared OAuth provider configuration.
 *
 * Centralizes provider metadata (name, redirect URI) and the default scope
 * list so the authorization and token endpoints stay in sync.
 *
 * NOTE: This service uses Dynamic Client Registration (DCR, RFC 7591) for
 * connecting to AI clients (Claude, ChatGPT). A new DCR client is registered
 * with the MCP server on every "Connect" click. The redirectUri here is the
 * CRM backend's OAuth callback URL — the URL where the MCP server sends the
 * authorization code after the user approves access.
 *
 * The OAUTH_CALLBACK_URL env var must be set to the CRM backend's public URL.
 * For local dev: http://localhost:4000/api/ai-integrations/callback
 * For production: https://services-api.cloudberrysolutions.in/devrealestatecrm/api/ai-integrations/callback
 */

export const OAUTH_SCOPES = [
  'read_leads',
  'write_leads',
  'read_properties',
  'write_properties',
  'read_owners',
  'write_owners',
  'read_tenants',
  'write_tenants',
  'read_buyers',
  'write_buyers',
  'read_meetings',
  'write_meetings',
];

/**
 * Returns the OAuth callback URL for this environment.
 * Reads from OAUTH_CALLBACK_URL env var at call time so the value
 * is always fresh (no stale module-level caching).
 */
export function getOAuthCallbackUrl() {
  return (
    process.env.OAUTH_CALLBACK_URL ||
    'http://localhost:4000/api/ai-integrations/callback'
  );
}

/**
 * Static provider metadata keyed by the logical provider id.
 * clientId / clientSecret are no longer used — DCR replaces static registration.
 * The name field is used for display purposes only.
 */
export const OAUTH_PROVIDERS = {
  anthropic: {
    name: 'Claude',
  },
  openai: {
    name: 'ChatGPT',
  },
};

export const OAUTH_PROVIDER_NAMES = Object.keys(OAUTH_PROVIDERS);

export function isValidOAuthClient(clientId) {
  return OAUTH_PROVIDER_NAMES.includes(clientId);
}
