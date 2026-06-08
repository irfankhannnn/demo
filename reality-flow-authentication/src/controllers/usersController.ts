import { Request, Response } from 'express';
import { extractClaims } from '../utils/cognito';
import { ok, badRequest, forbidden, internalError, notFound } from '../utils/http';
import {
  deleteUserByTenantAndUserId,
  getUserByTenantAndUserId,
  listUsersByTenant,
  findUserByUserId,
} from '../models/usersModel';
import { findIdentityBySub, deleteIdentitiesByUserId } from '../models/authIdentitiesModel';

/**
 * GET /users
 * Admin lists all users for their tenant.
 */
export async function listUsersHandler(req: Request, res: Response): Promise<void> {
  try {
    const claims = extractClaims(req);
    const { sub } = claims;

    if (!sub) {
      badRequest(res, 'Cognito sub is missing');
      return;
    }

    const callerIdentity = await findIdentityBySub(sub);
    if (!callerIdentity) { forbidden(res, 'Only admins can list users'); return; }
    const caller = await findUserByUserId(callerIdentity.userId);
    if (!caller || caller.role !== 'ADMIN') {
      forbidden(res, 'Only admins can list users');
      return;
    }

    const users = await listUsersByTenant(caller.TenantId);

    ok(res, {
      users: users.map((u) => ({
        userId: u.userId,
        cognitoSub: u.cognitoSub,
        email: u.email,
        phoneNumber: u.phoneNumber,
        displayName: u.displayName,
        role: u.role,
        status: u.status,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
        lastLoginAt: u.lastLoginAt,
        emailVerified: u.emailVerified ?? (!!u.email),
        phoneVerified: u.phoneVerified ?? (!!u.phoneNumber),
        pendingEmail: u.pendingEmail,
        pendingPhoneNumber: u.pendingPhoneNumber,
      })),
    });
  } catch (error) {
    console.error('listUsersHandler error:', error);
    internalError(res, 'Failed to list users');
  }
}

/**
 * DELETE /users/:sub
 * Admin deletes a member from their tenant.
 */
export async function deleteUserHandler(req: Request, res: Response): Promise<void> {
  try {
    const claims = extractClaims(req);
    const { sub } = claims;

    if (!sub) {
      badRequest(res, 'Cognito sub is missing');
      return;
    }

    const callerIdentity = await findIdentityBySub(sub);
    if (!callerIdentity) { forbidden(res, 'Only admins can delete users'); return; }
    const caller = await findUserByUserId(callerIdentity.userId);
    if (!caller || caller.role !== 'ADMIN') {
      forbidden(res, 'Only admins can delete users');
      return;
    }

    const targetUserId = req.params.userId;
    if (!targetUserId) {
      badRequest(res, 'Target userId is required');
      return;
    }

    if (targetUserId === caller.userId) {
      badRequest(res, 'You cannot delete your own user');
      return;
    }

    const target = await getUserByTenantAndUserId(caller.TenantId, targetUserId);
    if (!target) {
      notFound(res, 'User not found');
      return;
    }

    if (target.role === 'ADMIN') {
      badRequest(res, 'Cannot delete an admin user');
      return;
    }

    await deleteUserByTenantAndUserId(caller.TenantId, targetUserId);
    await deleteIdentitiesByUserId(targetUserId);

    ok(res, { success: true });
  } catch (error) {
    console.error('deleteUserHandler error:', error);
    internalError(res, 'Failed to delete user');
  }
}
