import { Request, Response } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { extractClaims } from '../utils/cognito';
import { ok, badRequest, conflict, internalError, notFound, forbidden } from '../utils/http';
import {
  updateUserProfile,
  findUserByUserId,
  findUserByEmail,
  findUserByPhone,
  findUserByPendingEmail,
  createAdminUser,
} from '../models/usersModel';
import { getAgencyConfig, updateAgencyConfig, createAgencyConfig } from '../models/agencyConfigModel';
import { findInvitesByEmail, findInvitesByPhone, deleteInvite } from '../models/invitesModel';
import { findIdentityBySub, createIdentity } from '../models/authIdentitiesModel';
import { resolveUser } from '../utils/resolveUser';
import { resolveMemberUser } from '../utils/resolveMemberUser';
import { logger } from '../utils/logger';

// --- Zod Schemas ---

const registerAdminSchema = z.object({
  agencyName: z.string().min(1, 'agencyName is required'),
  displayName: z.string().min(1, 'displayName is required'),
  consentAccepted: z.literal(true, {
    errorMap: () => ({ message: 'Terms and Privacy Policy consent is required' }),
  }),
});

const acceptInviteSchema = z.object({
  inviteCode: z.string().uuid('inviteCode must be a valid UUID'),
  displayName: z.string().optional(),
});

const patchProfileSchema = z.object({
  displayName: z.string().min(1).optional(),
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

    // Run universal resolution pipeline (fast-path + tenant lookup + admin create/link)
    const resolved = await resolveUser(sub, 'google', email, phone_number);

    if (resolved.isNewUser === false) {
      // Existing or newly-linked user
      const { user, agency } = resolved;
      ok(res, {
        exists: true,
        user: {
          userId: user.userId,
          cognitoSub: user.cognitoSub,
          email: user.email,
          role: user.role,
          tenantId: user.TenantId,
          displayName: user.displayName,
          status: user.status,
        },
        agency: agency
          ? { agencyName: agency.agencyName, status: agency.status }
          : null,
      });
      return;
    }

    let existingMember = email ? await findUserByEmail(email) : null;

    if (!existingMember && phone_number) {
      existingMember = await findUserByPhone(phone_number);
    }

    // Phase 4: Check if any user has this email as pendingEmail (Google-based linking)
    if (!existingMember && email) {
      existingMember = await findUserByPendingEmail(email);
    }

    if (existingMember && existingMember.role === 'MEMBER') {
      const result = await resolveMemberUser(
        sub,
        'google',
        existingMember.TenantId,
        email,
        phone_number,
        name || email?.split('@')[0]
      );

      if (result.isNewMember === null) {
        internalError(res, 'Failed to resolve member');
        return;
      }

      ok(res, {
        exists: true,
        user: {
          userId: result.user.userId,
          cognitoSub: result.user.cognitoSub,
          email: result.user.email,
          role: result.user.role,
          tenantId: result.user.TenantId,
          displayName: result.user.displayName,
          status: result.user.status,
        },
        agency: result.agency ? { agencyName: result.agency.agencyName, status: result.agency.status } : null,
      });
      return;
    }

    // resolveUser could not resolve a tenant — check pending invites
    const pendingInvites = email ? await findInvitesByEmail(email) : [];

    // Auto-accept if exactly 1 pending invite
    if (pendingInvites.length === 1) {
      const invite = pendingInvites[0];
      logger.info('[bootstrap] Auto-accepting invite for under tenant', { email, tenantId: invite.TenantId });

      const result = await resolveMemberUser(
        sub,
        'google',
        invite.TenantId,
        email,
        phone_number,
        name || email?.split('@')[0]
      );

      if (result.isNewMember === null) {
        internalError(res, 'Failed to resolve member');
        return;
      }

      await deleteInvite(invite.TenantId, invite.inviteCode);

      ok(res, {
        exists: true,
        user: {
          userId: result.user.userId,
          cognitoSub: result.user.cognitoSub,
          email: result.user.email,
          role: result.user.role,
          tenantId: result.user.TenantId,
          displayName: result.user.displayName,
          status: result.user.status,
        },
        agency: result.agency ? { agencyName: result.agency.agencyName, status: result.agency.status } : null,
        autoAcceptedInvite: true,
      });
      return;
    }

    // Multiple invites — manual selection required
    if (pendingInvites.length > 1) {
      ok(res, {
        exists: false,
        needsRegistration: true,
        cognitoSub: sub,
        email: email || null,
        name: name || null,
        phoneNumber: phone_number || null,
        hasPendingInvites: true,
        pendingInviteCount: pendingInvites.length,
      });
      return;
    }

    // No invites — new user eligible for self-serve trial signup
    ok(res, {
      exists: false,
      needsRegistration: true,
      cognitoSub: sub,
      email: email || null,
      name: name || null,
      phoneNumber: phone_number || null,
      hasPendingInvites: false,
    });
  } catch (error) {
    logger.error('bootstrap error', { error });
    internalError(res, 'Failed to bootstrap user');
  }
}

