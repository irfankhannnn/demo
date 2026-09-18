/**
 * Cross-agency reads for the consumer marketplace.
 *
 * Sits next to publicListingService.js and reuses its allowlist serialisers:
 * every listing leaving here passes through `toPublicProperty()`, every agency
 * card through `toPublicAgency()`. This module adds only the cross-tenant
 * query paths (GSI4 browse, marketplace vector search) and the agency card
 * each listing is decorated with. No raw item is ever returned.
 *
 * Nothing here writes. The marketplace attributes are owned by
 * marketplaceIndexing.js and set on the CRM's own write path.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, BatchGetCommand } from '@aws-sdk/lib-dynamodb';
import { getProperty } from './crmDynamodbService.js';
import { getAgencyConfig } from './agencyConfigService.js';
import {
  toPublicProperty,
  toPublicAgency,
  getTenantIdByAgencySlug,
} from './publicListingService.js';
import {
  isMarketplaceVisible,
  normaliseLocationKey,
  priceSortKey,
} from './marketplaceIndexing.js';
import { semanticMarketplaceSearch, searchMarketplaceVectors } from './services/embeddings/marketplaceSearchService.js';
import { wrapAwsClient } from './awsClientWrapper.js';
import { logger } from './logger.js';

const REGION = process.env.AWS_REGION || 'ap-south-1';
const CRM_TABLE_NAME = process.env.CRM_DYNAMODB_TABLE_NAME;

const docClient = DynamoDBDocumentClient.from(
  wrapAwsClient(new DynamoDBClient({ region: REGION }), 'DynamoDB', { tableName: CRM_TABLE_NAME }),
);

/**
 * Cities the marketplace offers. There is no "distinct cities" index and a
 * Scan for one would be the most expensive read in the system, so the
 * candidate list is configuration and `listMarketplaceCities()` probes each
 * with a Limit-1 Query per mode (cached). Comma-separated display names.
 */
const DEFAULT_CITIES = 'Mumbai,Navi Mumbai,Thane,Pune,Bengaluru,Hyderabad,Chennai,Delhi,Gurugram,Noida,Kolkata,Ahmedabad,Dubai';

export function configuredCities() {
  return String(process.env.MARKETPLACE_CITIES || DEFAULT_CITIES)
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean)
    .map((name) => ({ name, cityKey: normaliseLocationKey(name) }));
}

// ── agency card cache ──────────────────────────────────────────────────────
const AGENCY_TTL_MS = 60 * 1000;
const agencyCards = new Map();

async function getAgencyCard(tenantId) {
  const hit = agencyCards.get(tenantId);
  if (hit && hit.expiresAt > Date.now()) return hit.value;
  const config = await getAgencyConfig(tenantId);
  const card = toMarketplaceAgency(config, tenantId);
  if (agencyCards.size > 2000) agencyCards.clear();
  agencyCards.set(tenantId, { value: card, expiresAt: Date.now() + AGENCY_TTL_MS });
  return card;
}

/** The subset of the public agency profile a listing card carries. */
export function toMarketplaceAgency(config, tenantId) {
  const agency = toPublicAgency(config, tenantId);
  if (!agency) return null;
  return {
    tenantId,
    slug: agency.slug,
    name: agency.name,
    logoS3Key: agency.logoS3Key,
    brandPrimaryColor: agency.brandPrimaryColor,
    publicPhone: agency.publicPhone,
    publicEmail: agency.publicEmail,
    publicAddress: agency.publicAddress,
    about: agency.about,
    marketplaceEnabled: agency.marketplaceEnabled === true,
  };
}

/**
 * A marketplace listing = public property + agency card + the two identifiers
 * the marketplace needs to address it (tenantId for the CRM PK, agencySlug for
 * the public URL). `matchScore` is attached by search callers.
 */
export async function toMarketplaceListing(property, { includeAssetKeys = false, agency = null } = {}) {
  const pub = toPublicProperty(property, { includeAssetKeys });
  if (!pub) return null;
  const card = agency || await getAgencyCard(property.tenantId);
  return {
    ...pub,
    tenantId: property.tenantId,
    agencySlug: card?.slug || null,
    agency: card ? { name: card.name, slug: card.slug, logoS3Key: card.logoS3Key, brandPrimaryColor: card.brandPrimaryColor } : null,
    listedAt: property.mktListedAt || property.updatedAt || null,
  };
}

