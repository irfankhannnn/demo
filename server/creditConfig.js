import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { logger } from './logger.js';
import { SERVICE_ACCOUNT_USER } from './utils/serviceAccount.js';

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'ap-south-1',
  ...(process.env.DYNAMODB_ENDPOINT && { endpoint: process.env.DYNAMODB_ENDPOINT }),
});
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.CREDIT_CONFIG_TABLE_NAME || 'cloudberry-real-estate-credit-config';

function parseIntEnv(name, fallback) {
  const value = process.env[name];
  if (value === undefined || value === '') return fallback;
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function parseFloatEnv(name, fallback) {
  const value = process.env[name];
  if (value === undefined || value === '') return fallback;
  const parsed = parseFloat(value);
  return Number.isNaN(parsed) ? fallback : parsed;
}

const DEFAULTS = {
  FREE_TIER: { monthlyFreeCredits: parseIntEnv('CREDIT_FREE_MONTHLY_CREDITS', 1000) },
  PACKS: {
    starter: {
      label: 'Starter',
      priceMonthly: parseIntEnv('CREDIT_PACK_STARTER_PRICE', 1999),
      monthlyCredits: parseIntEnv('CREDIT_PACK_STARTER_CREDITS', 5000),
      razorpayPlan: process.env.CREDIT_PACK_STARTER_RAZORPAY_PLAN || 'plan_team',
    },
    professional: {
      label: 'Professional',
      priceMonthly: parseIntEnv('CREDIT_PACK_PROFESSIONAL_PRICE', 4999),
      monthlyCredits: parseIntEnv('CREDIT_PACK_PROFESSIONAL_CREDITS', 15000),
      razorpayPlan: process.env.CREDIT_PACK_PROFESSIONAL_RAZORPAY_PLAN || 'plan_teamplus',
    },
    annualDiscountPct: parseIntEnv('CREDIT_ANNUAL_DISCOUNT_PCT', 20),
    // 1 credit = ₹1. Top-up packs are priced 1:1 so a tenant can reason about
    // spend directly in rupees (an AI call minute costs 15 credits = ₹15).
    // The subscription plans above still bundle credits at a discount — that is
    // deliberate, and their prices are tied to fixed Razorpay plan ids, so they
    // are not on the 1:1 rate.
    overagePricePerCredit: parseFloatEnv('CREDIT_OVERAGE_PRICE_PER_CREDIT', 1.0),
    creditPacks: {
      pack_500: {
        credits: parseIntEnv('CREDIT_PACK_500_CREDITS', 500),
        priceInr: parseIntEnv('CREDIT_PACK_500_PRICE', 500),
      },
      pack_2000: {
        credits: parseIntEnv('CREDIT_PACK_2000_CREDITS', 2000),
        priceInr: parseIntEnv('CREDIT_PACK_2000_PRICE', 2000),
      },
      pack_5000: {
        credits: parseIntEnv('CREDIT_PACK_5000_CREDITS', 5000),
        priceInr: parseIntEnv('CREDIT_PACK_5000_PRICE', 5000),
      },
    },
  },
  // Pricing model: humans work for free, AI costs credits.
  //
  // Every manual data-entry action is 0 — a person typing a lead, contact,
  // property or khata entry into the CRM is never charged. Credits are spent
  // only when AI does work on the tenant's behalf: an LLM turn (`agent_action`,
  // which covers AI WhatsApp replies and the text lead qualifier) or an AI phone
  // call (`ai_call_per_minute`).
  //
  // These stay in the table at 0 rather than being deleted so the metering call
  // sites keep working (every helper in middleware/meterCredits.js short-circuits
  // on cost <= 0) and so a cost can be re-enabled from the admin cost editor
  // without a deploy.
  COSTS: {
    lead_add: parseIntEnv('CREDIT_COST_LEAD_ADD', 0),
    contact_add: parseIntEnv('CREDIT_COST_CONTACT_ADD', 0),
    property_add: parseIntEnv('CREDIT_COST_PROPERTY_ADD', 0),
    owner_add: parseIntEnv('CREDIT_COST_OWNER_ADD', 0),
    tenant_add: parseIntEnv('CREDIT_COST_TENANT_ADD', 0),
    khata_entry: parseIntEnv('CREDIT_COST_KHATA_ENTRY', 0),
    record_update: parseIntEnv('CREDIT_COST_RECORD_UPDATE', 0),
    // Falls back to the legacy AGENT_ACTION_CREDITS var because agentRuntime.js
    // reads that one directly (it needs a synchronous value at module load so
    // the deduct and the refund on a failed turn can never disagree). Keeping
    // the default chained here means the admin cost table and the amount
    // actually charged stay in step. Changing the charge still means setting
    // AGENT_ACTION_CREDITS — see docs/lead-adapter-architecture.md.
    agent_action: parseIntEnv('CREDIT_COST_AGENT_ACTION', parseIntEnv('AGENT_ACTION_CREDITS', 15)),
    // Charged per started minute of a completed AI call, from the settled
    // duration on the post-call webhook. See routes/aiCallingInternal.js.
    ai_call_per_minute: parseIntEnv('CREDIT_COST_AI_CALL_PER_MINUTE', 15),
    whatsapp_send: parseIntEnv('CREDIT_COST_WHATSAPP_SEND', 0),
    email_send: parseIntEnv('CREDIT_COST_EMAIL_SEND', 0),
    bulk_import_per_record: parseIntEnv('CREDIT_COST_BULK_IMPORT_PER_RECORD', 0),
    analytics_report: parseIntEnv('CREDIT_COST_ANALYTICS_REPORT', 0),
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

export async function updateConfig(key, value, updatedBy = SERVICE_ACCOUNT_USER) {
  if (!['FREE_TIER', 'PACKS', 'COSTS'].includes(key)) {
    throw new Error(`Invalid config key: ${key}`);
  }

  // Fetch previous value for audit
  const existing = await docClient.send(new GetCommand({
    TableName: TABLE_NAME,
    Key: { configKey: key },
  }));
  const previousValue = existing.Item?.value ?? null;

  await docClient.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: {
      configKey: key,
      value,
      updatedAt: new Date().toISOString(),
      updatedBy,
      previousValue, // Store for audit
    },
  }));
  
  // Clear cache immediately
  clearConfigCache();
  
  // Small delay to allow cache invalidation to propagate across Lambda instances
  // This is a simple approach; for distributed systems, consider DynamoDB Streams
  await new Promise(resolve => setTimeout(resolve, 100));

  logger.info('creditConfig.updated', {
    key,
    updatedBy,
    previousValue: previousValue ? '[changed]' : '[initial]',
    timestamp: new Date().toISOString(),
  });

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
