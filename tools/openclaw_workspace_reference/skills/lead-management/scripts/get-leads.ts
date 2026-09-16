import { crmClient, isCrmError } from '../../utils/crm-client';
import { logApiCall, logApiError, logExecution, startTimer } from '../../utils/logger';

const SCRIPT_NAME = 'get-leads';
const SKILL_NAME = 'lead-management';
let lastRequestLog: any = null;

type ResponseMode = 'summary' | 'compact' | 'details' | 'full';

function fmtMoney(v: number | undefined): string {
  if (!v) return '';
  if (v >= 10000000) return `₹${(v / 10000000).toFixed(1)}Cr`;
  if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
  if (v >= 1000) return `₹${(v / 1000).toFixed(0)}k`;
  return `₹${v}`;
}

function getBudget(l: any): number | undefined {
  return l.buyerRequirement?.budget || l.tenantRequirement?.budget || l.sellerProperty?.expectedPrice || l.ownerProperty?.rentExpected;
}

function getArea(l: any): string | undefined {
  return l.buyerRequirement?.preferredArea || l.tenantRequirement?.preferredArea || l.sellerProperty?.area || l.ownerProperty?.area;
}

function getPriorityLabel(p: string): string {
  if (p === 'high') return 'Hot';
  if (p === 'medium') return 'Warm';
  if (p === 'low') return 'Cold';
  return p || '';
}

function renderSummary(leads: any[], total: number, hasMore: boolean) {
  console.log(`Found ${total} lead${total === 1 ? '' : 's'}\n`);
  if (leads.length) {
    console.log('Top matches:\n');
    leads.forEach((l, i) => {
      const budget = getBudget(l);
      const area = getArea(l);
      const parts: string[] = [`${i + 1}. ${l.name} (${capitalize(l.leadType)})`, getPriorityLabel(l.priority)];
      if (budget) parts.push(fmtMoney(budget));
      if (area) parts.push(area);
      console.log(parts.filter(Boolean).join(' • '));
    });
  }
  if (hasMore) {
    console.log(`\n+${total - leads.length} more available. Ask "show more" or refine filters.`);
  }
}

function renderCompact(leads: any[], total: number, hasMore: boolean) {
  console.log(`${total} lead${total === 1 ? '' : 's'} found, showing ${leads.length}:\n`);
  leads.forEach((l, i) => {
    const area = getArea(l);
    console.log(`${i + 1}. ${l.name} • ${capitalize(l.leadType)}${area ? ` • ${area}` : ''}`);
  });
  if (hasMore) {
    console.log(`\nNext page: offset=${leads.length}`);
  }
}

function renderDetails(leads: any[], total: number, hasMore: boolean) {
  console.log(`${total} lead${total === 1 ? '' : 's'} found, showing ${leads.length}:\n`);
  leads.forEach((l) => {
    const budget = getBudget(l);
    const area = getArea(l);
    console.log(`${l.name}`);
    console.log(`  ${capitalize(l.leadType)} | ${l.status} | ${getPriorityLabel(l.priority)}`);
    if (budget) console.log(`  Budget: ${fmtMoney(budget)}`);
    if (area) console.log(`  Area: ${area}`);
    if (l.assignedTo) console.log(`  Assigned: ${l.assignedTo}`);
    if (l.source) console.log(`  Source: ${l.source}`);
    console.log('');
  });
  if (hasMore) console.log(`More available. Ask "show more".`);
}

function renderFull(leads: any[], total: number, hasMore: boolean) {
  console.log(`${total} lead${total === 1 ? '' : 's'} found, showing ${leads.length}:\n`);
  leads.forEach((l) => {
    const budget = getBudget(l);
    const area = getArea(l);
    const converted = l.convertedAt ? ' [CONVERTED]' : '';
    console.log(`- [${l.leadId}] ${l.name} | ${l.leadType} | ${l.status} | ${l.priority}${area ? ` | ${area}` : ''}${budget ? ` | ${fmtMoney(budget)}` : ''} | ${l.phone || 'no phone'}${converted}`);
    if (l.email) console.log(`  Email: ${l.email}`);
    if (l.source) console.log(`  Source: ${l.source}`);
    if (l.assignedTo) console.log(`  Assigned: ${l.assignedTo}`);
    if (l.notes) console.log(`  Notes: ${l.notes}`);
    if (l.createdAt) console.log(`  Created: ${l.createdAt}`);
    console.log('');
  });
  if (hasMore) console.log(`More available. Ask "show more".`);
}

function capitalize(s: string): string {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

async function main() {
  const timer = startTimer();
  const payload = process.argv[2] ? JSON.parse(process.argv[2]) : {};
  const { responseMode = 'summary', _meta, ...filters } = payload;

  const params = new URLSearchParams();
  for (const [key, val] of Object.entries(filters)) {
    if (val !== undefined && val !== null && val !== '') {
      params.append(key, String(val));
    }
  }

  const query = params.toString() ? `?${params.toString()}` : '';
  lastRequestLog = { method: 'GET', url: `/api/crm/leads${query}` };
  const res = await crmClient.get(`/api/crm/leads${query}`);
  logApiCall(SCRIPT_NAME, lastRequestLog, res.data, SKILL_NAME);

  const items = res.data.items ?? res.data;
  const total = res.data.total ?? items.length;
  const offset = res.data.offset ?? 0;
  const leads: any[] = Array.isArray(items) ? items : [];

  if (!leads.length) {
    console.log('No leads found.');
    logExecution({
      skill: SKILL_NAME, script: SCRIPT_NAME, status: 'success',
      duration_ms: timer.end(),
      userMessage: _meta?.userMessage, intent: _meta?.intent,
      request: lastRequestLog, response: { total: 0, leads: 0 },
    });
    return;
  }

  const hasMore = total > leads.length + offset;

  switch (responseMode as ResponseMode) {
    case 'compact': renderCompact(leads, total, hasMore); break;
    case 'details': renderDetails(leads, total, hasMore); break;
    case 'full': renderFull(leads, total, hasMore); break;
    case 'summary':
    default: renderSummary(leads, total, hasMore);
  }

  logExecution({
    skill: SKILL_NAME, script: SCRIPT_NAME, status: 'success',
    duration_ms: timer.end(),
    userMessage: _meta?.userMessage, intent: _meta?.intent,
    request: lastRequestLog, response: { total, returned: leads.length },
  });
}

main().catch(e => {
  logApiError(SCRIPT_NAME, lastRequestLog, isCrmError(e) ? e.crmError : (e.response?.data || e.message), SKILL_NAME);
  if (isCrmError(e)) {
    console.error('Error:', e.crmError.message);
  } else {
    console.error('Error:', e.response?.data?.error || e.message);
  }
  process.exit(1);
});