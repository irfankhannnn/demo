/**
 * Khata (ledger) read access for the AI agent.
 *
 * Khata is a fully-built REST feature (agency-app/api/routes/khata.js — 15 endpoints,
 * its own table, categories, settle/unsettle, summaries) that the WhatsApp
 * agent could not see at all: the tool registry had ZERO khata tools, so
 * "kitna paisa pending hai?" was unanswerable even though the data existed.
 * Noted in docs/proposals/agent-channel-architecture/01-diagnosis.md
 * ("`khata` has no agent tools — zero matches in the registry").
 *
 * READ-ONLY, DELIBERATELY. No create/update/settle tool is exposed here:
 *   1. flows/03-call-intelligence.md states the rule outright — "Khata
 *      entries are never created automatically ... money records need a
 *      human" — and that principle should not be weaker on WhatsApp than it
 *      is in the call pipeline.
 *   2. The REST routes are `requireAdmin`-gated, but the agent's own
 *      category permission check is currently inert on the WhatsApp path
 *      (userId is never passed — see phase1-imp/07-bugs-found.md #8), so an
 *      AI write tool for money would be effectively ungated.
 * Reading is safe and covers the actual common question; writing stays in the
 * CRM UI until #8 is fixed.
 */
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { logger } from './logger.js';

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-south-1' });
const docClient = DynamoDBDocumentClient.from(client);
const KHATA_TABLE = process.env.KHATA_TABLE_NAME || 'cloudberry-real-estate-khata';

const MAX_RETURNED = 20;

function normalizeEntry(e) {
  return {
    entryId: e.entryId ?? null,
    propertyId: e.propertyId ?? null,
    partyType: e.partyType ?? null,
    partyId: e.partyId ?? null,
    partyName: e.partyName ?? null,
    transactionType: e.transactionType ?? null,
    amount: typeof e.amount === 'number' ? e.amount : null,
    settlementStatus: e.settlementStatus ?? null,
    description: e.description ?? null,
    createdAt: e.createdAt ?? null,
    dueDate: e.dueDate ?? null,
  };
}

/** Fetch this tenant's khata entries, honouring the property GSI when we can. */
async function fetchEntries(tenantId, { propertyId } = {}) {
  if (propertyId) {
    const res = await docClient.send(new QueryCommand({
      TableName: KHATA_TABLE,
      IndexName: 'property-settlement-index',
      KeyConditionExpression: 'GSI1PK = :pk',
      ExpressionAttributeValues: { ':pk': `TENANT#${tenantId}#PROPERTY#${propertyId}` },
    }));
    return res.Items || [];
  }
  // Mirrors routes/khata.js: no tenant-wide entry index exists, so this is a
  // filtered Scan. Same cost profile as the other list paths in this codebase
  // (see the TODO(MED-1) in crmDynamodbService.js).
  const res = await docClient.send(new ScanCommand({
    TableName: KHATA_TABLE,
    FilterExpression: 'begins_with(PK, :pk) AND begins_with(SK, :sk)',
    ExpressionAttributeValues: { ':pk': `TENANT#${tenantId}`, ':sk': 'ENTRY#' },
  }));
  return res.Items || [];
}

function applyFilters(entries, filters = {}) {
  let out = entries;
  if (filters.settlementStatus) {
    const want = String(filters.settlementStatus).toUpperCase();
    out = out.filter((e) => String(e.settlementStatus || '').toUpperCase() === want);
  }
  if (filters.transactionType) {
    const want = String(filters.transactionType).toUpperCase();
    out = out.filter((e) => String(e.transactionType || '').toUpperCase() === want);
  }
  if (filters.partyId) {
    out = out.filter((e) => e.partyId === filters.partyId);
  }
  if (filters.query && String(filters.query).trim().length >= 2) {
    const q = String(filters.query).toLowerCase().trim();
    out = out.filter((e) =>
      String(e.partyName || '').toLowerCase().includes(q)
      || String(e.description || '').toLowerCase().includes(q));
  }
  return out;
}

/**
 * Search khata (ledger) entries.
 * @param {string} tenantId
 * @param {object} filters - { propertyId, partyId, settlementStatus, transactionType, query, limit }
 */
export async function searchKhataEntries(tenantId, filters = {}) {
  if (!tenantId) throw new Error('Tenant ID is required');
  try {
    const raw = await fetchEntries(tenantId, filters);
    const filtered = applyFilters(raw, filters);
    filtered.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    const limit = Math.min(parseInt(filters.limit, 10) || MAX_RETURNED, MAX_RETURNED);
    return {
      total: filtered.length,
      shown: Math.min(filtered.length, limit),
      entries: filtered.slice(0, limit).map(normalizeEntry),
    };
  } catch (err) {
    logger.error('khata.searchEntries.failed', { tenantId, error: err.message });
    throw err;
  }
}

/**
 * Money-in / money-out / net totals, with a pending breakdown.
 * @param {string} tenantId
 * @param {object} filters - { propertyId, partyId }
 */
export async function getKhataSummary(tenantId, filters = {}) {
  if (!tenantId) throw new Error('Tenant ID is required');
  try {
    const raw = await fetchEntries(tenantId, filters);
    const entries = applyFilters(raw, { partyId: filters.partyId });

    const sum = (list) => list.reduce((acc, e) => acc + (typeof e.amount === 'number' ? e.amount : 0), 0);
    const isType = (e, t) => String(e.transactionType || '').toUpperCase() === t;
    const isPending = (e) => String(e.settlementStatus || '').toUpperCase() === 'PENDING';

    const received = entries.filter((e) => isType(e, 'RECEIVED'));
    const paid = entries.filter((e) => isType(e, 'PAID'));
    const pending = entries.filter(isPending);

    return {
      entryCount: entries.length,
      totalReceived: sum(received),
      totalPaid: sum(paid),
      net: sum(received) - sum(paid),
      pendingCount: pending.length,
      pendingAmount: sum(pending),
      // Top pending items are what a "kitna baaki hai?" answer actually needs.
      topPending: pending
        .sort((a, b) => (b.amount || 0) - (a.amount || 0))
        .slice(0, 5)
        .map(normalizeEntry),
    };
  } catch (err) {
    logger.error('khata.getSummary.failed', { tenantId, error: err.message });
    throw err;
  }
}
