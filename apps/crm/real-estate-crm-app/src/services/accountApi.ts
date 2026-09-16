/**
 * Self-service account deletion.
 *
 * Required in-app by App Store Review Guideline 5.1.1(v) — an app that offers
 * account creation but no in-app deletion is rejected outright — and by Google
 * Play's data deletion policy.
 */
import { AUTH_API_URL } from '../config/apiConfig';

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('auth_id_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function handleResponse(response: Response) {
  const data = await response.json().catch(() => ({ error: 'Unknown error' }));
  if (!response.ok) {
    throw new Error(data.message || data.error || `HTTP ${response.status}`);
  }
  return data;
}

export interface DeletionPreview {
  role: 'ADMIN' | 'MEMBER';
  /** True when this account is the agency owner, so deletion removes everything. */
  deletesAgency: boolean;
  /** Other members who lose access. Only meaningful when deletesAgency is true. */
  memberCount: number;
  gracePeriodDays: number;
}

export interface DeletionResult {
  success: boolean;
  agencyDeleted: boolean;
  deletedUserCount: number;
  deletionScheduledFor?: string;
  gracePeriodDays?: number;
}

/** What deletion would destroy, so the confirmation screen can be specific. */
export async function getDeletionPreview(): Promise<DeletionPreview> {
  const response = await fetch(`${AUTH_API_URL}/auth/me/deletion-preview`, {
    headers: getAuthHeaders(),
  });
  const data = await handleResponse(response);
  return (data.data ?? data) as DeletionPreview;
}

/**
 * Permanently delete the signed-in account.
 *
 * `deleteAgency` must be true when the preview reports deletesAgency, which the
 * server enforces — an admin cannot wipe their team without acknowledging it.
 */
export async function deleteMyAccount(deleteAgency: boolean): Promise<DeletionResult> {
  const response = await fetch(`${AUTH_API_URL}/auth/me`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
    credentials: 'include',
    body: JSON.stringify({ confirm: 'DELETE', deleteAgency }),
  });
  const data = await handleResponse(response);
  return (data.data ?? data) as DeletionResult;
}
