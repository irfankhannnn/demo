import axios from 'axios';
import { logApiCall, logApiError } from '../../utils/logger';

const BASE = process.env.CRM_API_BASE;
const TOKEN = process.env.CRM_TOKEN;
const SCRIPT_NAME = 'create-property';
let lastRequestLog: any = null;

async function main() {
  const raw = process.argv[2];
  if (!raw) {
    console.error('Usage: create-property.ts \'<json>\'');
    process.exit(1);
  }

  const payload = JSON.parse(raw);
  if (!payload.ownerId) {
    console.error('Error: ownerId is required.');
    process.exit(1);
  }
  if (!payload.propertyType) {
    console.error('Error: propertyType is required (apartment|house|villa|commercial|land|office|shop|warehouse).');
    process.exit(1);
  }

  lastRequestLog = { method: 'POST', url: `${BASE}/api/crm/properties`, body: payload };
  const res = await axios.post(`${BASE}/api/crm/properties`, payload, {
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
  });
  logApiCall(SCRIPT_NAME, lastRequestLog, res.data);

  const p = res.data;
  const bhk = p.bhk ? `${p.bhk}BHK ` : '';
  console.log(`Property created: [${p.propertyId}] ${bhk}${p.propertyType}`);
  console.log(`Area: ${p.area || 'N/A'}, ${p.city || 'N/A'} | Status: ${p.status}`);
  if (p.monthlyRent) console.log(`Monthly rent: ₹${p.monthlyRent}`);
  if (p.salePrice) console.log(`Sale price: ₹${p.salePrice}`);
}

main().catch(e => {
  logApiError(SCRIPT_NAME, lastRequestLog, e.response?.data || e.message);
  console.error('Error creating property:', e.response?.data?.error || e.message);
  process.exit(1);
});