/**
 * POST /auth/register-admin
 * Self-serve agency admin registration for 14-day trial signups.
 */
export async function registerAdmin(req: Request, res: Response): Promise<void> {
  try {
    const claims = extractClaims(req);
    const { sub, email, phone_number, name } = claims;

    if (!sub) {
      badRequest(res, 'Cognito sub is missing from claims');
      return;
    }

    const parsed = registerAdminSchema.safeParse(req.body);
    if (!parsed.success) {
      badRequest(res, parsed.error.errors.map((e) => e.message).join(', '));
      return;
    }

    const { agencyName, displayName } = parsed.data;

    const existingIdentity = await findIdentityBySub(sub);
    if (existingIdentity) {
      const existingUser = await findUserByUserId(existingIdentity.userId);
      if (existingUser) {
        conflict(res, 'User already registered');
        return;
      }
    }

    const tenantId = uuidv4();
    const normalizedEmail = (email || `${sub}@phone.realestateflow.in`).toLowerCase().trim();
    const provider: 'google' | 'phone' = email ? 'google' : 'phone';

    if (email) {
      const emailTaken = await findUserByEmail(normalizedEmail);
      if (emailTaken) {
        conflict(res, 'Email already registered');
        return;
      }
    }

    if (phone_number) {
      const phoneTaken = await findUserByPhone(phone_number);
      if (phoneTaken) {
        conflict(res, 'Phone number already registered');
        return;
      }
    }

    const userId = uuidv4();

    const [user, agency] = await Promise.all([
      createAdminUser({
        tenantId,
        cognitoSub: sub,
        userId,
        email: normalizedEmail,
        displayName,
        phoneNumber: phone_number,
        authMethod: provider,
      }),
      createAgencyConfig({
        tenantId,
        agencyName,
        adminEmail: normalizedEmail,
      }),
    ]);

    await createIdentity({
      sub,
      userId,
      tenantId,
      provider,
      email: email?.toLowerCase().trim(),
      phone: phone_number,
    });

    ok(res, {
      success: true,
      user: {
        userId: user.userId,
        cognitoSub: user.cognitoSub,
        email: user.email,
        role: user.role,
        tenantId: user.TenantId,
        displayName: user.displayName,
        status: user.status,
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
    logger.error('checkInvite error', { error });
    internalError(res, 'Failed to check invites');
  }
}

/**
 * POST /auth/accept-invite
 * Accept a pending invite and register as a member under the inviting tenant.
 * Uses resolveMemberUser to handle both new members and identity linking.
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

    // Find the matching invite by email (or phone if invite has both)
    let pendingInvites = await findInvitesByEmail(email);
    let matchingInvite = pendingInvites.find((inv) => inv.inviteCode === inviteCode);

    // If not found by email, try by phone (for dual-contact invites)
    if (!matchingInvite && phone_number) {
      const phoneInvites = await findInvitesByPhone(phone_number);
      matchingInvite = phoneInvites.find((inv) => inv.inviteCode === inviteCode);
    }

    if (!matchingInvite) {
      notFound(res, 'Invite not found or already used');
      return;
    }

    // Check expiry
    if (new Date(matchingInvite.expiresAt) < new Date()) {
      badRequest(res, 'Invite has expired');
      return;
    }

    // Check if email or phone is already registered in another agency
    const existingByEmail = await findUserByEmail(email);
    const existingByPhone = phone_number ? await findUserByPhone(phone_number) : null;

    if (existingByEmail && existingByEmail.TenantId !== matchingInvite.TenantId) {
      forbidden(
        res,
        'EMAIL_ALREADY_REGISTERED',
        'This email is already registered with another agency. Please use a different email or contact support.'
      );
      return;
    }

    if (existingByPhone && existingByPhone.TenantId !== matchingInvite.TenantId) {
      forbidden(
        res,
        'PHONE_ALREADY_REGISTERED',
        'This phone number is already registered with another agency. Please use a different phone number or contact support.'
      );
      return;
    }

    // Use resolveMemberUser to create/link member
    const result = await resolveMemberUser(
      sub,
      'google',
      matchingInvite.TenantId,
      email,
      phone_number,
      displayName || name || email.split('@')[0]
    );

    if (result.isNewMember === null) {
      // Check if it failed due to duplicate email/phone
      const dupeCheckEmail = await findUserByEmail(email);
      const dupeCheckPhone = phone_number ? await findUserByPhone(phone_number) : null;

      if (dupeCheckEmail && dupeCheckEmail.TenantId !== matchingInvite.TenantId) {
        forbidden(
          res,
          'EMAIL_ALREADY_REGISTERED',
          'This email is already registered with another agency. Please use a different email or contact support.'
        );
        return;
      }

      if (dupeCheckPhone && dupeCheckPhone.TenantId !== matchingInvite.TenantId) {
        forbidden(
          res,
          'PHONE_ALREADY_REGISTERED',
          'This phone number is already registered with another agency. Please use a different phone number or contact support.'
        );
        return;
      }

      internalError(res, 'Failed to resolve member');
      return;
    }

    // Delete consumed invite
    await deleteInvite(matchingInvite.TenantId, inviteCode);

    ok(res, {
      success: true,
      user: {
        userId: result.user.userId,
        cognitoSub: result.user.cognitoSub,
        email: result.user.email,
        role: result.user.role,
        tenantId: result.user.TenantId,
        displayName: result.user.displayName,
      },
      agency: result.agency ? { agencyName: result.agency.agencyName, status: result.agency.status } : null,
    });
  } catch (error) {
    logger.error('acceptInvite error', { error });
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

    const identity = await findIdentityBySub(sub);
    if (!identity) {
      notFound(res, 'User not registered');
      return;
    }

    const user = await findUserByUserId(identity.userId);
    if (!user) {
      notFound(res, 'User record not found');
      return;
    }

    const agency = await getAgencyConfig(user.TenantId);

    ok(res, {
      user: {
        userId: user.userId,
        cognitoSub: user.cognitoSub,
        email: user.email,
        phoneNumber: user.phoneNumber,
        role: user.role,
        tenantId: user.TenantId,
        displayName: user.displayName,
        status: user.status,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
        emailVerified: user.emailVerified ?? (!!user.email),
        phoneVerified: user.phoneVerified ?? (!!user.phoneNumber),
        pendingEmail: user.pendingEmail,
        pendingPhoneNumber: user.pendingPhoneNumber,
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
    logger.error('me error', { error });
    internalError(res, 'Failed to get user profile');
  }
}

/**
 * PATCH /auth/profile
 * Update current user's profile (displayName only).
 * Does NOT allow updating role, tenantId, email, phoneNumber, or status.
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

    // Resolve identity → user
    const identity = await findIdentityBySub(sub);
    if (!identity) {
      notFound(res, 'User not found');
      return;
    }
    const user = await findUserByUserId(identity.userId);
    if (!user) {
      notFound(res, 'User record not found');
      return;
    }

    // Update user profile
    await updateUserProfile(user.TenantId, user.userId, updates);

    ok(res, { message: 'Profile updated successfully' });
  } catch (error) {
    logger.error('patchProfile error', { error });
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

    // Resolve identity → user
    const identity = await findIdentityBySub(sub);
    if (!identity) {
      notFound(res, 'User not found');
      return;
    }
    const user = await findUserByUserId(identity.userId);
    if (!user) {
      notFound(res, 'User record not found');
      return;
    }

    // Only admins can update agency config
    if (user.role !== 'ADMIN') {
      forbidden(res, 'Only admins can update agency configuration');
      return;
    }

    const tenantId = user.TenantId;

    // Update agency config
    await updateAgencyConfig(tenantId, updates);

    ok(res, { message: 'Agency configuration updated successfully' });
  } catch (error) {
    logger.error('patchAgency error', { error });
    internalError(res, 'Failed to update agency configuration');
  }
}

