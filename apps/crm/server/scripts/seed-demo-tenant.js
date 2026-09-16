/**
 * seed-demo-tenant.js — RealEstateFlow demo tenant seeder
 * =======================================================
 *
 * Populates a single, self-contained DEMO tenant with realistic Mumbai
 * real-estate data so prospects can click through the CRM at
 * `demo.realestateflow.in` without signing up. Designed to be re-run safely
 * (idempotent) and to be invoked by a daily reset cron (see cron/reset-demo.yaml).
 *
 * Source task: ZEE-001  (marketing-and-sales/launch-plan-v2/pre-launch-prep/P5-demo-environment.md)
 * PR: PR-A (coding-agent-brief/prompts/PR-A-demo-environment.md)
 *
 * USAGE
 * -----
 *   node apps/crm/server/scripts/seed-demo-tenant.js [--reset] [--tenant=DEMO_REALESTATEFLOW]
 *
 *   --reset           Delete every item belonging to the demo tenant from all
 *                     CRM tables first, then re-seed from scratch.
 *   --tenant=<id>     Override the demo tenant id. Defaults to
 *                     process.env.DEMO_TENANT_ID || 'DEMO_REALESTATEFLOW'.
 *
 * ENVIRONMENT
 * -----------
 *   AWS_REGION                  default 'ap-south-1'
 *   CRM_DYNAMODB_TABLE_NAME     required — buyers/owners/properties/leads/team
 *   KHATA_TABLE_NAME            default 'cloudberry-real-estate-khata'
 *   NOTIFICATIONS_TABLE_NAME    default 'cloudberry-real-estate-notifications'
 *   DEMO_TENANT_ID              default 'DEMO_REALESTATEFLOW'
 *   DYNAMODB_ENDPOINT           optional — point at DynamoDB Local for testing
 *
 * AWS credentials are resolved by the default AWS SDK chain (IAM role on Lambda,
 * shared config locally). No credentials are ever hard-coded here.
 *
 * IDEMPOTENCY
 * -----------
 * Every seeded row uses a *deterministic* id (e.g. `demo-buyer-01`) and a fixed
 * base timestamp, so a plain re-run (without --reset) overwrites the same items
 * rather than creating duplicates. `--reset` additionally purges any stray demo
 * rows (e.g. records a tester created) before seeding.
 *
 * HOW TO EXTEND
 * -------------
 * Each entity has a `build*()` factory below. To add more demo records, append
 * to the corresponding array (keep ids deterministic: `demo-<entity>-NN`) and,
 * if the entity lives in the CRM single table, follow the existing PK/SK shape
 * (`TENANT#<tenantId>#<ENTITY>#<id>` / `PROFILE`). Row counts are reported
 * automatically.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  ScanCommand,
  BatchWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { wrapAwsClient } from '../awsClientWrapper.js';

// Load apps/crm/server/.env (same pattern as crmDynamodbService.js)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// ----------------------------------------------------------------------------
// Configuration
// ----------------------------------------------------------------------------
const REGION = process.env.AWS_REGION || 'ap-south-1';
const CRM_TABLE = process.env.CRM_DYNAMODB_TABLE_NAME;
const KHATA_TABLE = process.env.KHATA_TABLE_NAME || 'cloudberry-real-estate-khata';
const NOTIFICATIONS_TABLE =
  process.env.NOTIFICATIONS_TABLE_NAME || 'cloudberry-real-estate-notifications';
const ENDPOINT = process.env.DYNAMODB_ENDPOINT || undefined;

// Fixed base timestamp keeps deterministic sort keys stable across runs.
const BASE_TS = '2026-01-01T00:00:00.000Z';

function parseArgs(argv) {
  const args = { reset: false, tenant: undefined };
  for (const a of argv.slice(2)) {
    if (a === '--reset') args.reset = true;
    else if (a.startsWith('--tenant=')) args.tenant = a.slice('--tenant='.length);
    else if (a === '--help' || a === '-h') args.help = true;
  }
  return args;
}

const cli = parseArgs(process.argv);
if (cli.help) {
  console.log(
    'Usage: node seed-demo-tenant.js [--reset] [--tenant=DEMO_REALESTATEFLOW]',
  );
  process.exit(0);
}

const TENANT_ID = cli.tenant || process.env.DEMO_TENANT_ID || 'DEMO_REALESTATEFLOW';

if (!CRM_TABLE) {
  console.error(
    'ERROR: CRM_DYNAMODB_TABLE_NAME is not set. Configure it in apps/crm/server/.env (or the Lambda env).',
  );
  process.exit(1);
}

const ddbClient = wrapAwsClient(
  new DynamoDBClient({ region: REGION, ...(ENDPOINT ? { endpoint: ENDPOINT } : {}) }),
  'DynamoDB',
  { tableName: 'demo-seed' },
);
const docClient = DynamoDBDocumentClient.from(ddbClient, {
  marshallOptions: { removeUndefinedValues: true },
});

// ----------------------------------------------------------------------------
// Mumbai demo data definitions
// ----------------------------------------------------------------------------
const LOCALITIES = [
  'Andheri West',
  'Bandra West',
  'Powai',
  'Thane West',
  'Borivali West',
  'Goregaon East',
  'Lower Parel',
  'Worli',
  'Juhu',
  'Vashi',
];

const FIRST_NAMES = [
  'Priya', 'Arjun', 'Suresh', 'Neha', 'Rohit', 'Anjali', 'Vikram', 'Sneha',
  'Karan', 'Pooja', 'Amit', 'Divya', 'Rahul', 'Meera', 'Sanjay', 'Kavita',
  'Nikhil', 'Ritu', 'Deepak', 'Aarti',
];
const LAST_NAMES = [
  'Sharma', 'Patel', 'Iyer', 'Nair', 'Mehta', 'Desai', 'Gupta', 'Reddy',
  'Joshi', 'Kulkarni', 'Shah', 'Malhotra', 'Verma', 'Rao', 'Kapoor', 'Bose',
  'Chopra', 'Pillai', 'Agarwal', 'Menon',
];

const pad2 = (n) => String(n).padStart(2, '0');
// Deterministic fake phone: 9 + 9-digit zero-padded counter (e.g. 9991000001-style).
const demoPhone = (n) => `9${String(900000000 + n).padStart(9, '0')}`;
const rupees = (amount) => amount; // stored as plain number (paise-free, INR)

/** Picsum placeholder image set for a property (3 photos). */
function propertyImages(propId) {
  return [1, 2, 3].map((i) => ({
    url: `https://picsum.photos/seed/ref-${propId}-${i}/400/300`,
    description: `Demo photo ${i}`,
  }));
}

