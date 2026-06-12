import axios from 'axios';

const BASE = process.env.CRM_API_BASE;
const TOKEN = process.env.CRM_TOKEN;

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

function capitalize(s: string): string {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function renderSummary(leads: any[], total: number, hasMore: boolean, query: string) {
  console.log(`Found ${total} lead${total === 1 ? '' : 's'} matching "${query}"\n`);
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

function renderCompact(leads: any[], total: number, hasMore: boolean, query: string) {
  console.log(`${total} lead${total === 1 ? '' : 's'} matching "${query}", showing ${leads.length}:\n`);
  leads.forEach((l, i) => {
    const area = getArea(l);
    console.log(`${i + 1}. ${l.name} • ${capitalize(l.leadType)}${area ? ` • ${area}` : ''}`);
  });
  if (hasMore) {
    console.log(`\nNext page: offset=${leads.length}`);
  }
}

function renderDetails(leads: any[], total: number, hasMore: boolean, query: string) {
  console.log(`${total} lead${total === 1 ? '' : 's'} matching "${query}", showing ${leads.length}:\n`);
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

function renderFull(leads: any[], total: number, hasMore: boolean, query: string) {
  console.log(`${total} lead${total === 1 ? '' : 's'} matching "${query}", showing ${leads.length}:\n`);
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

async function main() {
  const raw = process.argv[2];
  if (!raw) {
    console.error('Usage: search-leads.ts \'<json>\'');
    process.exit(1);
  }

  const payload = JSON.parse(raw);
  const { q, responseMode = 'summary', limit = 20 } = payload;
  if (!q) {
    console.error('Error: q (search query) is required.');
    process.exit(1);
  }

  const res = await axios.get(`${BASE}/api/crm/leads`, {
    params: { search: q, limit: String(limit) },
    headers: { Authorization: `Bearer ${TOKEN}` },
  });

  const items = res.data.items ?? res.data;
  const total = res.data.total ?? items.length;
  const offset = res.data.offset ?? 0;
  const leads: any[] = Array.isArray(items) ? items : [];

  if (!leads.length) {
    console.log(`No leads found for "${q}".`);
    return;
  }

  const hasMore = total > leads.length + offset;

  switch (responseMode as ResponseMode) {
    case 'compact':
      renderCompact(leads, total, hasMore, q);
      break;
    case 'details':
      renderDetails(leads, total, hasMore, q);
      break;
    case 'full':
      renderFull(leads, total, hasMore, q);
      break;
    case 'summary':
    default:
      renderSummary(leads, total, hasMore, q);
  }
}

main().catch(e => {
  console.error('Error:', e.response?.data?.error || e.message);
  process.exit(1);
});
