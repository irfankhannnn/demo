/**
 * Phone authentication controller using Cognito Custom Auth
 * Single source of truth for phone-based login.
 *
 * Endpoints:
 *   POST /auth/phone/start   – initiate Custom Auth (sends OTP via Cognito trigger)
 *   POST /auth/phone/confirm  – verify OTP, return tokens + existingUser/needsOnboarding
 *   POST /auth/phone/onboard  – register new user (admin or invited member)
 */

import { Request, Response } from 'express';
import { z } from 'zod';
import { validateAndFormatIndianPhone } from '../utils/phoneValidation';
import { ok, badRequest, forbidden, internalError } from '../utils/http';
import { getAgencyConfig } from '../models/agencyConfigModel';
import { findInvitesByPhone, findInvitesByEmail, deleteInvite } from '../models/invitesModel';
import { findIdentityBySub } from '../models/authIdentitiesModel';
import { resolveUser } from '../utils/resolveUser';
import { resolveMemberUser } from '../utils/resolveMemberUser';
import { extractClaims } from '../utils/cognito';
import { setRefreshTokenCookie } from '../utils/cookies';
import { logger } from '../utils/logger';
import AWS from 'aws-sdk';

const cognito = new AWS.CognitoIdentityServiceProvider({ region: 'ap-south-1' });

/**
 * Reliably get user's phone number from access token
 * This is more reliable than extracting from JWT claims which may not include phone_number
 */
