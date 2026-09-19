/**
 * Marketplace index keys — the ONLY place that decides whether a property is
 * visible on the cross-agency marketplace, and the only code that writes the
 * attributes the two marketplace indexes are keyed on.
 *
 * ── why attributes on the CRM item, not a copy ─────────────────────────────
 * The marketplace never mirrors property data. The CRM table stays the single
 * owner; the marketplace reads through /api/internal/marketplace/* and
 * searches through two SPARSE indexes on this same table:
 *
 *   marketplace-index (GSI4)   GSI4PK = CITY#<cityKey>#<mode>
 *                              GSI4SK = PRICE#<13-digit zero-padded>#<propertyId>
 *   marketplace-vector-index   HASH  = mktCityKey  (same descriptionVector as
 *                              the tenant-scoped property-vector-index)
 *                              INLINE = mktLocalityKey, mktMode, propertyType
 *
 * A property is in both indexes exactly when the attributes below exist on
 * the item, and in neither when they don't. Publishing SETs them; unpublishing,
 * unlisting, archiving, selling, renting out, or the agency switching the
 * marketplace off REMOVEs them — in the same table, in one UpdateCommand.
 * There is no sync job and no second store that could drift.
 *
 * ── the visibility rule ────────────────────────────────────────────────────
 * All four must hold:
 *   1. isPubliclyVisible(property)   — publicVisibility === 'public' AND status
 *                                      is openly marketable (publicListingService)
 *   2. property.marketplaceVisibility !== 'unlisted' — per-listing opt-out
 *   3. agency.marketplaceEnabled === true            — per-agency opt-in
 *   4. the property has a city                        — it is the partition key
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { getAgencyConfig } from './agencyConfigService.js';
import { isPubliclyVisible } from './publicListingService.js';
import { wrapAwsClient } from './awsClientWrapper.js';
import { logger } from './logger.js';

const REGION = process.env.AWS_REGION || 'ap-south-1';
const CRM_TABLE_NAME = process.env.CRM_DYNAMODB_TABLE_NAME;

const docClient = DynamoDBDocumentClient.from(
  wrapAwsClient(new DynamoDBClient({ region: REGION }), 'DynamoDB', { tableName: CRM_TABLE_NAME }),
);

/** Every attribute this module owns. REMOVEd as a set, never individually. */
export const MARKETPLACE_KEY_ATTRIBUTES = [
  'GSI4PK', 'GSI4SK', 'mktCityKey', 'mktLocalityKey', 'mktMode', 'mktListedAt',
];

/** Sort-key sentinel for "price on request": sorts after every real price. */
const PRICE_ON_REQUEST = '9999999999999';
const PRICE_WIDTH = 13;

/**
 * Lowercase, trimmed, whitespace-collapsed key for a city or locality name.
 * "Navi Mumbai " and "navi  mumbai" must land in the same partition.
 */
export function normaliseLocationKey(value) {
  const key = String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, '-');
  return key || null;
}

/**
 * Agents type the city the way they say it: "Bangalore", "Gurgaon", "Bombay".
 * The city is the partition key of both marketplace indexes, so two spellings
 * of one city would be two partitions and a buyer searching one would never
 * see the other. Fold the common alternates onto one key.
 */
const CITY_ALIASES = {
  bangalore: 'bengaluru',
  bengalooru: 'bengaluru',
  gurgaon: 'gurugram',
  bombay: 'mumbai',
  'new-delhi': 'delhi',
  'delhi-ncr': 'delhi',
  madras: 'chennai',
  calcutta: 'kolkata',
  poona: 'pune',
  'new-mumbai': 'navi-mumbai',
};

export function normaliseCityKey(value) {
  const key = normaliseLocationKey(value);
  return key ? (CITY_ALIASES[key] || key) : null;
}

/** `sale` | `rent`, matching publicListingService.derivePricing(). */
export function deriveListingMode(property) {
  const isRental = property?.status === 'for-rent' || property?.propertyDealType === 'rent';
  return isRental ? 'rent' : 'sale';
}

/** Amount used for the price sort key, or null when unpriced. */
export function deriveListingAmount(property, mode) {
  const raw = mode === 'rent'
    ? property?.rentalInfo?.expectedRent ?? property?.rentAmount
    : property?.saleInfo?.listedPrice ?? property?.price;
  const amount = Number(raw) || 0;
  return amount > 0 ? Math.round(amount) : null;
}

