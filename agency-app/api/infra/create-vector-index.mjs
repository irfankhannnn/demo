#!/usr/bin/env node
/**
 * Create the DynamoDB vector indexes this backend needs.
 *
 * Invoked by create-vector-index.sh, which sources the right .env file first.
 *
 * Why Node and not the AWS CLI
 * ----------------------------
 * DynamoDB vector search is recent enough that an installed `aws` CLI is very
 * likely to be too old: 2.27.10 rejects `--vector-index-updates` outright and
 * has no `search-vectors` at all. The SDK version is pinned in package.json, so
 * doing it here makes the script reproducible instead of dependent on whatever
 * CLI happens to be on the operator's machine.
 *
 * The shapes below are the SDK's, which differ from the shape the CLI docs
 * suggest — `VectorAttribute` is an object, not a string, and `SearchSchema` is
 * a flat array rather than a nested `SearchSchemaDefinitions`.
 *
 * IMMUTABLE once created. Changing DistanceFunction, the projected attribute
 * set, or Dimensions means delete + recreate + re-embed everything.
 */

import {
  DynamoDBClient,
  DescribeTableCommand,
  UpdateTableCommand,
} from '@aws-sdk/client-dynamodb';

const REGION = process.env.AWS_REGION || 'ap-south-1';
const target = (process.argv[2] || 'all').toLowerCase();

if (!['property', 'policy', 'marketplace', 'all'].includes(target)) {
  console.error('Usage: create-vector-index.mjs [property|policy|marketplace|all]');
  process.exit(1);
}

const client = new DynamoDBClient({ region: REGION });

/**
 * tenantId as the SearchSchema HASH is NOT optional and must never be removed.
 * AWS requires the partition key value in every SearchVectors call, which turns
 * tenant scoping into an API-level requirement that fails the call if omitted,
 * rather than a convention a developer has to remember. Without it, one search
 * would rank vectors from every agency and return their data in the response.
 */
const INDEXES = {
  property: {
    table: process.env.CRM_DYNAMODB_TABLE_NAME,
    envVar: 'CRM_DYNAMODB_TABLE_NAME',
    spec: {
      IndexName: 'property-vector-index',
      VectorAttribute: { AttributeName: 'descriptionVector' },
      Dimensions: 1024,
      DistanceFunction: 'COSINE',
      SearchSchema: [
        { AttributeName: 'tenantId', SearchSchemaElementType: 'HASH' },
        // The CRM table is single-table; without this a property search would
        // also rank leads, owners and every other entity that gains a vector.
        { AttributeName: 'EntityType', SearchSchemaElementType: 'INLINE_FILTER' },
        { AttributeName: 'propertyType', SearchSchemaElementType: 'INLINE_FILTER' },
      ],
      // Must carry every field used for post-search range filtering (price,
      // bhk, status): inline filters are equality-only, so range predicates run
      // in Lambda against whatever the index projected. Adding a field later is
      // not possible without a rebuild.
      Projection: {
        ProjectionType: 'INCLUDE',
        NonKeyAttributes: [
          'propertyId', 'title', 'description', 'area', 'city', 'buildingName',
          'bhk', 'furnishing', 'status', 'rentAmount', 'price', 'carpetArea', 'amenities',
        ],
      },
    },
  },

  /**
   * Consumer marketplace: the SAME descriptionVector on the SAME table, but
   * HASH-keyed by city instead of tenant so one search ranks listings from
   * every opted-in agency. Only marketplace-visible items carry mktCityKey
   * (marketplaceIndexing.js), so the index is sparse and unlisting a property
   * removes it from the index rather than filtering it out.
   *
   * Projection is deliberately small: the search returns keys + the fields
   * post-filters need; marketplaceListingService BatchGets the full items and
   * serialises them through the public allowlist. Adding a field later is
   * not possible without a rebuild, so only filter fields are projected.
   */
  marketplace: {
    table: process.env.CRM_DYNAMODB_TABLE_NAME,
    envVar: 'CRM_DYNAMODB_TABLE_NAME',
    spec: {
      IndexName: 'marketplace-vector-index',
      VectorAttribute: { AttributeName: 'descriptionVector' },
      Dimensions: 1024,
      DistanceFunction: 'COSINE',
      SearchSchema: [
        { AttributeName: 'mktCityKey', SearchSchemaElementType: 'HASH' },
        { AttributeName: 'mktLocalityKey', SearchSchemaElementType: 'INLINE_FILTER' },
        { AttributeName: 'mktMode', SearchSchemaElementType: 'INLINE_FILTER' },
        { AttributeName: 'propertyType', SearchSchemaElementType: 'INLINE_FILTER' },
      ],
      Projection: {
        ProjectionType: 'INCLUDE',
        NonKeyAttributes: [
          'propertyId', 'tenantId', 'bhk', 'status', 'furnishing',
          'rentAmount', 'price', 'mktListedAt',
        ],
      },
    },
  },

  policy: {
    table: process.env.KNOWLEDGE_CHUNKS_DYNAMODB_TABLE_NAME,
    envVar: 'KNOWLEDGE_CHUNKS_DYNAMODB_TABLE_NAME',
    spec: {
      IndexName: 'knowledge-vector-index',
      VectorAttribute: { AttributeName: 'contentVector' },
      Dimensions: 1024,
      DistanceFunction: 'COSINE',
      SearchSchema: [
        { AttributeName: 'tenantId', SearchSchemaElementType: 'HASH' },
        // Ingestion always writes a category (defaulting to "policies")
        // precisely so no chunk is ever missing this filter attribute.
        { AttributeName: 'category', SearchSchemaElementType: 'INLINE_FILTER' },
      ],
      // chunkText is projected because the retrieved passage IS the answer. An
      // index returning only ids would need a second round trip per hit, inside
      // a live phone call.
      Projection: {
        ProjectionType: 'INCLUDE',
        NonKeyAttributes: ['chunkText', 'documentTitle', 'policyId', 'chunkIndex', 'category'],
      },
    },
  },
};

