import { crmClient, isCrmError } from '../../utils/crm-client';
import { logApiCall, logApiError, logExecution, startTimer } from '../../utils/logger';

const SCRIPT_NAME = 'lookup-owner-by-phone';
const SKILL_NAME = 'owner-management';
let lastRequestLog: any = null;

async function main() {
  const timer = startTimer();
  const phone = process.argv[2];

  if (!phone) { console.error('Usage: lookup-owner-by-phone.ts <phone>'); process.exit(1); }

  const normalizedPhone = phone.replace(/[\s-]/g, '');

  lastRequestLog = { method: 'GET', url: '/api/crm/owners/lookup/by-phone', params: { phone: normalizedPhone } };
  const res = await crmClient.get('/api/crm/owners/lookup/by-phone', { params: { phone: normalizedPhone } });
  logApiCall(SCRIPT_NAME, lastRequestLog, res.data, SKILL_NAME);

  const o = res.data;
  if (!o) {
    console.log('No owner found with this phone number.');
    logExecution({ skill: SKILL_NAME, script: SCRIPT_NAME, status: 'success', duration_ms: timer.end(), request: lastRequestLog, response: { found: false } });
    return;
  }

  console.log(`Found owner: ${o.name} [${o.ownerId}]`);
  console.log(`Phone: ${o.phone || 'N/A'} | Email: ${o.email || 'N/A'}`);
  console.log(`Address: ${o.address || 'N/A'}`);
  console.log(`Status: ${o.status} | Source: ${o.source || 'N/A'}`);

  logExecution({ skill: SKILL_NAME, script: SCRIPT_NAME, status: 'success', duration_ms: timer.end(), request: lastRequestLog, response: { found: true, ownerId: o.ownerId } });
}

main().catch(e => {
  logApiError(SCRIPT_NAME, lastRequestLog, isCrmError(e) ? e.crmError : (e.response?.data || e.message), SKILL_NAME);
  if (isCrmError(e)) { console.error('Error:', e.crmError.message); }
  else { const status = e.response?.status; if (status === 404) console.log('No owner found with this phone number.'); else console.error('Error:', e.response?.data?.error || e.message); }
  process.exit(1);
});