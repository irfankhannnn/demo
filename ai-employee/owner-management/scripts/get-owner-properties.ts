import axios from 'axios';
import { logApiCall, logApiError } from '../../utils/logger';

const BASE = process.env.CRM_API_BASE;
const TOKEN = process.env.CRM_TOKEN;
const SCRIPT_NAME = 'get-owner-properties';
let lastRequestLog: any = null;

async function main() {
  const ownerId = process.argv[2];
  if (!ownerId) {
    console.error('Usage: get-owner-properties.ts <ownerId>');
    process.exit(1);
  }

  lastRequestLog = { method: 'GET', url: `${BASE}/api/crm/owners/${ownerId}/properties` };
  const res = await axios.get(`${BASE}/api/crm/owners/${ownerId}/properties`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  logApiCall(SCRIPT_NAME, lastRequestLog, res.data);

  const properties = res.data;
  if (!properties || properties.length === 0) {
    console.log(`No properties found for owner [${ownerId}].`);
    return;
  }

  console.log(`${properties.length} property(ies) for owner [${ownerId}]:`);
  properties.forEach((p: any) => {
    const bhk = p.bhk ? `${p.bhk}BHK ` : '';
    const rent = p.monthlyRent ? ` | Rent: ₹${p.monthlyRent}` : '';
    const sale = p.salePrice ? ` | Sale: ₹${p.salePrice}` : '';
    console.log(`- [${p.propertyId}] ${bhk}${p.propertyType} | ${p.area || ''} ${p.city || ''} | Status: ${p.status}${rent}${sale}`);
  });
}

main().catch(e => {
  logApiError(SCRIPT_NAME, lastRequestLog, e.response?.data || e.message);
  const status = e.response?.status;
  if (status === 404) console.error('Owner not found.');
  else console.error('Error:', e.response?.data?.error || e.message);
  process.exit(1);
});
