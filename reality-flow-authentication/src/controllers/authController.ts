import { Request, Response } from 'express';
import { z } from 'zod';
import { extractClaims } from '../utils/cognito';
import { ok, badRequest, conflict, internalError, notFound, forbidden } from '../utils/http';
import { findUserBySub, createAdminUser, updateLastLogin, updateUserProfile } from '../models/usersModel';
import { getAgencyConfig, createAgencyConfig, updateAgencyConfig } from '../models/agencyConfigModel';
import { findInvitesByEmail } from '../models/invitesModel';

// --- Zod Schemas ---

const registerAdminSchema = z.object({
  agencyName: z.string().min(1, 'agencyName is required'),
  displayName: z.string().min(1, 'displayName is required'),
});

const acceptInviteSchema = z.object({
  inviteCode: z.string().uuid('inviteCode must be a valid UUID'),
  displayName: z.string().optional(),
});

const patchProfileSchema = z.object({
  displayName: z.string().min(1).optional(),
  phoneNumber: z.string().optional(),
});

const patchAgencySchema = z.object({
  agencyName: z.string().min(1).optional(),
  address: z.string().optional(),
  city: z.string().optional(),
});

// --- Controllers ---

/**
 * POST /auth/bootstrap
 * Check if the authenticated Cognito user already exists in the system.
 * Returns user + agency info if found, or registration hints if not.
 */
export async function bootstrap(req: Request, res: Response): Promise<void> {
  try {
    const claims = extractClaims(req);
    const { sub, email, name, phone_number } = claims;

    if (!sub) {
      badRequest(res, 'Cognito sub is missing from claims');
      return;
    }

    // Check if user already exists
    const existingUser = await findUserBySub(sub);

    if (existingUser) {
      // Update last login
      await updateLastLogin(existingUser.TenantId, sub);

      // Get agency config
      const tenantId = existingUser.role === 'ADMIN' ? sub : existingUser.TenantId;
      const agency = await getAgencyConfig(tenantId);

      ok(res, {
        exists: true,
        user: {
          cognitoSub: existingUser.cognitoSub,
          email: existingUser.email,
          role: existingUser.role,
          tenantId: existingUser.TenantId,
          displayName: existingUser.displayName,
          status: existingUser.status,
        },
        agency: agency
          ? {
              agencyName: agency.agencyName,
              status: agency.status,
            }
          : null,
      });
      return;
    }

    // User doesn't exist — check for pending invites
    const pendingInvites = email ? await findInvitesByEmail(email) : [];

    ok(res, {
      exists: false,
      needsRegistration: true,
      cognitoSub: sub,
      email: email || null,
      name: name || null,
      phoneNumber: phone_number || null,
      hasPendingInvites: pendingInvites.length > 0,
      pendingInviteCount: pendingInvites.length,
    });
  } catch (error) {
    console.error('bootstrap error:', error);
    internalError(res, 'Failed to bootstrap user');
  }
}

/**
 * POST /auth/register-admin
 * Register a new admin user and create their agency config.
 */
export async function registerAdmin(req: Request, res: Response): Promise<void> {
  try {
    const claims = extractClaims(req);
    const { sub, email, phone_number } = claims;

    if (!sub || !email) {
      badRequest(res, 'Cognito sub and email are required');
      return;
    }

    // Validate body
    const parsed = registerAdminSchema.safeParse(req.body);
    if (!parsed.success) {
      badRequest(res, parsed.error.errors.map((e) => e.message).join(', '));
      return;
    }

    const { agencyName, displayName } = parsed.data;

    // Check if user already exists
    const existingUser = await findUserBySub(sub);
    if (existingUser) {
      conflict(res, 'User already registered');
      return;
    }

    // Check if an agency config already exists for this sub
    const existingAgency = await getAgencyConfig(sub);
    if (existingAgency) {
      conflict(res, 'Agency already exists for this user');
      return;
    }

    // Create admin user + agency config
    const [user, agency] = await Promise.all([
      createAdminUser({
        cognitoSub: sub,
        email,
        displayName,
        phoneNumber: phone_number,
      }),
      createAgencyConfig({
        tenantId: sub,
        agencyName,
        adminEmail: email,
      }),
    ]);

    ok(res, {
      success: true,
      user: {
        cognitoSub: user.cognitoSub,
        email: user.email,
        role: user.role,
        tenantId: user.TenantId,
        displayName: user.displayName,
      },
      agency: {
        agencyName: agency.agencyName,
        status: agency.status,
      },
    });
  } catch (error) {
    console.error('registerAdmin error:', error);
    internalError(res, 'Failed to register admin');
  }
}

/**
 * GET /auth/check-invite
 * Check if the authenticated user has any pending invites (by email).
 */
export async function checkInvite(req: Request, res: Response): Promise<void> {
  try {
    const claims = extractClaims(req);
    const { email } = claims;

    if (!email) {
      badRequest(res, 'Email not found in Cognito claims');
      return;
    }

    const pendingInvites = await findInvitesByEmail(email);

    // Enrich invites with agency names
    const enrichedInvites = await Promise.all(
      pendingInvites.map(async (invite) => {
        const agency = await getAgencyConfig(invite.TenantId);
        return {
          inviteCode: invite.inviteCode,
          tenantId: invite.TenantId,
          agencyName: agency?.agencyName || 'Unknown Agency',
          inviteeEmail: invite.inviteeEmail,
          expiresAt: invite.expiresAt,
          createdAt: invite.createdAt,
        };
      })
    );

    ok(res, {
      inviteFound: enrichedInvites.length > 0,
      invites: enrichedInvites,
    });
  } catch (error) {
    console.error('checkInvite error:', error);
    internalError(res, 'Failed to check invites');
  }
}

