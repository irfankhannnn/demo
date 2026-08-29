import { crmClient, isCrmError } from '../../utils/crm-client';
import { logApiCall, logApiError, logExecution, startTimer } from '../../utils/logger';

const SCRIPT_NAME = 'get-owner-properties';
const SKILL_NAME = 'owner-management';
let lastRequestLog: any = null;

async function main() {
  const timer = startTimer();
  const ownerId = process.argv[2];

  if (!ownerId) { console.error('Usage: get-owner-properties.ts <ownerId>'); process.exit(1); }

  lastRequestLog = { method: 'GET', url: `/api/crm/owners/${ownerId}/properties` };
  const res = await crmClient.get(`/api/crm/owners/${ownerId}/properties`);
  logApiCall(SCRIPT_NAME, lastRequestLog, res.data, SKILL_NAME);

  const properties = res.data;
  if (!properties || properties.length === 0) {
    console.log(`No properties found for owner [${ownerId}].`);
    logExecution({ skill: SKILL_NAME, script: SCRIPT_NAME, status: 'success', duration_ms: timer.end(), request: lastRequestLog, response: { count: 0 } });
    return;
  }

  console.log(`${properties.length} property(ies) for owner [${ownerId}]:`);
  properties.forEach((p: any) => {
    const bhk = p.bhk ? `${p.bhk}BHK ` : '';
    const rent = p.monthlyRent ? ` | Rent: ₹${p.monthlyRent}` : '';
    const sale = p.salePrice ? ` | Sale: ₹${p.salePrice}` : '';
    console.log(`- [${p.propertyId}] ${bhk}${p.propertyType} | ${p.area || ''} ${p.city || ''} | Status: ${p.status}${rent}${sale}`);
  });

  logExecution({ skill: SKILL_NAME, script: SCRIPT_NAME, status: 'success', duration_ms: timer.end(), request: lastRequestLog, response: { count: properties.length } });
}

main().catch(e => {
  logApiError(SCRIPT_NAME, lastRequestLog, isCrmError(e) ? e.crmError : (e.response?.data || e.message), SKILL_NAME);
  if (isCrmError(e)) { console.error('Error:', e.crmError.message); }
  else { const status = e.response?.status; if (status === 404) console.error('Owner not found.'); else console.error('Error:', e.response?.data?.error || e.message); }
  process.exit(1);
});