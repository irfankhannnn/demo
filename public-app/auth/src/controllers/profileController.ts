/**
 * Signed-in consumer's own account.
 *
 *   GET    /auth/me       → { user: { userId, phone, email, name, createdAt } }
 *   PATCH  /auth/profile  { name?, email? } → { user }
 *   DELETE /auth/me       → { ok }  (marketplace-api purge → Cognito disable → row soft-deleted)
 */
import { Request, Response } from 'express';
import { z } from 'zod';
import {
  AdminDisableUserCommand,
  AdminUpdateUserAttributesCommand,
  AdminUserGlobalSignOutCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { getConfig } from '../config/config';
import { getCognito } from '../utils/aws';
import { ok, badRequest, notFound, internalError, unauthorized } from '../utils/http';
import { clearRefreshTokenCookie } from '../utils/cookies';
import { logger } from '../utils/logger';
import { deleteMarketplaceUser } from '../utils/marketplaceApi';
import { UserItem, findUserBySub, markUserDeleted, toPublicUser, updateUserProfile } from '../models/usersModel';

const patchProfileSchema = z
  .object({
    name: z.string().trim().max(80, 'name must be 80 characters or fewer').optional(),
    email: z
      .union([z.literal(''), z.string().trim().toLowerCase().email('email must be a valid address').max(254)])
      .optional(),
  })
  .strict()
  .refine((v) => v.name !== undefined || v.email !== undefined, { message: 'Provide name and/or email' });

/** Resolve the caller's row or respond 401/404. */
async function currentUser(req: Request, res: Response): Promise<UserItem | null> {
  const sub = req.auth?.sub;
  if (!sub) {
    unauthorized(res);
    return null;
  }
  const user = await findUserBySub(sub);
  if (!user || user.status === 'DELETED') {
    notFound(res, 'No account for this token. Sign in again.', 'user_not_found');
    return null;
  }
  return user;
}

export async function me(req: Request, res: Response): Promise<void> {
  try {
    const user = await currentUser(req, res);
    if (!user) return;
    ok(res, { user: toPublicUser(user) });
  } catch (error) {
    logger.error('profile.me.failed', { error });
    internalError(res, 'Could not load profile');
  }
}

export async function patchProfile(req: Request, res: Response): Promise<void> {
  const parsed = patchProfileSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    badRequest(res, parsed.error.errors[0]?.message ?? 'Invalid request body', 'validation_error');
    return;
  }

  try {
    const user = await currentUser(req, res);
    if (!user) return;

    const updated = (await updateUserProfile(user.UserId, parsed.data)) ?? user;

    // Mirror onto the Cognito profile so ID-token claims stay in step.
    // Best-effort: the users table is the source of truth for the API.
    const attrs: { Name: string; Value: string }[] = [];
    if (parsed.data.name !== undefined) attrs.push({ Name: 'name', Value: parsed.data.name });
    if (parsed.data.email) attrs.push({ Name: 'email', Value: parsed.data.email });
    if (attrs.length > 0) {
      try {
        await getCognito().send(
          new AdminUpdateUserAttributesCommand({
            UserPoolId: getConfig().COGNITO_USER_POOL_ID,
            Username: user.cognitoUsername,
            UserAttributes: attrs,
          })
        );
      } catch (error) {
        logger.warn('profile.patch.cognito_sync_failed', { userId: user.UserId, error });
      }
    }

    ok(res, { user: toPublicUser(updated) });
  } catch (error) {
    logger.error('profile.patch.failed', { error });
    internalError(res, 'Could not update profile');
  }
}

export async function deleteMe(req: Request, res: Response): Promise<void> {
  try {
    const user = await currentUser(req, res);
    if (!user) return;
    const { COGNITO_USER_POOL_ID } = getConfig();
    const cognito = getCognito();

    // 1. Ask marketplace-api to purge the consumer's data (saved, searches,
    //    threads anonymised). Best-effort — logged on failure, never blocks.
    const purged = await deleteMarketplaceUser(user.UserId);

    // 2. End every session, then disable the Cognito user so the refresh
    //    token and any re-login stop working. Sign-out is best-effort;
    //    disable is required.
    try {
      await cognito.send(new AdminUserGlobalSignOutCommand({ UserPoolId: COGNITO_USER_POOL_ID, Username: user.cognitoUsername }));
    } catch (error) {
      logger.warn('profile.delete.global_signout_failed', { userId: user.UserId, error });
    }
    await cognito.send(new AdminDisableUserCommand({ UserPoolId: COGNITO_USER_POOL_ID, Username: user.cognitoUsername }));

    // 3. Soft-delete our row.
    await markUserDeleted(user.UserId);

    clearRefreshTokenCookie(res);
    logger.info('profile.delete.ok', { userId: user.UserId, marketplacePurged: purged });
    ok(res, { ok: true });
  } catch (error) {
    logger.error('profile.delete.failed', { error });
    internalError(res, 'Could not delete account');
  }
}
