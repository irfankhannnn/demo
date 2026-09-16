#!/usr/bin/env node
/**
 * Backfill / reconcile property embeddings.
 *
 * Two jobs, same code path:
 *  - Backfill: properties that existed before semantic search was added have no
 *    vector and are invisible to match_properties until this runs.
 *  - Reconcile: an embedding whose source text has since changed is worse than a
 *    missing one, because it returns confidently wrong matches with no error.
 *    embeddingSourceHash makes that drift detectable, and this fixes it.
 *
 * Safe to re-run. Items whose hash still matches are skipped without a Bedrock
 * call, so a no-op run costs one Scan and nothing else.
 *
 * Usage:
 *   node scripts/backfill-property-embeddings.js --dry-run
 *   node scripts/backfill-property-embeddings.js --tenant <tenantId>
 *   node scripts/backfill-property-embeddings.js --force
 *
 * Flags:
 *   --dry-run   report what would change, write nothing
 *   --tenant    restrict to one tenant (recommended for a first run)
 *   --force     re-embed even when the hash matches (use after changing the
 *               embedding source fields or the model)
 *   --limit N   stop after N items
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildPropertyEmbedding } from '../services/embeddings/propertySearchService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const CRM_TABLE_NAME = process.env.CRM_DYNAMODB_TABLE_NAME;
const REGION = process.env.AWS_REGION || 'ap-south-1';

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const FORCE = args.includes('--force');
const TENANT = args.includes('--tenant') ? args[args.indexOf('--tenant') + 1] : null;
const LIMIT = args.includes('--limit') ? Number(args[args.indexOf('--limit') + 1]) : Infinity;

/** Bedrock throttles; embedding is not the bottleneck worth optimising. */
const CONCURRENCY = 4;
const RETRY_DELAYS_MS = [500, 2000, 5000];

const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }), {
  marshallOptions: { removeUndefinedValues: true },
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function withRetry(fn, label) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      const retryable =
        error.name === 'ThrottlingException' ||
        error.name === 'TooManyRequestsException' ||
        error.$metadata?.httpStatusCode === 429;
      if (!retryable || attempt >= RETRY_DELAYS_MS.length) throw error;
      await sleep(RETRY_DELAYS_MS[attempt]);
    }
  }
}

async function* scanProperties() {
  let lastKey;
  do {
    const params = {
      TableName: CRM_TABLE_NAME,
      FilterExpression: TENANT
        ? 'EntityType = :type AND tenantId = :tenantId'
        : 'EntityType = :type',
      ExpressionAttributeValues: TENANT
        ? { ':type': 'PROPERTY', ':tenantId': TENANT }
        : { ':type': 'PROPERTY' },
      ExclusiveStartKey: lastKey,
    };
    const page = await docClient.send(new ScanCommand(params));
    for (const item of page.Items || []) yield item;
    lastKey = page.LastEvaluatedKey;
  } while (lastKey);
}

async function processOne(property, stats) {
  const existingHash = FORCE ? null : property.embeddingSourceHash;
  const attributes = await withRetry(
    () => buildPropertyEmbedding(property, existingHash),
    property.propertyId
  );

  if (!attributes) {
    stats.skipped += 1;
    return;
  }

  if (DRY_RUN) {
    stats.wouldUpdate += 1;
    console.log(`  would embed  ${property.propertyId}  ${(property.title || '').slice(0, 50)}`);
    return;
  }

  await withRetry(
    () =>
      docClient.send(
        new UpdateCommand({
          TableName: CRM_TABLE_NAME,
          Key: { PK: property.PK, SK: property.SK },
          UpdateExpression:
            'SET descriptionVector = :v, embeddingSourceHash = :h, embeddingModel = :m, embeddedAt = :t',
          ExpressionAttributeValues: {
            ':v': attributes.descriptionVector,
            ':h': attributes.embeddingSourceHash,
            ':m': attributes.embeddingModel,
            ':t': attributes.embeddedAt,
          },
        })
      ),
    property.propertyId
  );

  stats.updated += 1;
}

async function main() {
  if (!CRM_TABLE_NAME) {
    console.error('CRM_DYNAMODB_TABLE_NAME is not set. Check apps/crm/server/.env');
    process.exit(1);
  }

  console.log(`Table:   ${CRM_TABLE_NAME} (${REGION})`);
  console.log(`Tenant:  ${TENANT || 'ALL'}`);
  console.log(`Mode:    ${DRY_RUN ? 'DRY RUN' : 'WRITE'}${FORCE ? ' (forced re-embed)' : ''}\n`);

  const stats = { scanned: 0, updated: 0, skipped: 0, wouldUpdate: 0, failed: 0 };
  let batch = [];

  const flush = async () => {
    await Promise.all(
      batch.map((p) =>
        processOne(p, stats).catch((error) => {
          stats.failed += 1;
          console.error(`  FAILED ${p.propertyId}: ${error.message}`);
        })
      )
    );
    batch = [];
  };

  for await (const property of scanProperties()) {
    if (stats.scanned >= LIMIT) break;
    stats.scanned += 1;
    batch.push(property);
    if (batch.length >= CONCURRENCY) await flush();
  }
  if (batch.length) await flush();

  console.log('\n─────────────────────────────');
  console.log(`scanned      ${stats.scanned}`);
  console.log(`${DRY_RUN ? 'would embed  ' : 'embedded     '}${DRY_RUN ? stats.wouldUpdate : stats.updated}`);
  console.log(`up to date   ${stats.skipped}`);
  if (stats.failed) console.log(`failed       ${stats.failed}`);

  if (stats.failed) process.exit(1);
}

main().catch((error) => {
  console.error('Backfill failed:', error);
  process.exit(1);
});
