/**
 * Phone OTP login via Cognito CUSTOM_AUTH.
 *
 *   POST /auth/phone/start    { phone }               → { session, phone, expiresInSeconds }
 *   POST /auth/phone/confirm  { phone, otp, session } → { accessToken, idToken, expiresIn, user{…, isNew} }
 *                                                       + Set-Cookie: mp_refresh
 *
 * The pool's username attribute is phone_number, so the E.164 phone IS the
 * Cognito username — no synthetic e-mail alias. OTP generation/SMS/verify
 * live in the three trigger Lambdas declared in infra/cfn-backend.yaml.
 */
import { Request, Response } from 'express';
import { z } from 'zod';
import {
  AdminCreateUserCommand,
  AdminEnableUserCommand,
  AdminGetUserCommand,
  AdminInitiateAuthCommand,
  RespondToAuthChallengeCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { getConfig } from '../config/config';
import { getCognito } from '../utils/aws';
import { normalizePhone } from '../utils/phone';
import { ok, badRequest, forbidden, internalError, tooManyRequests } from '../utils/http';
import { logger } from '../utils/logger';
import { findUserById } from '../models/usersModel';
import { buildSessionResponse, markPhoneVerified, readIdTokenClaims, resolveUser } from '../services/sessionService';

const OTP_TTL_SECONDS = 300; // must match the CreateAuthChallenge trigger's ttl

const startSchema = z.object({
  phone: z.string({ required_error: 'phone is required' }).min(1, 'phone is required'),
});

const confirmSchema = z.object({
  phone: z.string({ required_error: 'phone is required' }).min(1, 'phone is required'),
  otp: z.string({ required_error: 'otp is required' }).regex(/^\d{6}$/, 'otp must be 6 digits'),
  session: z.string({ required_error: 'session is required' }).min(1, 'session is required'),
});

function errName(err: unknown): string {
  return (err as { name?: string })?.name ?? '';
}

function firstIssue(e: z.ZodError): string {
  return e.errors[0]?.message ?? 'Invalid request body';
}

/**
 * Make sure a Cognito user exists for this phone and is enabled. Returns
 * false (after responding) when the account is disabled for a reason other
 * than self-deletion.
 */
async function ensureCognitoUser(phone: string, res: Response): Promise<boolean> {
  const { COGNITO_USER_POOL_ID } = getConfig();
  const cognito = getCognito();

  try {
    const existing = await cognito.send(new AdminGetUserCommand({ UserPoolId: COGNITO_USER_POOL_ID, Username: phone }));
    if (existing.Enabled === false) {
      const sub = existing.UserAttributes?.find((a) => a.Name === 'sub')?.Value;
      const row = sub ? await findUserById(sub) : null;
      if (row?.status === 'DELETED') {
        // Consumer deleted their account and is signing up again — re-enable
        // so the OTP flow can proceed; confirm() reactivates the row.
        await cognito.send(new AdminEnableUserCommand({ UserPoolId: COGNITO_USER_POOL_ID, Username: phone }));
        logger.info('phone.start.reenabled_deleted_user', { phone });
        return true;
      }
      forbidden(res, 'This account is disabled', 'account_disabled');
      return false;
    }
    return true;
  } catch (err) {
    if (errName(err) !== 'UserNotFoundException') throw err;
  }

  await cognito.send(
    new AdminCreateUserCommand({
      UserPoolId: COGNITO_USER_POOL_ID,
      Username: phone,
      UserAttributes: [
        { Name: 'phone_number', Value: phone },
        { Name: 'phone_number_verified', Value: 'false' },
      ],
      MessageAction: 'SUPPRESS',
    })
  );
  return true;
}

export async function startPhoneAuthHandler(req: Request, res: Response): Promise<void> {
  const parsed = startSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    badRequest(res, firstIssue(parsed.error), 'validation_error');
    return;
  }

  const phone = normalizePhone(parsed.data.phone);
  if (!phone) {
    badRequest(res, 'Enter a valid mobile number (10-digit Indian number or E.164 with country code)', 'invalid_phone');
    return;
  }

  try {
    if (!(await ensureCognitoUser(phone, res))) return;

    const { COGNITO_USER_POOL_ID, COGNITO_CLIENT_ID } = getConfig();
    const auth = await getCognito().send(
      new AdminInitiateAuthCommand({
        UserPoolId: COGNITO_USER_POOL_ID,
        ClientId: COGNITO_CLIENT_ID,
        AuthFlow: 'CUSTOM_AUTH',
        AuthParameters: { USERNAME: phone },
      })
    );

    if (auth.ChallengeName !== 'CUSTOM_CHALLENGE' || !auth.Session) {
      logger.error('phone.start.unexpected_challenge', { phone, challenge: auth.ChallengeName });
      internalError(res, 'Unexpected authentication challenge');
      return;
    }

    ok(res, { session: auth.Session, phone, expiresInSeconds: OTP_TTL_SECONDS });
  } catch (err) {
    const name = errName(err);
    logger.error('phone.start.failed', { phone, error: err });
    if (name === 'TooManyRequestsException' || name === 'LimitExceededException') {
      tooManyRequests(res, 'Too many OTP requests. Try again later.');
    } else if (name === 'NotAuthorizedException') {
      forbidden(res, 'This account cannot sign in right now', 'account_disabled');
    } else {
      internalError(res, 'Could not send OTP');
    }
  }
}

