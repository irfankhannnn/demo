import { Page } from '@playwright/test';
import { API_URL } from './config';

export interface CrmOwnerRecord {
  ownerId: string;
  name: string;
  phone?: string;
  email?: string;
  status?: string;
  propertyCount?: number;
  isSeller?: boolean;
  contactId?: string;
  sellerLifecycle?: string;
}

interface OwnersApiResponse {
  owners?: CrmOwnerRecord[];
  total?: number;
  sellerCount?: number;
}

interface PropertiesApiResponse {
  properties?: Array<{ ownerId?: string }>;
}

export interface CrmLeadRecord {
  leadId: string;
  leadType: string;
  name: string;
  phone?: string;
  email?: string;
  source?: string;
  status?: string;
  priority?: string;
  notes?: string;
  lostReason?: string | null;
  lostAt?: string | null;
  buyerRequirement?: Record<string, unknown> | null;
  sellerProperty?: Record<string, unknown> | null;
  tenantRequirement?: Record<string, unknown> | null;
  ownerProperty?: Record<string, unknown> | null;
}

export interface CrmLeadNoteRecord {
  noteId: string;
  leadId?: string;
  content: string;
  createdAt?: string;
}

async function authGet<T>(page: Page, path: string): Promise<T> {
  return page.evaluate(async ({ apiUrl, requestPath }) => {
    const token = localStorage.getItem('auth_id_token') || localStorage.getItem('auth_access_token');
    if (!token) throw new Error('No auth token in localStorage — login first');

    let tenantId = '';
    try {
      const profile = JSON.parse(localStorage.getItem('auth_user_profile') || '{}');
      tenantId = profile.tenantId || '';
    } catch {
      tenantId = '';
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
    if (tenantId) headers['x-tenant-id'] = tenantId;

    const res = await fetch(`${apiUrl}${requestPath}`, { headers });

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(`API ${requestPath} failed: ${res.status} — ${JSON.stringify(body)}`);
    }
    return body as T;
  }, { apiUrl: API_URL, requestPath: path });
}

/** Fetch owners using the same authenticated API the CRM UI uses. */
export async function fetchOwnersFromApi(
  page: Page,
  options: { seller?: boolean; limit?: number; offset?: number } = {},
): Promise<CrmOwnerRecord[]> {
  const limit = options.limit ?? 200;
  const offset = options.offset ?? 0;
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });
  if (options.seller) params.set('seller', 'true');

  const data = await authGet<OwnersApiResponse>(page, `/crm/owners?${params.toString()}`);
  const owners = Array.isArray(data.owners) ? data.owners : [];
  return owners.filter((o) => o.ownerId && o.name);
}

/** Sellers = contacts with seller role (Phase 5), with legacy for-sale fallback. */
export async function fetchSellersFromApi(page: Page): Promise<CrmOwnerRecord[]> {
  try {
    const contactsData = await authGet<any>(page, '/crm/contacts?role=seller');
    const contacts = Array.isArray(contactsData)
      ? contactsData
      : (contactsData?.contacts || []);
    const fromContacts = contacts
      .filter((c: any) => c?.contactId && c?.name)
      .map((c: any) => ({
        ownerId: c.linkedOwnerId || c.contactId,
        contactId: c.contactId,
        name: c.name,
        phone: c.phone,
        email: c.email,
        status: c.status || 'active',
        sellerLifecycle: c.sellerProfile?.lifecycleStatus || 'active',
        propertyCount: c.ownerProfile?.ownedPropertyIds?.length
          || c.sellerProfile?.activeListingIds?.length
          || 0,
        isSeller: true,
      })) as CrmOwnerRecord[];
    if (fromContacts.length > 0) return fromContacts;
  } catch {
    // fall through to legacy join
  }

  const [owners, propertiesData] = await Promise.all([
    fetchOwnersFromApi(page, { limit: 200 }),
    authGet<PropertiesApiResponse>(page, '/crm/properties?limit=200&offset=0&status=for-sale'),
  ]);

  const sellerOwnerIds = new Set(
    (propertiesData.properties ?? [])
      .map((p) => p.ownerId)
      .filter((id): id is string => Boolean(id)),
  );

  return owners.filter((o) => sellerOwnerIds.has(o.ownerId));
}

/**
 * Open the Owners / Sellers list in the UI, then load records from the live API.
 * This mirrors what the list page shows without brittle network interception.
 */
export async function fetchOwnersFromListPage(
  page: Page,
  sellersOnly: boolean,
): Promise<CrmOwnerRecord[]> {
  const listUrl = sellersOnly ? '/crm/owners?sellers=1' : '/crm/owners';
  await page.goto(listUrl);
  await page.waitForLoadState('networkidle');

  const heading = sellersOnly ? /Sellers/i : /Owners/i;
  await page.getByRole('heading', { name: heading }).first().waitFor({ state: 'visible', timeout: 15_000 });
  await page.waitForTimeout(1_000);

  if (sellersOnly) {
    const sellers = await fetchSellersFromApi(page);
    if (sellers.length > 0) return sellers;
    return fetchOwnersFromApi(page, { seller: true, limit: 200 });
  }

  return fetchOwnersFromApi(page, { limit: 200 });
}

/** Fetch a single lead by ID (post-create verification). */
export async function fetchLeadFromApi(page: Page, leadId: string): Promise<CrmLeadRecord> {
  return authGet<CrmLeadRecord>(page, `/crm/leads/${leadId}`);
}

/** Fetch activity notes for a lead. */
export async function fetchLeadNotesFromApi(page: Page, leadId: string): Promise<CrmLeadNoteRecord[]> {
  const data = await authGet<CrmLeadNoteRecord[] | { notes?: CrmLeadNoteRecord[] }>(
    page,
    `/crm/leads/${leadId}/notes`,
  );
  if (Array.isArray(data)) return data;
  return Array.isArray(data.notes) ? data.notes : [];
}
