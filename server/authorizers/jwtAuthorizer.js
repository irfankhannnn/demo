/**
 * API Gateway JWT Authorizer — Validates OAuth tokens for MCP Lambda
 * 
 * This Lambda function is invoked by API Gateway before routing requests to the MCP Lambda.
 * It validates the JWT token and extracts the tenantId claim, which is passed to the MCP Lambda
 * via the x-tenant-id header.
 * 
 * Input: API Gateway authorization event with Bearer token
 * Output: Authorization policy + context with tenantId
 */

import { validateAccessToken, extractClaims } from '../oauth/tokenValidator.js';

/**
 * Lambda handler for API Gateway JWT authorizer
 * @param {Object} event - API Gateway authorizer event
 * @returns {Object} Authorization policy
 */
export async function handler(event) {
  console.log('jwtAuthorizer.invoked', { authorizationToken: event.authorizationToken?.substring(0, 20) });

  try {
    // Extract token from Authorization header
    const token = extractBearerToken(event.authorizationToken);
    if (!token) {
      console.warn('jwtAuthorizer.no_token');
      throw new Error('Unauthorized');
    }

    // Validate token
    const { valid, decoded, error } = validateAccessToken(token);
    if (!valid) {
      console.warn('jwtAuthorizer.invalid_token', { error });
      throw new Error('Unauthorized');
    }

    // Extract claims
    const { sub: userId, tenantId, clientId, scopes } = decoded;

    if (!tenantId) {
      console.warn('jwtAuthorizer.no_tenant_id');
      throw new Error('Unauthorized');
    }

    console.log('jwtAuthorizer.authorized', { userId, tenantId, clientId });

    // Return authorization policy
    return {
      principalId: userId,
      policyDocument: {
        Version: '2012-10-17',
        Statement: [
          {
            Action: 'execute-api:Invoke',
            Effect: 'Allow',
            Resource: event.methodArn,
          },
        ],
      },
      context: {
        tenantId,
        userId,
        clientId,
        scopes: (scopes || []).join(','),
      },
    };
  } catch (err) {
    console.error('jwtAuthorizer.error', { error: err.message });
    throw new Error('Unauthorized');
  }
}

/**
 * Extract Bearer token from Authorization header
 * @param {string} authorizationToken - Authorization header value
 * @returns {string|null} Token or null
 */
function extractBearerToken(authorizationToken) {
  if (!authorizationToken) return null;

  const parts = authorizationToken.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    return null;
  }

  return parts[1];
}
