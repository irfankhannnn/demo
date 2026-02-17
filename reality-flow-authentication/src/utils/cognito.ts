import { Request } from 'express';

export interface CognitoClaims {
  sub: string;
  email?: string;
  phone_number?: string;
  name?: string;
  email_verified?: boolean;
  phone_number_verified?: boolean;
  'cognito:username'?: string;
  'custom:tenantId'?: string;
}

/**
 * Extract Cognito claims from the API Gateway event context.
 * When API Gateway Cognito Authorizer is used, claims are injected into
 * event.requestContext.authorizer.claims by API Gateway before reaching Lambda.
 *
 * For local dev, claims are extracted from the x-cognito-claims header (JSON).
 */
export function extractClaims(req: Request): CognitoClaims {
  // Production: API Gateway injects claims via @vendia/serverless-express
  const apiGwContext = (req as any).apiGateway?.event?.requestContext?.authorizer?.claims;
  if (apiGwContext) {
    return apiGwContext as CognitoClaims;
  }

  // Local dev: read from header (set by local auth middleware)
  const claimsHeader = req.headers['x-cognito-claims'];
  if (claimsHeader && typeof claimsHeader === 'string') {
    try {
      return JSON.parse(claimsHeader) as CognitoClaims;
    } catch {
      throw new Error('Invalid x-cognito-claims header');
    }
  }

  throw new Error('No Cognito claims found in request');
}

/**
 * Get the Cognito sub (user ID) from the request.
 */
export function getCognitoSub(req: Request): string {
  const claims = extractClaims(req);
  if (!claims.sub) {
    throw new Error('Cognito sub not found in claims');
  }
  return claims.sub;
}

/**
 * Get email from Cognito claims.
 */
export function getCognitoEmail(req: Request): string | undefined {
  const claims = extractClaims(req);
  return claims.email;
}
