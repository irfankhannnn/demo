import { v4 as uuidv4 } from 'uuid';
import { findIdentityBySub, createIdentity, AuthIdentityItem } from '../models/authIdentitiesModel';
import {
  findUserByUserId,
  findUserByPhone,
  findAdminByTenantId,
  createAdminUser,
  enrichUserProfile,
  updateLastLogin,
  promotePendingEmail,
  reconcilePhoneGsiIfNeeded,
  assertEmailAvailable,
  UserItem,
} from '../models/usersModel';
import { findAgencyByAdminEmail, findAgencyByAdminPhone, getAgencyConfig, AgencyConfigItem } from '../models/agencyConfigModel';
import { logger } from '../utils/logger';

export interface ResolveUserResult {
  user: UserItem;
  agency: AgencyConfigItem | null;
  identity: AuthIdentityItem;
  isNewUser: boolean;
}

export interface ResolveUserNewResult {
  isNewUser: true;
}

/**
 * Universal resolution pipeline.
 * Given a Cognito sub + optional email/phone from token claims:
 *
 * Step 1: Fast path — look up AUTH_IDENTITIES by sub.
 *         If found, resolve user and enrich any missing profile fields.
 *
 * Step 2: Tenant resolution — find the agency this identity belongs to
 *         via adminEmail or adminPhone lookup in AGENCY_CONFIG_TABLE.
 *
 * Step 3: Find the existing ADMIN for that tenant.
 *
 * Step 4a: Admin exists → link new identity to existing admin.
 * Step 4b: No admin found → create new admin user, link identity.
 * Step 4c: No tenant resolved → return { isNewUser: true }.
 *
 * Invariant: At most one ADMIN per tenant. Enforced before any creation.
 */
