/**
 * Agency-facing client for the public property pages settings.
 *
 * Backs the "Public Pages" settings screen where an admin claims the agency's
 * subdomain slug, sets public branding, and switches the public site on. Also
 * used by the property publish control to check whether public pages are set
 * up before letting an agent flip a listing's visibility.
 *
 * Auth and tenancy follow the same convention as agencyPoliciesApi.ts: the
 * bearer token identifies the user and the server derives the tenant from it.
 * All three endpoints are admin-only on the server (requireAdmin).
 */

import { getTenantHeaders } from '../config/tenant';
import { CRM_API_URL } from '../config/apiConfig';

const API_BASE_URL = CRM_API_URL;

export interface PublicPagesSettings {
  tenantId: string;
  slug: string | null;
  name: string;
  logoS3Key: string | null;
  brandPrimaryColor: string;
  publicPhone: string | null;
  publicEmail: string | null;
  publicAddress: string | null;
  about: string | null;
  enabled: boolean;
  /** Whether published listings are also offered on the RealEstateFlow marketplace. */
  marketplaceEnabled: boolean;
  /** Which channels get an alert when a marketplace buyer chats, pings or requests a visit. */
  marketplaceNotifications: MarketplaceNotifications;
}

export interface MarketplaceNotifications {
  email: boolean;
  whatsapp: boolean;
  push: boolean;
  /** Extra recipients beyond the team's own addresses. Max 5 each, server-validated. */
  extraEmails: string[];
  extraPhones: string[];
}

export interface GetPublicPagesSettingsResult {
  settings: PublicPagesSettings;
  /** Slugified agency name, offered when no slug has been claimed yet. */
  suggestedSlug: string;
}

export interface UpdatePublicPagesSettingsInput {
  agencySlug?: string;
  agencyName?: string;
  brandPrimaryColor?: string;
  publicPhone?: string | null;
  publicEmail?: string | null;
  publicAddress?: string | null;
  publicAbout?: string | null;
  publicPagesEnabled?: boolean;
  marketplaceEnabled?: boolean;
  marketplaceNotifications?: MarketplaceNotifications;
}

export interface UpdatePublicPagesSettingsResult {
  settings: PublicPagesSettings;
}

export type SlugUnavailableReason = 'invalid' | 'taken';

export interface SlugAvailability {
  available: boolean;
  reason?: SlugUnavailableReason;
}

/**
 * Thrown for every non-2xx response. Carries the server's `error`/`details`
 * pair (400 invalid slug, 409 slug taken, 400 enabling with no slug) so the
 * settings screen can show the exact reason rather than a generic failure.
 */
export class PublicPagesApiError extends Error {
  status: number;
  details?: string;

  constructor(message: string, status: number, details?: string) {
    super(message);
    this.name = 'PublicPagesApiError';
    this.status = status;
    this.details = details;
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
    throw new PublicPagesApiError(
      body.error || `HTTP ${response.status}`,
      response.status,
      body.details,
    );
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const publicPagesApi = {
  /** GET /api/crm/public-pages/settings */
  async getSettings(): Promise<GetPublicPagesSettingsResult> {
    return request<GetPublicPagesSettingsResult>('/crm/public-pages/settings');
  },

  /** PUT /api/crm/public-pages/settings */
  async updateSettings(
    input: UpdatePublicPagesSettingsInput,
  ): Promise<UpdatePublicPagesSettingsResult> {
    return request<UpdatePublicPagesSettingsResult>('/crm/public-pages/settings', {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  },

  /** GET /api/crm/public-pages/slug-available?slug=foo */
  async checkSlugAvailability(slug: string): Promise<SlugAvailability> {
    return request<SlugAvailability>(
      `/crm/public-pages/slug-available?slug=${encodeURIComponent(slug)}`,
    );
  },
};

export default publicPagesApi;
