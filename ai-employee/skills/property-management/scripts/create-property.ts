import { crmClient, isCrmError } from '../../utils/crm-client';
import { logApiCall, logApiError, logExecution, startTimer } from '../../utils/logger';

const SCRIPT_NAME = 'create-property';
const SKILL_NAME = 'property-management';
let lastRequestLog: any = null;

async function main() {
  const timer = startTimer();
  const raw = process.argv[2];

  if (!raw) { console.error('Usage: create-property.ts \'<json>\''); process.exit(1); }

  const payload = JSON.parse(raw);
  const { _meta, ...propertyData } = payload;

  if (!propertyData.ownerId) { console.error('Error: ownerId is required.'); process.exit(1); }
  if (!propertyData.propertyType) { console.error('Error: propertyType is required (apartment|house|villa|commercial|land|office|shop|warehouse).'); process.exit(1); }

  lastRequestLog = { method: 'POST', url: '/api/crm/properties', body: propertyData };
  const res = await crmClient.post('/api/crm/properties', propertyData);
  logApiCall(SCRIPT_NAME, lastRequestLog, res.data, SKILL_NAME);

  const p = res.data;
  const bhk = p.bhk ? `${p.bhk}BHK ` : '';
  console.log(`Property created: [${p.propertyId}] ${bhk}${p.propertyType}`);
  console.log(`Area: ${p.area || 'N/A'}, ${p.city || 'N/A'} | Status: ${p.status}`);
  if (p.monthlyRent) console.log(`Monthly rent: ₹${p.monthlyRent}`);
  if (p.salePrice) console.log(`Sale price: ₹${p.salePrice}`);

  logExecution({ skill: SKILL_NAME, script: SCRIPT_NAME, status: 'success', duration_ms: timer.end(), userMessage: _meta?.userMessage, intent: _meta?.intent, request: lastRequestLog, response: { propertyId: p.propertyId } });
}

main().catch(e => {
  logApiError(SCRIPT_NAME, lastRequestLog, isCrmError(e) ? e.crmError : (e.response?.data || e.message), SKILL_NAME);
  if (isCrmError(e)) { console.error('Error:', e.crmError.message); }
  else { console.error('Error creating property:', e.response?.data?.error || e.message); }
  process.exit(1);
});