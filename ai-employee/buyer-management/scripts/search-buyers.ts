import axios from 'axios';

const BASE = process.env.CRM_API_BASE;
const TOKEN = process.env.CRM_TOKEN;

type ResponseMode = 'summary' | 'compact' | 'details' | 'full';

function fmtMoney(v?: number): string {
  if (!v) return '';
  if (v >= 10000000) return `₹${(v / 10000000).toFixed(1)}Cr`;
  if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
  if (v >= 1000) return `₹${(v / 1000).toFixed(0)}k`;
  return `₹${v}`;
}

function render(mode: ResponseMode, buyers: any[], total: number, hasMore: boolean) {
  if (mode === 'compact') {
    console.log(`${total} buyer${total === 1 ? '' : 's'} found, showing ${buyers.length}:\n`);
    buyers.forEach((b, i) => console.log(`${i + 1}. ${b.name}${b.priority ? ` • ${b.priority}` : ''}`));
  } else if (mode === 'details') {
    console.log(`${total} buyer${total === 1 ? '' : 's'} found, showing ${buyers.length}:\n`);
    buyers.forEach((b) => {
      console.log(`${b.name}`);
      console.log(`  Priority: ${b.priority || 'medium'} | Status: ${b.status || 'active'}`);
      if (b.budget) console.log(`  Budget: ${fmtMoney(b.budget)}`);
      if (b.propertyType) console.log(`  Type: ${b.propertyType}`);
      if (b.preferredArea) console.log(`  Area: ${b.preferredArea}`);
      if (b.phone) console.log(`  Phone: ${b.phone}`);
      console.log('');
    });
  } else if (mode === 'full') {
    console.log(`${total} buyer${total === 1 ? '' : 's'} found, showing ${buyers.length}:\n`);
    buyers.forEach((b) => {
      const status = b.status !== 'active' ? ` [${b.status}]` : '';
      console.log(`- [${b.buyerId}] ${b.name} | ${b.phone || 'no phone'} | ${b.priority || 'medium'}${status}`);
      if (b.email) console.log(`  Email: ${b.email}`);
      if (b.budget) console.log(`  Budget: ${fmtMoney(b.budget)}`);
      if (b.propertyType) console.log(`  Type: ${b.propertyType}`);
      if (b.bhk) console.log(`  BHK: ${b.bhk}`);
      if (b.preferredArea) console.log(`  Area: ${b.preferredArea}`);
      if (b.requirement) console.log(`  Requirement: ${b.requirement}`);
      console.log('');
    });
  } else {
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
  }
  if (hasMore) console.log(`\n+${total - buyers.length} more available. Ask "show more" or refine filters.`);
}

async function main() {
  const raw = process.argv[2];
  if (!raw) {
    console.error('Usage: search-buyers.ts \'<json>\'');
    process.exit(1);
  }

  const payload = JSON.parse(raw);
  const { q, responseMode = 'summary', ...filters } = payload;
  if (!q || String(q).trim().length < 2) {
    console.error('Error: search query (q) must be at least 2 characters.');
    process.exit(1);
  }

  const params: Record<string, string> = { search: String(q) };
  const paramMap: Record<string, string> = {
    status: 'status',
    priority: 'priority',
    propertyType: 'propertyType',
    bhk: 'bhk',
    furnishing: 'furnishing',
    area: 'area',
    minBudget: 'minBudget',
    maxBudget: 'maxBudget',
    createdFrom: 'createdFrom',
    createdTo: 'createdTo',
    tag: 'tag',
    limit: 'limit',
    offset: 'offset',
  };
  for (const [key, queryKey] of Object.entries(paramMap)) {
    if (filters[key] !== undefined) params[queryKey] = String(filters[key]);
  }

  lastRequestLog = { method: 'GET', url: `${BASE}/api/crm/buyers`, params };
  const res = await axios.get(`${BASE}/api/crm/buyers`, {
    params,
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  logApiCall(SCRIPT_NAME, lastRequestLog, res.data);

  const buyers = res.data.buyers ?? [];
  const total = res.data.total ?? buyers.length;
  const limit = res.data.limit ?? buyers.length;
  const offset = res.data.offset ?? 0;

  if (!buyers.length) {
    console.log('No buyers found.');
    return;
  }

  const hasMore = limit > 0 && offset + limit < total;
  render(responseMode as ResponseMode, buyers, total, hasMore);
}

main().catch(e => {
  logApiError(SCRIPT_NAME, lastRequestLog, e.response?.data || e.message);
  console.error('Error searching buyers:', e.response?.data?.error || e.message);
  process.exit(1);
});
