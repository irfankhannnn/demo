/**
 * OAuth Scope Definitions
 *
 * This service uses Dynamic Client Registration (DCR, RFC 7591) exclusively.
 * AI clients (Claude, ChatGPT, etc.) self-register via POST /oauth/register
 * and receive a 'dcr_'-prefixed client_id. No static provider credentials
 * (client_id/client_secret) are needed.
 *
 * The scope list below defines the permissions that can be requested during
 * the authorization flow. DCR clients are granted all scopes by default;
 * finer-grained per-client scope restrictions can be added later if needed.
 */

/**
 * Must stay in step with `inferScope` in services/toolDefinitions.ts, which
 * derives a scope from each tool's category and readOnly flag. A scope that
 * `inferScope` can emit but this list does not contain is unreachable: no
 * client can ever be granted it, so every tool needing it returns
 * "Insufficient scope" forever.
 *
 * That is not hypothetical — `read_contacts`, `write_contacts` and
 * `read_metrics` were emitted but missing here, which silently made all nine
 * contact tools and all twelve metrics tools permanently uncallable over
 * OAuth. `services/toolDefinitions.scopes.test.ts` now fails the build if the
 * two ever diverge again.
 */
export const OAUTH_SCOPES: string[] = [
  'read_leads',
  'write_leads',
  'read_contacts',
  'write_contacts',
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
  // Read-only categories — the registry defines no write tool for either.
  'read_khata',
  'read_metrics',
  // Wildcard, and the fail-closed fallback for a tool whose category has no
  // scope noun yet. Grant only to clients that should reach everything.
  'crm',
];
