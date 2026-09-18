/**
 * Consumer authentication: a Cognito JWT from marketplace-authentication.
 *
 * Ported from services/reality-flow-authentication/src/middleware/
 * authMiddleware.ts (jwks-rsa + jsonwebtoken), minus the API Gateway
 * authorizer path — this API verifies the token itself on every request,
 * because half its routes are public and an authorizer on `{proxy+}` would
 * lock those out.
 *
 * What is checked: signature against the pool's JWKS (cached ten minutes,
 * rate-limited so a flood of bad `kid`s cannot hammer Cognito), issuer,
 * expiry, `token_use`, and — when COGNITO_CLIENT_ID is set — that the token
 * was minted for our app client. Both access and id tokens are accepted: the
 * contract sends the access token, which carries `sub` but not the profile
 * claims; an id token carries those too. Either way the phone/email/name on
 * `req.user` are hints for lazily creating the profile, never authority.
 *
 * `authOptional` decorates `req.user` when a valid token is present and
 * does nothing otherwise — it never rejects. `authRequired` rejects. A
 * present-but-invalid token is a 401 on both: a client that sends a token
 * expects it to count, and silently treating it as anonymous would make an
 * expired-session bug look like "my saved flag disappeared".
 */

import jwt from 'jsonwebtoken';
import { JwksClient } from 'jwks-rsa';
import { config } from '../config/env.js';
import { logger } from '../logger.js';

let jwks = null;

function issuer() {
  return `https://cognito-idp.${config.cognito.region}.amazonaws.com/${config.cognito.userPoolId}`;
}

function getJwks() {
  if (!jwks) {
    jwks = new JwksClient({
      jwksUri: `${issuer()}/.well-known/jwks.json`,
      cache: true,
      cacheMaxAge: config.cognito.jwksCacheMs,
      rateLimit: true,
      jwksRequestsPerMinute: 10,
    });
  }
  return jwks;
}

/** Test seam: replace the key resolver (kid → PEM). */
let resolveKey = async (kid) => (await getJwks().getSigningKey(kid)).getPublicKey();
export function setKeyResolver(fn) {
  resolveKey = fn || (async (kid) => (await getJwks().getSigningKey(kid)).getPublicKey());
}

/** The shape every route sees. Nothing else from the token is exposed. */
function userFromClaims(claims) {
  return {
    userId: claims.sub,
    sub: claims.sub,
    phone: typeof claims.phone_number === 'string' ? claims.phone_number : null,
    email: typeof claims.email === 'string' ? claims.email : null,
    name: typeof claims.name === 'string' ? claims.name : null,
  };
}

/**
 * @returns {{ user: object } | { error: string }}
 */
export async function verifyBearer(token) {
  const decoded = jwt.decode(token, { complete: true });
  if (!decoded?.header?.kid || !decoded.payload) return { error: 'malformed' };

  let key;
  try {
    key = await resolveKey(decoded.header.kid);
  } catch (err) {
    logger.warn('auth.jwks_failed', { error: err.message });
    return { error: 'unknown_key' };
  }

  let claims;
  try {
    claims = jwt.verify(token, key, { issuer: issuer(), algorithms: ['RS256'] });
  } catch (err) {
    return { error: err.name === 'TokenExpiredError' ? 'expired' : 'invalid' };
  }

  if (claims.token_use !== 'access' && claims.token_use !== 'id') return { error: 'wrong_token_use' };
  if (config.cognito.clientId) {
    const forUs = claims.token_use === 'access'
      ? claims.client_id === config.cognito.clientId
      : claims.aud === config.cognito.clientId;
    if (!forUs) return { error: 'wrong_client' };
  }
  if (typeof claims.sub !== 'string' || !claims.sub) return { error: 'no_subject' };

  return { user: userFromClaims(claims) };
}

function bearerFrom(req) {
  const header = req.headers.authorization;
  if (typeof header !== 'string') return null;
  const [scheme, token] = header.split(' ');
  if (!/^bearer$/i.test(scheme || '') || !token) return null;
  return token.trim();
}

async function attach(req, res, { required }) {
  const token = bearerFrom(req);
  if (!token) {
    if (required) {
      res.status(401).json({ error: 'Authentication required' });
      return false;
    }
    req.user = null;
    return true;
  }

  const result = await verifyBearer(token);
  if (result.error) {
    logger.info('auth.rejected', { reason: result.error, path: req.path });
    res.status(401).json({ error: 'Invalid or expired token', details: result.error });
    return false;
  }
  req.user = result.user;
  return true;
}

export function authOptional(req, res, next) {
  attach(req, res, { required: false }).then((ok) => ok && next()).catch(next);
}

export function authRequired(req, res, next) {
  attach(req, res, { required: true }).then((ok) => ok && next()).catch(next);
}
