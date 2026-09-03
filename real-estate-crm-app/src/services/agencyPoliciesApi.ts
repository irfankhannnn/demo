/**
 * Client for agency policy documents.
 *
 * These are the documents the AI voice agent quotes when a customer asks about
 * deposits, brokerage, paperwork or house rules, and the same text backs the
 * WhatsApp and web chat agents. Saving here re-embeds them into the knowledge
 * vector index server-side; the client never touches embeddings.
 *
 * Auth and tenancy work exactly as elsewhere in the CRM: the bearer token
 * identifies the user and the server derives the tenant from it. Nothing here
 * sends a tenant id the browser chose.
 */

import { getTenantHeaders } from '../config/tenant';

const API_BASE_URL = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL;

export type PolicyCategory = 'faq' | 'policies' | 'agency_info' | 'pricing';

export interface AgencyPolicy {
  policyId: string;
  title: string;
  category: PolicyCategory;
  content: string;
  updatedAt?: string;
}

export interface PolicyMeta {
  categories: PolicyCategory[];
  maxPolicyChars: number;
  maxPolicies: number;
}

export interface SavePoliciesResult {
  policies: AgencyPolicy[];
  count: number;
  indexing: { indexed: number; unchanged: number; deleted: number; totalChunks: number } | null;
  /**
   * Set when the documents saved but re-indexing failed. The save still
   * succeeded — surface this as a warning, never as a failed save, or the user
   * will re-submit work that is already stored.
   */
  indexingError: string | null;
  warning?: string;
}

/** Thrown when this deployment's server does not mount the policies routes yet. */
export class PoliciesUnavailableError extends Error {
  constructor(message = 'Agency policies are not available on this deployment') {
    super(message);
    this.name = 'PoliciesUnavailableError';
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

  if (response.status === 404) throw new PoliciesUnavailableError();

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
    throw new Error(body.details ? `${body.error}: ${body.details}` : body.error || `HTTP ${response.status}`);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const agencyPoliciesApi = {
  async getMeta(): Promise<PolicyMeta> {
    return request<PolicyMeta>('/crm/agency-policies/meta');
  },

  async list(): Promise<AgencyPolicy[]> {
    const result = await request<{ policies: AgencyPolicy[] }>('/crm/agency-policies');
    return result.policies ?? [];
  },

  /**
   * Replace the whole set. Whole-set replace, not per-document save, because
   * the server needs to know which documents disappeared in order to delete
   * their indexed passages — otherwise the agent keeps quoting a retired policy.
   */
  async save(policies: AgencyPolicy[]): Promise<SavePoliciesResult> {
    return request<SavePoliciesResult>('/crm/agency-policies', {
      method: 'PUT',
      body: JSON.stringify({ policies }),
    });
  },

  /** Recovery path when a save stored the text but indexing failed. */
  async reindex(): Promise<{ indexed: number; unchanged: number; totalChunks: number }> {
    return request('/crm/agency-policies/reindex', { method: 'POST' });
  },
};

export default agencyPoliciesApi;
