import axios from 'axios';
import { logApiCall, logApiError } from '../../utils/logger';

const BASE = process.env.CRM_API_BASE;
const TOKEN = process.env.CRM_TOKEN;
const SCRIPT_NAME = 'search-owners';
let lastRequestLog: any = null;

type ResponseMode = 'summary' | 'compact' | 'details' | 'full';

function renderSummary(owners: any[], total: number, hasMore: boolean, query: string) {
  console.log(`Found ${total} owner${total === 1 ? '' : 's'} matching "${query}"\n`);
  if (owners.length) {
    console.log('Top matches:\n');
    owners.forEach((o, i) => {
      const parts: string[] = [`${i + 1}. ${o.name}`];
      if (o.isSeller) parts.push('Seller');
      if (o.propertyCount > 0) parts.push(`${o.propertyCount} properties`);
      if (o.status !== 'active') parts.push(`[${o.status}]`);
      console.log(parts.filter(Boolean).join(' • '));
    });
  }
  if (hasMore) {
    console.log(`\n+${total - owners.length} more available. Ask "show more" or refine filters.`);
  }
}

function renderCompact(owners: any[], total: number, hasMore: boolean, query: string) {
  console.log(`${total} owner${total === 1 ? '' : 's'} matching "${query}", showing ${owners.length}:\n`);
  owners.forEach((o, i) => {
    const props = o.propertyCount > 0 ? ` • ${o.propertyCount} properties` : '';
    console.log(`${i + 1}. ${o.name}${props}`);
  });
  if (hasMore) {
    console.log(`\nNext page: offset=${owners.length}`);
  }
}

function renderDetails(owners: any[], total: number, hasMore: boolean, query: string) {
  console.log(`${total} owner${total === 1 ? '' : 's'} matching "${query}", showing ${owners.length}:\n`);
  owners.forEach((o) => {
    console.log(`${o.name}`);
    console.log(`  Status: ${o.status}${o.isSeller ? ' | Seller' : ''}${o.propertyCount > 0 ? ` | ${o.propertyCount} properties` : ''}`);
    if (o.source) console.log(`  Source: ${o.source}`);
    if (o.address) console.log(`  Address: ${o.address}`);
    if (o.phone) console.log(`  Phone: ${o.phone}`);
    console.log('');
  });
  if (hasMore) console.log(`More available. Ask "show more".`);
}

function renderFull(owners: any[], total: number, hasMore: boolean, query: string) {
  console.log(`${total} owner${total === 1 ? '' : 's'} matching "${query}", showing ${owners.length}:\n`);
  owners.forEach((o) => {
    const status = o.status !== 'active' ? ` [${o.status}]` : '';
    const props = o.propertyCount > 0 ? ` | ${o.propertyCount} properties` : '';
    const sellerFlag = o.isSeller ? ' | seller' : '';
    console.log(`- [${o.ownerId}] ${o.name} | ${o.phone || 'no phone'}${props}${sellerFlag}${status}`);
    if (o.email) console.log(`  Email: ${o.email}`);
    if (o.source) console.log(`  Source: ${o.source}`);
    if (o.address) console.log(`  Address: ${o.address}`);
    if (o.panNumber) console.log(`  PAN: ${o.panNumber}`);
    if (o.aadharNumber) console.log(`  Aadhar: ${o.aadharNumber}`);
    console.log('');
  });
  if (hasMore) console.log(`More available. Ask "show more".`);
}

async function main() {
  const raw = process.argv[2];
  if (!raw) {
    console.error('Usage: search-owners.ts \'<json>\'');
    process.exit(1);
  }

  const payload = JSON.parse(raw);
  const { q, responseMode = 'summary', limit = 20 } = payload;
  if (!q) {
    console.error('Error: q (search query) is required.');
    process.exit(1);
  }

  lastRequestLog = { method: 'GET', url: `${BASE}/api/crm/owners`, params: { search: q, limit: String(limit) } };
  const res = await axios.get(`${BASE}/api/crm/owners`, {
    params: { search: q, limit: String(limit) },
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  logApiCall(SCRIPT_NAME, lastRequestLog, res.data);

  const { owners, total, limit: pageLimit, offset } = res.data;
  if (!owners || owners.length === 0) {
    console.log(`No owners found for "${q}".`);
    return;
  }

  const hasMore = pageLimit > 0 && offset + pageLimit < total;

  switch (responseMode as ResponseMode) {
    case 'compact':
      renderCompact(owners, total, hasMore, q);
      break;
    case 'details':
      renderDetails(owners, total, hasMore, q);
      break;
    case 'full':
      renderFull(owners, total, hasMore, q);
      break;
    case 'summary':
    default:
      renderSummary(owners, total, hasMore, q);
  }
}

main().catch(e => {
  logApiError(SCRIPT_NAME, lastRequestLog, e.response?.data || e.message);
  console.error('Error searching owners:', e.response?.data?.error || e.message);
  process.exit(1);
});