async function serialiseAll(items, options = {}) {
  const out = [];
  for (const item of items) {
    const listing = await toMarketplaceListing(item, options);
    if (listing) out.push(listing);
  }
  return out;
}

/** Range/equality predicates the index cannot express, applied after the Query. */
function buildFilter({ minPrice, maxPrice, bhk, minBhk, maxBhk, propertyType, furnishing, localityKey }) {
  return (item) => {
    const mode = item.mktMode;
    const price = mode === 'rent'
      ? (item.rentalInfo?.expectedRent ?? item.rentAmount ?? null)
      : (item.saleInfo?.listedPrice ?? item.price ?? null);
    const amount = Number(price) > 0 ? Number(price) : null;

    if (minPrice != null && (amount == null || amount < minPrice)) return false;
    if (maxPrice != null && (amount == null || amount > maxPrice)) return false;

    const rooms = item.bhk != null ? Number(item.bhk) : null;
    if (bhk != null && rooms !== Number(bhk)) return false;
    if (minBhk != null && (rooms == null || rooms < minBhk)) return false;
    if (maxBhk != null && (rooms == null || rooms > maxBhk)) return false;

    if (propertyType && item.propertyType !== propertyType) return false;
    if (furnishing && item.furnishing !== furnishing) return false;
    if (localityKey && item.mktLocalityKey !== localityKey) return false;
    return true;
  };
}

function encodeCursor(item) {
  return Buffer.from(JSON.stringify({
    PK: item.PK, SK: item.SK, GSI4PK: item.GSI4PK, GSI4SK: item.GSI4SK,
  })).toString('base64url');
}

function decodeCursor(cursor) {
  if (!cursor) return null;
  try {
    return JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
  } catch {
    logger.warn('marketplace.bad_cursor', {});
    return null;
  }
}

/**
 * Browse listings in one city + mode, price-sorted, through GSI4.
 *
 * @param {object} params
 * @param {string} params.city            display name or key
 * @param {string} [params.mode]          'sale' | 'rent' (default 'sale')
 * @param {string} [params.sort]          'price_asc' | 'price_desc' | 'newest'
 */
export async function listMarketplaceProperties({
  city, mode = 'sale', locality = null, minPrice = null, maxPrice = null,
  bhk = null, minBhk = null, maxBhk = null, propertyType = null, furnishing = null,
  sort = 'newest', limit = 24, cursor = null,
} = {}) {
  const cityKey = normaliseLocationKey(city);
  if (!cityKey) return { items: [], nextCursor: null };
  const safeMode = mode === 'rent' ? 'rent' : 'sale';
  const safeLimit = Math.min(Math.max(Number(limit) || 24, 1), 50);

  const values = { ':pk': `CITY#${cityKey}#${safeMode}` };
  let keyCondition = 'GSI4PK = :pk';
  // Price bounds go into the key condition (the sort key IS the price) so a
  // "under 80 lakh" browse never reads the crores it will then discard.
  if (minPrice != null || maxPrice != null) {
    values[':lo'] = priceSortKey(minPrice != null ? Math.floor(minPrice) : 0, '');
    values[':hi'] = maxPrice != null ? priceSortKey(Math.ceil(maxPrice), '￿') : 'PRICE#9999999999998#￿';
    keyCondition += ' AND GSI4SK BETWEEN :lo AND :hi';
  }

  const filter = buildFilter({
    bhk, minBhk, maxBhk, propertyType, furnishing,
    localityKey: normaliseLocationKey(locality),
  });

  const params = {
    TableName: CRM_TABLE_NAME,
    IndexName: 'marketplace-index',
    KeyConditionExpression: keyCondition,
    ExpressionAttributeValues: values,
    ScanIndexForward: sort !== 'price_desc',
    Limit: safeLimit * 4,
  };

  const items = [];
  let lastKey = decodeCursor(cursor);
  let pages = 0;
  do {
    if (lastKey) params.ExclusiveStartKey = lastKey;
    const result = await docClient.send(new QueryCommand(params));
    for (const item of result.Items || []) {
      if (filter(item)) items.push(item);
    }
    lastKey = result.LastEvaluatedKey || null;
    pages += 1;
  } while (lastKey && items.length < safeLimit && pages < 10);

  let page = items.slice(0, safeLimit);
  if (sort === 'newest') {
    page = [...page].sort((a, b) => String(b.mktListedAt || '').localeCompare(String(a.mktListedAt || '')));
  }
  const hasMore = items.length > safeLimit || Boolean(lastKey);
  const nextCursor = hasMore && page.length > 0 ? encodeCursor(items[safeLimit - 1] || items[items.length - 1]) : null;

  return { items: await serialiseAll(page), nextCursor, cityKey, mode: safeMode };
}

