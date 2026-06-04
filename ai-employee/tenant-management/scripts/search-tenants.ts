import axios from 'axios';
import { renderTenants, ResponseMode } from './tenant-formatter';

const BASE = process.env.CRM_API_BASE;
const TOKEN = process.env.CRM_TOKEN;

async function main() {
  const payload = process.argv[2] ? JSON.parse(process.argv[2]) : {};
  const { q, responseMode = 'summary', ...extraFilters } = payload;

  if (!q || q.trim().length < 2) {
    console.error('Usage: search-tenants.ts \'{"q":"<query>"}\'');
    process.exit(1);
  }

  const params = new URLSearchParams();
  params.append('search', q.trim());
  for (const [key, val] of Object.entries(extraFilters)) {
    if (val !== undefined && val !== null && val !== '') {
      params.append(key, String(val));
    }
  }

  const query = params.toString() ? `?${params.toString()}` : '';
  const res = await axios.get(`${BASE}/api/crm/customers${query}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });

  const data = res.data;
  const customers = data.customers ?? data;
  const total = data.total ?? customers.length;
  const offset = data.offset ?? 0;
  const tenants: any[] = Array.isArray(customers) ? customers : [];

  if (!tenants.length) {
    console.log(`No tenants found for "${q}".`);
    return;
  }

  renderTenants(tenants, total, offset, responseMode as ResponseMode);
}

main().catch(e => {
  console.error('Error:', e.response?.data?.error || e.message);
  process.exit(1);
});
