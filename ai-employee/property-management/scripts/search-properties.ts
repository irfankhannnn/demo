import axios from 'axios';

const BASE = process.env.CRM_API_BASE;
const TOKEN = process.env.CRM_TOKEN;

type ResponseMode = 'summary' | 'compact' | 'details' | 'full';

function renderSummary(properties: any[], total: number, hasMore: boolean, query: string) {
  console.log(`Found ${total} propert${total === 1 ? 'y' : 'ies'} matching "${query}"\n`);
  if (properties.length) {
    console.log('Top matches:\n');
    properties.forEach((p, i) => {
      const bhk = p.bhk ? `${p.bhk}BHK ` : '';
      const rent = p.rentAmount || p.rentalInfo?.expectedRent ? ` | ₹${p.rentAmount || p.rentalInfo?.expectedRent}/mo` : '';
      const sale = p.saleInfo?.listedPrice ? ` | ₹${p.saleInfo.listedPrice}` : '';
      console.log(`${i + 1}. ${bhk}${p.propertyType} | ${p.area || ''} ${p.city || ''} | ${p.status}${rent}${sale}`);
    });
  }
  if (hasMore) {
    console.log(`\n+${total - properties.length} more available. Ask "show more" or refine filters.`);
  }
}

function renderCompact(properties: any[], total: number, hasMore: boolean, query: string) {
  console.log(`${total} propert${total === 1 ? 'y' : 'ies'} matching "${query}", showing ${properties.length}:\n`);
  properties.forEach((p, i) => {
    const bhk = p.bhk ? `${p.bhk}BHK ` : '';
    console.log(`${i + 1}. ${bhk}${p.propertyType} | ${p.area || ''} | ${p.status}`);
  });
  if (hasMore) {
    console.log(`\nNext page: offset=${properties.length}`);
  }
}

function renderDetails(properties: any[], total: number, hasMore: boolean, query: string) {
  console.log(`${total} propert${total === 1 ? 'y' : 'ies'} matching "${query}", showing ${properties.length}:\n`);
  properties.forEach((p) => {
    const bhk = p.bhk ? `${p.bhk}BHK ` : '';
    console.log(`${bhk}${p.propertyType} | ${p.area || ''}, ${p.city || ''}`);
    console.log(`  Status: ${p.status}${p.furnishing ? ` | ${p.furnishing}` : ''}`);
    if (p.ownerName) console.log(`  Owner: ${p.ownerName}`);
    const rent = p.rentAmount || p.rentalInfo?.expectedRent;
    if (rent) console.log(`  Rent: ₹${rent}/mo`);
    const sale = p.saleInfo?.listedPrice || p.salePrice;
    if (sale) console.log(`  Sale: ₹${sale}`);
    console.log('');
  });
  if (hasMore) console.log(`More available. Ask "show more".`);
}

function renderFull(properties: any[], total: number, hasMore: boolean, query: string) {
  console.log(`${total} propert${total === 1 ? 'y' : 'ies'} matching "${query}", showing ${properties.length}:\n`);
  properties.forEach((p) => {
    const bhk = p.bhk ? `${p.bhk}BHK ` : '';
    console.log(`- [${p.propertyId}] ${bhk}${p.propertyType} | ${p.area || ''}, ${p.city || ''} | ${p.status}`);
    if (p.buildingName) console.log(`  Building: ${p.buildingName}`);
    if (p.address) console.log(`  Address: ${p.address}`);
    if (p.ownerName) console.log(`  Owner: ${p.ownerName} | ${p.ownerPhone || 'no phone'}`);
    if (p.furnishing) console.log(`  Furnishing: ${p.furnishing}`);
    console.log('');
  });
  if (hasMore) console.log(`More available. Ask "show more".`);
}

async function main() {
  const raw = process.argv[2];
  if (!raw) {
    console.error('Usage: search-properties.ts \'<json>\'');
    process.exit(1);
  }

  const payload = JSON.parse(raw);
  const { q, responseMode = 'summary', limit = 20, ...extraFilters } = payload;
  if (!q) {
    console.error('Error: q (search query) is required.');
    process.exit(1);
  }

  const params: Record<string, string> = { search: q, limit: String(limit) };
  const extraMap = ['status', 'propertyType', 'bhk', 'furnishing', 'area', 'city', 'minRent', 'maxRent', 'sortBy', 'sortOrder'];
  for (const key of extraMap) {
    if (extraFilters[key] !== undefined) params[key] = String(extraFilters[key]);
  }

  const res = await axios.get(`${BASE}/api/crm/properties`, {
    params,
    headers: { Authorization: `Bearer ${TOKEN}` },
  });

  const properties = res.data.properties ?? [];
  const total = res.data.total ?? properties.length;
  const pageLimit = res.data.limit ?? properties.length;
  const offset = res.data.offset ?? 0;

  if (!properties.length) {
    console.log(`No properties found for "${q}".`);
    return;
  }

  const hasMore = pageLimit > 0 && offset + pageLimit < total;

  switch (responseMode as ResponseMode) {
    case 'compact':
      renderCompact(properties, total, hasMore, q);
      break;
    case 'details':
      renderDetails(properties, total, hasMore, q);
      break;
    case 'full':
      renderFull(properties, total, hasMore, q);
      break;
    case 'summary':
    default:
      renderSummary(properties, total, hasMore, q);
  }
}

main().catch(e => {
  console.error('Error searching properties:', e.response?.data?.error || e.message);
  process.exit(1);
});