async function describe(table) {
  try {
    const result = await client.send(new DescribeTableCommand({ TableName: table }));
    return result.Table;
  } catch (error) {
    if (error.name === 'ResourceNotFoundException') return null;
    throw error;
  }
}

async function createIndex(key) {
  const { table, envVar, spec } = INDEXES[key];

  console.log(`\n--- ${spec.IndexName} on ${table || `(${envVar} unset)`} ---`);

  if (!table) {
    console.error(`ERROR: ${envVar} is not set in the env file.`);
    return false;
  }

  const description = await describe(table);
  if (!description) {
    console.error(`ERROR: table '${table}' not found. Deploy the backend stack first.`);
    return false;
  }

  // Re-creating re-embeds everything, so never silently replace one.
  const existing = (description.VectorIndexes || []).find((i) => i.IndexName === spec.IndexName);
  if (existing) {
    console.log(`Already exists (status: ${existing.IndexStatus}) — nothing to do.`);
    return true;
  }

  // Vector indexes require on-demand capacity.
  const billing = description.BillingModeSummary?.BillingMode;
  if (billing !== 'PAY_PER_REQUEST') {
    console.error(`ERROR: vector indexes require on-demand capacity; table is '${billing}'.`);
    return false;
  }

  console.log('Creating (returns immediately; backfill runs async)...');
  await client.send(
    new UpdateTableCommand({
      TableName: table,
      AttributeDefinitions: spec.SearchSchema.map((element) => ({
        AttributeName: element.AttributeName,
        AttributeType: 'S',
      })),
      VectorIndexUpdates: [{ Create: spec }],
    })
  );

  console.log('Creation started.');
  return true;
}

/**
 * DynamoDB allows one vector-index create/delete per table at a time. When a
 * run creates two on the CRM table (property + marketplace), wait for the
 * first to leave CREATING before starting the second.
 */
async function waitForIndexNotCreating(table, indexName) {
  for (let i = 0; i < 120; i += 1) {
    const description = await describe(table);
    const idx = (description?.VectorIndexes || []).find((v) => v.IndexName === indexName);
    if (!idx || idx.IndexStatus !== 'CREATING') return;
    if (i === 0) console.log(`Waiting for ${indexName} to finish CREATING before the next index...`);
    await new Promise((r) => setTimeout(r, 5000));
  }
}

const targets = target === 'all' ? ['property', 'marketplace', 'policy'] : [target];

console.log(`Region: ${REGION}`);
console.log(`Target: ${target}`);

let ok = true;
for (const key of targets) {
  // Sequential: two UpdateTable calls against the same table would conflict,
  // and a clear per-index result is easier to act on than an interleaved one.
  if (key === 'marketplace' && INDEXES.property.table) {
    await waitForIndexNotCreating(INDEXES.property.table, INDEXES.property.spec.IndexName);
  }
  ok = (await createIndex(key)) && ok;
}

console.log(`
-------------------------------------------------------------------------------
An index is NOT searchable until its backfill finishes. Poll with:

  node infra/check-vector-index.mjs

Wait for ACTIVE with Backfilling false before searching. Querying a backfilling
index returns partial results with no error, which reads as "no matches" rather
than as a fault.

Then populate the vectors:
  node scripts/backfill-property-embeddings.js     # properties
  node scripts/reindex-policies.js                 # policy documents
-------------------------------------------------------------------------------`);

process.exit(ok ? 0 : 1);
