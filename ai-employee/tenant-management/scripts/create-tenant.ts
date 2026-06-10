import axios from 'axios';
import { logApiCall, logApiError } from '../../utils/logger';

const BASE = process.env.CRM_API_BASE;
const TOKEN = process.env.CRM_TOKEN;
const SCRIPT_NAME = 'create-tenant';
let lastRequestLog: any = null;

async function main() {
  const raw = process.argv[2];
  if (!raw) {
    console.error('Usage: create-tenant.ts \'<json>\'');
    process.exit(1);
  }

  const payload = JSON.parse(raw);
  if (!payload.name?.trim()) {
    console.error('Error: name is required.');
    process.exit(1);
  }

  lastRequestLog = { method: 'POST', url: `${BASE}/api/crm/customers`, body: payload };
  const res = await axios.post(`${BASE}/api/crm/customers`, payload, {
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
  });
  logApiCall(SCRIPT_NAME, lastRequestLog, res.data);

  const t = res.data;
  console.log(`Tenant created: ${t.name} [${t.customerId}]`);
  console.log(`Phone: ${t.phone || 'N/A'} | Email: ${t.email || 'N/A'}`);
  console.log(`Status: ${t.status}`);
}

main().catch(e => {
  logApiError(SCRIPT_NAME, lastRequestLog, e.response?.data || e.message);
  console.error('Error creating tenant:', e.response?.data?.error || e.message);
  process.exit(1);
});
