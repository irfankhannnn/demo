/**
 * The public-safe view of a Property.
 *
 * Everything a visitor can see on a tenant's shareable property page passes
 * through this module, and nothing else in the codebase is allowed to shape a
 * public response. That constraint is the entire point of the file.
 *
 * ── the allowlist rule ─────────────────────────────────────────────────────
 * `toPublicProperty()` builds a NEW object naming every field it emits. It
 * never spreads the stored item and never deletes fields it dislikes. A
 * blocklist would silently start leaking the day someone adds a column — and
 * the PROPERTY item happens to carry `titleDeedS3Key`, `occupancyCertificateUrl`,
 * `propertyTaxReceiptUrl`, `ownerPhone` and `ownerSnapshot`, so a leak here is
 * a leak of a homeowner's legal documents and personal phone number.
 *
 * If you add a field to the public page, add it here explicitly. If you are
 * unsure whether a field is safe, it is not safe.
 *
 * ── two independent gates ──────────────────────────────────────────────────
 * A property is publishable only when BOTH hold:
 *   1. `publicVisibility === 'public'`  — a human deliberately published it.
 *   2. its lifecycle `status` is still openly marketable.
 * Gate 2 exists because `sold`/`rented` properties keep `publicVisibility`
 * from when they were listed; without it, closing a deal in the CRM would
 * leave the listing live on the public internet.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { getProperty } from './crmDynamodbService.js';
import { getAgencyConfig } from './agencyConfigService.js';
import { wrapAwsClient } from './awsClientWrapper.js';
import { logger } from './logger.js';

const REGION = process.env.AWS_REGION || 'ap-south-1';
const CRM_TABLE_NAME = process.env.CRM_DYNAMODB_TABLE_NAME;
const AGENCY_CONFIG_TABLE_NAME = process.env.AGENCY_CONFIG_DYNAMODB_TABLE_NAME;

// Own client, matching how every other service module here is built
// (agencyConfigService, webhookLogService). crmDynamodbService keeps its
// client private, and widening its exports just to share one is a worse trade
// than a second lightweight client over the same table.
const docClient = DynamoDBDocumentClient.from(
  wrapAwsClient(new DynamoDBClient({ region: REGION }), 'DynamoDB', { tableName: CRM_TABLE_NAME }),
);

const agencyClient = DynamoDBDocumentClient.from(
  wrapAwsClient(new DynamoDBClient({ region: REGION }), 'DynamoDB', { tableName: AGENCY_CONFIG_TABLE_NAME }),
);

/**
 * Lifecycle statuses that may appear on a public page. Deliberately an
 * allowlist: a status added later (say 'under-offer') stays hidden until
 * someone decides it should be visible.
 */
const PUBLICLY_MARKETABLE_STATUSES = new Set([
  'available',
  'for-sale',
  'for-rent',
]);

/** Amenity strings are rendered into HTML, so cap them rather than trust length. */
const MAX_AMENITIES = 40;
const MAX_IMAGES = 20;

export function isPubliclyVisible(property) {
  if (!property) return false;
  if (property.publicVisibility !== 'public') return false;
  return PUBLICLY_MARKETABLE_STATUSES.has(property.status);
}

/**
 * URL-safe slug from a listing title. Purely cosmetic — the canonical
 * identifier in a public URL is always the propertyId that follows it, so a
 * retitled listing never breaks an already-shared link.
 */
export function slugifyTitle(title) {
  const base = String(title || '')
    .toLowerCase()
    // NFKD splits an accented letter into base + combining mark so the base
    // letter survives the [^a-z0-9] pass below ("Café" -> "cafe-" -> "cafe",
    // not "caf"). The mark itself becomes a separator and collapses away.
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '');
  return base || 'property';
}

/**
 * Agency slug, used as the tenant's subdomain. Stricter than the title slug:
 * this becomes a DNS label, so it must survive a hostname parse.
 */
export function slugifyAgencyName(name) {
  const base = String(name || '')
    .toLowerCase()
    // NFKD splits an accented letter into base + combining mark so the base
    // letter survives the [^a-z0-9] pass below ("Café" -> "cafe-" -> "cafe",
    // not "caf"). The mark itself becomes a separator and collapses away.
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');
  return base || '';
}

