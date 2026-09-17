import { Request, Response } from 'express';
import AWS from 'aws-sdk';
import { extractClaims } from '../utils/cognito';
import { ok, badRequest, internalError, notFound } from '../utils/http';
import { getConfig } from '../config/config';
import {
  findUserByUserId,
  listUsersByTenant,
  deleteUserByTenantAndUserId,
  type UserItem,
} from '../models/usersModel';
import { findIdentityBySub, deleteIdentitiesByUserId } from '../models/authIdentitiesModel';
import {
  markAgencyForDeletion,
  DELETION_GRACE_PERIOD_DAYS,
} from '../models/agencyConfigModel';
import { clearRefreshTokenCookie } from '../utils/cookies';
import { logger } from '../utils/logger';

const cognito = new AWS.CognitoIdentityServiceProvider({
  region: process.env.AWS_REGION || 'ap-south-1',
});

/** Typing this exactly guards against a stray DELETE wiping an account. */
const CONFIRMATION_PHRASE = 'DELETE';

/**
 * Remove a user from Cognito, ending every existing session first.
 *
 * Global sign-out is issued before deletion so that already-issued access
 * tokens stop working immediately rather than remaining valid until they
 * expire. Failures are logged and swallowed: the local records must still be
 * removed, and a Cognito user with no corresponding record cannot sign in
 * anywhere useful.
 */
async function destroyCognitoUser(userPoolId: string, cognitoSub: string): Promise<boolean> {
  try {
    await cognito
      .adminUserGlobalSignOut({ UserPoolId: userPoolId, Username: cognitoSub })
      .promise();
  } catch (error) {
    logger.warn('account.delete.global_signout_failed', { cognitoSub, error });
  }

  try {
    await cognito
      .adminDeleteUser({ UserPoolId: userPoolId, Username: cognitoSub })
      .promise();
    return true;
  } catch (error) {
    logger.error('account.delete.cognito_delete_failed', { cognitoSub, error });
    return false;
  }
}

/** Delete one user's identity records everywhere they exist. */
async function purgeUser(userPoolId: string, user: UserItem): Promise<void> {
  await destroyCognitoUser(userPoolId, user.cognitoSub);
  await deleteIdentitiesByUserId(user.userId);
  await deleteUserByTenantAndUserId(user.TenantId, user.userId);
}

/**
 * DELETE /auth/me
 *
 * Self-service account deletion. Required by App Store Review Guideline
 * 5.1.1(v), which makes an app that offers account creation without in-app
 * deletion an automatic rejection, and by Google Play's data deletion policy.
 *
 * Deliberately different from DELETE /users/:userId, which is an admin removing
 * somebody else and explicitly refuses both self-deletion and deleting an
 * ADMIN. That left the agency owner -- the paying persona -- with no way to
 * delete their own account at all.
 *
 * An ADMIN deleting their account takes the whole agency with it: every member
 * loses access and the tenant's CRM data is scheduled for purge. The client
 * must acknowledge that explicitly, and the response tells the UI how many
 * members were affected so it can be stated plainly beforehand.
 */
export async function deleteMyAccountHandler(req: Request, res: Response): Promise<void> {
  try {
    const { COGNITO_USER_POOL_ID } = getConfig();
    const { sub } = extractClaims(req);

    if (!sub) {
      badRequest(res, 'Cognito sub is missing');
      return;
    }

    if (req.body?.confirm !== CONFIRMATION_PHRASE) {
      badRequest(res, `Confirmation required. Send { "confirm": "${CONFIRMATION_PHRASE}" }.`);
      return;
    }

    const identity = await findIdentityBySub(sub);
    if (!identity) {
      notFound(res, 'Account not found');
      return;
    }

    const user = await findUserByUserId(identity.userId);
    if (!user) {
      notFound(res, 'Account not found');
      return;
    }

    const tenantId = user.TenantId;
    const isAdmin = user.role === 'ADMIN';

    let deletedUserCount = 1;
    let agencyDeleted = false;
    let deletionScheduledFor: string | undefined;

    if (isAdmin) {
      const members = await listUsersByTenant(tenantId);
      const others = members.filter((m) => m.userId !== user.userId);

      // The agency cannot outlive its only admin: nobody left could invite,
      // manage billing or delete data. Removing everyone is the honest outcome,
      // and the client warns about it before calling this.
      if (!req.body?.deleteAgency) {
        badRequest(
          res,
          'Deleting an admin account also deletes the agency and removes all members. ' +
            'Send { "deleteAgency": true } to confirm.'
        );
        return;
      }

      for (const member of others) {
        await purgeUser(COGNITO_USER_POOL_ID, member);
      }
      deletedUserCount += others.length;

      const scheduled = await markAgencyForDeletion(tenantId, user.userId);
      deletionScheduledFor = scheduled.deletionScheduledFor;
      agencyDeleted = true;
    }

    await purgeUser(COGNITO_USER_POOL_ID, user);

    // Kill the refresh cookie too, or the browser keeps a credential for an
    // account that no longer exists.
    clearRefreshTokenCookie(res);

    logger.info('account.deleted', {
      tenantId,
      userId: user.userId,
      role: user.role,
      agencyDeleted,
      deletedUserCount,
    });

    ok(res, {
      success: true,
      agencyDeleted,
      deletedUserCount,
      deletionScheduledFor,
      gracePeriodDays: agencyDeleted ? DELETION_GRACE_PERIOD_DAYS : undefined,
    });
  } catch (error) {
    logger.error('deleteMyAccountHandler error', { error });
    internalError(res, 'Failed to delete account');
  }
}

/**
 * GET /auth/me/deletion-preview
 *
 * What deleting this account would destroy, so the confirmation screen can be
 * specific rather than vague. Read-only.
 */
export async function deletionPreviewHandler(req: Request, res: Response): Promise<void> {
  try {
    const { sub } = extractClaims(req);
    if (!sub) {
      badRequest(res, 'Cognito sub is missing');
      return;
    }

    const identity = await findIdentityBySub(sub);
    if (!identity) {
      notFound(res, 'Account not found');
      return;
    }

    const user = await findUserByUserId(identity.userId);
    if (!user) {
      notFound(res, 'Account not found');
      return;
    }

    const isAdmin = user.role === 'ADMIN';
    let memberCount = 0;

    if (isAdmin) {
      const members = await listUsersByTenant(user.TenantId);
      memberCount = members.filter((m) => m.userId !== user.userId).length;
    }

    ok(res, {
      role: user.role,
      deletesAgency: isAdmin,
      memberCount,
      gracePeriodDays: DELETION_GRACE_PERIOD_DAYS,
    });
  } catch (error) {
    logger.error('deletionPreviewHandler error', { error });
    internalError(res, 'Failed to load deletion preview');
  }
}
