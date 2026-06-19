import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { logger } from './logger.js';

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'ap-south-1',
  ...(process.env.DYNAMODB_ENDPOINT && { endpoint: process.env.DYNAMODB_ENDPOINT }),
});
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.CREDIT_CONFIG_TABLE_NAME || 'cloudberry-real-estate-credit-config';

const DEFAULTS = {
  FREE_TIER: { monthlyFreeCredits: 1000 },
  PACKS: {
    starter: { label: 'Starter', priceMonthly: 1999, monthlyCredits: 5000, razorpayPlan: 'plan_team' },
    professional: { label: 'Professional', priceMonthly: 4999, monthlyCredits: 15000, razorpayPlan: 'plan_teamplus' },
    annualDiscountPct: 20,
    overagePricePerCredit: 0.10,
    creditPacks: {
      pack_500: { credits: 500, priceInr: 499 },
      pack_2000: { credits: 2000, priceInr: 1799 },
      pack_5000: { credits: 5000, priceInr: 3999 },
    },
  },
  COSTS: {
    lead_add: 10,
    contact_add: 5,
    property_add: 8,
    owner_add: 3,
    tenant_add: 3,
    khata_entry: 1,
    record_update: 1,
    agent_action: 15,
    whatsapp_send: 1,
    email_send: 1,
    bulk_import_per_record: 8,
    analytics_report: 5,
  },
};

let cache = null;
let cacheExpiry = 0;
const CACHE_TTL_MS = 60_000;

async function loadConfig() {
  if (cache && Date.now() < cacheExpiry) return cache;

  try {
    const items = {};
    for (const key of ['FREE_TIER', 'PACKS', 'COSTS']) {
      const result = await docClient.send(new GetCommand({
        TableName: TABLE_NAME,
        Key: { configKey: key },
      }));
      items[key] = result.Item?.value ?? DEFAULTS[key];
    }
    cache = items;
    cacheExpiry = Date.now() + CACHE_TTL_MS;
    return items;
  } catch (err) {
    logger.warn('creditConfig.load.failed', { error: err.message });
    return DEFAULTS;
  }
}

export function clearConfigCache() {
  cache = null;
  cacheExpiry = 0;
}

export async function getCosts() {
  const config = await loadConfig();
  return config.COSTS;
}

export async function getPacks() {
  const config = await loadConfig();
  return config.PACKS;
}

export async function getFreeTier() {
  const config = await loadConfig();
  return config.FREE_TIER;
}

export async function getFullConfig() {
  return loadConfig();
}

export async function updateConfig(key, value) {
  if (!['FREE_TIER', 'PACKS', 'COSTS'].includes(key)) {
    throw new Error(`Invalid config key: ${key}`);
  }
  await docClient.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: {
      configKey: key,
      value,
      updatedAt: new Date().toISOString(),
    },
  }));
  clearConfigCache();
  return value;
}

/**
 * Seed default config values (idempotent — only writes missing keys).
 */
export async function seedDefaultConfig() {
  for (const [key, value] of Object.entries(DEFAULTS)) {
    const existing = await docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: { configKey: key },
    }));
    if (!existing.Item) {
      await docClient.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: { configKey: key, value, seededAt: new Date().toISOString() },
      }));
      logger.info('creditConfig.seeded', { key });
    }
  }
}

export { DEFAULTS };