/**
 * Reserved subdomains an agency must never be able to claim. `www` and `api`
 * would shadow real infrastructure; the rest would let a tenant mint a
 * convincing phishing host under our own domain.
 */
const RESERVED_AGENCY_SLUGS = new Set([
  'www', 'api', 'app', 'admin', 'auth', 'login', 'signup', 'mail', 'email',
  'static', 'assets', 'cdn', 'img', 'images', 'media', 'docs', 'help',
  'support', 'status', 'blog', 'pages', 'dev', 'staging', 'prod', 'test',
  'billing', 'pay', 'payment', 'secure', 'account', 'internal', 'realestateflow',
]);

export function isValidAgencySlug(slug) {
  if (typeof slug !== 'string') return false;
  if (slug.length < 3 || slug.length > 40) return false;
  // A single DNS label: alphanumeric, internal hyphens only.
  if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(slug)) return false;
  if (slug.includes('--')) return false;
  return !RESERVED_AGENCY_SLUGS.has(slug);
}

/**
 * Price shown on the card. A rental listing quotes rent; a sale quotes the
 * listed price. Returns null rather than 0 when unpriced, so the page can say
 * "Price on request" instead of the actively misleading "₹0".
 */
function derivePricing(property) {
  const isRental = property.status === 'for-rent' || property.propertyDealType === 'rent';
  if (isRental) {
    const rent = Number(property.rentalInfo?.expectedRent) || 0;
    return {
      mode: 'rent',
      amount: rent > 0 ? rent : null,
      deposit: Number(property.rentalInfo?.securityDeposit) || null,
    };
  }
  const listed = Number(property.saleInfo?.listedPrice) || 0;
  return {
    mode: 'sale',
    amount: listed > 0 ? listed : null,
    deposit: null,
  };
}

/**
 * Images are stored inconsistently: `routes/crm.js` writes bare S3 key strings,
 * while older records (and the schema comment) use `{s3Key, url, description}`.
 * Normalise to keys and drop anything else. We deliberately keep only the key
 * and never any stored `url` — a stored presigned URL has already expired, and
 * echoing one would put a credentialed S3 link in public HTML.
 */
function normaliseImageKeys(images) {
  if (!Array.isArray(images)) return [];
  const keys = [];
  for (const entry of images) {
    if (typeof entry === 'string' && entry.trim()) {
      keys.push(entry.trim());
    } else if (entry && typeof entry === 'object' && typeof entry.s3Key === 'string' && entry.s3Key.trim()) {
      keys.push(entry.s3Key.trim());
    }
    if (keys.length >= MAX_IMAGES) break;
  }
  return keys;
}

/**
 * Marketing documents only. `brochureS3Key` and `floorPlanS3Keys` are new
 * fields added for the public pages feature and are the ONLY document fields
 * that may ever be surfaced here — the legal document fields on the same item
 * (title deed, occupancy certificate, tax receipt) are intentionally absent
 * and must stay that way.
 */
function normalisePublicDocuments(property) {
  const docs = [];
  if (typeof property.brochureS3Key === 'string' && property.brochureS3Key.trim()) {
    docs.push({ kind: 'brochure', label: 'Brochure', s3Key: property.brochureS3Key.trim() });
  }
  const floorPlans = Array.isArray(property.floorPlanS3Keys) ? property.floorPlanS3Keys : [];
  floorPlans.slice(0, 6).forEach((key, i) => {
    if (typeof key === 'string' && key.trim()) {
      docs.push({
        kind: 'floor-plan',
        label: floorPlans.length > 1 ? `Floor plan ${i + 1}` : 'Floor plan',
        s3Key: key.trim(),
      });
    }
  });
  return docs;
}

/**
 * THE allowlist. Every public field is named here.
 *
 * `s3Key` values are included so the pages microservice can ask for a fresh
 * presigned URL per asset; they are opaque paths, not credentials, and the
 * service never renders them into HTML.
 */
