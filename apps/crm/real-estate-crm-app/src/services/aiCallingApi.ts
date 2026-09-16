/**
 * Client for the AI Calling feature.
 *
 * WHY THESE PATHS GO THROUGH THE CRM AND NOT STRAIGHT TO ai-calling-service:
 * the microservice's API Gateway is `AuthorizationType: NONE`
 * (`services/ai-calling-service/infra/cfn-ai-calling.yaml`) and its routes take the
 * tenant from a plain `x-tenant-id` header with no token check. A browser
 * calling it directly could forge that header and read any tenant's call
 * transcripts and lead phone numbers. The CRM proxy is also where the things
 * that must not be skippable live: `validateToken`, `requireCrmMemberOrAbove`,
 * the `aiEmployeeEnabled` tenant gate, and the credit pre-check that stops a
 * tenant dialling a call they cannot pay for (calls bill per started minute
 * *after* the fact, so this is the only point it can be refused).
 *
 * `docs/services/server/DISABLED_FEATURES.md` states the rule plainly: the browser never
 * talks to ai-calling-service directly, and there are no `VITE_AI_CALLING_*`
 * env vars. Everything here therefore hangs off the normal CRM API base URL
 * and reuses its auth, exactly like every other feature in the app.
 */

import { getTenantHeaders } from '../config/tenant';
import type {
  AIAgentConfig,
  AICallMetrics,
  AICallSession,
  AICallTranscriptEntry,
  SaveAIAgentConfigData,
  StartAICallData,
  StartAICallResult,
} from '../types/aiCalling';
import { CRM_API_URL } from '../config/apiConfig';

const API_BASE_URL = CRM_API_URL;

/**
 * Thrown when the CRM answers 404 — i.e. this deployment's server does not
 * mount the AI calling proxy yet. The page treats that as "not available on
 * this deployment" rather than a hard error, because it is a deployment state,
 * not a fault the user can act on.
 */
export class AICallingUnavailableError extends Error {
  constructor(message = 'AI calling is not available on this deployment') {
    super(message);
    this.name = 'AICallingUnavailableError';
  }
}

function headers(): Record<string, string> {
  const base: Record<string, string> = {
    'Content-Type': 'application/json',
    ...getTenantHeaders(),
  };
  const token = localStorage.getItem('auth_id_token');
  if (token) base.Authorization = `Bearer ${token}`;
  return base;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers: headers() });

  if (response.status === 404) {
    throw new AICallingUnavailableError();
  }

  if (!response.ok) {
    // The CRM and the microservice both answer { error, details? }.
    const body = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
    throw new Error(body.details ? `${body.error}: ${body.details}` : (body.error || `HTTP ${response.status}`));
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const aiCallingApi = {
  /** Recent calls, newest first. `status` filters server-side. */
  async listCalls(params: { limit?: number; status?: string } = {}): Promise<AICallSession[]> {
    const query = new URLSearchParams();
    if (params.limit) query.set('limit', String(params.limit));
    if (params.status) query.set('status', params.status);
    const suffix = query.toString() ? `?${query}` : '';
    const result = await request<AICallSession[] | { calls: AICallSession[] }>(`/crm/ai-calling/calls${suffix}`);
    // The microservice returns a bare array; tolerate a wrapped shape too so a
    // future pagination envelope on the CRM side doesn't break the page.
    return Array.isArray(result) ? result : (result.calls ?? []);
  },

  async getCall(callSessionId: string): Promise<AICallSession> {
    return request<AICallSession>(`/crm/ai-calling/calls/${encodeURIComponent(callSessionId)}`);
  },

  async getTranscript(callSessionId: string): Promise<AICallTranscriptEntry[]> {
    const result = await request<{ transcript: AICallTranscriptEntry[] }>(
      `/crm/ai-calling/calls/${encodeURIComponent(callSessionId)}/transcript`,
    );
    return result.transcript ?? [];
  },

  async getMetrics(): Promise<AICallMetrics> {
    return request<AICallMetrics>('/crm/ai-calling/calls/metrics/summary');
  },

  /**
   * Start a call for a lead. The CRM resolves the lead's name and phone
   * server-side — the browser deliberately does not supply them, so a tampered
   * request cannot dial an arbitrary number off the tenant's credit.
   */
  async startCall(data: StartAICallData): Promise<StartAICallResult> {
    return request<StartAICallResult>('/crm/ai-calling/calls/start', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async endCall(callSessionId: string, reason = 'user_ended'): Promise<{ success: boolean }> {
    return request<{ success: boolean }>(
      `/crm/ai-calling/calls/${encodeURIComponent(callSessionId)}/end`,
      { method: 'POST', body: JSON.stringify({ reason }) },
    );
  },

  async getAgentConfig(): Promise<AIAgentConfig> {
    return request<AIAgentConfig>('/crm/ai-calling/config/agent');
  },

  async saveAgentConfig(data: SaveAIAgentConfigData): Promise<AIAgentConfig> {
    return request<AIAgentConfig>('/crm/ai-calling/config/agent', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
};
