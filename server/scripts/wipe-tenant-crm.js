/**
 * wipe-tenant-crm.js — purge CRM operational data for one tenant.
 *
 * SAFETY
 * ------
 * Requires BOTH:
 *   --tenant=<id>
 *   --confirm=WIPE_<tenantId>
 *
 * Optional:
 *   --keep-team     keep TEAM_MEMBER / agency config rows
 *   --dry-run       list counts only, do not delete
 *
 * USAGE
 * -----
 *   node server/scripts/wipe-tenant-crm.js --tenant=acme-corp --confirm=WIPE_acme-corp
 *
 * ENVIRONMENT
 * -----------
 *   CRM_DYNAMODB_TABLE_NAME (required)
 *   KHATA_TABLE_NAME (optional)
 *   NOTIFICATIONS_TABLE_NAME (optional)
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  ScanCommand,
  BatchWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { wrapAwsClient } from '../awsClientWrapper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const REGION = process.env.AWS_REGION || 'ap-south-1';
const CRM_TABLE = process.env.CRM_DYNAMODB_TABLE_NAME;
const KHATA_TABLE = process.env.KHATA_TABLE_NAME || 'cloudberry-real-estate-khata';
const NOTIFICATIONS_TABLE =
  process.env.NOTIFICATIONS_TABLE_NAME || 'cloudberry-real-estate-notifications';
const ENDPOINT = process.env.DYNAMODB_ENDPOINT || undefined;

const KEEP_ENTITY_TYPES = new Set([
  'TEAM_MEMBER',
  'AGENCY_CONFIG',
  'SUBSCRIPTION',
  'CREDIT_LEDGER',
  'USER_CATEGORY',
]);

function parseArgs(argv) {
  const args = { tenant: null, confirm: null, dryRun: false, keepTeam: false, help: false };
  for (const a of argv.slice(2)) {
    if (a === '--help' || a === '-h') args.help = true;
    else if (a === '--dry-run') args.dryRun = true;
    else if (a === '--keep-team') args.keepTeam = true;
    else if (a.startsWith('--tenant=')) args.tenant = a.slice('--tenant='.length);
    else if (a.startsWith('--confirm=')) args.confirm = a.slice('--confirm='.length);
  }
  return args;
}

async function scanTenantKeys(docClient, table, tenantId) {
  const keys = [];
  let ExclusiveStartKey;
  do {
    const scan = await docClient.send(new ScanCommand({
      TableName: table,
      FilterExpression: 'tenantId = :t',
      ExpressionAttributeValues: { ':t': tenantId },
      ProjectionExpression: 'PK, SK, EntityType',
      ExclusiveStartKey,
    }));
    for (const item of scan.Items || []) {
      keys.push({ PK: item.PK, SK: item.SK, EntityType: item.EntityType || null });
    }
    ExclusiveStartKey = scan.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return keys;
}

async function deleteKeys(docClient, table, keys, dryRun) {
  if (dryRun) return 0;
  let removed = 0;
  for (let i = 0; i < keys.length; i += 25) {
    const batch = keys.slice(i, i + 25);
    await docClient.send(new BatchWriteCommand({
      RequestItems: {
        [table]: batch.map((it) => ({
          DeleteRequest: { Key: { PK: it.PK, SK: it.SK } },
        })),
      },
    }));
    removed += batch.length;
  }
  return removed;
}

function summarize(keys) {
  const byType = {};
  for (const k of keys) {
    const t = k.EntityType || 'UNKNOWN';
    byType[t] = (byType[t] || 0) + 1;
  }
  return byType;
}

async function main() {
  const cli = parseArgs(process.argv);
  const out = [];
  const log = (m) => { out.push(m); console.log(m); };

  if (cli.help || !cli.tenant) {
    log('Usage: node wipe-tenant-crm.js --tenant=<id> --confirm=WIPE_<id> [--dry-run] [--keep-team]');
    fs.writeFileSync(path.join(__dirname, '_wipe-out.txt'), out.join('\n'));
    process.exit(cli.help ? 0 : 1);
  }

  if (!CRM_TABLE) {
    log('ERROR: CRM_DYNAMODB_TABLE_NAME is not set');
    fs.writeFileSync(path.join(__dirname, '_wipe-out.txt'), out.join('\n'));
    process.exit(1);
  }

  const expected = `WIPE_${cli.tenant}`;
  if (cli.confirm !== expected) {
    log(`ERROR: refuse wipe without --confirm=${expected}`);
    fs.writeFileSync(path.join(__dirname, '_wipe-out.txt'), out.join('\n'));
    process.exit(1);
  }

  const ddbClient = wrapAwsClient(
    new DynamoDBClient({ region: REGION, ...(ENDPOINT ? { endpoint: ENDPOINT } : {}) }),
    'DynamoDB',
    { tableName: 'wipe-tenant' },
  );
  const docClient = DynamoDBDocumentClient.from(ddbClient, {
    marshallOptions: { removeUndefinedValues: true },
  });

  log(`[wipe] tenant=${cli.tenant} table=${CRM_TABLE} dryRun=${cli.dryRun}`);

  const crmKeysAll = await scanTenantKeys(docClient, CRM_TABLE, cli.tenant);
  let crmKeys = crmKeysAll;
  if (cli.keepTeam) {
    crmKeys = crmKeysAll.filter((k) => !KEEP_ENTITY_TYPES.has(k.EntityType));
  }

  log(`[wipe] CRM matched=${crmKeysAll.length} willDelete=${crmKeys.length}`);
  log(`[wipe] CRM byType=${JSON.stringify(summarize(crmKeys))}`);

  const crmRemoved = await deleteKeys(docClient, CRM_TABLE, crmKeys, cli.dryRun);

  let khataRemoved = 0;
  let notifRemoved = 0;
  try {
    const khataKeys = await scanTenantKeys(docClient, KHATA_TABLE, cli.tenant);
    log(`[wipe] KHATA matched=${khataKeys.length}`);
    khataRemoved = await deleteKeys(docClient, KHATA_TABLE, khataKeys, cli.dryRun);
  } catch (e) {
    log(`[wipe] KHATA skip: ${e.message}`);
  }
  try {
    const notifKeys = await scanTenantKeys(docClient, NOTIFICATIONS_TABLE, cli.tenant);
    log(`[wipe] NOTIF matched=${notifKeys.length}`);
    notifRemoved = await deleteKeys(docClient, NOTIFICATIONS_TABLE, notifKeys, cli.dryRun);
  } catch (e) {
    log(`[wipe] NOTIF skip: ${e.message}`);
  }

  log(`[wipe] done crmRemoved=${crmRemoved} khataRemoved=${khataRemoved} notifRemoved=${notifRemoved}`);
  fs.writeFileSync(path.join(__dirname, '_wipe-out.txt'), out.join('\n'));
}

main().catch((err) => {
  fs.writeFileSync(
    path.join(__dirname, '_wipe-out.txt'),
    `FATAL ${err.stack || err.message}`,
  );
  process.exit(1);
});