async function resolvePhoneNumberFromAccessToken(accessToken: string): Promise<string | null> {
  try {
    const userResult = await cognito.getUser({ AccessToken: accessToken }).promise();
    const phoneAttr = userResult.UserAttributes?.find(attr => attr.Name === 'phone_number');
    return phoneAttr?.Value || null;
  } catch (error) {
    logger.error('[resolvePhone] Error getting user attributes', { error });
    return null;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Maps phone number to email-shaped Cognito username
 * Required because User Pool enforces email-format usernames
 */
function phoneToCognitoUsername(phoneNumberE164: string): string {
  const digitsOnly = phoneNumberE164.replace(/\D/g, '');
  return `${digitsOnly}@phone.realityflow.local`;
}

function decodeJwtPayload(token: string): Record<string, any> | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const payloadBase64Url = parts[1];
    const payloadBase64 = payloadBase64Url.replace(/-/g, '+').replace(/_/g, '/');
    const padded = payloadBase64.padEnd(payloadBase64.length + ((4 - (payloadBase64.length % 4)) % 4), '=');
    const json = Buffer.from(padded, 'base64').toString('utf8');
    return JSON.parse(json);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const startOTPSchema = z.object({
  phoneNumber: z.string().min(10, 'Phone number is required'),
});

const confirmOTPSchema = z.object({
  phoneNumber: z.string().min(10, 'Phone number is required'),
  otp: z.string().length(6, 'OTP must be 6 digits'),
  session: z.string().min(1, 'Session is required'),
});

const onboardSchema = z.object({
  displayName: z.string().min(1, 'displayName is required'),
  role: z.enum(['ADMIN', 'MEMBER']),
  agencyName: z.string().optional(),
});

// ---------------------------------------------------------------------------
// POST /auth/phone/start
// ---------------------------------------------------------------------------

/**
 * Start phone authentication by initiating Cognito Custom Auth.
 * Auto-creates Cognito user if not found.
 */
export async function startPhoneAuthHandler(req: Request, res: Response) {
  try {
    const parseResult = startOTPSchema.safeParse(req.body);
    if (!parseResult.success) {
      return badRequest(res, parseResult.error.errors[0].message);
    }

    const { phoneNumber } = parseResult.data;

    // Validate and format phone number
    const formattedPhone = validateAndFormatIndianPhone(phoneNumber);
    if (!formattedPhone) {
      return badRequest(res, 'Invalid Indian phone number. Must start with +91 and have 10 digits.');
    }

    const userPoolId = process.env.COGNITO_USER_POOL_ID!;
    const clientId = process.env.COGNITO_CLIENT_ID!;
    const cognitoUsername = phoneToCognitoUsername(formattedPhone);

    // Ensure user exists in Cognito (auto-create if not)
    try {
      await cognito
        .adminGetUser({
          UserPoolId: userPoolId,
          Username: cognitoUsername,
        })
        .promise();
    } catch (error: any) {
      if (error.code === 'UserNotFoundException') {
        await cognito
          .adminCreateUser({
            UserPoolId: userPoolId,
            Username: cognitoUsername,
            UserAttributes: [
              { Name: 'phone_number', Value: formattedPhone },
              { Name: 'phone_number_verified', Value: 'false' },
            ],
            MessageAction: 'SUPPRESS',
          })
          .promise();
      } else {
        logger.error('[start] Error checking/creating Cognito user', { error });
        return internalError(res, 'Failed to prepare user account');
      }
    }

    // Initiate Custom Auth flow
    const authResult = await cognito
      .adminInitiateAuth({
        UserPoolId: userPoolId,
        ClientId: clientId,
        AuthFlow: 'CUSTOM_AUTH',
        AuthParameters: {
          USERNAME: cognitoUsername,
        },
      })
      .promise();

    if (authResult.ChallengeName === 'CUSTOM_CHALLENGE') {
      return ok(res, {
        message: 'OTP sent successfully',
        session: authResult.Session,
        challengeName: authResult.ChallengeName,
        expiresIn: 300,
      });
    } else {
      logger.error('[start] Unexpected challenge', { authResult });
      return internalError(res, 'Unexpected authentication challenge');
    }
  } catch (error) {
    logger.error('[start] Error', { error });
    return internalError(res, 'Failed to start phone authentication');
  }
}

// ---------------------------------------------------------------------------
// POST /auth/phone/confirm
// ---------------------------------------------------------------------------

/**
 * Confirm OTP, issue tokens, and determine if user needs onboarding.
 *
 * Response contract:
 *   existingUser: true  → user already onboarded, go to dashboard
 *   needsOnboarding: true → user must call POST /auth/phone/onboard
 */
export async function confirmPhoneAuthHandler(req: Request, res: Response) {
  try {
    const parseResult = confirmOTPSchema.safeParse(req.body);
    if (!parseResult.success) {
      return badRequest(res, parseResult.error.errors[0].message);
    }

    const { phoneNumber, otp, session } = parseResult.data;

    // Validate and format phone number
    const formattedPhone = validateAndFormatIndianPhone(phoneNumber);
    if (!formattedPhone) {
      return badRequest(res, 'Invalid Indian phone number');
    }

    const clientId = process.env.COGNITO_CLIENT_ID!;
    const userPoolId = process.env.COGNITO_USER_POOL_ID!;
    const cognitoUsername = phoneToCognitoUsername(formattedPhone);

    // Helper to mark phone as verified in Cognito (only after eligibility checks pass)
    async function markPhoneVerifiedIfPossible(): Promise<void> {
      try {
        await cognito
          .adminUpdateUserAttributes({
            UserPoolId: userPoolId,
            Username: cognitoUsername,
            UserAttributes: [{ Name: 'phone_number_verified', Value: 'true' }],
          })
          .promise();
        logger.info('[confirm] Marked phone_number_verified=true for', { phone: formattedPhone });
      } catch (e) {
        logger.error('[confirm] Failed to mark phone_number_verified', { error: e });
      }
    }

    // Respond to the challenge with OTP
    const authResult = await cognito
      .respondToAuthChallenge({
        ClientId: clientId,
        ChallengeName: 'CUSTOM_CHALLENGE',
        Session: session,
        ChallengeResponses: {
          USERNAME: cognitoUsername,
          ANSWER: otp,
        },
      })
      .promise();

    // Wrong OTP – Cognito returns another challenge
    if (authResult.ChallengeName === 'CUSTOM_CHALLENGE') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid OTP. Please try again.',
        session: authResult.Session,
        attemptsRemaining: 3,
      });
    }

    // OTP correct – must have tokens
    if (!authResult.AuthenticationResult) {
      logger.error('[confirm] Unexpected auth result', { authResult });
      return internalError(res, 'Authentication failed');
    }

    const accessToken = authResult.AuthenticationResult.AccessToken;
    const idToken = authResult.AuthenticationResult.IdToken;

    if (!accessToken || !idToken) {
      return internalError(res, 'Authentication succeeded but tokens were missing');
    }

    // Extract sub from ID token
    const idTokenPayload = decodeJwtPayload(idToken);
    const sub = idTokenPayload?.sub as string | undefined;

    if (!sub) {
      return internalError(res, 'Could not determine user identity');
    }

    // --- Run universal resolution pipeline ---
    let resolved;
    try {
      resolved = await resolveUser(sub, 'phone', undefined, formattedPhone);
    } catch (resolveErr) {
      logger.error('[confirm] resolveUser error', { error: resolveErr });
      return internalError(res, 'Failed to resolve user identity');
    }

    if (resolved.isNewUser === false) {
      // --- Existing or auto-linked user ---
      const { user, agency } = resolved;

      await markPhoneVerifiedIfPossible();

      if (authResult.AuthenticationResult?.RefreshToken) {
        setRefreshTokenCookie(res, authResult.AuthenticationResult.RefreshToken);
      }

      return ok(res, {
        message: 'Login successful',
        tokens: {
          idToken,
          accessToken,
        },
        user: {
          userId: user.userId,
          sub,
          phoneNumber: formattedPhone,
          displayName: user.displayName,
          role: user.role,
          tenantId: user.TenantId,
          status: user.status,
        },
        agency: agency ? { agencyName: agency.agencyName, status: agency.status } : null,
        existingUser: true,
        newUser: false,
        needsOnboarding: false,
      });
    }

    // --- New user: check for pending phone invites ---
    logger.info('[confirm] New user (not resolved)', { sub });

    let pendingInvites: any[] = [];
    try {
      pendingInvites = await findInvitesByPhone(formattedPhone);
      logger.info(`[confirm] Found ${pendingInvites.length} pending invites for phone ${formattedPhone}`);
    } catch (inviteErr) {
      logger.error('[confirm] Failed to check invites', { error: inviteErr });
    }

    if (pendingInvites.length === 0) {
      return forbidden(res, 'NOT_ONBOARDED', 'You are not onboarded. Please contact the administrator to get onboarded.');
    }

    await markPhoneVerifiedIfPossible();

    if (authResult.AuthenticationResult?.RefreshToken) {
      setRefreshTokenCookie(res, authResult.AuthenticationResult.RefreshToken);
    }

    return ok(res, {
      message: 'Phone verified successfully',
      tokens: {
        idToken,
        accessToken,
      },
      user: { sub, phoneNumber: formattedPhone },
      existingUser: false,
      newUser: true,
      needsOnboarding: true,
      hasPendingInvite: true,
      pendingInvitesCount: pendingInvites.length,
    });
  } catch (error: any) {
    logger.error('[confirm] Error', { error });

    if (error.code === 'NotAuthorizedException') {
      return badRequest(res, 'Invalid or expired OTP');
    } else if (error.code === 'ExpiredCodeException') {
      return badRequest(res, 'OTP has expired. Please request a new one.');
    } else {
      return internalError(res, 'Failed to verify OTP');
    }
  }
}

