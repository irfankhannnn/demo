import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import { getConfig } from '../config/config';
import { unauthorized } from '../utils/http';
import { logger } from '../utils/logger';

/**
 * Bearer-token verification against the consumer pool's JWKS.
 *
 * Unlike the agency auth service, API Gateway here is a plain {proxy+}
 * with no Cognito authorizer — this middleware is the only gate, in Lambda
 * and locally alike. Both token types are accepted: marketplace-web sends
 * the access token (contract §2: `token_use: 'access'`), but an ID token
 * from the same client is equally valid for the routes this service
 * exposes.
 */
export interface AuthContext {
  sub: string;
  tokenUse: 'access' | 'id';
  username?: string;
  phone?: string;
  email?: string;
  name?: string;
}

let _jwks: jwksClient.JwksClient | null = null;

function issuer(): string {
  const { COGNITO_USER_POOL_ID, AWS_REGION } = getConfig();
  return `https://cognito-idp.${AWS_REGION}.amazonaws.com/${COGNITO_USER_POOL_ID}`;
}

function getJwks(): jwksClient.JwksClient {
  if (_jwks) return _jwks;
  _jwks = jwksClient({
    jwksUri: `${issuer()}/.well-known/jwks.json`,
    cache: true,
    cacheMaxAge: 10 * 60 * 1000,
    rateLimit: true,
    jwksRequestsPerMinute: 10,
  });
  return _jwks;
}

function getSigningKey(kid: string): Promise<string> {
  return new Promise((resolve, reject) => {
    getJwks().getSigningKey(kid, (err, key) => {
      if (err) return reject(err);
      if (!key) return reject(new Error('No signing key found'));
      resolve(key.getPublicKey());
    });
  });
}

export type TokenVerifier = (token: string) => Promise<AuthContext>;

/** Real verifier: RS256 signature via JWKS, issuer, client binding, token_use. */
export const verifyCognitoToken: TokenVerifier = async (token) => {
  const decoded = jwt.decode(token, { complete: true });
  if (!decoded || typeof decoded === 'string' || !decoded.header.kid) {
    throw new Error('Malformed token');
  }

  const { COGNITO_CLIENT_ID } = getConfig();
  const key = await getSigningKey(decoded.header.kid);
  const payload = jwt.verify(token, key, { issuer: issuer(), algorithms: ['RS256'] }) as jwt.JwtPayload;

  const tokenUse = payload.token_use;
  if (tokenUse === 'access') {
    if (payload.client_id !== COGNITO_CLIENT_ID) throw new Error('Token issued to another client');
  } else if (tokenUse === 'id') {
    if (payload.aud !== COGNITO_CLIENT_ID) throw new Error('Token issued to another client');
  } else {
    throw new Error('Unsupported token_use');
  }
  if (!payload.sub) throw new Error('Token has no sub');

  return {
    sub: payload.sub,
    tokenUse,
    username: (payload['cognito:username'] as string | undefined) ?? (payload.username as string | undefined),
    phone: payload.phone_number as string | undefined,
    email: payload.email as string | undefined,
    name: payload.name as string | undefined,
  };
};

let verifier: TokenVerifier = verifyCognitoToken;

/** Test-only: replace the verifier (pass null to restore the JWKS one). */
export function __setTokenVerifierForTests(v: TokenVerifier | null): void {
  verifier = v ?? verifyCognitoToken;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (req.method === 'OPTIONS') {
    next();
    return;
  }

  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    unauthorized(res, 'Authorization: Bearer <token> header is required');
    return;
  }
  const token = header.slice('Bearer '.length).trim();
  if (!token) {
    unauthorized(res, 'Authorization: Bearer <token> header is required');
    return;
  }

  try {
    req.auth = await verifier(token);
    next();
  } catch (error) {
    logger.warn('auth.token_rejected', { error: error instanceof Error ? error.message : String(error) });
    unauthorized(res, 'Invalid or expired token');
  }
}