export function toPublicProperty(property, { includeAssetKeys = false } = {}) {
  if (!property) return null;

  const pricing = derivePricing(property);
  const imageKeys = normaliseImageKeys(property.images);
  const documents = normalisePublicDocuments(property);

  const publicView = {
    propertyId: property.propertyId,
    slug: property.publicSlug || slugifyTitle(property.title),

    title: property.title || 'Property',
    description: property.description || '',
    propertyType: property.propertyType || 'apartment',
    bhk: Number(property.bhk) || null,
    furnishing: property.furnishing || null,
    facing: property.facing || null,
    carpetArea: Number(property.carpetArea) || null,
    builtUpArea: Number(property.builtUpArea) || null,
    amenities: Array.isArray(property.amenities)
      ? property.amenities.filter((a) => typeof a === 'string').slice(0, MAX_AMENITIES)
      : [],

    // Locality only — never `address` or `flatNumber`. A public listing shows
    // where a property roughly is, not which door to knock on while the owner
    // is out.
    locality: property.area || '',
    city: property.city || '',
    buildingName: property.buildingName || '',
    latitude: typeof property.latitude === 'number' ? property.latitude : null,
    longitude: typeof property.longitude === 'number' ? property.longitude : null,

    status: property.status,
    pricing,

    imageCount: imageKeys.length,
    documents: documents.map((d) => ({ kind: d.kind, label: d.label })),

    availableFrom: property.availableFrom || null,
    updatedAt: property.updatedAt || null,
  };

  if (includeAssetKeys) {
    // Server-side only: consumed by the presign endpoint, never serialised to
    // a browser.
    publicView._assetKeys = {
      images: imageKeys,
      documents,
    };
  }

  return publicView;
}

/**
 * Public branding for a tenant. AgencyConfig also stores admin password
 * hashes and channel tokens, so this is an allowlist for exactly the same
 * reason toPublicProperty is.
 */
export function toPublicAgency(config, tenantId) {
  if (!config) return null;
  return {
    tenantId,
    slug: config.agencySlug || null,
    name: config.agencyName || 'Property Listings',
    logoS3Key: config.agencyLogoS3Key || null,
    brandPrimaryColor: /^#[0-9a-fA-F]{6}$/.test(config.brandPrimaryColor || '')
      ? config.brandPrimaryColor
      : '#FF7A1A',
    publicPhone: config.publicPhone || null,
    publicEmail: config.publicEmail || null,
    publicAddress: config.publicAddress || null,
    about: config.publicAbout || null,
    enabled: config.publicPagesEnabled === true,
  };
}

/**
 * Resolve a tenant from its public subdomain slug.
 *
 * Uses the `agencySlug-index` GSI rather than a table scan: this runs on every
 * inbound public page request, including from crawlers, and a scan per render
 * would be both slow and expensive. Same deploy gate as the other AgencyConfig
 * GSIs — the index must report ACTIVE with Backfilling false before this path
 * is relied on, or lookups will intermittently 404 on real tenants.
 */
export async function getTenantIdByAgencySlug(slug) {
  if (!slug || !isValidAgencySlug(slug)) return null;

  const result = await logger.span(
    'ddb.getTenantByAgencySlug',
    { tableName: AGENCY_CONFIG_TABLE_NAME },
    async () => agencyClient.send(new QueryCommand({
      TableName: AGENCY_CONFIG_TABLE_NAME,
      IndexName: 'agencySlug-index',
      KeyConditionExpression: 'agencySlug = :slug',
      ExpressionAttributeValues: { ':slug': slug },
      Limit: 1,
    })),
  );

  return result.Items?.[0]?.TenantId || null;
}

/**
 * List a tenant's published properties.
 *
 * Queries the existing `search-index` (GSI3) partition `TENANT#<id>#SEARCH`
 * with `begins_with(GSI3SK, 'PROPERTY#')` — the same trick `getLeads` uses.
 * Every PROPERTY item has written GSI3 since `createProperty` was first
 * committed, so no property can exist outside the index and no backfill is
 * needed. This deliberately avoids adding a GSI for a read that is already
 * satisfiable.
 *
 * `publicVisibility` is applied as a DynamoDB FilterExpression, so unpublished
 * items are dropped server-side and never travel over the wire. The filter runs
 * after the key condition, so a tenant with many private listings pays read
 * capacity for them — acceptable at current per-tenant inventory sizes, and the
 * alternative (a dedicated public-listing GSI) is the fix if that changes.
 */