// ---- Buyers (20) -----------------------------------------------------------
// Temperature distribution per spec: 5 hot / 8 warm / 5 cold / 2 inactive.
const BUYER_TEMPERATURES = [
  ...Array(5).fill('hot'),
  ...Array(8).fill('warm'),
  ...Array(5).fill('cold'),
  ...Array(2).fill('inactive'),
];

function buildBuyers() {
  const budgets = [5000000, 7500000, 9000000, 12000000, 15000000, 18000000,
    22000000, 25000000, 28000000, 30000000, 32000000, 35000000, 38000000,
    40000000, 9500000, 11000000, 13500000, 16500000, 21000000, 27000000];
  return BUYER_TEMPERATURES.map((temperature, idx) => {
    const n = idx + 1;
    const id = `demo-buyer-${pad2(n)}`;
    const name = `${FIRST_NAMES[idx]} ${LAST_NAMES[idx]}`;
    const locality = LOCALITIES[idx % LOCALITIES.length];
    const status = temperature === 'inactive' ? 'inactive' : 'active';
    return {
      table: CRM_TABLE,
      item: {
        PK: `TENANT#${TENANT_ID}#BUYER#${id}`,
        SK: 'PROFILE',
        EntityType: 'BUYER',
        tenantId: TENANT_ID,
        buyerId: id,
        name,
        email: `demo+buyer-${n}@realestateflow.in`,
        phone: demoPhone(n),
        address: `${locality}, Mumbai`,
        source: 'demo',
        status,
        temperature, // hot | warm | cold | inactive (demo display)
        budget: rupees(budgets[idx]),
        preferredArea: locality,
        propertyType: 'apartment',
        requirement: `${(idx % 4) + 1}BHK in ${locality}, budget up to ₹${(budgets[idx] / 10000000).toFixed(2)}Cr`,
        notes: 'Demo buyer — auto-seeded.',
        tags: ['demo'],
        createdAt: BASE_TS,
        updatedAt: BASE_TS,
        createdBy: 'DemoSeed',
        GSI3PK: `TENANT#${TENANT_ID}#SEARCH`,
        GSI3SK: `BUYER#${name.toLowerCase()}#${demoPhone(n)}`,
      },
    };
  });
}

