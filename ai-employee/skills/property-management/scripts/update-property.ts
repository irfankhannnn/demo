import axios from 'axios';
import { logApiCall, logApiError } from '../../utils/logger';

const BASE = process.env.CRM_API_BASE;
const TOKEN = process.env.CRM_TOKEN;
const SCRIPT_NAME = 'update-property';
let lastRequestLog: any = null;

async function main() {
  const raw = process.argv[2];
  if (!raw) {
    console.error('Usage: update-property.ts \'<json with propertyId>\'');
    process.exit(1);
  }

  const { propertyId, ...updates } = JSON.parse(raw);
  if (!propertyId) {
    console.error('Error: propertyId is required.');
    process.exit(1);
  }

  lastRequestLog = { method: 'PUT', url: `${BASE}/api/crm/properties/${propertyId}`, body: updates };
  const res = await axios.put(`${BASE}/api/crm/properties/${propertyId}`, updates, {
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
  });
  logApiCall(SCRIPT_NAME, lastRequestLog, res.data);

  const p = res.data;
  const updated = Object.keys(updates).join(', ');
  console.log(`Property updated: [${p.propertyId}] ${p.propertyType} | ${p.area || ''} ${p.city || ''}`);
  console.log(`Fields updated: ${updated}`);
}

main().catch(e => {
  logApiError(SCRIPT_NAME, lastRequestLog, e.response?.data || e.message);
  const status = e.response?.status;
  if (status === 404) console.error('Property not found.');
  else console.error('Error updating property:', e.response?.data?.error || e.message);
  process.exit(1);
});
