import axios from 'axios';
import { logApiCall, logApiError } from '../../utils/logger';

const BASE = process.env.CRM_API_BASE;
const TOKEN = process.env.CRM_TOKEN;
const SCRIPT_NAME = 'update-buyer';
let lastRequestLog: any = null;

async function main() {
  const raw = process.argv[2];
  if (!raw) {
    console.error('Usage: update-buyer.ts \'<json with buyerId>\'');
    process.exit(1);
  }

  const { buyerId, ...updates } = JSON.parse(raw);
  if (!buyerId) {
    console.error('Error: buyerId is required.');
    process.exit(1);
  }

  lastRequestLog = { method: 'PUT', url: `${BASE}/api/crm/buyers/${buyerId}`, body: updates };
  const res = await axios.put(`${BASE}/api/crm/buyers/${buyerId}`, updates, {
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
  });
  logApiCall(SCRIPT_NAME, lastRequestLog, res.data);

  const b = res.data;
  const updated = Object.keys(updates).join(', ');
  console.log(`Buyer updated: ${b.name} [${b.buyerId}]`);
  console.log(`Fields updated: ${updated}`);
}

main().catch(e => {
  logApiError(SCRIPT_NAME, lastRequestLog, e.response?.data || e.message);
  const status = e.response?.status;
  if (status === 404) console.error('Buyer not found.');
  else console.error('Error updating buyer:', e.response?.data?.error || e.message);
  process.exit(1);
});