// ---- Owners (15) -----------------------------------------------------------
function buildOwners() {
  return Array.from({ length: 15 }, (_, idx) => {
    const n = idx + 1;
    const id = `demo-owner-${pad2(n)}`;
    const name = `${FIRST_NAMES[(idx + 5) % FIRST_NAMES.length]} ${LAST_NAMES[(idx + 7) % LAST_NAMES.length]}`;
    const locality = LOCALITIES[idx % LOCALITIES.length];
    const constructionType = idx % 2 === 0 ? 'resale' : 'new construction';
    return {
      table: CRM_TABLE,
      item: {
        PK: `TENANT#${TENANT_ID}#OWNER#${id}`,
        SK: 'PROFILE',
        EntityType: 'OWNER',
        tenantId: TENANT_ID,
        ownerId: id,
        name,
        email: `demo+owner-${n}@realestateflow.in`,
        phone: demoPhone(100 + n),
        address: `${locality}, Mumbai`,
        notes: `Demo owner (${constructionType}) — auto-seeded.`,
        tags: ['demo', constructionType.replace(' ', '-')],
        source: 'demo',
        status: idx % 5 === 0 ? 'inactive' : 'active',
        createdAt: BASE_TS,
        updatedAt: BASE_TS,
        GSI3PK: `TENANT#${TENANT_ID}#SEARCH`,
        GSI3SK: `OWNER#${name.toLowerCase()}#${demoPhone(100 + n)}`,
      },
    };
  });
}

// ---- Properties (10, one per locality) ------------------------------------
function buildProperties() {
  const specs = [
    { bhk: 2, price: 18500000, carpet: 720, society: 'Lokhandwala Heights' },
    { bhk: 3, price: 42000000, carpet: 1150, society: 'Pali Hill Residency' },
    { bhk: 3, price: 28000000, carpet: 980, society: 'Hiranandani Gardens' },
    { bhk: 2, price: 11500000, carpet: 680, society: 'Lodha Amara' },
    { bhk: 1, price: 9000000, carpet: 480, society: 'Shanti Nagar CHS' },
    { bhk: 2, price: 13500000, carpet: 700, society: 'Oberoi Garden City' },
    { bhk: 4, price: 65000000, carpet: 1850, society: 'Lodha World Towers' },
    { bhk: 3, price: 60000000, carpet: 1400, society: 'Indiabulls Blu' },
    { bhk: 2, price: 32000000, carpet: 820, society: 'Juhu Galaxy' },
    { bhk: 1, price: 6500000, carpet: 450, society: 'Sai Sky Vashi' },
  ];
  return specs.map((spec, idx) => {
    const n = idx + 1;
    const id = `demo-prop-${pad2(n)}`;
    const locality = LOCALITIES[idx];
    const ownerId = `demo-owner-${pad2(n)}`;
    const status = idx % 3 === 0 ? 'for-sale' : idx % 3 === 1 ? 'for-rent' : 'vacant';
    return {
      table: CRM_TABLE,
      item: {
        PK: `TENANT#${TENANT_ID}#PROPERTY#${id}`,
        SK: 'PROFILE',
        EntityType: 'PROPERTY',
        tenantId: TENANT_ID,
        propertyId: id,
        ownerId,
        ownerName: `Demo Owner ${n}`,
        ownerPhone: demoPhone(100 + n),
        title: `${spec.bhk}BHK in ${spec.society}, ${locality}`,
        description: `Spacious ${spec.bhk}BHK demo listing in ${locality}, Mumbai.`,
        propertyType: 'apartment',
        bhk: spec.bhk,
        area: locality,
        city: 'Mumbai',
        address: `${spec.society}, ${locality}, Mumbai`,
        buildingName: spec.society,
        carpetArea: spec.carpet,
        builtUpArea: Math.round(spec.carpet * 1.25),
        furnishing: ['unfurnished', 'semi-furnished', 'furnished'][idx % 3],
        status,
        listingStatus: 'active',
        saleInfo: {
          listedPrice: status === 'for-sale' ? spec.price : null,
          soldPrice: null,
          soldDate: null,
          soldToBuyerId: null,
        },
        images: propertyImages(id),
        featured: idx < 3,
        verified: true,
        views: 0,
        availableFrom: BASE_TS,
        createdAt: BASE_TS,
        updatedAt: BASE_TS,
        GSI1PK: `TENANT#${TENANT_ID}#OWNER#${ownerId}`,
        GSI1SK: `PROPERTY#${id}`,
        GSI2PK: `TENANT#${TENANT_ID}#PROPERTY_STATUS#${status}`,
        GSI2SK: `PROPERTY#${id}`,
        GSI3PK: `TENANT#${TENANT_ID}#SEARCH`,
        GSI3SK: `PROPERTY#${spec.society.toLowerCase()}#${locality.toLowerCase()}`,
      },
    };
  });
}

