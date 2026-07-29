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

export const OAUTH_SCOPES: string[] = [
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
