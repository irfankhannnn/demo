import axios from 'axios';
import { logApiCall, logApiError } from '../../utils/logger';

const BASE = process.env.CRM_API_BASE;
const TOKEN = process.env.CRM_TOKEN;
const SCRIPT_NAME = 'create-lead';
let lastRequestLog: any = null;

async function main() {
  if (!process.argv[2]) {
    console.error('Usage: create-lead.ts \'<json>\'');
    process.exit(1);
  }

  const payload = JSON.parse(process.argv[2]);

  lastRequestLog = { method: 'POST', url: `${BASE}/api/crm/leads`, body: payload };
  const res = await axios.post(`${BASE}/api/crm/leads`, payload, {
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
  });
  logApiCall(SCRIPT_NAME, lastRequestLog, res.data);

  const l = res.data;
  const budget =
    l.buyerRequirement?.budget ||
    l.tenantRequirement?.budget ||
    l.sellerProperty?.expectedPrice ||
    l.ownerProperty?.rentExpected;
  const area =
    l.buyerRequirement?.preferredArea ||
    l.tenantRequirement?.preferredArea ||
    l.sellerProperty?.area ||
    l.ownerProperty?.area;

  console.log(`Lead created: ${l.name} | ${l.leadType} | ${l.status} | ${l.priority} priority${area ? ` | ${area}` : ''}${budget ? ` | ₹${Number(budget).toLocaleString()}` : ''}`);
  console.log(`Lead ID: ${l.leadId}`);
  if (l.phone) console.log(`Phone: ${l.phone}`);
}

main().catch(e => {
  logApiError(SCRIPT_NAME, lastRequestLog, e.response?.data || e.message);
  const status = e.response?.status;
  if (status === 409) console.error('DUPLICATE: A lead with this phone number already exists.');
  else if (status === 400) console.error(`Validation error: ${e.response?.data?.error || 'Bad request'}`);
  else console.error('Error:', e.response?.data?.error || e.message);
  process.exit(1);
});