// ---- Pipeline leads (8 across stages) -------------------------------------
// Map documented pipeline stages onto the LEAD `status` enum
// (new|contacted|qualified|negotiating|converted|lost) while preserving the
// human-readable stage in `pipelineStage`.
const PIPELINE = [
  { stage: 'New', status: 'new' },
  { stage: 'New', status: 'new' },
  { stage: 'Contacted', status: 'contacted' },
  { stage: 'Contacted', status: 'contacted' },
  { stage: 'Site Visit Scheduled', status: 'qualified' },
  { stage: 'Negotiating', status: 'negotiating' },
  { stage: 'Negotiating', status: 'negotiating' },
  { stage: 'Closed-Won', status: 'converted' },
];

function buildLeads() {
  return PIPELINE.map((p, idx) => {
    const n = idx + 1;
    const id = `demo-lead-${pad2(n)}`;
    const buyerNum = idx + 1;
    const propNum = (idx % 10) + 1;
    const name = `${FIRST_NAMES[idx]} ${LAST_NAMES[(idx + 3) % LAST_NAMES.length]}`;
    const locality = LOCALITIES[idx % LOCALITIES.length];
    const isConverted = p.status === 'converted';
    return {
      table: CRM_TABLE,
      item: {
        PK: `TENANT#${TENANT_ID}#LEAD#${id}`,
        SK: 'PROFILE',
        EntityType: 'LEAD',
        tenantId: TENANT_ID,
        leadId: id,
        leadType: 'buyer',
        name,
        email: `demo+lead-${n}@realestateflow.in`,
        phone: demoPhone(200 + n),
        normalizedPhone: demoPhone(200 + n),
        source: 'demo',
        status: p.status,
        pipelineStage: p.stage,
        score: idx < 3 ? 'HOT' : idx < 6 ? 'WARM' : 'COLD',
        scoreValue: idx < 3 ? 85 : idx < 6 ? 55 : 25,
        scoreReasons: idx < 3
          ? 'Demo data — named a specific building, wants to move immediately.'
          : idx < 6
            ? 'Demo data — open to a site visit, area not finalized.'
            : 'Demo data — early research, timeline a couple of months out.',
        scoredAt: BASE_TS,
        scoreSource: 'manual',
        buyerRequirement: {
          budget: 8000000 + idx * 2500000,
          preferredArea: locality,
          bhk: (idx % 4) + 1,
          propertyType: 'apartment',
        },
        linkedBuyerId: `demo-buyer-${pad2(buyerNum)}`,
        linkedPropertyId: `demo-prop-${pad2(propNum)}`,
        convertedAt: isConverted ? BASE_TS : null,
        convertedTo: isConverted
          ? { entityType: 'buyer', buyerId: `demo-buyer-${pad2(buyerNum)}` }
          : null,
        notes: `Demo pipeline lead — stage: ${p.stage}.`,
        history: [
          {
            timestamp: BASE_TS,
            action: 'Lead Created',
            details: `Demo ${p.stage} lead created`,
            updatedBy: 'DemoSeed',
          },
        ],
        createdBy: 'DemoSeed',
        createdAt: BASE_TS,
        updatedAt: BASE_TS,
        GSI3PK: `TENANT#${TENANT_ID}#SEARCH`,
        GSI3SK: `LEAD#buyer#${name.toLowerCase()}#${demoPhone(200 + n)}`,
      },
    };
  });
}

