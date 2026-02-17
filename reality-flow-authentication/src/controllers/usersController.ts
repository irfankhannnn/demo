import { Request, Response } from 'express';
import { extractClaims } from '../utils/cognito';
import { ok, badRequest, forbidden, internalError, notFound } from '../utils/http';
import {
  deleteUserByTenantAndSub,
  findUserBySub,
  getUserByTenantAndSub,
  listUsersByTenant,
} from '../models/usersModel';

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

    const caller = await findUserBySub(sub);
    if (!caller || caller.role !== 'ADMIN') {
      forbidden(res, 'Only admins can list users');
      return;
    }

    const users = await listUsersByTenant(caller.TenantId);

    ok(res, {
      users: users.map((u) => ({
        cognitoSub: u.cognitoSub,
        email: u.email,
        phoneNumber: u.phoneNumber,
        displayName: u.displayName,
        role: u.role,
        status: u.status,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
        lastLoginAt: u.lastLoginAt,
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

    const caller = await findUserBySub(sub);
    if (!caller || caller.role !== 'ADMIN') {
      forbidden(res, 'Only admins can delete users');
      return;
    }

    const targetSub = req.params.sub;
    if (!targetSub) {
      badRequest(res, 'Target sub is required');
      return;
    }

    if (targetSub === sub) {
      badRequest(res, 'You cannot delete your own user');
      return;
    }

    const target = await getUserByTenantAndSub(caller.TenantId, targetSub);
    if (!target) {
      notFound(res, 'User not found');
      return;
    }

    if (target.role === 'ADMIN') {
      badRequest(res, 'Cannot delete an admin user');
      return;
    }

    await deleteUserByTenantAndSub(caller.TenantId, targetSub);

    ok(res, { success: true });
  } catch (error) {
    console.error('deleteUserHandler error:', error);
    internalError(res, 'Failed to delete user');
  }
}
