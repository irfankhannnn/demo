import { v4 as uuidv4 } from 'uuid';
import { findIdentityBySub, createIdentity, AuthIdentityItem } from '../models/authIdentitiesModel';
import {
  findUserByUserId,
  findUserByEmail,
  findUserByPhone,
  findUserByPendingEmail,
  createMemberUser,
  enrichUserProfile,
  updateLastLogin,
  promotePendingEmail,
  assertEmailAvailable,
  UserItem,
} from '../models/usersModel';
import { getAgencyConfig, AgencyConfigItem } from '../models/agencyConfigModel';
import { logger } from '../utils/logger';

export interface ResolveMemberResult {
  user: UserItem;
  agency: AgencyConfigItem | null;
  identity: AuthIdentityItem;
  isNewMember: boolean;
}

export interface ResolveMemberNotFoundResult {
  isNewMember: null;
}

/**
 * Member resolution pipeline for invite-based onboarding.
 * Given a Cognito sub, tenantId (from invite), and optional email/phone:
 *
 * Step 1: Fast path — look up AUTH_IDENTITIES by sub.
 *         If found, verify tenant matches and return existing user.
 *
 * Step 2: Find existing member by email or phone (globally unique).
 *         If found in same tenant → link new identity to existing member.
 *
 * Step 3: No existing member → create new member user + link identity.
 *
 * Enforces global uniqueness of email/phone.
 */