// ---- Team members (2, Hierarchy view) -------------------------------------
function buildTeamMembers() {
  const members = [
    { id: 'demo-member-01', name: 'Demo Owner', role: 'owner' },
    { id: 'demo-member-02', name: 'Demo Agent', role: 'agent' },
  ];
  return members.map((m, idx) => ({
    table: CRM_TABLE,
    item: {
      PK: `TENANT#${TENANT_ID}#HIERARCHY#${m.id}`,
      SK: 'PROFILE',
      EntityType: 'HIERARCHY_MEMBER',
      tenantId: TENANT_ID,
      memberId: m.id,
      name: m.name,
      email: `demo+${m.role}@realestateflow.in`,
      phone: demoPhone(300 + idx + 1),
      role: m.role,
      reportsTo: m.role === 'agent' ? 'demo-member-01' : null,
      status: 'active',
      createdAt: BASE_TS,
      updatedAt: BASE_TS,
    },
  }));
}

// ---- Khata entries (5, mix paid/pending) ----------------------------------
function buildKhataEntries() {
  const defs = [
    { type: 'TO_TAKE', amount: 250000, status: 'PENDING', party: 'OWNER', cat: 'Brokerage' },
    { type: 'TO_GIVE', amount: 50000, status: 'SETTLED', party: 'OWNER', cat: 'Refund' },
    { type: 'TO_TAKE', amount: 125000, status: 'PENDING', party: 'BUYER', cat: 'Token Money' },
    { type: 'TO_TAKE', amount: 75000, status: 'SETTLED', party: 'BUYER', cat: 'Brokerage' },
    { type: 'TO_GIVE', amount: 25000, status: 'PENDING', party: 'OWNER', cat: 'Maintenance' },
  ];
  return defs.map((d, idx) => {
    const n = idx + 1;
    const id = `demo-khata-${pad2(n)}`;
    const propId = `demo-prop-${pad2(n)}`;
    const partyId =
      d.party === 'OWNER' ? `demo-owner-${pad2(n)}` : `demo-buyer-${pad2(n)}`;
    const partyName = d.party === 'OWNER' ? `Demo Owner ${n}` : `Demo Buyer ${n}`;
    return {
      table: KHATA_TABLE,
      item: {
        PK: `TENANT#${TENANT_ID}`,
        SK: `ENTRY#${id}`,
        GSI1PK: `TENANT#${TENANT_ID}#PROPERTY#${propId}`,
        GSI1SK: d.status,
        GSI2PK: `TENANT#${TENANT_ID}`,
        GSI2SK: `${d.status}#${BASE_TS}`,
        entryId: id,
        tenantId: TENANT_ID,
        propertyId: propId,
        partyType: d.party,
        partyId,
        partyName,
        transactionType: d.type,
        amount: rupees(d.amount),
        categoryId: `demo-cat-${idx + 1}`,
        categoryName: d.cat,
        description: `Demo khata entry — ${d.cat}.`,
        settlementStatus: d.status,
        reminderAt: null,
        reminderNote: null,
        createdAt: BASE_TS,
        createdBy: 'DemoSeed',
        updatedAt: BASE_TS,
      },
    };
  });
}

