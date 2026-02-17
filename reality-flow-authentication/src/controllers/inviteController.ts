import { Request, Response } from 'express';
import { z } from 'zod';
import { extractClaims } from '../utils/cognito';
import { ok, badRequest, forbidden, notFound, internalError, conflict } from '../utils/http';
import { findUserBySub } from '../models/usersModel';
import { getAgencyConfig } from '../models/agencyConfigModel';
import {
  createInvite,
  findInvitesByEmail,
  listInvitesByTenant,
  getInvite,
  revokeInvite,
  updateInviteEmail,
} from '../models/invitesModel';

// --- Zod Schemas ---

const createInviteSchema = z.object({
  email: z.string().email('Valid email is required'),
  expiresInDays: z.number().int().min(1).max(30).optional(),
});

const updateInviteEmailSchema = z.object({
  email: z.string().email('Valid email is required'),
});

// --- Controllers ---

/**
 * POST /invites
 * Admin creates a new invite for a member.
 */
export async function createInviteHandler(req: Request, res: Response): Promise<void> {
  try {
    const claims = extractClaims(req);
    const { sub } = claims;

    if (!sub) {
      badRequest(res, 'Cognito sub is missing');
      return;
    }

    // Verify caller is an ADMIN
    const user = await findUserBySub(sub);
    if (!user || user.role !== 'ADMIN') {
      forbidden(res, 'Only admins can create invites');
      return;
    }

    // Validate body
    const parsed = createInviteSchema.safeParse(req.body);
    if (!parsed.success) {
      badRequest(res, parsed.error.errors.map((e) => e.message).join(', '));
      return;
    }

    const { email, expiresInDays } = parsed.data;

    // Create invite
    const invite = await createInvite({
      tenantId: user.TenantId,
      invitedBySub: sub,
      inviteeEmail: email,
      expiresInDays,
    });

    const agency = await getAgencyConfig(user.TenantId);

    ok(res, {
      success: true,
      invite: {
        inviteCode: invite.inviteCode,
        inviteeEmail: invite.inviteeEmail,
        agencyName: agency?.agencyName || '',
        status: invite.status,
        expiresAt: invite.expiresAt,
        createdAt: invite.createdAt,
      },
    });
  } catch (error) {
    console.error('createInvite error:', error);
    internalError(res, 'Failed to create invite');
  }
}

/**
 * PATCH /invites/:inviteCode/email
 * Admin updates the invitee email for a PENDING invite.
 */
export async function updateInviteEmailHandler(req: Request, res: Response): Promise<void> {
  try {
    const claims = extractClaims(req);
    const { sub } = claims;

    if (!sub) {
      badRequest(res, 'Cognito sub is missing');
      return;
    }

    const user = await findUserBySub(sub);
    if (!user || user.role !== 'ADMIN') {
      forbidden(res, 'Only admins can update invite emails');
      return;
    }

    const { inviteCode } = req.params;
    if (!inviteCode) {
      badRequest(res, 'inviteCode is required');
      return;
    }

    const parsed = updateInviteEmailSchema.safeParse(req.body);
    if (!parsed.success) {
      badRequest(res, parsed.error.errors.map((e) => e.message).join(', '));
      return;
    }

    const newEmail = parsed.data.email;

    const invite = await getInvite(user.TenantId, inviteCode);
    if (!invite) {
      notFound(res, 'Invite not found');
      return;
    }

    if (invite.status !== 'PENDING') {
      badRequest(res, `Cannot update invite email with status: ${invite.status}`);
      return;
    }

    const existingPendingForEmail = await findInvitesByEmail(newEmail);
    const conflicting = existingPendingForEmail.find(
      (inv) => inv.TenantId === user.TenantId && inv.inviteCode !== inviteCode
    );
    if (conflicting) {
      conflict(res, 'A pending invite already exists for this email');
      return;
    }

    try {
      await updateInviteEmail(user.TenantId, inviteCode, newEmail);
    } catch (err: any) {
      if (err?.code === 'ConditionalCheckFailedException') {
        badRequest(res, 'Invite is no longer pending');
        return;
      }
      throw err;
    }

    ok(res, {
      success: true,
      invite: {
        inviteCode,
        inviteeEmail: newEmail,
      },
    });
  } catch (error) {
    console.error('updateInviteEmail error:', error);
    internalError(res, 'Failed to update invite email');
  }
}

/**
 * GET /invites
 * Admin lists all invites for their agency.
 */
export async function listInvitesHandler(req: Request, res: Response): Promise<void> {
  try {
    const claims = extractClaims(req);
    const { sub } = claims;

    if (!sub) {
      badRequest(res, 'Cognito sub is missing');
      return;
    }

    // Verify caller is an ADMIN
    const user = await findUserBySub(sub);
    if (!user || user.role !== 'ADMIN') {
      forbidden(res, 'Only admins can list invites');
      return;
    }

    const statusFilter = req.query.status as string | undefined;
    const validStatuses = ['PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED'];
    const filter =
      statusFilter && validStatuses.includes(statusFilter)
        ? (statusFilter as 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'REVOKED')
        : undefined;

    const invites = await listInvitesByTenant(user.TenantId, filter);

    ok(res, {
      invites: invites.map((inv) => ({
        inviteCode: inv.inviteCode,
        inviteeEmail: inv.inviteeEmail,
        status: inv.status,
        expiresAt: inv.expiresAt,
        createdAt: inv.createdAt,
      })),
    });
  } catch (error) {
    console.error('listInvites error:', error);
    internalError(res, 'Failed to list invites');
  }
}

/**
 * POST /invites/:inviteCode/revoke
 * Admin revokes a pending invite.
 */
export async function revokeInviteHandler(req: Request, res: Response): Promise<void> {
  try {
    const claims = extractClaims(req);
    const { sub } = claims;

    if (!sub) {
      badRequest(res, 'Cognito sub is missing');
      return;
    }

    // Verify caller is an ADMIN
    const user = await findUserBySub(sub);
    if (!user || user.role !== 'ADMIN') {
      forbidden(res, 'Only admins can revoke invites');
      return;
    }

    const { inviteCode } = req.params;
    if (!inviteCode) {
      badRequest(res, 'inviteCode is required');
      return;
    }

    // Get invite
    const invite = await getInvite(user.TenantId, inviteCode);
    if (!invite) {
      notFound(res, 'Invite not found');
      return;
    }

    if (invite.status !== 'PENDING') {
      badRequest(res, `Cannot revoke invite with status: ${invite.status}`);
      return;
    }

    await revokeInvite(user.TenantId, inviteCode);

    ok(res, {
      success: true,
      invite: {
        inviteCode,
        status: 'REVOKED',
      },
    });
  } catch (error) {
    console.error('revokeInvite error:', error);
    internalError(res, 'Failed to revoke invite');
  }
}
