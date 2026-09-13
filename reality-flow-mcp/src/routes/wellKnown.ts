/**
 * OAuth 2.0 Authorization Server Metadata (RFC 8414)
 *
 * GET /.well-known/oauth-authorization-server
 *
 * Claude and other MCP clients fetch this first to discover all OAuth
 * endpoints, supported grant types, and whether DCR is available.
 * This is the entry point for Dynamic Client Registration.
 */

import { Router, Request, Response } from 'express';
import { OAUTH_SCOPES } from '../services/oauthProviders';
import { getMcpPublicBaseUrl } from '../config/config';

const router = Router();

/**
 * Canonical base URL for this authorization server / protected resource:
 * https://<MCP_API_DOMAIN_NAME>/<MCP_API_BASE_PATH>, composed in the config
 * module. Never derived from Host / X-Forwarded-* headers (spoofable) and
 * never a raw execute-api URL.
 */
function getBaseUrl(_req: Request): string {
  return getMcpPublicBaseUrl();
}

router.get('/oauth-authorization-server', (req: Request, res: Response) => {
  const baseUrl = getBaseUrl(req);

  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.json({
    issuer: baseUrl,
    authorization_endpoint: `${baseUrl}/oauth/authorize`,
    token_endpoint: `${baseUrl}/oauth/token`,
    registration_endpoint: `${baseUrl}/oauth/register`,
    revocation_endpoint: `${baseUrl}/oauth/revoke`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
    scopes_supported: OAUTH_SCOPES,
    service_documentation: 'https://docs.realtyflow.com/mcp',
  });
});

/**
 * OAuth 2.0 Protected Resource Metadata (RFC 9728)
 *
 * GET /.well-known/oauth-protected-resource
 *
 * Required by the 2025-06-18 MCP authorization spec. Tells MCP clients
 * which authorization server(s) issue tokens for this resource (MCP server).
 */
router.get('/oauth-protected-resource', (req: Request, res: Response) => {
  const baseUrl = getBaseUrl(req);

  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.json({
    resource: baseUrl,
    authorization_servers: [baseUrl],
    scopes_supported: OAUTH_SCOPES,
    bearer_methods_supported: ['header'],
    resource_name: 'RealtyFlow MCP Server',
    resource_documentation: 'https://docs.realtyflow.com/mcp',
  });
});

export default router;