// ---- AI-Employee WhatsApp transcripts (5) ---------------------------------
function buildTranscripts() {
  const conversations = [
    {
      topic: '2BHK Bandra search',
      buyer: 'demo-buyer-02',
      messages: [
        ['buyer', 'Hi, I saw your listing for 2BHK in Bandra West. Is it still available?'],
        ['ai', 'Hello! Yes, the 2BHK at Pali Hill Residency is available. Carpet ~720 sq ft, asking ₹3.2Cr. Would you like to visit?'],
        ['buyer', 'Budget is around 2.8Cr. Any flexibility?'],
        ['ai', 'The owner can consider serious offers. Shall I schedule a site visit this weekend so you can decide?'],
        ['buyer', 'Saturday afternoon works.'],
        ['ai', 'Booked for Saturday 4 PM. I will share the exact location pin and our agent Rohit will meet you there.'],
        ['buyer', 'Great, thanks!'],
        ['ai', 'You are welcome! I will send a reminder on Saturday morning.'],
      ],
    },
    {
      topic: '3BHK Powai upgrade',
      buyer: 'demo-buyer-03',
      messages: [
        ['buyer', 'We are a family of 4 looking to upgrade to a 3BHK in Powai.'],
        ['ai', 'Powai is a great choice for families. We have a 3BHK at Hiranandani Gardens, ~980 sq ft carpet, ₹2.8Cr.'],
        ['buyer', 'Is it close to schools?'],
        ['ai', 'Yes, Hiranandani Foundation School is a 5-minute drive, and the lake is nearby.'],
        ['buyer', 'Sounds good. Can we see it this week?'],
        ['ai', 'Absolutely. I have Wednesday 6 PM or Thursday 11 AM open. Which suits you?'],
        ['buyer', 'Thursday 11 AM.'],
        ['ai', 'Done. Agent will confirm and share documents in advance.'],
        ['buyer', 'Perfect.'],
      ],
    },
    {
      topic: 'Investor Lower Parel',
      buyer: 'demo-buyer-07',
      messages: [
        ['buyer', 'Looking for investment options in Lower Parel. What yields are realistic?'],
        ['ai', 'For premium towers like Lodha World Towers, rental yields are ~3% but capital appreciation has been strong.'],
        ['buyer', 'What is the ticket size for a 4BHK?'],
        ['ai', 'A 4BHK there is around ₹6.5Cr, ~1850 sq ft carpet. Ready possession.'],
        ['buyer', 'Any pre-leased options?'],
        ['ai', 'I can check current pre-leased inventory and revert by tomorrow. Shall I?'],
        ['buyer', 'Yes please.'],
        ['ai', 'Noted. I will share a shortlist with yields and tenant profiles tomorrow.'],
      ],
    },
    {
      topic: 'Rental Goregaon',
      buyer: 'demo-buyer-06',
      messages: [
        ['buyer', 'Need a 2BHK on rent in Goregaon East, budget 45k/month.'],
        ['ai', 'We have a semi-furnished 2BHK at Oberoi Garden City, ₹48k/month. Slightly above budget but great amenities.'],
        ['buyer', 'Is parking included?'],
        ['ai', 'Yes, one covered parking is included. Deposit is 3 months.'],
        ['buyer', 'Can we negotiate to 45k?'],
        ['ai', 'I will check with the owner. When would you want to move in?'],
        ['buyer', 'Next month.'],
        ['ai', 'Got it. I will revert on the rent and hold the flat tentatively for you.'],
        ['buyer', 'Thank you!'],
      ],
    },
    {
      topic: 'NRI Dubai to Worli high-rise',
      buyer: 'demo-buyer-08',
      messages: [
        ['buyer', 'I am based in Dubai and want a sea-facing 3BHK in Worli.'],
        ['ai', 'Welcome! Indiabulls Blu has a sea-facing 3BHK, ~1400 sq ft, ₹6Cr. Can do a video walkthrough for you.'],
        ['buyer', 'A video tour would be ideal given the distance.'],
        ['ai', 'I will arrange a live video tour. What time zone works — IST evening?'],
        ['buyer', 'IST evening is fine, around 8 PM.'],
        ['ai', 'Booked for 8 PM IST tomorrow. I will also share NRI documentation and payment guidelines.'],
        ['buyer', 'Please do. Also need help with home loan for NRIs.'],
        ['ai', 'We work with HDFC and ICICI NRI desks. I will connect you with a relationship manager.'],
        ['buyer', 'Excellent, thanks.'],
      ],
    },
  ];

  return conversations.map((c, idx) => {
    const n = idx + 1;
    const id = `demo-transcript-${pad2(n)}`;
    const createdAt = BASE_TS;
    return {
      table: NOTIFICATIONS_TABLE,
      item: {
        PK: `TENANT#${TENANT_ID}#NOTIFICATIONS`,
        SK: `NOTIF#${createdAt}#${id}`,
        EntityType: 'NOTIFICATION',
        tenantId: TENANT_ID,
        notificationId: id,
        category: 'ENQUIRIES',
        type: 'ai_transcript',
        title: `AI Employee chat — ${c.topic}`,
        message: `Simulated WhatsApp conversation (${c.messages.length} messages): ${c.topic}`,
        deepLink: `/crm/buyers/${c.buyer}`,
        entityRef: { entityType: 'buyer', entityId: c.buyer },
        transcript: c.messages.map(([sender, text], i) => ({
          seq: i + 1,
          sender, // 'ai' | 'buyer'
          text,
        })),
        readAt: null,
        createdAt,
        GSI1PK: `TENANT#${TENANT_ID}#UNREAD`,
        GSI1SK: `NOTIF#${createdAt}#${id}`,
      },
    };
  });
}

