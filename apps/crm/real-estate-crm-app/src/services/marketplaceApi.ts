/**
 * Agent-facing client for the RealEstateFlow marketplace inbox.
 *
 * Backs the Marketplace Inbox screen where agents read and answer buyer
 * conversations that started on the consumer marketplace. The CRM routes are
 * thin JWT-guarded proxies to marketplace-api `/internal/*` (see
 * docs/services/marketplace-api/API-CONTRACT.md section 5); the CRM never
 * stores the threads itself.
 *
 * Auth and tenancy follow publicPagesApi.ts: the bearer token identifies the
 * user and the server derives the tenant from it. A 503 means the CRM has no
 * marketplace credentials configured for this environment — callers should
 * check `getStatus()` first and show an empty state rather than an error.
 */

import { getTenantHeaders } from '../config/tenant';
import { CRM_API_URL } from '../config/apiConfig';

const API_BASE_URL = CRM_API_URL;

export type MarketplaceThreadStatus = 'open' | 'listing_removed' | 'agency_closed';

export interface MarketplaceThreadSnapshot {
  title: string;
  agencyName: string;
  city: string;
  locality: string;
  price: number | null;
  mode: 'sale' | 'rent';
  imageCount: number;
}

export interface MarketplaceBuyer {
  name: string;
  phone: string;
  email?: string | null;
}

export interface MarketplaceThread {
  threadId: string;
  buyerUserId: string;
  tenantId: string;
  agencySlug: string;
  propertyId: string;
  leadId: string | null;
  status: MarketplaceThreadStatus;
  snapshot: MarketplaceThreadSnapshot;
  lastMessageAt: string;
  lastPreview: string;
  unreadBuyer: number;
  unreadAgency: number;
  createdAt: string;
  /** Present on list items only (joined by the internal API). */
  buyer?: MarketplaceBuyer;
}

export type MarketplaceMessageKind = 'text' | 'ping' | 'visit_request';

export interface MarketplaceMessage {
  messageId: string;
  threadId: string;
  senderType: 'buyer' | 'agency' | 'system';
  senderId: string;
  senderName: string;
  text: string;
  kind: MarketplaceMessageKind;
  meta?: {
    meetingId?: string;
    meetingDate?: string;
    meetingTime?: string;
  };
  createdAt: string;
}

export interface MarketplaceStatusResult {
  configured: boolean;
}

export interface ListMarketplaceThreadsParams {
  status?: MarketplaceThreadStatus;
  limit?: number;
  cursor?: string | null;
}

export interface ListMarketplaceThreadsResult {
  items: MarketplaceThread[];
  nextCursor: string | null;
}

export interface GetMarketplaceThreadResult {
  thread: MarketplaceThread;
  buyer: MarketplaceBuyer;
  messages: MarketplaceMessage[];
}

export interface SendMarketplaceMessageResult {
  message: MarketplaceMessage;
}

/**
 * Thrown for every non-2xx response. `status === 503` means the marketplace
 * integration is not configured for this CRM deployment.
 */
export class MarketplaceApiError extends Error {
  status: number;
  details?: string;

  constructor(message: string, status: number, details?: string) {
    super(message);
    this.name = 'MarketplaceApiError';
    this.status = status;
    this.details = details;
  }

  get notConfigured(): boolean {
    return this.status === 503;
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

  if (!response.ok) {
    const body: { error?: string; details?: string } = await response
      .json()
      .catch(() => ({ error: `HTTP ${response.status}` }));
    throw new MarketplaceApiError(
      body.error || `HTTP ${response.status}`,
      response.status,
      body.details,
    );
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const marketplaceApi = {
  /** GET /api/crm/marketplace/status */
  async getStatus(): Promise<MarketplaceStatusResult> {
    return request<MarketplaceStatusResult>('/crm/marketplace/status');
  },

  /** GET /api/crm/marketplace/threads?status&limit&cursor */
  async listThreads(params: ListMarketplaceThreadsParams = {}): Promise<ListMarketplaceThreadsResult> {
    const query = new URLSearchParams();
    if (params.status) query.set('status', params.status);
    if (params.limit) query.set('limit', String(params.limit));
    if (params.cursor) query.set('cursor', params.cursor);
    const qs = query.toString();
    return request<ListMarketplaceThreadsResult>(`/crm/marketplace/threads${qs ? `?${qs}` : ''}`);
  },

  /** GET /api/crm/marketplace/threads/:threadId?since= */
  async getThread(threadId: string, since?: string | null): Promise<GetMarketplaceThreadResult> {
    const qs = since ? `?since=${encodeURIComponent(since)}` : '';
    return request<GetMarketplaceThreadResult>(
      `/crm/marketplace/threads/${encodeURIComponent(threadId)}${qs}`,
    );
  },

  /** POST /api/crm/marketplace/threads/:threadId/messages */
  async sendMessage(threadId: string, text: string): Promise<SendMarketplaceMessageResult> {
    return request<SendMarketplaceMessageResult>(
      `/crm/marketplace/threads/${encodeURIComponent(threadId)}/messages`,
      { method: 'POST', body: JSON.stringify({ text }) },
    );
  },

  /** POST /api/crm/marketplace/threads/:threadId/read */
  async markRead(threadId: string): Promise<{ ok: boolean }> {
    return request<{ ok: boolean }>(
      `/crm/marketplace/threads/${encodeURIComponent(threadId)}/read`,
      { method: 'POST' },
    );
  },
};

export default marketplaceApi;
