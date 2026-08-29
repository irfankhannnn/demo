import { SERVICE_ACCOUNT_USER } from './serviceAccount.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Resolve the human-readable actor for audit/history logs.
 * Prefers the team directory lookup by userId (same source as assignment dropdown).
 */
export function resolveRequestActor(user, labelMap = {}) {
  if (!user) {
    return { actorName: SERVICE_ACCOUNT_USER, actorUserId: null };
  }

  const actorUserId = user.userId || user.sub || null;

  if (actorUserId && labelMap[actorUserId]) {
    return { actorName: labelMap[actorUserId], actorUserId };
  }

  const actorName =
    user.displayName?.trim()
    || user.name?.trim()
    || user.email?.trim()
    || (user.username?.trim() && !UUID_REGEX.test(user.username) ? user.username.trim() : null)
    || SERVICE_ACCOUNT_USER;

  return { actorName, actorUserId };
}

/** Attach server-derived create audit fields (never trust client for actor). */
export function withCreateActor(user, body = {}) {
  const { actorName, actorUserId } = resolveRequestActor(user);
  return {
    ...body,
    createdBy: actorName,
    createdByUserId: actorUserId,
    performedBy: actorName,
    performedByUserId: actorUserId,
  };
}

/** Attach server-derived update audit fields (never trust client for actor). */
export function withUpdateActor(user, body = {}) {
  const { actorName, actorUserId } = resolveRequestActor(user);
  return {
    ...body,
    updatedBy: actorName,
    updatedByUserId: actorUserId,
    performedBy: actorName,
    performedByUserId: actorUserId,
  };
}

/** Human label for timeline badges — "system" means background/automation, not a person. */
export function formatPerformedByLabel(performedBy) {
  const value = String(performedBy || '').trim();
  if (!value || value.toLowerCase() === SERVICE_ACCOUNT_USER.toLowerCase()) {
    return 'Automated';
  }
  return value;
}
