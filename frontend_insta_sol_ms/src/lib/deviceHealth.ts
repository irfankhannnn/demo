import type { Device } from '../api/types';
import type { BadgeTone } from '../components/Badge';
import { millisSince } from './format';

/**
 * Device health is derived, not stored.
 *
 * The contract gives the frontend `lastSeenAt`, `status`, `revokedAt` and
 * `tokenExpiresAt` (section 3) and the agent heartbeats on `/agent/heartbeat`.
 * Turning those four fields into one word is done here so the Overview panel
 * and the Devices page can never disagree about what "healthy" means.
 */

export type HealthLevel = 'online' | 'stale' | 'offline' | 'revoked' | 'unknown';

export interface DeviceHealth {
  level: HealthLevel;
  label: string;
  tone: BadgeTone;
  /** Set when the Instagram token is close to expiry — F64 wants 10 days' warning. */
  tokenWarning: string | null;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** F64: warn 10 days before the long-lived token expires rather than failing silently. */
export const TOKEN_WARNING_DAYS = 10;

export function deviceHealth(device: Device): DeviceHealth {
  const tokenWarning = tokenExpiryWarning(device.tokenExpiresAt);

  if (device.revokedAt || device.status === 'revoked') {
    return { level: 'revoked', label: 'Revoked', tone: 'neutral', tokenWarning: null };
  }

  const age = millisSince(device.lastSeenAt);
  if (age === null) {
    return {
      level: 'unknown',
      label: 'Never checked in',
      tone: 'warning',
      tokenWarning,
    };
  }

  // The agent heartbeats far more often than every 15 minutes, so anything
  // quieter than that is a laptop that is shut, asleep, or offline.
  if (age < 15 * MINUTE) {
    return { level: 'online', label: 'Online', tone: 'success', tokenWarning };
  }
  if (age < 24 * HOUR) {
    return { level: 'stale', label: 'Idle', tone: 'warning', tokenWarning };
  }
  return { level: 'offline', label: 'Offline', tone: 'danger', tokenWarning };
}

function tokenExpiryWarning(tokenExpiresAt?: string): string | null {
  if (!tokenExpiresAt) return null;
  const expires = new Date(tokenExpiresAt).getTime();
  if (Number.isNaN(expires)) return null;

  const remaining = expires - Date.now();
  if (remaining <= 0) return 'Instagram token has expired — re-authorise the account.';

  const days = Math.ceil(remaining / DAY);
  if (days <= TOKEN_WARNING_DAYS) {
    return `Instagram token expires in ${days} day${days === 1 ? '' : 's'}.`;
  }
  return null;
}

/** True when at least one laptop is not currently reporting in. */
export function hasUnhealthyDevice(devices: Device[]): boolean {
  return devices.some((device) => {
    const health = deviceHealth(device);
    return health.level === 'offline' || health.level === 'unknown' || !!health.tokenWarning;
  });
}