export async function confirmPhoneAuthHandler(req: Request, res: Response): Promise<void> {
  const parsed = confirmSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    badRequest(res, firstIssue(parsed.error), 'validation_error');
    return;
  }

  const phone = normalizePhone(parsed.data.phone);
  if (!phone) {
    badRequest(res, 'Enter a valid mobile number', 'invalid_phone');
    return;
  }
  const { otp, session } = parsed.data;

  try {
    const { COGNITO_CLIENT_ID } = getConfig();
    const result = await getCognito().send(
      new RespondToAuthChallengeCommand({
        ClientId: COGNITO_CLIENT_ID,
        ChallengeName: 'CUSTOM_CHALLENGE',
        Session: session,
        ChallengeResponses: { USERNAME: phone, ANSWER: otp },
      })
    );

    // Wrong code: Cognito re-issues the challenge with a fresh session the
    // client must use for its next attempt (3 attempts total, see the
    // DefineAuthChallenge trigger).
    if (result.ChallengeName === 'CUSTOM_CHALLENGE') {
      badRequest(res, 'Incorrect OTP. Please try again.', 'invalid_otp', { session: result.Session ?? null });
      return;
    }

    const tokens = result.AuthenticationResult;
    if (!tokens?.AccessToken || !tokens.IdToken) {
      logger.error('phone.confirm.no_tokens', { phone });
      internalError(res, 'Authentication succeeded but no tokens were issued');
      return;
    }

    const claims = readIdTokenClaims(tokens.IdToken);
    if (!claims) {
      internalError(res, 'Could not read identity from token');
      return;
    }
    if (!claims.phone) claims.phone = phone;

    const { user, isNew } = await resolveUser(claims, 'phone');
    if (!claims.phoneVerified) await markPhoneVerified(phone);

    logger.info('phone.confirm.ok', { userId: user.UserId, isNew });
    ok(
      res,
      buildSessionResponse(
        res,
        {
          accessToken: tokens.AccessToken,
          idToken: tokens.IdToken,
          refreshToken: tokens.RefreshToken,
          expiresIn: tokens.ExpiresIn ?? 3600,
        },
        user,
        isNew
      )
    );
  } catch (err) {
    const name = errName(err);
    if (name === 'NotAuthorizedException' || name === 'CodeMismatchException') {
      // Session used up (3 wrong answers) or otherwise invalid — start over.
      badRequest(res, 'OTP incorrect or session expired. Request a new code.', 'invalid_otp');
      return;
    }
    if (name === 'ExpiredCodeException') {
      badRequest(res, 'OTP has expired. Request a new code.', 'otp_expired');
      return;
    }
    if (name === 'TooManyRequestsException') {
      tooManyRequests(res, 'Too many attempts. Try again later.');
      return;
    }
    logger.error('phone.confirm.failed', { phone, error: err });
    internalError(res, 'Could not verify OTP');
  }
}
