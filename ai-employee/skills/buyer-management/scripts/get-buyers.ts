import { crmClient, isCrmError } from '../../utils/crm-client';
import { logApiCall, logApiError, logExecution, startTimer } from '../../utils/logger';

const SCRIPT_NAME = 'get-buyers';
const SKILL_NAME = 'buyer-management';
let lastRequestLog: any = null;

type ResponseMode = 'summary' | 'compact' | 'details' | 'full';

function fmtMoney(v: number | undefined): string {
  if (!v) return '';
  if (v >= 10000000) return `₹${(v / 10000000).toFixed(1)}Cr`;
  if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
  if (v >= 1000) return `₹${(v / 1000).toFixed(0)}k`;
  return `₹${v}`;
}

function renderSummary(buyers: any[], total: number, hasMore: boolean) {
  console.log(`Found ${total} buyer${total === 1 ? '' : 's'}\n`);
  if (buyers.length) {
    console.log('Top matches:\n');
    buyers.forEach((b, i) => {
      const parts: string[] = [`${i + 1}. ${b.name}`];
      if (b.priority) parts.push(b.priority);
      if (b.budget) parts.push(fmtMoney(b.budget));
      if (b.preferredArea) parts.push(b.preferredArea);
      if (b.propertyType) parts.push(b.propertyType);
      console.log(parts.filter(Boolean).join(' • '));
    });
  }
  if (hasMore) {
    console.log(`\n+${total - buyers.length} more available. Ask "show more" or refine filters.`);
  }
}

function renderCompact(buyers: any[], total: number, hasMore: boolean) {
  console.log(`${total} buyer${total === 1 ? '' : 's'} found, showing ${buyers.length}:\n`);
  buyers.forEach((b, i) => {
    const prio = b.priority ? ` • ${b.priority}` : '';
    console.log(`${i + 1}. ${b.name}${prio}`);
  });
  if (hasMore) { console.log(`\nNext page: offset=${buyers.length}`); }
}

function renderDetails(buyers: any[], total: number, hasMore: boolean) {
  console.log(`${total} buyer${total === 1 ? '' : 's'} found, showing ${buyers.length}:\n`);
  buyers.forEach((b) => {
    console.log(`${b.name}`);
    console.log(`  Priority: ${b.priority || 'medium'} | Status: ${b.status || 'active'}`);
    if (b.budget) console.log(`  Budget: ${fmtMoney(b.budget)}`);
    if (b.propertyType) console.log(`  Type: ${b.propertyType}`);
    if (b.bhk) console.log(`  BHK: ${b.bhk}`);
    if (b.preferredArea) console.log(`  Area: ${b.preferredArea}`);
    if (b.phone) console.log(`  Phone: ${b.phone}`);
    console.log('');
  });
  if (hasMore) console.log('More available. Ask "show more".');
}

function renderFull(buyers: any[], total: number, hasMore: boolean) {
  console.log(`${total} buyer${total === 1 ? '' : 's'} found, showing ${buyers.length}:\n`);
  buyers.forEach((b) => {
    const status = b.status !== 'active' ? ` [${b.status}]` : '';
    console.log(`- [${b.buyerId}] ${b.name} | ${b.phone || 'no phone'} | ${b.priority || 'medium'} priority${status}`);
    if (b.email) console.log(`  Email: ${b.email}`);
    if (b.budget) console.log(`  Budget: ${fmtMoney(b.budget)}`);
    if (b.propertyType) console.log(`  Type: ${b.propertyType}`);
    if (b.bhk) console.log(`  BHK: ${b.bhk}`);
    if (b.furnishing) console.log(`  Furnishing: ${b.furnishing}`);
    if (b.preferredArea) console.log(`  Area: ${b.preferredArea}`);
    if (b.requirement) console.log(`  Requirement: ${b.requirement}`);
    if (b.source) console.log(`  Source: ${b.source}`);
    if (b.createdAt) console.log(`  Created: ${b.createdAt}`);
    console.log('');
  });
  if (hasMore) console.log('More available. Ask "show more".');
}

async function main() {
  const timer = startTimer();
  const raw = process.argv[2];

  if (!raw) {
    console.error('Usage: get-buyers.ts \'<json>\' — pass {} for all');
    process.exit(1);
  }

  const payload = JSON.parse(raw);
  const { responseMode = 'summary', _meta, ...filters } = payload;
  const params: Record<string, string> = {};

  const paramMap: Record<string, string> = {
    status: 'status', priority: 'priority', propertyType: 'propertyType',
    source: 'source', bhk: 'bhk', furnishing: 'furnishing', area: 'area',
    search: 'search', minBudget: 'minBudget', maxBudget: 'maxBudget',
    createdFrom: 'createdFrom', createdTo: 'createdTo', tag: 'tag',
    sortBy: 'sortBy', sortOrder: 'sortOrder', limit: 'limit', offset: 'offset',
  };

  for (const [key, queryKey] of Object.entries(paramMap)) {
    if (filters[key] !== undefined) params[queryKey] = String(filters[key]);
  }

  lastRequestLog = { method: 'GET', url: '/api/crm/buyers', params };
  const res = await crmClient.get('/api/crm/buyers', { params });
  logApiCall(SCRIPT_NAME, lastRequestLog, res.data, SKILL_NAME);

  const buyers = res.data.buyers ?? [];
  const total = res.data.total ?? buyers.length;
  const limit = res.data.limit ?? buyers.length;
  const offset = res.data.offset ?? 0;

  if (!buyers.length) {
    console.log('No buyers found.');
    logExecution({ skill: SKILL_NAME, script: SCRIPT_NAME, status: 'success', duration_ms: timer.end(), userMessage: _meta?.userMessage, intent: _meta?.intent, request: lastRequestLog, response: { total: 0 } });
    return;
  }

  const hasMore = limit > 0 && offset + limit < total;

  switch (responseMode as ResponseMode) {
    case 'compact': renderCompact(buyers, total, hasMore); break;
    case 'details': renderDetails(buyers, total, hasMore); break;
    case 'full': renderFull(buyers, total, hasMore); break;
    case 'summary':
    default: renderSummary(buyers, total, hasMore);
  }

  logExecution({ skill: SKILL_NAME, script: SCRIPT_NAME, status: 'success', duration_ms: timer.end(), userMessage: _meta?.userMessage, intent: _meta?.intent, request: lastRequestLog, response: { total, returned: buyers.length } });
}

main().catch(e => {
  logApiError(SCRIPT_NAME, lastRequestLog, isCrmError(e) ? e.crmError : (e.response?.data || e.message), SKILL_NAME);
  if (isCrmError(e)) { console.error('Error:', e.crmError.message); }
  else { console.error('Error fetching buyers:', e.response?.data?.error || e.message); }
  process.exit(1);
});