export async function resolveMemberUser(
  sub: string,
  provider: 'google' | 'phone',
  tenantId: string,
  email?: string,
  phone?: string,
  displayName?: string
): Promise<ResolveMemberResult | ResolveMemberNotFoundResult> {
  const normalizedEmail = email?.toLowerCase().trim();

  // -------------------------------------------------------------------------
  // Step 1: Fast path — identity already mapped
  // -------------------------------------------------------------------------
  const existingIdentity = await findIdentityBySub(sub);

  if (existingIdentity) {
    const user = await findUserByUserId(existingIdentity.userId);

    if (user) {
      // Verify tenant matches (member cannot switch tenants)
      if (user.TenantId !== tenantId) {
        logger.error(
          '[resolveMemberUser] Tenant mismatch',
          { identityTenant: existingIdentity.tenantId, expected: tenantId }
        );
        return { isNewMember: null };
      }

      const agency = await getAgencyConfig(user.TenantId);

      // Update last login
      await updateLastLogin(user.TenantId, user.userId).catch((e) =>
        logger.error('[resolveMemberUser] updateLastLogin error', { error: e })
      );

      // Phase 4: If Google login email matches pendingEmail, promote it
      if (
        provider === 'google' &&
        normalizedEmail &&
        user.pendingEmail &&
        user.pendingEmail.toLowerCase() === normalizedEmail
      ) {
        const emailFree = await assertEmailAvailable(normalizedEmail, user.userId);
        if (emailFree) {
          const promoted = await promotePendingEmail(user.TenantId, user.userId, normalizedEmail);
          if (promoted) {
            logger.info('[resolveMemberUser] Promoted pendingEmail to canonical', { email: normalizedEmail });
          }
        }
      }

      // Enrich profile with any missing fields from current login
      await enrichUserProfile(user.TenantId, user.userId, {
        email: normalizedEmail,
        phoneNumber: phone,
      }).catch((e) => logger.error('[resolveMemberUser] enrichUserProfile error', { error: e }));

      // Re-fetch user to capture any promotions
      const refreshedFastPath = await findUserByUserId(user.userId);
      return { user: refreshedFastPath || user, agency, identity: existingIdentity, isNewMember: false };
    }

    // Identity row exists but user record is missing — data inconsistency
    logger.error(
      '[resolveMemberUser] Identity found but user missing',
      { sub, userId: existingIdentity.userId }
    );
    return { isNewMember: null };
  }

  // -------------------------------------------------------------------------
  // Step 2: Find existing member by email or phone (global lookup)
  // -------------------------------------------------------------------------
  let existingMember: UserItem | null = null;

  if (normalizedEmail) {
    existingMember = await findUserByEmail(normalizedEmail);
  }

  if (!existingMember && phone) {
    existingMember = await findUserByPhone(phone);
  }

  // Step 2b: For Google login, also check pendingEmail field (phone-first users who set a pending email)
  if (!existingMember && normalizedEmail && provider === 'google') {
    existingMember = await findUserByPendingEmail(normalizedEmail);
    if (existingMember) {
      logger.info('[resolveMemberUser] Found existing member via pendingEmail match', { userId: existingMember.userId });
    }
  }

  // -------------------------------------------------------------------------
  // Step 2a: Existing member found — link new identity
  // -------------------------------------------------------------------------
  if (existingMember) {
    if (!existingMember.userId || !existingMember.SK || !existingMember.TenantId) {
      logger.error('[resolveMemberUser] Existing member record is malformed', { member: existingMember });
      return { isNewMember: null };
    }

    // Verify tenant matches
    if (existingMember.TenantId !== tenantId) {
      logger.error(
        '[resolveMemberUser] Existing member in different tenant',
        { memberTenant: existingMember.TenantId, expected: tenantId }
      );
      return { isNewMember: null };
    }

    logger.info(
      '[resolveMemberUser] Linking new sub to existing member',
      { userId: existingMember.userId, sub }
    );

    let identity: AuthIdentityItem;
    try {
      identity = await createIdentity({
        sub,
        userId: existingMember.userId,
        tenantId,
        provider,
        email: normalizedEmail,
        phone,
      });
    } catch (err: any) {
      if (err?.code === 'ConditionalCheckFailedException') {
        // Race: identity was created by a concurrent request, re-fetch
        const retried = await findIdentityBySub(sub);
        if (retried) {
          const user = await findUserByUserId(retried.userId);
          if (user) {
            const agency = await getAgencyConfig(user.TenantId);
            await updateLastLogin(user.TenantId, user.userId).catch(() => undefined);
            return { user, agency, identity: retried, isNewMember: false };
          }
        }
      }
      throw err;
    }

    const agency = await getAgencyConfig(tenantId);

    await updateLastLogin(tenantId, existingMember.userId).catch((e) =>
      logger.error('[resolveMemberUser] updateLastLogin error', { error: e })
    );

    // Enrich any missing fields on the canonical user record
    await enrichUserProfile(tenantId, existingMember.userId, {
      email: normalizedEmail,
      phoneNumber: phone,
    }).catch((e) => logger.error('[resolveMemberUser] enrichUserProfile error', { error: e }));

    // Promote pendingEmail if this Google login matched via pendingEmail
    if (
      provider === 'google' &&
      normalizedEmail &&
      existingMember.pendingEmail?.toLowerCase() === normalizedEmail
    ) {
      const emailFree = await assertEmailAvailable(normalizedEmail, existingMember.userId);
      if (emailFree) {
        const promoted = await promotePendingEmail(existingMember.TenantId, existingMember.userId, normalizedEmail);
        if (promoted) {
          logger.info('[resolveMemberUser] Promoted pendingEmail to canonical via new identity link', { email: normalizedEmail });
        }
      }
    }

    // Re-fetch to return enriched version
    const refreshedUser = (await findUserByUserId(existingMember.userId)) || existingMember;
    return { user: refreshedUser, agency, identity, isNewMember: false };
  }

  // -------------------------------------------------------------------------
  // Step 3: No existing member — create new member + link identity
  // -------------------------------------------------------------------------

  // Final duplicate-prevention guard before any creation
  if (normalizedEmail) {
    const dupeByEmail = await findUserByEmail(normalizedEmail);
    if (dupeByEmail) {
      logger.error('[resolveMemberUser] Duplicate guard: member already exists by canonical email', { email: normalizedEmail, userId: dupeByEmail.userId });
      return { isNewMember: null };
    }
    const dupeByPending = await findUserByPendingEmail(normalizedEmail);
    if (dupeByPending) {
      logger.error('[resolveMemberUser] Duplicate guard: member already exists by pendingEmail', { email: normalizedEmail, userId: dupeByPending.userId });
      return { isNewMember: null };
    }
  }
  if (phone) {
    const dupeByPhone = await findUserByPhone(phone);
    if (dupeByPhone) {
      logger.error('[resolveMemberUser] Duplicate guard: member already exists by canonical phone', { phone, userId: dupeByPhone.userId });
      return { isNewMember: null };
    }
  }

  logger.info('[resolveMemberUser] Creating new member for tenant', { tenantId, sub });

  const userId = uuidv4();
  const displayName_ = displayName || normalizedEmail?.split('@')[0] || phone || userId.slice(0, 8);

  const newMember = await createMemberUser({
    tenantId,
    cognitoSub: sub,
    userId,
    email: normalizedEmail,
    displayName: displayName_,
    phoneNumber: phone,
    authMethod: provider,
  });

  let identity: AuthIdentityItem;
  try {
    identity = await createIdentity({
      sub,
      userId,
      tenantId,
      provider,
      email: normalizedEmail,
      phone,
    });
  } catch (err: any) {
    if (err?.code === 'ConditionalCheckFailedException') {
      // Race: some other request also created identity at the same time
      const retried = await findIdentityBySub(sub);
      if (retried) {
        const user = await findUserByUserId(retried.userId);
        if (user) {
          const agency = await getAgencyConfig(user.TenantId);
          await updateLastLogin(user.TenantId, user.userId).catch(() => undefined);
          return { user, agency, identity: retried, isNewMember: false };
        }
      }
    }
    throw err;
  }

  const agency = await getAgencyConfig(tenantId);
  return { user: newMember, agency, identity, isNewMember: true };
}
