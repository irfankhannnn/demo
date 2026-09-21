import { Response } from 'express';
import { AdminUpdateUserAttributesCommand } from '@aws-sdk/client-cognito-identity-provider';
import { getConfig } from '../config/config';
import { getCognito } from '../utils/aws';
import { decodeJwtPayload } from '../utils/jwt';
import { setRefreshTokenCookie } from '../utils/cookies';
import { logger } from '../utils/logger';
import {
  AuthProvider,
  PublicUser,
  UserItem,
  createUser,
  enrichUserProfile,
  findUserById,
  reactivateUser,
  toPublicUser,
  touchLastLogin,
} from '../models/usersModel';
import { ensureIdentity } from '../models/identitiesModel';

/** Tokens as Cognito returns them, whichever path issued them. */
export interface IssuedTokens {
  accessToken: string;
  idToken: string;
  refreshToken?: string;
  expiresIn: number;
}

export interface IdTokenClaims {
  sub: string;
  cognitoUsername: string;
  phone?: string;
  phoneVerified: boolean;
  email?: string;
  name?: string;
}

/** Pull what we need out of a freshly-issued ID token (trusted, see utils/jwt.ts). */
export function readIdTokenClaims(idToken: string): IdTokenClaims | null {
  const p = decodeJwtPayload(idToken);
  if (!p || typeof p.sub !== 'string' || !p.sub) return null;
  const username = typeof p['cognito:username'] === 'string' ? (p['cognito:username'] as string) : p.sub;
  return {
    sub: p.sub,
    cognitoUsername: username,
    phone: typeof p.phone_number === 'string' ? p.phone_number : undefined,
    phoneVerified: p.phone_number_verified === true || p.phone_number_verified === 'true',
    email: typeof p.email === 'string' ? p.email : undefined,
    name: typeof p.name === 'string' ? p.name : undefined,
  };
}

/**
 * Map a Cognito identity to a user row, creating it on first sign-in.
 * `isNew` is true exactly when this call created (or reactivated) the row —
 * that's the `user.isNew` marketplace-web uses to route to onboarding.
 */
export async function resolveUser(
  claims: IdTokenClaims,
  provider: AuthProvider
): Promise<{ user: UserItem; isNew: boolean }> {
  const existing = await findUserById(claims.sub);

  if (!existing) {
    let user: UserItem;
    try {
      user = await createUser({
        sub: claims.sub,
        cognitoUsername: claims.cognitoUsername,
        provider,
        phone: claims.phone,
        email: claims.email,
        name: claims.name,
      });
    } catch (err) {
      // Two first-sign-ins racing: the other one won, treat ours as returning.
      if ((err as { name?: string })?.name === 'ConditionalCheckFailedException') {
        const raced = await findUserById(claims.sub);
        if (raced) return { user: raced, isNew: false };
      }
      throw err;
    }
    await ensureIdentity({ sub: claims.sub, userId: user.UserId, provider, phone: claims.phone, email: claims.email });
    return { user, isNew: true };
  }

  if (existing.status === 'DELETED') {
    const revived = (await reactivateUser(existing.UserId)) ?? existing;
    await enrichUserProfile(revived.UserId, { email: claims.email, name: claims.name, phone: claims.phone }).catch((error) =>
      logger.warn('session.enrich_failed', { userId: revived.UserId, error })
    );
    const fresh = (await findUserById(revived.UserId)) ?? revived;
    return { user: fresh, isNew: true };
  }

  await touchLastLogin(existing.UserId).catch((error) =>
    logger.warn('session.touch_last_login_failed', { userId: existing.UserId, error })
  );
  await enrichUserProfile(existing.UserId, { email: claims.email, name: claims.name, phone: claims.phone }).catch((error) =>
    logger.warn('session.enrich_failed', { userId: existing.UserId, error })
  );
  const fresh = (await findUserById(existing.UserId)) ?? existing;
  return { user: fresh, isNew: false };
}

/** Best-effort: mark phone_number_verified once an OTP round-trip succeeded. */
export async function markPhoneVerified(cognitoUsername: string): Promise<void> {
  try {
    await getCognito().send(
      new AdminUpdateUserAttributesCommand({
        UserPoolId: getConfig().COGNITO_USER_POOL_ID,
        Username: cognitoUsername,
        UserAttributes: [{ Name: 'phone_number_verified', Value: 'true' }],
      })
    );
  } catch (error) {
    logger.warn('session.mark_phone_verified_failed', { cognitoUsername, error });
  }
}

export interface SessionResponse {
  accessToken: string;
  idToken: string;
  expiresIn: number;
  user: PublicUser & { isNew: boolean };
}

/** Set the refresh cookie and build the contract's confirm/token response body. */
export function buildSessionResponse(
  res: Response,
  tokens: IssuedTokens,
  user: UserItem,
  isNew: boolean
): SessionResponse {
  if (tokens.refreshToken) setRefreshTokenCookie(res, tokens.refreshToken);
  return {
    accessToken: tokens.accessToken,
    idToken: tokens.idToken,
    expiresIn: tokens.expiresIn,
    user: { ...toPublicUser(user), isNew },
  };
}
