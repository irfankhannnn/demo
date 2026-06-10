import axios from 'axios';
import { renderTenants, ResponseMode } from './tenant-formatter';
import { logApiCall, logApiError } from '../../utils/logger';

const BASE = process.env.CRM_API_BASE;
const TOKEN = process.env.CRM_TOKEN;
const SCRIPT_NAME = 'get-tenants';
let lastRequestLog: any = null;

async function main() {
  const payload = process.argv[2] ? JSON.parse(process.argv[2]) : {};
  const { responseMode = 'summary', ...filters } = payload;

  const params = new URLSearchParams();
  for (const [key, val] of Object.entries(filters)) {
    if (val !== undefined && val !== null && val !== '') {
      params.append(key, String(val));
    }
  }

  const query = params.toString() ? `?${params.toString()}` : '';
  lastRequestLog = { method: 'GET', url: `${BASE}/api/crm/customers${query}` };
  const res = await axios.get(`${BASE}/api/crm/customers${query}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  logApiCall(SCRIPT_NAME, lastRequestLog, res.data);

  const data = res.data;
  const customers = data.customers ?? data;
  const total = data.total ?? customers.length;
  const offset = data.offset ?? 0;
  const tenants: any[] = Array.isArray(customers) ? customers : [];

  if (!tenants.length) {
    console.log('No tenants found.');
    return;
  }

  renderTenants(tenants, total, offset, responseMode as ResponseMode);
}

main().catch(e => {
  logApiError(SCRIPT_NAME, lastRequestLog, e.response?.data || e.message);
  console.error('Error:', e.response?.data?.error || e.message);
  process.exit(1);
});