/**
 * Which configured cities actually have listings right now, with a rough
 * count per mode (capped — it is a hint for chips, not analytics).
 */
const CITY_CACHE_TTL_MS = 5 * 60 * 1000;
let cityCache = { value: null, expiresAt: 0 };

export async function listMarketplaceCities({ force = false } = {}) {
  if (!force && cityCache.value && cityCache.expiresAt > Date.now()) return cityCache.value;

  const cities = [];
  for (const { name, cityKey } of configuredCities()) {
    const counts = {};
    for (const mode of ['sale', 'rent']) {
      const result = await docClient.send(new QueryCommand({
        TableName: CRM_TABLE_NAME,
        IndexName: 'marketplace-index',
        KeyConditionExpression: 'GSI4PK = :pk',
        ExpressionAttributeValues: { ':pk': `CITY#${cityKey}#${mode}` },
        Select: 'COUNT',
        Limit: 500,
      }));
      counts[mode] = result.Count || 0;
    }
    cities.push({ name, cityKey, sale: counts.sale, rent: counts.rent, total: counts.sale + counts.rent });
  }

  const value = cities.filter((c) => c.total > 0);
  cityCache = { value, expiresAt: Date.now() + CITY_CACHE_TTL_MS };
  return value;
}

/** Resolve an agency by slug → its public card, or null when not on the marketplace. */
export async function getMarketplaceAgency(slug) {
  const tenantId = await getTenantIdByAgencySlug(slug);
  if (!tenantId) return null;
  const card = await getAgencyCard(tenantId);
  if (!card || !card.marketplaceEnabled) return null;
  return card;
}

/**
 * One listing by (tenantId, propertyId). Null for missing, unpublished or
 * unlisted — indistinguishable on purpose.
 */
export async function getMarketplaceProperty(tenantId, propertyId, { includeAssetKeys = false } = {}) {
  if (!tenantId || !propertyId) return null;
  const [property, config] = await Promise.all([getProperty(tenantId, propertyId), getAgencyConfig(tenantId)]);
  if (!isMarketplaceVisible(property, config)) return null;
  return toMarketplaceListing(property, { includeAssetKeys, agency: toMarketplaceAgency(config, tenantId) });
}

/** Fetch full items for vector hits (the index projects only filter fields). */
async function hydrate(matches) {
  const keys = matches
    .map((m) => m.item)
    .filter((it) => it.tenantId && it.propertyId)
    .map((it) => ({ PK: `TENANT#${it.tenantId}#PROPERTY#${it.propertyId}`, SK: 'PROFILE' }));
  if (keys.length === 0) return new Map();

  const byKey = new Map();
  for (let i = 0; i < keys.length; i += 25) {
    const result = await docClient.send(new BatchGetCommand({
      RequestItems: { [CRM_TABLE_NAME]: { Keys: keys.slice(i, i + 25) } },
    }));
    for (const item of result.Responses?.[CRM_TABLE_NAME] || []) byKey.set(item.PK, item);
  }
  return byKey;
}