// ----------------------------------------------------------------------------
// DynamoDB helpers
// ----------------------------------------------------------------------------
async function putAll(records) {
  for (const { table, item } of records) {
    await docClient.send(new PutCommand({ TableName: table, Item: item }));
  }
}

/** Delete every item with tenantId == TENANT_ID from a table. */
async function purgeTenant(table) {
  let removed = 0;
  let ExclusiveStartKey;
  do {
    const scan = await docClient.send(
      new ScanCommand({
        TableName: table,
        FilterExpression: 'tenantId = :t',
        ExpressionAttributeValues: { ':t': TENANT_ID },
        ProjectionExpression: 'PK, SK',
        ExclusiveStartKey,
      }),
    );
    const items = scan.Items || [];
    for (let i = 0; i < items.length; i += 25) {
      const batch = items.slice(i, i + 25);
      await docClient.send(
        new BatchWriteCommand({
          RequestItems: {
            [table]: batch.map((it) => ({
              DeleteRequest: { Key: { PK: it.PK, SK: it.SK } },
            })),
          },
        }),
      );
      removed += batch.length;
    }
    ExclusiveStartKey = scan.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return removed;
}

// ----------------------------------------------------------------------------
// Main
// ----------------------------------------------------------------------------
async function main() {
  const startedAt = Date.now();
  console.log(`[seed-demo] tenant=${TENANT_ID} region=${REGION}${ENDPOINT ? ` endpoint=${ENDPOINT}` : ''}`);

  if (cli.reset) {
    console.log('[seed-demo] --reset: purging existing demo data...');
    const crmRemoved = await purgeTenant(CRM_TABLE);
    const khataRemoved = await purgeTenant(KHATA_TABLE);
    const notifRemoved = await purgeTenant(NOTIFICATIONS_TABLE);
    console.log(
      `[seed-demo] purged: crm=${crmRemoved} khata=${khataRemoved} notifications=${notifRemoved}`,
    );
  }

  const buyers = buildBuyers();
  const owners = buildOwners();
  const properties = buildProperties();
  const leads = buildLeads();
  const team = buildTeamMembers();
  const khata = buildKhataEntries();
  const transcripts = buildTranscripts();

  await putAll(buyers);
  await putAll(owners);
  await putAll(properties);
  await putAll(leads);
  await putAll(team);
  await putAll(khata);
  await putAll(transcripts);

  const counts = {
    buyers: buyers.length,
    owners: owners.length,
    properties: properties.length,
    pipelineLeads: leads.length,
    teamMembers: team.length,
    khataEntries: khata.length,
    aiTranscripts: transcripts.length,
  };
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const elapsedMs = Date.now() - startedAt;

  console.log('[seed-demo] seeded row counts:');
  for (const [k, v] of Object.entries(counts)) {
    console.log(`  ${k}: ${v}`);
  }
  console.log(`  TOTAL: ${total} rows in ${elapsedMs}ms`);

  // Emit a machine-readable trace (elapsed + counts) next to the script.
  try {
    fs.writeFileSync(
      path.join(__dirname, 'node-trace.json'),
      JSON.stringify({ tenantId: TENANT_ID, elapsedMs, counts, total, reset: cli.reset, finishedAt: new Date().toISOString() }, null, 2),
    );
  } catch (err) {
    console.warn('[seed-demo] could not write node-trace.json:', err?.message);
  }
}

main().catch((err) => {
  console.error('[seed-demo] FAILED:', err);
  process.exit(1);
});
