import axios from 'axios';

const BASE = process.env.CRM_API_BASE;
const TOKEN = process.env.CRM_TOKEN;

type ResponseMode = 'summary' | 'compact' | 'details' | 'full';

function renderSummary(owners: any[], total: number, hasMore: boolean) {
  console.log(`Found ${total} owner${total === 1 ? '' : 's'}\n`);
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

function renderCompact(owners: any[], total: number, hasMore: boolean) {
  console.log(`${total} owner${total === 1 ? '' : 's'} found, showing ${owners.length}:\n`);
  owners.forEach((o, i) => {
    const props = o.propertyCount > 0 ? ` • ${o.propertyCount} properties` : '';
    console.log(`${i + 1}. ${o.name}${props}`);
  });
  if (hasMore) {
    console.log(`\nNext page: offset=${owners.length}`);
  }
}

function renderDetails(owners: any[], total: number, hasMore: boolean) {
  console.log(`${total} owner${total === 1 ? '' : 's'} found, showing ${owners.length}:\n`);
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

function renderFull(owners: any[], total: number, hasMore: boolean) {
  console.log(`${total} owner${total === 1 ? '' : 's'} found, showing ${owners.length}:\n`);
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
    if (o.bankName || o.ifscCode) console.log(`  Bank: ${o.bankName || ''} ${o.ifscCode || ''}`);
    console.log('');
  });
  if (hasMore) console.log(`More available. Ask "show more".`);
}

async function main() {
  const raw = process.argv[2];
  if (!raw) {
    console.error('Usage: get-owners.ts \'<json>\' — pass {} for all');
    process.exit(1);
  }

  const payload = JSON.parse(raw);
  const { responseMode = 'summary', ...filters } = payload;
  const params: Record<string, string> = {};

  const paramMap: Record<string, string> = {
    status: 'status',
    source: 'source',
    area: 'area',
    search: 'search',
    createdFrom: 'createdFrom',
    createdTo: 'createdTo',
    hasProperties: 'hasProperties',
    seller: 'seller',
    propertyType: 'propertyType',
    listingType: 'listingType',
    bhk: 'bhk',
    furnishing: 'furnishing',
    minProperties: 'minProperties',
    maxProperties: 'maxProperties',
    tag: 'tag',
    hasPAN: 'hasPAN',
    hasAadhar: 'hasAadhar',
    hasBankDetails: 'hasBankDetails',
    sortBy: 'sortBy',
    sortOrder: 'sortOrder',
    limit: 'limit',
    offset: 'offset',
  };

  for (const [key, queryKey] of Object.entries(paramMap)) {
    if (filters[key] !== undefined) params[queryKey] = String(filters[key]);
  }

  const res = await axios.get(`${BASE}/api/crm/owners`, {
    params,
    headers: { Authorization: `Bearer ${TOKEN}` },
  });

  const owners = res.data.owners ?? [];
  const total = res.data.total ?? owners.length;
  const limit = res.data.limit ?? owners.length;
  const offset = res.data.offset ?? 0;

  if (!owners.length) {
    console.log('No owners found.');
    return;
  }

  const hasMore = limit > 0 && offset + limit < total;

  switch (responseMode as ResponseMode) {
    case 'compact':
      renderCompact(owners, total, hasMore);
      break;
    case 'details':
      renderDetails(owners, total, hasMore);
      break;
    case 'full':
      renderFull(owners, total, hasMore);
      break;
    case 'summary':
    default:
      renderSummary(owners, total, hasMore);
  }
}

main().catch(e => {
  console.error('Error fetching owners:', e.response?.data?.error || e.message);
  process.exit(1);
});
