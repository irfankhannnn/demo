/**
 * Standalone property search API for the Instagram Lead Desk.
 *
 * The CRM already has a semantic property search, but reaching it needs either
 * the AI-calling service key or a Cognito ID token that expires in an hour.
 * Neither is something a desktop app can hold, so this Lambda reads the same
 * DynamoDB table directly behind a single static api key.
 *
 * It is read-only by construction: the IAM role has Query, Scan, GetItem and
 * SearchVectors and nothing that writes.
 */

import { DynamoDBClient, SearchVectorsCommand } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient, GetCommand, QueryCommand, ScanCommand,
} from '@aws-sdk/lib-dynamodb';
import {
  BedrockRuntimeClient, InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime';

const TABLE = process.env.PROPERTIES_TABLE_NAME;
const VECTOR_INDEX = process.env.VECTOR_INDEX_NAME || '';
const TENANT_ID = process.env.TENANT_ID || '';
const API_KEY = process.env.API_KEY || '';
const MODEL_ID = process.env.EMBEDDING_MODEL_ID || 'amazon.titan-embed-text-v2:0';
const DIMENSIONS = Number(process.env.EMBEDDING_DIMENSIONS || 1024);
// The CRM stores cosine *distance*, so lower is better. Same default the
// backend's vectorSearchService uses.
const SCORE_THRESHOLD = Number(process.env.VECTOR_SCORE_THRESHOLD || 0.55);
// How many rows the keyword path will pull before it gives up paging. An agency
// inventory is hundreds of listings, not millions, and this endpoint answers a
// human typing in a desktop app.
const MAX_POOL = Number(process.env.MAX_POOL_SIZE || 1000);

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
});
const bedrock = new BedrockRuntimeClient({});

const ALIVE_STATUSES = ['available', 'for-sale', 'for-rent', 'active'];
const DEAD_STATUSES = ['sold', 'rented', 'inactive', 'unavailable', 'closed',
  'archived', 'out-of-stock'];

/* ------------------------------------------------------------- reading -- */

/**
 * First present value from a list of dotted, case-insensitive paths.
 *
 * Deliberately the same shape as property_search.normalise_property's dig() in
 * the python client. The CRM writes both a nested object and a flat mirror for
 * price (rentalInfo.expectedRent plus rentAmount), and the vector index
 * projects only the flat one, so a row can arrive either way.
 */
function dig(raw, ...paths) {
  for (const path of paths) {
    let node = raw;
    for (const part of path.split('.')) {
      if (node && typeof node === 'object' && !Array.isArray(node)) {
        const key = Object.keys(node).find(
          (k) => k.toLowerCase() === part.toLowerCase());
        node = key === undefined ? undefined : node[key];
      } else {
        node = undefined;
        break;
      }
    }
    if (node !== undefined && node !== null && node !== '') return node;
  }
  return undefined;
}