export async function listPublicProperties(tenantId, { limit = 24, cursor = null, city = null } = {}) {
  if (!tenantId) return { items: [], nextCursor: null };

  const safeLimit = Math.min(Math.max(Number(limit) || 24, 1), 50);

  const names = { '#vis': 'publicVisibility', '#st': 'status' };
  const values = {
    ':pk': `TENANT#${tenantId}#SEARCH`,
    ':prefix': 'PROPERTY#',
    ':public': 'public',
    ...Object.fromEntries(
      [...PUBLICLY_MARKETABLE_STATUSES].map((s, i) => [`:st${i}`, s]),
    ),
  };
  const statusPlaceholders = [...PUBLICLY_MARKETABLE_STATUSES].map((_, i) => `:st${i}`);
  let filter = `#vis = :public AND #st IN (${statusPlaceholders.join(', ')})`;

  if (city) {
    names['#city'] = 'city';
    values[':city'] = city;
    filter += ' AND #city = :city';
  }

  const params = {
    TableName: CRM_TABLE_NAME,
    IndexName: 'search-index',
    KeyConditionExpression: 'GSI3PK = :pk AND begins_with(GSI3SK, :prefix)',
    FilterExpression: filter,
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values,
  };

  if (cursor) {
    try {
      params.ExclusiveStartKey = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    } catch {
      // A malformed cursor is a client problem, not a server error: start over
      // rather than 500 on a truncated URL someone pasted into WhatsApp.
      logger.warn('publicListing.bad_cursor', { tenantId });
    }
  }

  // A filtered Query returns up to `Limit` *scanned* items, not matches, so a
  // single page can come back short (or empty) while more matches exist
  // further along. Keep paging until we have a full page or the index ends.
  const items = [];
  let lastKey = params.ExclusiveStartKey || null;
  let pages = 0;

  do {
    if (lastKey) params.ExclusiveStartKey = lastKey;
    params.Limit = safeLimit * 4;
    const result = await docClient.send(new QueryCommand(params));
    items.push(...(result.Items || []));
    lastKey = result.LastEvaluatedKey || null;
    pages += 1;
  } while (lastKey && items.length < safeLimit && pages < 10);

  const page = items.slice(0, safeLimit);
  const hasMore = items.length > safeLimit || Boolean(lastKey);

  let nextCursor = null;
  if (hasMore && page.length > 0) {
    const lastItem = page[page.length - 1];
    nextCursor = Buffer.from(JSON.stringify({
      PK: lastItem.PK,
      SK: lastItem.SK,
      GSI3PK: lastItem.GSI3PK,
      GSI3SK: lastItem.GSI3SK,
    })).toString('base64url');
  }

  return {
    items: page.map((p) => toPublicProperty(p)),
    nextCursor,
  };
}

/**
 * Fetch one published property by id.
 *
 * The public URL carries the propertyId, so this is a point read rather than a
 * slug lookup — no extra index, and a retitled listing keeps working. Returns
 * null for both "no such property" and "exists but not published", so an
 * unpublished listing is indistinguishable from a nonexistent one and the
 * endpoint cannot be used to probe a tenant's private inventory.
 */
export async function getPublicProperty(tenantId, propertyId, { includeAssetKeys = false } = {}) {
  if (!tenantId || !propertyId) return null;

  const property = await getProperty(tenantId, propertyId);
  if (!isPubliclyVisible(property)) return null;

  return toPublicProperty(property, { includeAssetKeys });
}

/**
 * Public agency profile, or null when the tenant has not switched public pages
 * on. Callers treat null as 404.
 */
export async function getPublicAgency(tenantId) {
  if (!tenantId) return null;
  const config = await getAgencyConfig(tenantId);
  const agency = toPublicAgency(config, tenantId);
  if (!agency || !agency.enabled) return null;
  return agency;
}
