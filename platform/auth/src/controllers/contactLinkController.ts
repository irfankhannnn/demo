import { Request, Response } from 'express';
import { z } from 'zod';
import { extractClaims } from '../utils/cognito';
import { ok, badRequest, conflict, internalError, notFound, forbidden } from '../utils/http';
import {
  findUserByUserId,
  assertEmailAvailable,
  assertPhoneAvailable,
  setPendingEmail,
  setPendingPhone,
  promotePendingPhone,
} from '../models/usersModel';
import { findIdentityBySub } from '../models/authIdentitiesModel';
import { createPhoneLinkOtp, verifyPhoneLinkOtp } from '../models/phoneLinkOtpModel';
import { validateAndFormatIndianPhone } from '../utils/phoneValidation';
import { logger } from '../utils/logger';

// --- Zod Schemas ---

const emailStartSchema = z.object({
  email: z.string().email('A valid email is required'),
});

const phoneStartSchema = z.object({
  phoneNumber: z.string().min(10, 'Phone number is required'),
});

const phoneVerifySchema = z.object({
  phoneNumber: z.string().min(10, 'Phone number is required'),
  otp: z.string().length(6, 'OTP must be 6 digits'),
});

// --- Helpers ---

async function resolveCallerUser(req: Request, res: Response) {
  const claims = extractClaims(req);
  const { sub } = claims;

  if (!sub) {
    badRequest(res, 'Cognito sub is missing from claims');
    return null;
  }

  const identity = await findIdentityBySub(sub);
  if (!identity) {
    notFound(res, 'User not registered');
    return null;
  }

  const user = await findUserByUserId(identity.userId);
  if (!user) {
    notFound(res, 'User record not found');
    return null;
  }

  return user;
}

// ---------------------------------------------------------------------------
// POST /auth/profile/contact/email/start
// ---------------------------------------------------------------------------

export async function selfEmailStart(req: Request, res: Response): Promise<void> {
  try {
    const user = await resolveCallerUser(req, res);
    if (!user) return;

    const parsed = emailStartSchema.safeParse(req.body);
    if (!parsed.success) {
      badRequest(res, parsed.error.errors[0].message);
      return;
    }

    const normalizedEmail = parsed.data.email.toLowerCase().trim();

    // Already has this canonical email
    if (user.email && user.email.toLowerCase() === normalizedEmail) {
      badRequest(res, 'This email is already your canonical email');
      return;
    }

    // Global uniqueness check
    const available = await assertEmailAvailable(normalizedEmail, user.userId);
    if (!available) {
      conflict(res, 'This email is already in use by another user');
      return;
    }

    await setPendingEmail(user.TenantId, user.userId, normalizedEmail);

    ok(res, {
      message: 'Pending email saved. Log in with Google using this email to complete linking.',
      pendingEmail: normalizedEmail,
    });
  } catch (error) {
    logger.error('selfEmailStart error', { error });
    internalError(res, 'Failed to start email linking');
  }
}

// ---------------------------------------------------------------------------
// POST /auth/profile/contact/phone/start
// ---------------------------------------------------------------------------

export async function selfPhoneStart(req: Request, res: Response): Promise<void> {
  try {
    const user = await resolveCallerUser(req, res);
    if (!user) return;

    const parsed = phoneStartSchema.safeParse(req.body);
    if (!parsed.success) {
      badRequest(res, parsed.error.errors[0].message);
      return;
    }

    const formattedPhone = validateAndFormatIndianPhone(parsed.data.phoneNumber);
    if (!formattedPhone) {
      badRequest(res, 'Invalid Indian phone number');
      return;
    }

    // Already has this canonical phone
    if (user.phoneNumber === formattedPhone) {
      badRequest(res, 'This phone number is already your canonical phone');
      return;
    }

    // Global uniqueness check
    const available = await assertPhoneAvailable(formattedPhone, user.userId);
    if (!available) {
      conflict(res, 'This phone number is already in use by another user');
      return;
    }

    await setPendingPhone(user.TenantId, user.userId, formattedPhone);

    const otpResult = await createPhoneLinkOtp({
      phoneNumber: formattedPhone,
      tenantId: user.TenantId,
      requestedByUserId: user.userId,
      targetUserId: user.userId,
    });

    ok(res, {
      message: 'OTP sent to the phone number. Enter it to verify.',
      pendingPhoneNumber: formattedPhone,
      ...(otpResult.testOtp ? { testOtp: otpResult.testOtp } : {}),
    });
  } catch (error) {
    logger.error('selfPhoneStart error', { error });
    internalError(res, 'Failed to start phone linking');
  }
}

// ---------------------------------------------------------------------------
// POST /auth/profile/contact/phone/verify
// ---------------------------------------------------------------------------