export async function resolveUser(
  sub: string,
  provider: 'google' | 'phone',
  email?: string,
  phone?: string
): Promise<ResolveUserResult | ResolveUserNewResult> {
  const normalizedEmail = email?.toLowerCase().trim();

  // -------------------------------------------------------------------------
  // Step 1: Fast path — identity already mapped
  // -------------------------------------------------------------------------
  const existingIdentity = await findIdentityBySub(sub);

  if (existingIdentity) {
    const user = await findUserByUserId(existingIdentity.userId);

    if (user) {
      const agency = await getAgencyConfig(user.TenantId);

      // Update last login
      await updateLastLogin(user.TenantId, user.userId).catch((e) =>
        logger.error('[resolveUser] updateLastLogin error', { error: e })
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
            logger.info('[resolveUser] Promoted pendingEmail to canonical', { email: normalizedEmail });
          }
        }
      }

      // Enrich profile with any missing fields from current login
      await enrichUserProfile(user.TenantId, user.userId, {
        email: normalizedEmail,
        phoneNumber: phone,
      }).catch((e) => logger.error('[resolveUser] enrichUserProfile error', { error: e }));

      await reconcilePhoneGsiIfNeeded(user).catch((e) =>
        logger.error('[resolveUser] reconcilePhoneGsiIfNeeded error', { error: e })
      );

      // Re-fetch user to capture any promotions
      const refreshed = await findUserByUserId(user.userId);
      return { user: refreshed || user, agency, identity: existingIdentity, isNewUser: false };
    }

    // Identity row exists but user record is missing — data inconsistency
    logger.error('[resolveUser] Identity found but user missing', { sub, userId: existingIdentity.userId });
    return { isNewUser: true };
  }

  // -------------------------------------------------------------------------
  // Step 2: Resolve tenant via email or phone
  // -------------------------------------------------------------------------
  let agency: AgencyConfigItem | null = null;

  if (normalizedEmail) {
    agency = await findAgencyByAdminEmail(normalizedEmail);
  }

  if (!agency && phone) {
    agency = await findAgencyByAdminPhone(phone);
  }

  if (!agency) {
    // Before giving up, check if an existing user (any role) already owns this canonical phone.
    // This handles secondary phone login for users who were onboarded via Google and later linked a phone.
    if (phone) {
      const userByPhone = await findUserByPhone(phone);
      if (userByPhone) {
        logger.info('[resolveUser] Found existing user by canonical phone, linking new sub', { userId: userByPhone.userId });

        let linkedIdentity: AuthIdentityItem;
        try {
          linkedIdentity = await createIdentity({
            sub,
            userId: userByPhone.userId,
            tenantId: userByPhone.TenantId,
            provider: 'phone',
            phone,
          });
        } catch (err: any) {
          if (err?.code === 'ConditionalCheckFailedException') {
            const retried = await findIdentityBySub(sub);
            if (retried) {
              const retriedUser = await findUserByUserId(retried.userId);
              if (retriedUser) {
                const retriedAgency = await getAgencyConfig(retriedUser.TenantId);
                await updateLastLogin(retriedUser.TenantId, retriedUser.userId).catch(() => undefined);
                return { user: retriedUser, agency: retriedAgency, identity: retried, isNewUser: false };
              }
            }
          }
          throw err;
        }

        const linkedAgency = await getAgencyConfig(userByPhone.TenantId);
        await updateLastLogin(userByPhone.TenantId, userByPhone.userId).catch((e) =>
          logger.error('[resolveUser] updateLastLogin error', { error: e })
        );
        const refreshedLinked = (await findUserByUserId(userByPhone.userId)) || userByPhone;
        return { user: refreshedLinked, agency: linkedAgency, identity: linkedIdentity, isNewUser: false };
      }
    }

    // No tenant and no canonical phone match — new user not yet onboarded
    logger.info('[resolveUser] No pre-onboarded agency found', { sub, email: normalizedEmail, phone });
    return { isNewUser: true };
  }

  const tenantId = agency.TenantId;

  // -------------------------------------------------------------------------
  // Step 3: Find existing admin for this tenant
  // -------------------------------------------------------------------------
  const existingAdmin = await findAdminByTenantId(tenantId);

  // -------------------------------------------------------------------------
  // Step 4a: Admin already exists — just link this new sub to them
  // -------------------------------------------------------------------------
  if (existingAdmin) {
    logger.info('[resolveUser] Linking new sub to existing admin', { userId: existingAdmin.userId, sub });

    let identity: AuthIdentityItem;
    try {
      identity = await createIdentity({
        sub,
        userId: existingAdmin.userId,
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
            await updateLastLogin(user.TenantId, user.userId).catch(() => undefined);
            return { user, agency, identity: retried, isNewUser: false };
          }
        }
      }
      throw err;
    }

    await updateLastLogin(tenantId, existingAdmin.userId).catch((e) =>
      logger.error('[resolveUser] updateLastLogin error:', e)
    );

    // Enrich any missing fields on the canonical user record
    await enrichUserProfile(tenantId, existingAdmin.userId, {
      email: normalizedEmail,
      phoneNumber: phone,
    }).catch((e) => logger.error('[resolveUser] enrichUserProfile error:', e));

    // Re-fetch to return enriched version
    const refreshedUser = (await findUserByUserId(existingAdmin.userId)) || existingAdmin;
    return { user: refreshedUser, agency, identity, isNewUser: false };
  }

  // -------------------------------------------------------------------------
  // Step 4b: No admin for this tenant — create new admin + link identity
  // -------------------------------------------------------------------------
  logger.info('[resolveUser] Creating new admin for tenant', { tenantId, sub });

  const userId = uuidv4();
  const email_ = normalizedEmail || agency.adminEmail || `${userId}@unknown.user`;
  const displayName_ =
    normalizedEmail?.split('@')[0] || phone || userId.slice(0, 8);

  const newAdmin = await createAdminUser({
    tenantId,
    cognitoSub: sub,
    userId,
    email: email_,
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
          await updateLastLogin(user.TenantId, user.userId).catch(() => undefined);
          return { user, agency, identity: retried, isNewUser: false };
        }
      }
    }
    throw err;
  }

  return { user: newAdmin, agency, identity, isNewUser: false };
}

