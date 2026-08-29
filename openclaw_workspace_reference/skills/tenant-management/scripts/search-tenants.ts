import { crmClient, isCrmError } from '../../utils/crm-client';
import { logApiCall, logApiError, logExecution, startTimer } from '../../utils/logger';

const SCRIPT_NAME = 'search-tenants';
const SKILL_NAME = 'tenant-management';
let lastRequestLog: any = null;

type ResponseMode = 'summary' | 'compact' | 'details' | 'full';

function fmtMoney(v: number | undefined): string {
  if (!v) return '';
  if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
  if (v >= 1000) return `₹${(v / 1000).toFixed(0)}k`;
  return `₹${v}`;
}

function getRentalLine(t: any): string {
  if (!t.currentRental) return '';
  const r = t.currentRental;
  const parts: string[] = [];
  if (r.propertyId) parts.push(`Property: ${r.propertyId}`);
  if (r.monthlyRent) parts.push(`${fmtMoney(r.monthlyRent)}/mo`);
  if (r.leaseEndDate) parts.push(`ends ${r.leaseEndDate}`);
  return parts.join(' | ');
}

function renderSummary(tenants: any[], total: number, hasMore: boolean) {
  console.log(`Found ${total} tenant${total === 1 ? '' : 's'}\n`);
  if (tenants.length) {
    console.log('Top matches:\n');
    tenants.forEach((t, i) => {
      const rental = getRentalLine(t);
      const parts: string[] = [`${i + 1}. ${t.name}`, t.phone || 'no phone'];
      if (t.status && t.status !== 'active') parts.push(`[${t.status}]`);
      if (rental) parts.push(rental);
      console.log(parts.join(' • '));
    });
  }
  if (hasMore) { console.log(`\n+${total - tenants.length} more available. Ask "show more" or refine filters.`); }
}

function renderCompact(tenants: any[], total: number, hasMore: boolean) {
  console.log(`${total} tenant${total === 1 ? '' : 's'} found, showing ${tenants.length}:\n`);
  tenants.forEach((t, i) => {
    const statusTag = t.status && t.status !== 'active' ? ` [${t.status}]` : '';
    console.log(`${i + 1}. ${t.name}${statusTag}`);
  });
  if (hasMore) { console.log(`\nNext page: offset=${tenants.length}`); }
}

function renderDetails(tenants: any[], total: number, hasMore: boolean) {
  console.log(`${total} tenant${total === 1 ? '' : 's'} found, showing ${tenants.length}:\n`);
  tenants.forEach((t) => {
    const rental = getRentalLine(t);
    console.log(`${t.name}`);
    console.log(`  ${t.phone || 'no phone'} | ${t.status || 'active'}`);
    if (t.address) console.log(`  Address: ${t.address}`);
    if (rental) console.log(`  Rental: ${rental}`);
    console.log('');
  });
  if (hasMore) console.log('More available. Ask "show more".');
}

function renderFull(tenants: any[], total: number, hasMore: boolean) {
  console.log(`${total} tenant${total === 1 ? '' : 's'} found, showing ${tenants.length}:\n`);
  tenants.forEach((t) => {
    const rental = getRentalLine(t);
    const historyCount = Array.isArray(t.rentalHistory) ? t.rentalHistory.length : 0;
    console.log(`- [${t.customerId}] ${t.name} | ${t.phone || 'no phone'} | ${t.status || 'active'}`);
    if (t.email) console.log(`  Email: ${t.email}`);
    if (t.address) console.log(`  Address: ${t.address}`);
    if (t.source) console.log(`  Source: ${t.source}`);
    if (t.tags?.length) console.log(`  Tags: ${t.tags.join(', ')}`);
    if (rental) console.log(`  Current Rental: ${rental}`);
    if (historyCount) console.log(`  Past Rentals: ${historyCount}`);
    if (t.createdAt) console.log(`  Created: ${t.createdAt.slice(0, 10)}`);
    console.log('');
  });
  if (hasMore) console.log('More available. Ask "show more".');
}

async function main() {
  const timer = startTimer();
  const payload = process.argv[2] ? JSON.parse(process.argv[2]) : {};
  const { q, responseMode = 'summary', _meta, ...extraFilters } = payload;

  if (!q || q.trim().length < 2) { console.error('Usage: search-tenants.ts \'{"q":"<query>"}\''); process.exit(1); }

  const params = new URLSearchParams();
  params.append('search', q.trim());
  for (const [key, val] of Object.entries(extraFilters)) {
    if (val !== undefined && val !== null && val !== '') {
      params.append(key, String(val));
    }
  }

  const query = params.toString() ? `?${params.toString()}` : '';
  lastRequestLog = { method: 'GET', url: `/api/crm/customers${query}` };
  const res = await crmClient.get(`/api/crm/customers${query}`);
  logApiCall(SCRIPT_NAME, lastRequestLog, res.data, SKILL_NAME);

  const data = res.data;
  const customers = data.customers ?? data;
  const total = data.total ?? customers.length;
  const offset = data.offset ?? 0;
  const tenants: any[] = Array.isArray(customers) ? customers : [];

  if (!tenants.length) {
    console.log(`No tenants found for "${q}".`);
    logExecution({ skill: SKILL_NAME, script: SCRIPT_NAME, status: 'success', duration_ms: timer.end(), userMessage: _meta?.userMessage, intent: _meta?.intent, request: lastRequestLog, response: { total: 0, query: q } });
    return;
  }

  const hasMore = total > tenants.length + offset;

  switch (responseMode as ResponseMode) {
    case 'compact': renderCompact(tenants, total, hasMore); break;
    case 'details': renderDetails(tenants, total, hasMore); break;
    case 'full': renderFull(tenants, total, hasMore); break;
    case 'summary':
    default: renderSummary(tenants, total, hasMore);
  }

  logExecution({ skill: SKILL_NAME, script: SCRIPT_NAME, status: 'success', duration_ms: timer.end(), userMessage: _meta?.userMessage, intent: _meta?.intent, request: lastRequestLog, response: { total, returned: tenants.length, query: q } });
}

main().catch(e => {
  logApiError(SCRIPT_NAME, lastRequestLog, isCrmError(e) ? e.crmError : (e.response?.data || e.message), SKILL_NAME);
  if (isCrmError(e)) { console.error('Error:', e.crmError.message); }
  else { console.error('Error:', e.response?.data?.error || e.message); }
  process.exit(1);
});