/**
 * POST /auth/accept-invite
 * Accept a pending invite and register as a member under the inviting tenant.
 */
export async function acceptInvite(req: Request, res: Response): Promise<void> {
  try {
    const claims = extractClaims(req);
    const { sub, email, phone_number, name } = claims;

    if (!sub || !email) {
      badRequest(res, 'Cognito sub and email are required');
      return;
    }

    // Validate body
    const parsed = acceptInviteSchema.safeParse(req.body);
    if (!parsed.success) {
      badRequest(res, parsed.error.errors.map((e) => e.message).join(', '));
      return;
    }

    const { inviteCode, displayName } = parsed.data;

    // Check if user already exists
    const existingUser = await findUserBySub(sub);
    if (existingUser) {
      conflict(res, 'User already registered');
      return;
    }

    // Find the invite — we need to find which tenant it belongs to
    const pendingInvites = await findInvitesByEmail(email);
    const matchingInvite = pendingInvites.find((inv) => inv.inviteCode === inviteCode);

    if (!matchingInvite) {
      notFound(res, 'Invite not found or already used');
      return;
    }

    // Check expiry
    if (new Date(matchingInvite.expiresAt) < new Date()) {
      badRequest(res, 'Invite has expired');
      return;
    }

    // Import here to avoid circular dependency at module level
    const { createMemberUser } = await import('../models/usersModel');
    const { markInviteAccepted } = await import('../models/invitesModel');

    // Create member + mark invite accepted
    const [user] = await Promise.all([
      createMemberUser({
        tenantId: matchingInvite.TenantId,
        cognitoSub: sub,
        email,
        displayName: displayName || name || email.split('@')[0],
        phoneNumber: phone_number,
      }),
      markInviteAccepted(matchingInvite.TenantId, inviteCode),
    ]);

    const agency = await getAgencyConfig(matchingInvite.TenantId);

    ok(res, {
      success: true,
      user: {
        cognitoSub: user.cognitoSub,
        email: user.email,
        role: user.role,
        tenantId: user.TenantId,
        displayName: user.displayName,
      },
      agency: agency
        ? {
            agencyName: agency.agencyName,
            status: agency.status,
          }
        : null,
    });
  } catch (error) {
    console.error('acceptInvite error:', error);
    internalError(res, 'Failed to accept invite');
  }
}

/**
 * GET /auth/me
 * Return the current user's profile and agency info.
 */
export async function me(req: Request, res: Response): Promise<void> {
  try {
    const claims = extractClaims(req);
    const { sub } = claims;

    if (!sub) {
      badRequest(res, 'Cognito sub is missing');
      return;
    }

    const user = await findUserBySub(sub);
    if (!user) {
      notFound(res, 'User not registered');
      return;
    }

    const tenantId = user.role === 'ADMIN' ? sub : user.TenantId;
    const agency = await getAgencyConfig(tenantId);

    ok(res, {
      user: {
        cognitoSub: user.cognitoSub,
        email: user.email,
        phoneNumber: user.phoneNumber,
        role: user.role,
        tenantId: user.TenantId,
        displayName: user.displayName,
        status: user.status,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
      },
      agency: agency
        ? {
            agencyName: agency.agencyName,
            address: agency.address,
            city: agency.city,
            status: agency.status,
            notificationSettings: agency.notificationSettings,
          }
        : null,
    });
  } catch (error) {
    console.error('me error:', error);
    internalError(res, 'Failed to get user profile');
  }
}

/**
 * PATCH /auth/profile
 * Update current user's profile (displayName, phoneNumber).
 * Does NOT allow updating role, tenantId, email, or status.
 */
export async function patchProfile(req: Request, res: Response): Promise<void> {
  try {
    const claims = extractClaims(req);
    const { sub } = claims;

    if (!sub) {
      badRequest(res, 'Cognito sub is missing from claims');
      return;
    }

    // Validate request body
    const validation = patchProfileSchema.safeParse(req.body);
    if (!validation.success) {
      badRequest(res, validation.error.errors[0]?.message || 'Invalid request body');
      return;
    }

    const updates = validation.data;

    // Get user to determine tenantId
    const user = await findUserBySub(sub);
    if (!user) {
      notFound(res, 'User not found');
      return;
    }

    // Update user profile
    await updateUserProfile(user.TenantId, sub, updates);

    ok(res, { message: 'Profile updated successfully' });
  } catch (error) {
    console.error('patchProfile error:', error);
    internalError(res, 'Failed to update profile');
  }
}

/**
 * PATCH /auth/agency
 * Update agency config (agencyName, address, city).
 * Admin-only endpoint - members cannot update agency config.
 */
export async function patchAgency(req: Request, res: Response): Promise<void> {
  try {
    const claims = extractClaims(req);
    const { sub } = claims;

    if (!sub) {
      badRequest(res, 'Cognito sub is missing from claims');
      return;
    }

    // Validate request body
    const validation = patchAgencySchema.safeParse(req.body);
    if (!validation.success) {
      badRequest(res, validation.error.errors[0]?.message || 'Invalid request body');
      return;
    }

    const updates = validation.data;

    // Get user to check role
    const user = await findUserBySub(sub);
    if (!user) {
      notFound(res, 'User not found');
      return;
    }

    // Only admins can update agency config
    if (user.role !== 'ADMIN') {
      forbidden(res, 'Only admins can update agency configuration');
      return;
    }

    // For admin, tenantId is their own sub
    const tenantId = user.TenantId;

    // Update agency config
    await updateAgencyConfig(tenantId, updates);

    ok(res, { message: 'Agency configuration updated successfully' });
  } catch (error) {
    console.error('patchAgency error:', error);
    internalError(res, 'Failed to update agency configuration');
  }
}
