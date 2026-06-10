import axios from 'axios';
import { logApiCall, logApiError } from '../../utils/logger';

const BASE = process.env.CRM_API_BASE;
const TOKEN = process.env.CRM_TOKEN;
const SCRIPT_NAME = 'create-buyer';
let lastRequestLog: any = null;

async function main() {
  const raw = process.argv[2];
  if (!raw) {
    console.error('Usage: create-buyer.ts \'<json>\'');
    process.exit(1);
  }

  const payload = JSON.parse(raw);
  if (!payload.name?.trim()) {
    console.error('Error: name is required.');
    process.exit(1);
  }

  lastRequestLog = { method: 'POST', url: `${BASE}/api/crm/buyers`, body: payload };
  const res = await axios.post(`${BASE}/api/crm/buyers`, payload, {
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
  });
  logApiCall(SCRIPT_NAME, lastRequestLog, res.data);

  const b = res.data;
  console.log(`Buyer created: ${b.name} [${b.buyerId}]`);
  console.log(`Phone: ${b.phone || 'N/A'} | Priority: ${b.priority}`);
  if (b.budget) console.log(`Budget: ₹${b.budget}`);
  if (b.crossRoleInfo) console.log(`Note: ${b.crossRoleInfo.message}`);
}

main().catch(e => {
  logApiError(SCRIPT_NAME, lastRequestLog, e.response?.data || e.message);
  console.error('Error creating buyer:', e.response?.data?.error || e.message);
  process.exit(1);
});
