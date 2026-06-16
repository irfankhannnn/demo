import { crmClient, isCrmError } from '../../utils/crm-client';
import { logApiCall, logApiError, logExecution, startTimer } from '../../utils/logger';

const SCRIPT_NAME = 'update-property';
const SKILL_NAME = 'property-management';
let lastRequestLog: any = null;

async function main() {
  const timer = startTimer();
  const raw = process.argv[2];

  if (!raw) { console.error('Usage: update-property.ts \'<json with propertyId>\''); process.exit(1); }

  const payload = JSON.parse(raw);
  const { propertyId, _meta, ...updates } = payload;

  if (!propertyId) { console.error('Error: propertyId is required.'); process.exit(1); }

  lastRequestLog = { method: 'PUT', url: `/api/crm/properties/${propertyId}`, body: updates };
  const res = await crmClient.put(`/api/crm/properties/${propertyId}`, updates);
  logApiCall(SCRIPT_NAME, lastRequestLog, res.data, SKILL_NAME);

  const p = res.data;
  const updated = Object.keys(updates).join(', ');
  console.log(`Property updated: [${p.propertyId}] ${p.propertyType} | ${p.area || ''} ${p.city || ''}`);
  console.log(`Fields updated: ${updated}`);

  logExecution({ skill: SKILL_NAME, script: SCRIPT_NAME, status: 'success', duration_ms: timer.end(), userMessage: _meta?.userMessage, intent: _meta?.intent, request: lastRequestLog, response: { propertyId: p.propertyId } });
}

main().catch(e => {
  logApiError(SCRIPT_NAME, lastRequestLog, isCrmError(e) ? e.crmError : (e.response?.data || e.message), SKILL_NAME);
  if (isCrmError(e)) { console.error('Error:', e.crmError.message); }
  else { const status = e.response?.status; if (status === 404) console.error('Property not found.'); else console.error('Error updating property:', e.response?.data?.error || e.message); }
  process.exit(1);
});