export function priceSortKey(amount, propertyId) {
  const padded = amount == null
    ? PRICE_ON_REQUEST
    : String(Math.min(amount, 9999999999998)).padStart(PRICE_WIDTH, '0');
  return `PRICE#${padded}#${propertyId}`;
}

/**
 * The visibility rule, in one place.
 * `agency` is the AgencyConfig item (or null when the tenant has none).
 */
export function isMarketplaceVisible(property, agency) {
  if (!property || !agency) return false;
  if (agency.marketplaceEnabled !== true) return false;
  if (!isPubliclyVisible(property)) return false;
  if (property.marketplaceVisibility === 'unlisted') return false;
  return Boolean(normaliseCityKey(property.city));
}

/**
 * Attributes to SET (visible) or the list to REMOVE (hidden).
 *
 * @returns {{ set: object|null, remove: string[] }}
 */
export function computeMarketplaceKeys(property, agency, { now = new Date().toISOString() } = {}) {
  if (!isMarketplaceVisible(property, agency)) {
    return { set: null, remove: MARKETPLACE_KEY_ATTRIBUTES };
  }

  const cityKey = normaliseCityKey(property.city);
  const mode = deriveListingMode(property);
  const amount = deriveListingAmount(property, mode);
  const localityKey = normaliseLocationKey(property.area) || 'unknown';

  return {
    set: {
      GSI4PK: `CITY#${cityKey}#${mode}`,
      GSI4SK: priceSortKey(amount, property.propertyId),
      mktCityKey: cityKey,
      mktLocalityKey: localityKey,
      mktMode: mode,
      // Preserved across re-keys so "New in <city>" ordering is stable; only
      // set fresh when the listing was not previously on the marketplace.
      mktListedAt: property.mktListedAt || now,
    },
    remove: [],
  };
}

/** True when the item already carries exactly these keys (skip the write). */
export function keysAlreadyApplied(property, keys) {
  if (!property) return false;
  if (!keys.set) {
    return MARKETPLACE_KEY_ATTRIBUTES.every((attr) => property[attr] === undefined);
  }
  return Object.entries(keys.set).every(([attr, value]) => property[attr] === value);
}

/**
 * Write the computed keys with a direct UpdateCommand.
 *
 * Deliberately NOT via crmDynamodbService.updateProperty(): that function calls
 * this module at the end of its own write, and going back through it would
 * recurse (and re-run status validation, timeline sync and embedding checks
 * for a change that is purely an index bookkeeping write).
 */
export async function applyMarketplaceKeys(tenantId, propertyId, keys) {
  if (!tenantId || !propertyId) return false;

  const names = {};
  const values = {};
  const parts = [];

  if (keys.set) {
    const sets = Object.entries(keys.set).map(([attr, value], i) => {
      names[`#s${i}`] = attr;
      values[`:s${i}`] = value;
      return `#s${i} = :s${i}`;
    });
    parts.push(`SET ${sets.join(', ')}`);
  }

  if (keys.remove?.length) {
    const removes = keys.remove.map((attr, i) => {
      names[`#r${i}`] = attr;
      return `#r${i}`;
    });
    parts.push(`REMOVE ${removes.join(', ')}`);
  }

  if (parts.length === 0) return false;

  const command = {
    TableName: CRM_TABLE_NAME,
    Key: { PK: `TENANT#${tenantId}#PROPERTY#${propertyId}`, SK: 'PROFILE' },
    UpdateExpression: parts.join(' '),
    ConditionExpression: 'attribute_exists(PK)',
    ExpressionAttributeNames: names,
  };
  if (Object.keys(values).length) command.ExpressionAttributeValues = values;

  try {
    await docClient.send(new UpdateCommand(command));
    return true;
  } catch (err) {
    // The property was deleted between the caller's write and this one; it
    // is out of both indexes already, which is the outcome we wanted.
    if (err.name === 'ConditionalCheckFailedException') return false;
    throw err;
  }
}

// ── agency lookup cache ─────────────────────────────────────────────────────
// Every property write consults the agency's marketplaceEnabled flag. Bulk
// imports write hundreds of properties per tenant; a 60 s cache turns that
// into one AgencyConfig read.
const AGENCY_CACHE_TTL_MS = 60 * 1000;
const agencyCache = new Map();

