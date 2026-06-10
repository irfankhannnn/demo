import axios from 'axios';
import { logApiCall, logApiError } from '../../utils/logger';

const BASE = process.env.CRM_API_BASE;
const TOKEN = process.env.CRM_TOKEN;
const SCRIPT_NAME = 'lookup-owner-by-phone';
let lastRequestLog: any = null;

async function main() {
  const phone = process.argv[2];
  if (!phone) {
    console.error('Usage: lookup-owner-by-phone.ts <phone>');
    process.exit(1);
  }

  const normalizedPhone = phone.replace(/[\s-]/g, '');

  lastRequestLog = { method: 'GET', url: `${BASE}/api/crm/owners/lookup/by-phone`, params: { phone: normalizedPhone } };
  const res = await axios.get(`${BASE}/api/crm/owners/lookup/by-phone`, {
    params: { phone: normalizedPhone },
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  logApiCall(SCRIPT_NAME, lastRequestLog, res.data);

  const o = res.data;
  if (!o) {
    console.log('No owner found with this phone number.');
    return;
  }

  console.log(`Found owner: ${o.name} [${o.ownerId}]`);
  console.log(`Phone: ${o.phone || 'N/A'} | Email: ${o.email || 'N/A'}`);
  console.log(`Address: ${o.address || 'N/A'}`);
  console.log(`Status: ${o.status} | Source: ${o.source || 'N/A'}`);
}

main().catch(e => {
  logApiError(SCRIPT_NAME, lastRequestLog, e.response?.data || e.message);
  const status = e.response?.status;
  if (status === 404) console.log('No owner found with this phone number.');
  else console.error('Error:', e.response?.data?.error || e.message);
  process.exit(1);
});
