import axios from 'axios';
import { logApiCall, logApiError } from '../../utils/logger';

const BASE = process.env.CRM_API_BASE;
const TOKEN = process.env.CRM_TOKEN;
const SCRIPT_NAME = 'update-tenant';
let lastRequestLog: any = null;

async function main() {
  const raw = process.argv[2];
  if (!raw) {
    console.error('Usage: update-tenant.ts \'<json with customerId>\'');
    process.exit(1);
  }

  const { customerId, ...updates } = JSON.parse(raw);
  if (!customerId) {
    console.error('Error: customerId is required.');
    process.exit(1);
  }

  lastRequestLog = { method: 'PUT', url: `${BASE}/api/crm/customers/${customerId}`, body: updates };
  const res = await axios.put(`${BASE}/api/crm/customers/${customerId}`, updates, {
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
  });
  logApiCall(SCRIPT_NAME, lastRequestLog, res.data);

  const t = res.data;
  const updated = Object.keys(updates).join(', ');
  console.log(`Tenant updated: ${t.name} [${t.customerId}]`);
  console.log(`Fields updated: ${updated}`);
}

main().catch(e => {
  logApiError(SCRIPT_NAME, lastRequestLog, e.response?.data || e.message);
  const status = e.response?.status;
  if (status === 404) console.error('Tenant not found.');
  else console.error('Error updating tenant:', e.response?.data?.error || e.message);
  process.exit(1);
});
