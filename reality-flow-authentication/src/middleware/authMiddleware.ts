import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import { getConfig } from '../config/config';
import { logger } from '../utils/logger';

let _jwksClient: jwksClient.JwksClient | null = null;

function getJwksClient(): jwksClient.JwksClient {
  if (_jwksClient) return _jwksClient;
  
  const { COGNITO_USER_POOL_ID, AWS_REGION } = getConfig();
  
  _jwksClient = jwksClient({
    jwksUri: `https://cognito-idp.${AWS_REGION}.amazonaws.com/${COGNITO_USER_POOL_ID}/.well-known/jwks.json`,
    cache: true,
    cacheMaxAge: 600000,
    rateLimit: true,
  });
  
  return _jwksClient;
}

function getSigningKey(kid: string): Promise<string> {
  return new Promise((resolve, reject) => {
    getJwksClient().getSigningKey(kid, (err, key) => {
      if (err) return reject(err);
      if (!key) return reject(new Error('No signing key found'));
      const signingKey = key.getPublicKey();
      resolve(signingKey);
    });
  });
}

/**
 * Middleware for local development: verifies Cognito JWT token manually.
 * In production (behind API Gateway Cognito Authorizer), token is already verified
 * and claims are injected into the event context.
 *
 * This middleware is only used in local-server.ts.
 */
export async function localAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  // Let CORS preflight requests pass without auth
  if (req.method === 'OPTIONS') {
    next();
    return;
  }

  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authorization header with Bearer token is required' });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.decode(token, { complete: true });
    if (!decoded || !decoded.header.kid) {
      res.status(401).json({ error: 'Invalid token format' });
      return;
    }

    const { COGNITO_USER_POOL_ID, AWS_REGION, COGNITO_CLIENT_ID } = getConfig();
    const expectedIssuer = `https://cognito-idp.${AWS_REGION}.amazonaws.com/${COGNITO_USER_POOL_ID}`;
    
    const signingKey = await getSigningKey(decoded.header.kid);

    const verified = jwt.verify(token, signingKey, {
      issuer: expectedIssuer,
      audience: COGNITO_CLIENT_ID,
    }) as jwt.JwtPayload;

    // Set claims as header for downstream extraction by cognito.ts
    req.headers['x-cognito-claims'] = JSON.stringify({
      sub: verified.sub,
      email: verified.email,
      phone_number: verified.phone_number,
      name: verified.name,
      email_verified: verified.email_verified,
      phone_number_verified: verified.phone_number_verified,
      'cognito:username': verified['cognito:username'],
    });

    next();
  } catch (error) {
    logger.error('Token verification failed', { error });
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

