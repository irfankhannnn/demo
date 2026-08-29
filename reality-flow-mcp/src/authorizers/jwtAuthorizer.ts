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

import { validateAccessToken } from '../services/tokenService';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-south-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const OAUTH_TABLE = process.env.OAUTH_CODES_TABLE_NAME || 'realtyflow-oauth-codes';

/**
 * Check whether a token has been revoked.
 */
async function isTokenRevoked(decoded: any): Promise<boolean> {
  const jti = decoded?.jti;
  if (!jti) {
    // Without a jti we cannot track revocation — fail-closed.
    return true;
  }
  try {
    const result = await docClient.send(
      new GetCommand({
        TableName: OAUTH_TABLE,
        Key: { code: `revoked:${jti}` },
      })
    );
    return !!result.Item;
  } catch (err: any) {
    console.error('jwtAuthorizer.revocation_check.error', { error: err.message });
    // Fail-closed: if we can't check, treat as revoked
    return true;
  }
}

/**
 * Extract Bearer token from Authorization header
 */
function extractBearerToken(authorizationToken: string | undefined): string | null {
  if (!authorizationToken) return null;
  const parts = authorizationToken.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    return null;
  }
  return parts[1];
}

/**
 * Lambda handler for API Gateway JWT authorizer
 */
export async function handler(event: any): Promise<any> {
  console.log('jwtAuthorizer.invoked', {
    authorizationToken: event.authorizationToken?.substring(0, 20),
  });

  try {
    const token = extractBearerToken(event.authorizationToken);
    if (!token) {
      console.warn('jwtAuthorizer.no_token');
      throw new Error('Unauthorized');
    }

    const { valid, decoded, error } = validateAccessToken(token);
    if (!valid) {
      console.warn('jwtAuthorizer.invalid_token', { error });
      throw new Error('Unauthorized');
    }

    if (await isTokenRevoked(decoded)) {
      console.warn('jwtAuthorizer.revoked_token', { token: token.substring(0, 20) });
      throw new Error('Unauthorized');
    }

    const { sub: userId, tenantId, clientId, scopes } = decoded as any;

    if (!tenantId) {
      console.warn('jwtAuthorizer.no_tenant_id');
      throw new Error('Unauthorized');
    }

    console.log('jwtAuthorizer.authorized', { userId, tenantId, clientId });

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
  } catch (err: any) {
    console.error('jwtAuthorizer.error', { error: err.message });
    throw new Error('Unauthorized');
  }
}
