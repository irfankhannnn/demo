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
import { logger } from '../utils/logger';

const router = Router();

/**
 * Determine the canonical base URL for this authorization server.
 * In production behind API Gateway, the base URL is provided explicitly via
 * the OAUTH_BASE_URL environment variable (set in CloudFormation). This
 * prevents header spoofing from X-Forwarded-Host/Proto headers.
 */
function getBaseUrl(req: Request): string {
  const configuredBaseUrl = process.env.OAUTH_BASE_URL || process.env.MCP_BASE_URL;

  if (configuredBaseUrl && configuredBaseUrl.startsWith('https://')) {
    return configuredBaseUrl.replace(/\/$/, '');
  }

  // Fallback for local/dev: only accept localhost/127.0.0.1 from the Host header
  const forwardedHost = req.headers['x-forwarded-host'];
  const hostHeader = Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost;
  const host = hostHeader || req.get('host') || 'localhost';
  if (host !== 'localhost' && !host.startsWith('127.0.0.1') && !host.startsWith('localhost:')) {
    logger.warn('wellKnown.untrusted_host', { host });
    // Return a safe default; the real fix is to configure OAUTH_BASE_URL in production
    return 'https://localhost';
  }

  const forwardedProto = req.headers['x-forwarded-proto'];
  const protoHeader = Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto;
  const proto = protoHeader || req.protocol || 'https';
  return `${proto}://${host}`;
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