async function attachScores(matches) {
  const full = await hydrate(matches);
  const out = [];
  for (const { item, score } of matches) {
    const property = full.get(`TENANT#${item.tenantId}#PROPERTY#${item.propertyId}`);
    // A hit whose item has since lost its keys (unpublished between index
    // update and read) is skipped rather than shown.
    if (!property || !property.mktCityKey) continue;
    const listing = await toMarketplaceListing(property);
    if (listing) out.push({ ...listing, matchScore: Number((1 - score).toFixed(3)) });
  }
  return out;
}

/**
 * AI search: free text → Titan embedding → marketplace-vector-index, ranked
 * across every opted-in agency in the city, then range-filtered.
 */
export async function searchMarketplace({
  query, city, mode = null, locality = null, propertyType = null,
  minPrice = null, maxPrice = null, bhk = null, minBhk = null, maxBhk = null, furnishing = null,
  limit = 12, scoreThreshold,
} = {}) {
  const cityKey = normaliseLocationKey(city);
  if (!cityKey) return { items: [], cityKey: null, reason: 'city_required' };
  const safeLimit = Math.min(Math.max(Number(limit) || 12, 1), 25);

  let matches;
  try {
    matches = await semanticMarketplaceSearch({
      query,
      cityKey,
      localityKey: normaliseLocationKey(locality),
      mode: mode === 'rent' || mode === 'sale' ? mode : null,
      propertyType: propertyType || null,
      topK: safeLimit,
      scoreThreshold,
      postFilter: buildFilter({ minPrice, maxPrice, bhk, minBhk, maxBhk, furnishing }),
    });
  } catch (error) {
    logger.error('marketplace.search.failed', { cityKey, error: error.message, errorName: error.name });
    return { items: [], cityKey, reason: 'search_unavailable' };
  }

  return { items: await attachScores(matches), cityKey };
}

/** "Similar homes": rank the city by this listing's own stored vector. */
export async function similarMarketplaceProperties(tenantId, propertyId, { limit = 6 } = {}) {
  const [property, config] = await Promise.all([getProperty(tenantId, propertyId), getAgencyConfig(tenantId)]);
  if (!isMarketplaceVisible(property, config)) return [];
  const vector = property.descriptionVector;
  if (!Array.isArray(vector) || vector.length === 0) return [];

  try {
    const matches = await searchMarketplaceVectors({
      cityKey: property.mktCityKey,
      vector,
      mode: property.mktMode,
      topK: limit + 1,
      // Similar listings may be less similar than a targeted query hit.
      scoreThreshold: 0.7,
    });
    const others = matches.filter((m) => m.item.propertyId !== propertyId).slice(0, limit);
    return attachScores(others);
  } catch (error) {
    logger.warn('marketplace.similar.failed', { tenantId, propertyId, error: error.message });
    return [];
  }
}

/** Sitemap feed: every listed (tenantId, slug, propertyId, updatedAt) per city. */
export async function listMarketplaceSitemapEntries({ limitPerCity = 500 } = {}) {
  const entries = [];
  for (const { cityKey } of configuredCities()) {
    for (const mode of ['sale', 'rent']) {
      const result = await docClient.send(new QueryCommand({
        TableName: CRM_TABLE_NAME,
        IndexName: 'marketplace-index',
        KeyConditionExpression: 'GSI4PK = :pk',
        ExpressionAttributeValues: { ':pk': `CITY#${cityKey}#${mode}` },
        ProjectionExpression: 'tenantId, propertyId, updatedAt, publicSlug, title',
        Limit: limitPerCity,
      }));
      for (const item of result.Items || []) {
        const card = await getAgencyCard(item.tenantId);
        if (!card?.slug) continue;
        entries.push({
          agencySlug: card.slug,
          propertyId: item.propertyId,
          updatedAt: item.updatedAt || null,
          cityKey,
          mode,
        });
      }
    }
  }
  return entries;
}

export default {
  configuredCities,
  toMarketplaceAgency,
  toMarketplaceListing,
  listMarketplaceProperties,
  listMarketplaceCities,
  getMarketplaceAgency,
  getMarketplaceProperty,
  searchMarketplace,
  similarMarketplaceProperties,
  listMarketplaceSitemapEntries,
};