function num(value) {
  const parsed = Number(String(value ?? '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function priceOf(row) {
  return num(dig(row, 'rentAmount', 'rentalInfo.expectedRent', 'price',
    'saleInfo.listedPrice', 'saleInfo.expectedPrice', 'expectedPrice'));
}

/** Everything the client needs, with the vectors stripped back out. */
function shape(row, score, matchedOn) {
  const out = {};
  for (const [key, value] of Object.entries(row || {})) {
    if (/vector$/i.test(key)) continue;          // 1024 floats help nobody here
    out[key] = value;
  }
  if (score !== undefined) out._score = score;
  if (matchedOn) out.matchedOn = matchedOn;
  return out;
}

/* ------------------------------------------------------------ embedding -- */

async function embed(text) {
  const body = JSON.stringify({
    inputText: String(text).slice(0, 8000),
    dimensions: DIMENSIONS,
    normalize: true,
  });
  const response = await bedrock.send(new InvokeModelCommand({
    modelId: MODEL_ID,
    contentType: 'application/json',
    accept: 'application/json',
    body,
  }));
  const parsed = JSON.parse(new TextDecoder().decode(response.body));
  const vector = parsed.embedding || parsed.embeddings?.[0];
  if (!Array.isArray(vector) || !vector.length) {
    throw new Error('embedding model returned no vector');
  }
  return vector;
}

function cosineSimilarity(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    const x = Number(a[i]);
    const y = Number(b[i]);
    dot += x * y;
    normA += x * x;
    normB += y * y;
  }
  if (!normA || !normB) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/* ------------------------------------------------------------- the pool -- */

/**
 * Every property row this tenant has.
 *
 * Prefers the search-index GSI (GSI3PK = TENANT#<t>#SEARCH), which is the
 * cheapest way to list one tenant's properties. Falls back to a filtered Scan,
 * which is what the CRM's own getProperties does, if that index is missing or
 * the keys were never written.
 */
async function loadPool() {
  const rows = [];
  let key;
  try {
    do {
      const page = await ddb.send(new QueryCommand({
        TableName: TABLE,
        IndexName: 'search-index',
        KeyConditionExpression: 'GSI3PK = :pk AND begins_with(GSI3SK, :sk)',
        ExpressionAttributeValues: {
          ':pk': `TENANT#${TENANT_ID}#SEARCH`,
          ':sk': 'PROPERTY#',
        },
        ExclusiveStartKey: key,
      }));
      rows.push(...(page.Items || []));
      key = page.LastEvaluatedKey;
    } while (key && rows.length < MAX_POOL);
    if (rows.length) return rows;
  } catch (err) {
    console.warn('search-index query failed, scanning instead:', err.message);
  }

  key = undefined;
  do {
    const page = await ddb.send(new ScanCommand({
      TableName: TABLE,
      FilterExpression: '#et = :type AND tenantId = :tenantId',
      ExpressionAttributeNames: { '#et': 'EntityType' },
      ExpressionAttributeValues: { ':type': 'PROPERTY', ':tenantId': TENANT_ID },
      ExclusiveStartKey: key,
    }));
    rows.push(...(page.Items || []));
    key = page.LastEvaluatedKey;
  } while (key && rows.length < MAX_POOL);
  return rows;
}

/* -------------------------------------------------------------- filters -- */

function passesFilters(row, filters) {
  const status = String(dig(row, 'status', 'availability') || '').toLowerCase();
  if (DEAD_STATUSES.includes(status)) return false;

  const locality = String(filters.locality || '').trim().toLowerCase();
  if (locality) {
    // The CRM calls this attribute "area". Match on any word of the requested
    // locality so "Kurla West" still finds a listing filed as "Kurla".
    const haystack = [
      dig(row, 'area', 'locality', 'sublocality'),
      dig(row, 'buildingName', 'society'),
      dig(row, 'title'),
      dig(row, 'city'),
    ].filter(Boolean).join(' ').toLowerCase();
    const words = locality.split(/[^a-z]+/).filter((w) => w.length > 3);
    if (words.length && !words.some((w) => haystack.includes(w))) return false;
  }

  if (filters.bhk) {
    const wanted = String(filters.bhk).match(/\d+(\.\d+)?/)?.[0];
    const have = String(dig(row, 'bhk', 'configuration', 'bedrooms') || '');
    if (wanted && !have.includes(wanted)) return false;
  }

  const deal = String(filters.dealType || '').toLowerCase();
  if (deal) {
    const rent = num(dig(row, 'rentAmount', 'rentalInfo.expectedRent'));
    const sale = num(dig(row, 'price', 'saleInfo.listedPrice'));
    if (deal.startsWith('rent') || deal.startsWith('heavy')) {
      if (status === 'for-sale') return false;
      if (sale && !rent) return false;
    } else if (deal.startsWith('buy') || deal.startsWith('sale')) {
      if (status === 'for-rent') return false;
      if (rent && !sale) return false;
    }
  }

  // A row with no price is kept even when a budget was given: the vector index
  // does not project every pricing attribute, and dropping those rows would
  // silently hide listings that are in budget.
  const price = priceOf(row);
  if (price) {
    if (filters.minPrice && price < num(filters.minPrice)) return false;
    if (filters.maxPrice && price > num(filters.maxPrice)) return false;
  }
  return true;
}

/* ------------------------------------------------------------- scoring -- */

const STOPWORDS = new Set(['the', 'and', 'for', 'with', 'near', 'any', 'show',
  'find', 'need', 'want', 'looking', 'please', 'property', 'properties', 'flat',
  'flats', 'house', 'budget', 'around', 'under', 'about', 'available', 'bhk']);

function keywordScore(row, query) {
  const haystack = [
    dig(row, 'area', 'locality'), dig(row, 'buildingName', 'society'),
    dig(row, 'title'), dig(row, 'city'), dig(row, 'propertyType'),
    dig(row, 'furnishing'), dig(row, 'description'),
  ].filter(Boolean).join(' ').toLowerCase();
  const tokens = String(query || '').toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
  if (!tokens.length) return 0.1;                // no query: everything ties
  const hits = tokens.filter((t) => haystack.includes(t));
  return hits.length / tokens.length;
}

/* -------------------------------------------------------------- routes -- */

/** Attribute-value form back to plain JSON, vectors dropped. */
function unmarshallShallow(item) {
  const out = {};
  for (const [key, value] of Object.entries(item || {})) {
    if (!value || typeof value !== 'object') {
      out[key] = value;
      continue;
    }
    if (/vector$/i.test(key)) continue;
    if ('S' in value) out[key] = value.S;
    else if ('N' in value) out[key] = Number(value.N);
    else if ('BOOL' in value) out[key] = value.BOOL;
    else if ('NULL' in value) out[key] = null;
    else if ('M' in value) out[key] = unmarshallShallow(value.M);
    else if ('L' in value) {
      out[key] = value.L.map((entry) => (
        entry && typeof entry === 'object' && 'M' in entry
          ? unmarshallShallow(entry.M)
          : entry?.S ?? (entry?.N !== undefined ? Number(entry.N) : entry)));
    }
  }
  return out;
}

async function searchViaVectorIndex(query, filters, limit) {
  const vector = await embed(query);
  const conditions = ['tenantId = :tenantId'];
  const values = { ':tenantId': { S: TENANT_ID } };
  if (filters.propertyType) {
    // propertyType is the index's only inline equality filter. Everything else
    // is applied below, after the search.
    conditions.push('propertyType = :propertyType');
    values[':propertyType'] = { S: String(filters.propertyType) };
  }
  const response = await ddb.send(new SearchVectorsCommand({
    TableName: TABLE,
    IndexName: VECTOR_INDEX,
    // The query vector takes no L wrapper, unlike the stored attribute.
    SearchVector: vector.map((n) => ({ N: String(n) })),
    TopK: Math.min(Math.max(limit * 4, limit), 100),
    SearchConditionExpression: conditions.join(' AND '),
    ExpressionAttributeValues: values,
  }));

  // SearchVectors answers with SearchResults, not Items, and a miss on that
  // name reads as "no matches" rather than as an error.
  return (response.SearchResults || [])
    .map((entry) => ({
      // Scores are COSINE distance: lower is more similar. Flipped here so the
      // client can read _score the same way on every path.
      distance: Number(entry.Score ?? entry.score ?? Number.POSITIVE_INFINITY),
      row: unmarshallShallow(entry.Item || entry),
    }))
    .filter((r) => Number.isFinite(r.distance) && r.distance <= SCORE_THRESHOLD)
    .sort((a, b) => a.distance - b.distance)
    .filter((r) => passesFilters(r.row, filters))
    .slice(0, limit)
    .map((r) => shape(r.row, Math.max(0, 1 - r.distance), 'semantic match'));
}

async function searchLocally(query, filters, limit) {
  const pool = await loadPool();
  const candidates = pool.filter((row) => passesFilters(row, filters));

  const vectored = candidates.filter(
    (row) => Array.isArray(dig(row, 'descriptionVector')));
  if (vectored.length) {
    const vector = await embed(query);
    const scored = vectored.map((row) => ({
      row,
      score: cosineSimilarity(vector, dig(row, 'descriptionVector')),
    })).sort((a, b) => b.score - a.score);
    return {
      properties: scored.slice(0, limit)
        .map((s) => shape(s.row, s.score, 'semantic match')),
      source: 'vector',
      pool: pool.length,
    };
  }

  const scored = candidates
    .map((row) => ({ row, score: keywordScore(row, query) }))
    .sort((a, b) => b.score - a.score);
  return {
    properties: scored.slice(0, limit)
      .map((s) => shape(s.row, s.score, 'keyword match')),
    source: 'keyword',
    pool: pool.length,
  };
}

async function handleSearch(body) {
  const query = String(body.query || '').trim();
  const limit = Math.min(Math.max(Number(body.limit) || 8, 1), 50);
  const filters = body.filters && typeof body.filters === 'object'
    ? body.filters : {};

  if (VECTOR_INDEX && query) {
    try {
      const properties = await searchViaVectorIndex(query, filters, limit);
      if (properties.length) {
        return { properties, source: 'vector', pool: properties.length };
      }
      // An empty answer from the index is not proof of an empty inventory: the
      // index may never have been backfilled for this tenant. Check the table.
      console.warn('vector index returned nothing, falling back to the table');
    } catch (err) {
      console.warn('vector index search failed:', err.message);
    }
  }
  return searchLocally(query, filters, limit);
}

async function handleGet(propertyId) {
  const direct = await ddb.send(new GetCommand({
    TableName: TABLE,
    Key: {
      PK: `TENANT#${TENANT_ID}#PROPERTY#${propertyId}`,
      SK: 'PROFILE',
    },
  })).catch((err) => {
    console.warn('GetItem failed:', err.message);
    return {};
  });
  if (direct.Item) return shape(direct.Item, 1, 'exact id');

  // Not the primary key, so it may be a publicSlug or a legacy id. The pool is
  // small enough that one pass over it is cheaper than another index.
  const wanted = String(propertyId).toLowerCase();
  const pool = await loadPool();
  const found = pool.find((row) => [
    dig(row, 'propertyId', 'id'), dig(row, 'publicSlug', 'slug'),
  ].some((value) => String(value ?? '').toLowerCase() === wanted));
  return found ? shape(found, 1, 'exact id') : null;
}

async function handleHealth() {
  let pool = 0;
  let error = '';
  try {
    pool = (await loadPool()).length;
  } catch (err) {
    error = err.message;
  }
  return {
    ok: !error,
    table: TABLE,
    vectorIndex: VECTOR_INDEX || '',
    pool,
    ...(error ? { error } : {}),
  };
}

/* ------------------------------------------------------------- handler -- */

function corsHeaders(event) {
  // Function URL CORS has no port wildcard, so any localhost origin is echoed
  // back here as well. Reads are api-key guarded, and no cookie is involved.
  const origin = event?.headers?.origin || event?.headers?.Origin || '';
  const local = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin);
  return {
    'content-type': 'application/json',
    'access-control-allow-origin': local ? origin : '*',
    'access-control-allow-headers': 'content-type,x-api-key',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
  };
}

function reply(event, statusCode, payload) {
  return {
    statusCode,
    headers: corsHeaders(event),
    body: JSON.stringify(payload),
  };
}

export const handler = async (event) => {
  const method = (event?.requestContext?.http?.method || 'GET').toUpperCase();
  const path = (event?.requestContext?.http?.path || event?.rawPath || '/')
    .replace(/\/+$/, '') || '/';

  if (method === 'OPTIONS') return reply(event, 204, {});

  const headers = event?.headers || {};
  const given = headers['x-api-key'] || headers['X-Api-Key'] || '';
  if (!API_KEY || given !== API_KEY) {
    return reply(event, 401, { error: 'unauthorised' });
  }

  try {
    if (method === 'POST' && path === '/properties/search') {
      let body = {};
      if (event.body) {
        const raw = event.isBase64Encoded
          ? Buffer.from(event.body, 'base64').toString('utf8') : event.body;
        body = JSON.parse(raw || '{}');
      }
      return reply(event, 200, await handleSearch(body));
    }

    if (method === 'GET' && path === '/health') {
      return reply(event, 200, await handleHealth());
    }

    if (method === 'GET' && path.startsWith('/properties/')) {
      const id = decodeURIComponent(path.slice('/properties/'.length));
      const property = await handleGet(id);
      return property
        ? reply(event, 200, { property })
        : reply(event, 404, { error: `${id} not found` });
    }

    return reply(event, 404, { error: `no route for ${method} ${path}` });
  } catch (err) {
    console.error('request failed:', err);
    return reply(event, 500, { error: err.message || 'internal error' });
  }
};
