import { Request, Response } from 'express';
import { z } from 'zod';
import { extractClaims } from '../utils/cognito';
import { ok, badRequest, forbidden, notFound, internalError, conflict } from '../utils/http';
import { findIdentityBySub } from '../models/authIdentitiesModel';
import { findUserByUserId, findUserByEmail, findUserByPhone, countUsersByTenant } from '../models/usersModel';
import { getSubscription } from '../models/subscriptionsModel';
import { getAgencyConfig } from '../models/agencyConfigModel';
import {
  createInvite,
  findInvitesByEmail,
  findInvitesByPhone,
  listInvitesByTenant,
  getInvite,
  revokeInvite,
  updateInviteEmail,
} from '../models/invitesModel';
import { validateAndFormatIndianPhone } from '../utils/phoneValidation';
import { logger } from '../utils/logger';

// --- Zod Schemas ---

const createInviteSchema = z.object({
  email: z.string().email('Valid email is required').optional(),
  phone: z.string().optional(),
  expiresInDays: z.number().int().min(1).max(30).optional(),
}).refine((data) => data.email || data.phone, {
  message: 'Either email or phone must be provided',
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
    const callerIdentity = await findIdentityBySub(sub);
    if (!callerIdentity) { forbidden(res, 'Only admins can create invites'); return; }
    const user = await findUserByUserId(callerIdentity.userId);
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

    const { email, phone, expiresInDays } = parsed.data;

    // Validate and format phone if provided
    let formattedPhone: string | undefined;
    if (phone) {
      const validated = validateAndFormatIndianPhone(phone);
      if (!validated) {
        badRequest(res, 'Invalid Indian phone number');
        return;
      }
      formattedPhone = validated;
    }

    // Global uniqueness check: email/phone must not belong to any existing user
    if (email) {
      const existingUser = await findUserByEmail(email);
      if (existingUser) {
        conflict(res, 'This email already belongs to an existing user');
        return;
      }
    }

    if (formattedPhone) {
      const existingUser = await findUserByPhone(formattedPhone);
      if (existingUser) {
        conflict(res, 'This phone number already belongs to an existing user');
        return;
      }
    }

    // Check for existing pending invite
    if (email) {
      const existingInvites = await findInvitesByEmail(email);
      if (existingInvites.length > 0) {
        conflict(res, 'An invite for this email already exists');
        return;
      }
    }

    if (formattedPhone) {
      const existingInvites = await findInvitesByPhone(formattedPhone);
      if (existingInvites.length > 0) {
        conflict(res, 'An invite for this phone number already exists');
        return;
      }
    }

    // Seat cap enforcement
    const subscription = await getSubscription(user.TenantId);
    const seatsPaid = subscription?.seatsPaid ?? 1;
    const activeUsers = await countUsersByTenant(user.TenantId);
    if (activeUsers >= seatsPaid) {
      forbidden(res, `Seat limit reached (${activeUsers}/${seatsPaid}). Upgrade to add more members.`);
      return;
    }

    // Create invite
    const invite = await createInvite({
      tenantId: user.TenantId,
      invitedBySub: sub,
      inviteeEmail: email,
      inviteePhone: formattedPhone,
      expiresInDays,
    });

    const agency = await getAgencyConfig(user.TenantId);

    ok(res, {
      success: true,
      invite: {
        inviteCode: invite.inviteCode,
        inviteeEmail: invite.inviteeEmail,
        inviteePhone: invite.inviteePhone,
        agencyName: agency?.agencyName || '',
        status: invite.status,
        expiresAt: invite.expiresAt,
        createdAt: invite.createdAt,
      },
    });
  } catch (error) {
    logger.error('createInvite error', { error });
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

    const callerIdentity = await findIdentityBySub(sub);
    if (!callerIdentity) { forbidden(res, 'Only admins can update invite emails'); return; }
    const user = await findUserByUserId(callerIdentity.userId);
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
    logger.error('updateInviteEmail error', { error });
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
    const callerIdentity = await findIdentityBySub(sub);
    if (!callerIdentity) { forbidden(res, 'Only admins can list invites'); return; }
    const user = await findUserByUserId(callerIdentity.userId);
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
        inviteePhone: inv.inviteePhone,
        status: inv.status,
        expiresAt: inv.expiresAt,
        createdAt: inv.createdAt,
      })),
    });
  } catch (error) {
    logger.error('listInvites error', { error });
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
    const callerIdentity = await findIdentityBySub(sub);
    if (!callerIdentity) { forbidden(res, 'Only admins can revoke invites'); return; }
    const user = await findUserByUserId(callerIdentity.userId);
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
    logger.error('revokeInvite error', { error });
    internalError(res, 'Failed to revoke invite');
  }
}

