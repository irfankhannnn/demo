/**
 * Exotel click-to-call through the CRM (`POST /api/crm/calls/click-to-call`,
 * CONTRACTS.md section 5 / APPROVAL-PLAN.md section 3.6).
 *
 * The browser sends only an entity type and id. The CRM resolves the
 * contact's number server-side and takes the caller's number from the
 * authenticated user's profile, so a phone number never has to be in the
 * page for a call to be placed — which is what lets non-admin roles (who get
 * masked numbers) still call a lead.
 *
 * Base URL and auth headers follow `aiCallingApi.ts` exactly.
 */

import { getTenantHeaders } from '../config/tenant';
import { CRM_API_URL } from '../config/apiConfig';

const API_BASE_URL = CRM_API_URL;

export type ClickToCallEntityType = 'lead' | 'buyer' | 'owner' | 'customer' | 'contact' | 'property';

export interface ClickToCallRequest {
  entityType: ClickToCallEntityType;
  entityId: string;
}

export interface ClickToCallSession {
  callSessionId: string;
  callSid?: string;
  status: string;
}

/**
 * Typed outcome so the UI can branch on the two expected failures without
 * string-matching error messages:
 *  - `caller_phone_missing`: the signed-in user has no phone on their profile
 *    (400). Fix is on the user's side (add a number in Profile).
 *  - `click_to_call_not_configured`: the tenant/deployment has no Exotel
 *    caller id (503). Nothing the user can do; button should be disabled.
 *  - `unavailable`: the CRM does not mount the route (404) on this deployment.
 */
export type ClickToCallResult =
  | { ok: true; session: ClickToCallSession }
  | { ok: false; code: 'caller_phone_missing'; message: string }
  | { ok: false; code: 'click_to_call_not_configured'; message: string }
  | { ok: false; code: 'unavailable'; message: string }
  | { ok: false; code: 'error'; message: string };

function headers(): Record<string, string> {
  const base: Record<string, string> = {
    'Content-Type': 'application/json',
    ...getTenantHeaders(),
  };
  const token = localStorage.getItem('auth_id_token');
  if (token) base.Authorization = `Bearer ${token}`;
  return base;
}

export const clickToCallApi = {
  async connect(data: ClickToCallRequest): Promise<ClickToCallResult> {
    let response: Response;
    try {
      response = await fetch(`${API_BASE_URL}/crm/calls/click-to-call`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(data),
      });
    } catch (err) {
      return { ok: false, code: 'error', message: err instanceof Error ? err.message : 'Network error' };
    }

    if (response.status === 404) {
      return { ok: false, code: 'unavailable', message: 'Click-to-call is not available on this deployment' };
    }

    const body = await response.json().catch(() => ({} as Record<string, unknown>));
    const errorCode = typeof body.error === 'string' ? body.error : '';
    const details = typeof body.details === 'string' ? body.details : '';

    if (response.ok) {
      return {
        ok: true,
        session: {
          callSessionId: String(body.callSessionId ?? ''),
          callSid: body.callSid ? String(body.callSid) : undefined,
          status: String(body.status ?? 'initiated'),
        },
      };
    }

    if (errorCode === 'caller_phone_missing' || (response.status === 400 && /caller.?phone/i.test(errorCode))) {
      return {
        ok: false,
        code: 'caller_phone_missing',
        message: details || 'Add your phone number to your profile to place calls.',
      };
    }

    if (errorCode === 'click_to_call_not_configured' || response.status === 503) {
      return {
        ok: false,
        code: 'click_to_call_not_configured',
        message: details || 'Click-to-call is not configured for your agency yet.',
      };
    }

    return {
      ok: false,
      code: 'error',
      message: details ? `${errorCode}: ${details}` : (errorCode || `HTTP ${response.status}`),
    };
  },
};