export async function selfPhoneVerify(req: Request, res: Response): Promise<void> {
  try {
    const user = await resolveCallerUser(req, res);
    if (!user) return;

    const parsed = phoneVerifySchema.safeParse(req.body);
    if (!parsed.success) {
      badRequest(res, parsed.error.errors[0].message);
      return;
    }

    const formattedPhone = validateAndFormatIndianPhone(parsed.data.phoneNumber);
    if (!formattedPhone) {
      badRequest(res, 'Invalid Indian phone number');
      return;
    }

    // Must match the pending phone
    if (user.pendingPhoneNumber !== formattedPhone) {
      badRequest(res, 'Phone number does not match your pending phone');
      return;
    }

    // Re-check uniqueness right before promotion
    const available = await assertPhoneAvailable(formattedPhone, user.userId);
    if (!available) {
      conflict(res, 'This phone number was claimed by another user');
      return;
    }

    const result = await verifyPhoneLinkOtp({
      phoneNumber: formattedPhone,
      targetUserId: user.userId,
      otp: parsed.data.otp,
    });

    if (!result.valid) {
      badRequest(res, result.reason || 'OTP verification failed');
      return;
    }

    // Promote pending phone to canonical
    const promoted = await promotePendingPhone(user.TenantId, user.userId, formattedPhone);
    if (!promoted) {
      internalError(res, 'Failed to promote phone number');
      return;
    }

    ok(res, {
      message: 'Phone number verified and linked successfully',
      phoneNumber: formattedPhone,
      phoneVerified: true,
    });
  } catch (error) {
    logger.error('selfPhoneVerify error', { error });
    internalError(res, 'Failed to verify phone');
  }
}

// ---------------------------------------------------------------------------
// Admin-managed endpoints (Phase 5)
// POST /users/:userId/contact/email/start
// ---------------------------------------------------------------------------

export async function adminEmailStart(req: Request, res: Response): Promise<void> {
  try {
    const caller = await resolveCallerUser(req, res);
    if (!caller) return;

    if (caller.role !== 'ADMIN') {
      forbidden(res, 'ADMIN_ONLY', 'Only admins can manage member contacts');
      return;
    }

    const targetUserId = req.params.userId;
    if (!targetUserId) {
      badRequest(res, 'Target userId is required');
      return;
    }

    const target = await findUserByUserId(targetUserId);
    if (!target) {
      notFound(res, 'Target user not found');
      return;
    }

    if (target.TenantId !== caller.TenantId) {
      forbidden(res, 'CROSS_TENANT', 'Cannot modify users in another tenant');
      return;
    }

    const parsed = emailStartSchema.safeParse(req.body);
    if (!parsed.success) {
      badRequest(res, parsed.error.errors[0].message);
      return;
    }

    const normalizedEmail = parsed.data.email.toLowerCase().trim();

    if (target.email && target.email.toLowerCase() === normalizedEmail) {
      badRequest(res, 'This email is already the canonical email for this user');
      return;
    }

    const available = await assertEmailAvailable(normalizedEmail, target.userId);
    if (!available) {
      conflict(res, 'This email is already in use by another user');
      return;
    }

    await setPendingEmail(target.TenantId, target.userId, normalizedEmail);

    ok(res, {
      message: 'Pending email saved for user. It will activate when they log in with Google using this email.',
      targetUserId: target.userId,
      pendingEmail: normalizedEmail,
    });
  } catch (error) {
    logger.error('adminEmailStart error', { error });
    internalError(res, 'Failed to start email linking for member');
  }
}

// ---------------------------------------------------------------------------
// POST /users/:userId/contact/phone/start
// ---------------------------------------------------------------------------

export async function adminPhoneStart(req: Request, res: Response): Promise<void> {
  try {
    const caller = await resolveCallerUser(req, res);
    if (!caller) return;

    if (caller.role !== 'ADMIN') {
      forbidden(res, 'ADMIN_ONLY', 'Only admins can manage member contacts');
      return;
    }

    const targetUserId = req.params.userId;
    if (!targetUserId) {
      badRequest(res, 'Target userId is required');
      return;
    }

    const target = await findUserByUserId(targetUserId);
    if (!target) {
      notFound(res, 'Target user not found');
      return;
    }

    if (target.TenantId !== caller.TenantId) {
      forbidden(res, 'CROSS_TENANT', 'Cannot modify users in another tenant');
      return;
    }

    const parsed = phoneStartSchema.safeParse(req.body);
    if (!parsed.success) {
      badRequest(res, parsed.error.errors[0].message);
      return;
    }

    const formattedPhone = validateAndFormatIndianPhone(parsed.data.phoneNumber);
    if (!formattedPhone) {
      badRequest(res, 'Invalid Indian phone number');
      return;
    }

    if (target.phoneNumber === formattedPhone) {
      badRequest(res, 'This phone number is already the canonical phone for this user');
      return;
    }

    const available = await assertPhoneAvailable(formattedPhone, target.userId);
    if (!available) {
      conflict(res, 'This phone number is already in use by another user');
      return;
    }

    await setPendingPhone(target.TenantId, target.userId, formattedPhone);

    const otpResult = await createPhoneLinkOtp({
      phoneNumber: formattedPhone,
      tenantId: target.TenantId,
      requestedByUserId: caller.userId,
      targetUserId: target.userId,
    });

    ok(res, {
      message: 'OTP sent to the phone number for verification.',
      targetUserId: target.userId,
      pendingPhoneNumber: formattedPhone,
      ...(otpResult.testOtp ? { testOtp: otpResult.testOtp } : {}),
    });
  } catch (error) {
    logger.error('adminPhoneStart error', { error });
    internalError(res, 'Failed to start phone linking for member');
  }
}

