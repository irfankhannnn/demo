/**
 * Client for the AI follow-up call feature (followup-agent-service), reached
 * through the CRM proxy routes — never the microservice directly. See
 * `docs/agency-app/followup-agent/CONTRACTS.md` sections 4 and 5. The CRM proxy
 * is where `validateToken`, `requireCrmMemberOrAbove` and `requestedBy` are
 * applied, so the browser only ever sends a lead id and a job type.
 *
 * Base URL and auth headers follow `aiCallingApi.ts` exactly.
 */

import { getTenantHeaders } from '../config/tenant';
import { CRM_API_URL } from '../config/apiConfig';

const API_BASE_URL = CRM_API_URL;

export type FollowupJobType = 'site_visit_confirmation' | 'post_visit_feedback';

export type FollowupJobStatus =
  | 'scheduled'
  | 'calling'
  | 'done'
  | 'needs_human'
  | 'escalated'
  | 'cancelled'
  | 'failed';

export interface FollowupJobContext {
  meetingId?: string;
  propertyId?: string;
  meetingSchedule?: string;
  propertyHint?: string;
  note?: string;
}

/** One dial of the lead by the follow-up agent (SK=ATTEMPT#n on the job). */
export interface FollowupAttempt {
  jobId?: string;
  attemptNo?: number;
  attempt?: number;
  callSessionId?: string;
  outcome?: string;
  durationSeconds?: number;
  summary?: string;
  startedAt?: string;
  endedAt?: string;
  createdAt?: string;
}

export interface FollowupJob {
  jobId: string;
  tenantId: string;
  leadId: string;
  jobType: FollowupJobType;
  status: FollowupJobStatus;
  dueAt?: string;
  attemptCount: number;
  maxAttempts: number;
  lastAttemptAt?: string | null;
  lastOutcome?: string | null;
  escalatedAt?: string | null;
  escalationReason?: string | null;
  context?: FollowupJobContext;
  requestedBy?: string;
  source?: string;
  createdAt: string;
  updatedAt: string;
  /** Present when the CRM proxy embeds the attempts alongside each job. */
  attempts?: FollowupAttempt[];
}

export interface ScheduleFollowupCallData {
  jobType?: FollowupJobType;
  note?: string;
}

export interface ScheduleFollowupCallResult {
  job: FollowupJob;
  duplicate?: boolean;
}

/**
 * Thrown when the CRM answers 404 — this deployment's server does not mount
 * the follow-up proxy yet. Callers treat it as "not available", not a fault.
 */
export class FollowupUnavailableError extends Error {
  constructor(message = 'AI follow-up calls are not available on this deployment') {
    super(message);
    this.name = 'FollowupUnavailableError';
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
    throw new FollowupUnavailableError();
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
    throw new Error(body.details ? `${body.error}: ${body.details}` : (body.error || `HTTP ${response.status}`));
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const followupApi = {
  /**
   * Ask the follow-up agent to call this lead. The CRM resolves the lead's
   * phone server-side and stamps `requestedBy` from the JWT.
   */
  async scheduleCall(leadId: string, data: ScheduleFollowupCallData = {}): Promise<ScheduleFollowupCallResult> {
    return request<ScheduleFollowupCallResult>(
      `/crm/leads/${encodeURIComponent(leadId)}/followup-call`,
      { method: 'POST', body: JSON.stringify({ jobType: 'site_visit_confirmation', ...data }) },
    );
  },

  /** All follow-up jobs for a lead, newest first. */
  async listForLead(leadId: string): Promise<FollowupJob[]> {
    const result = await request<{ jobs?: FollowupJob[] } | FollowupJob[]>(
      `/crm/leads/${encodeURIComponent(leadId)}/followups`,
    );
    const jobs = Array.isArray(result) ? result : (result.jobs ?? []);
    return jobs
      .slice()
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  },

  async cancel(jobId: string): Promise<FollowupJob> {
    const result = await request<{ job: FollowupJob } | FollowupJob>(
      `/crm/followups/${encodeURIComponent(jobId)}/cancel`,
      { method: 'POST', body: JSON.stringify({}) },
    );
    return 'job' in result ? result.job : result;
  },
};