async function getAgencyCached(tenantId) {
  const hit = agencyCache.get(tenantId);
  if (hit && hit.expiresAt > Date.now()) return hit.value;
  const value = await getAgencyConfig(tenantId);
  if (agencyCache.size > 1000) agencyCache.clear();
  agencyCache.set(tenantId, { value, expiresAt: Date.now() + AGENCY_CACHE_TTL_MS });
  return value;
}

/** Drop a tenant's cached config — called when its marketplace settings change. */
export function invalidateAgencyCache(tenantId) {
  if (tenantId) agencyCache.delete(tenantId);
  else agencyCache.clear();
}

/**
 * The hook every property write calls last. Never throws: a marketplace
 * bookkeeping failure must not fail a CRM save (the backfill script repairs
 * any item this misses).
 *
 * @returns {Promise<{ visible: boolean, changed: boolean, keys?: object }>}
 */
export async function syncPropertyMarketplaceKeys(tenantId, property) {
  if (!tenantId || !property?.propertyId) return { visible: false, changed: false };
  try {
    const agency = await getAgencyCached(tenantId);
    const keys = computeMarketplaceKeys(property, agency);
    if (keysAlreadyApplied(property, keys)) {
      return { visible: Boolean(keys.set), changed: false, keys };
    }
    const changed = await applyMarketplaceKeys(tenantId, property.propertyId, keys);
    logger.info('marketplace.keys.synced', {
      tenantId,
      propertyId: property.propertyId,
      visible: Boolean(keys.set),
      cityKey: keys.set?.mktCityKey || null,
    });
    return { visible: Boolean(keys.set), changed, keys };
  } catch (err) {
    logger.error('marketplace.keys.sync_failed', {
      tenantId, propertyId: property.propertyId, error: err.message,
    });
    return { visible: false, changed: false };
  }
}

/**
 * Re-evaluate every property of a tenant — used when the agency toggles the
 * marketplace on/off and by the backfill script. Walks GSI3 (`search-index`)
 * the same way publicListingService.listPublicProperties does; every PROPERTY
 * item has always carried GSI3.
 *
 * @param {string} tenantId
 * @param {object} [options]
 * @param {boolean} [options.dryRun]
 * @param {object} [options.agency]   pre-fetched AgencyConfig (skips the lookup)
 * @returns {Promise<{ scanned: number, listed: number, removed: number, unchanged: number }>}
 */
export async function syncTenantMarketplaceKeys(tenantId, { dryRun = false, agency = null } = {}) {
  if (!tenantId) throw new Error('Tenant ID is required');
  invalidateAgencyCache(tenantId);
  const config = agency || await getAgencyConfig(tenantId);

  const stats = { scanned: 0, listed: 0, removed: 0, unchanged: 0 };
  let lastKey = null;

  do {
    const result = await docClient.send(new QueryCommand({
      TableName: CRM_TABLE_NAME,
      IndexName: 'search-index',
      KeyConditionExpression: 'GSI3PK = :pk AND begins_with(GSI3SK, :prefix)',
      ExpressionAttributeValues: { ':pk': `TENANT#${tenantId}#SEARCH`, ':prefix': 'PROPERTY#' },
      ExclusiveStartKey: lastKey || undefined,
    }));

    for (const property of result.Items || []) {
      stats.scanned += 1;
      const keys = computeMarketplaceKeys(property, config);
      if (keysAlreadyApplied(property, keys)) {
        stats.unchanged += 1;
        continue;
      }
      if (keys.set) stats.listed += 1; else stats.removed += 1;
      if (!dryRun) await applyMarketplaceKeys(tenantId, property.propertyId, keys);
    }

    lastKey = result.LastEvaluatedKey || null;
  } while (lastKey);

  logger.info('marketplace.keys.tenant_synced', { tenantId, dryRun, ...stats });
  return stats;
}

export default {
  MARKETPLACE_KEY_ATTRIBUTES,
  normaliseLocationKey,
  normaliseCityKey,
  deriveListingMode,
  deriveListingAmount,
  priceSortKey,
  isMarketplaceVisible,
  computeMarketplaceKeys,
  keysAlreadyApplied,
  applyMarketplaceKeys,
  invalidateAgencyCache,
  syncPropertyMarketplaceKeys,
  syncTenantMarketplaceKeys,
};