// ---------------------------------------------------------------------------
// POST /auth/phone/onboard
// ---------------------------------------------------------------------------

/**
 * Register a new phone-authenticated user.
 * Requires a valid access token from /auth/phone/confirm.
 *
 * - ADMIN: creates admin user + agency config
 * - MEMBER: requires a pending phone invite; creates member under inviter's tenant
 */
export async function onboardPhoneUserHandler(req: Request, res: Response) {
  try {
    // Extract claims from the access token set by authMiddleware
    const claims = extractClaims(req);
    const { sub } = claims;
    
    // Get access token from custom header (ID Token is in Authorization header for API Gateway)
    const accessToken = req.headers['x-access-token'] as string;

    if (!sub) {
      return badRequest(res, 'Cognito sub is missing from token');
    }

    if (!accessToken) {
      return badRequest(res, 'Access token is required');
    }

    // Validate body
    const parsed = onboardSchema.safeParse(req.body);
    if (!parsed.success) {
      return badRequest(res, parsed.error.errors.map((e) => e.message).join(', '));
    }

    const { displayName, role, agencyName } = parsed.data;

    // Prevent double-onboarding via identity check
    const existingIdentity = await findIdentityBySub(sub);
    if (existingIdentity) {
      const { findUserByUserId } = await import('../models/usersModel');
      const existingUser = await findUserByUserId(existingIdentity.userId);
      logger.info('[onboard] User already onboarded', { sub });
      const agency = existingUser ? await getAgencyConfig(existingUser.TenantId) : null;
      return ok(res, {
        message: 'User already onboarded',
        user: existingUser
          ? {
              userId: existingUser.userId,
              sub: existingUser.cognitoSub,
              phoneNumber: existingUser.phoneNumber,
              displayName: existingUser.displayName,
              role: existingUser.role,
              tenantId: existingUser.TenantId,
              status: existingUser.status,
            }
          : null,
        agency: agency ? { agencyName: agency.agencyName, status: agency.status } : null,
        existingUser: true,
      });
    }

    // Reliably resolve phone number from token
    logger.info('[onboard] Resolving phone number from token for user', { sub });
    const phoneNumber = await resolvePhoneNumberFromAccessToken(accessToken);
    
    if (!phoneNumber) {
      logger.error('[onboard] Failed to resolve phone number from token for user', { sub });
      return badRequest(res, 'Unable to retrieve phone number from your account. Please re-login.');
    }

    // Block self-admin onboarding - admins must be pre-onboarded via onboarding page
    if (role === 'ADMIN') {
      return forbidden(res, 'NOT_ONBOARDED', 'Admin self-registration is not allowed. Please contact the SaaS administrator to get onboarded.');
    }

    // --- Member onboarding (requires invite) ---
    logger.info('[onboard] Looking up phone invites for', { phoneNumber });
    let pendingInvites = await findInvitesByPhone(phoneNumber);
    
    // Filter invites to ensure they are valid (PENDING + not expired)
    const now = new Date().toISOString();
    pendingInvites = pendingInvites.filter(invite => 
      invite.status === 'PENDING' && 
      invite.expiresAt > now
    );
    
    logger.info(`[onboard] Found ${pendingInvites.length} valid pending invites after filtering`);
    
    if (pendingInvites.length === 0) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'No valid invitation found for this phone number. Please contact your administrator.',
        code: 'NOT_INVITED',
      });
    }

    // Use first matching invite
    const invite = pendingInvites[0];
    
    // Validate tenant integrity
    if (!invite.TenantId) {
      logger.error('[onboard] Invalid invite: missing TenantId');
      return internalError(res, 'Invalid invitation data. Please contact support.');
    }

    // Check if email or phone is already registered in another agency
    const { findUserByEmail, findUserByPhone } = await import('../models/usersModel');
    if (invite.inviteeEmail) {
      const existingByEmail = await findUserByEmail(invite.inviteeEmail);
      if (existingByEmail && existingByEmail.TenantId !== invite.TenantId) {
        return forbidden(
          res,
          'EMAIL_ALREADY_REGISTERED',
          'This email is already registered with another agency. Please use a different email or contact support.'
        );
      }
    }

    const existingByPhone = await findUserByPhone(phoneNumber);
    if (existingByPhone && existingByPhone.TenantId !== invite.TenantId) {
      return forbidden(
        res,
        'PHONE_ALREADY_REGISTERED',
        'This phone number is already registered with another agency. Please use a different phone number or contact support.'
      );
    }
    
    logger.info('[onboard] Found valid invite, resolving MEMBER under tenant', { tenantId: invite.TenantId });

    // Use resolveMemberUser to create/link member
    const result = await resolveMemberUser(
      sub,
      'phone',
      invite.TenantId,
      invite.inviteeEmail,
      phoneNumber,
      displayName
    );

    if (result.isNewMember === null) {
      // Check if it failed due to duplicate email/phone
      const dupeCheckEmail = invite.inviteeEmail ? await findUserByEmail(invite.inviteeEmail) : null;
      const dupeCheckPhone = await findUserByPhone(phoneNumber);

      if (dupeCheckEmail && dupeCheckEmail.TenantId !== invite.TenantId) {
        return forbidden(
          res,
          'EMAIL_ALREADY_REGISTERED',
          'This email is already registered with another agency. Please use a different email or contact support.'
        );
      }

      if (dupeCheckPhone && dupeCheckPhone.TenantId !== invite.TenantId) {
        return forbidden(
          res,
          'PHONE_ALREADY_REGISTERED',
          'This phone number is already registered with another agency. Please use a different phone number or contact support.'
        );
      }

      return internalError(res, 'Failed to resolve member');
    }

    await deleteInvite(invite.TenantId, invite.inviteCode);
    logger.info('[onboard] Member resolved, invite deleted');

    return ok(res, {
      message: 'Member registered successfully',
      user: {
        userId: result.user.userId,
        sub: result.user.cognitoSub,
        phoneNumber: result.user.phoneNumber,
        displayName: result.user.displayName,
        role: result.user.role,
        tenantId: result.user.TenantId,
        status: result.user.status,
      },
      agency: result.agency ? { agencyName: result.agency.agencyName, status: result.agency.status } : null,
      newUser: result.isNewMember,
    });
  } catch (error) {
    logger.error('[onboard] Error', { error });
    return internalError(res, 'Failed to complete onboarding');
  }
}


