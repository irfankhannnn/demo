import { crmClient, isCrmError } from '../../utils/crm-client';
import { logApiCall, logApiError, logExecution, startTimer } from '../../utils/logger';

const SCRIPT_NAME = 'lookup-buyer-by-phone';
const SKILL_NAME = 'buyer-management';
let lastRequestLog: any = null;

async function main() {
  const timer = startTimer();
  const phone = process.argv[2];

  if (!phone) {
    console.error('Usage: lookup-buyer-by-phone.ts <phone>');
    process.exit(1);
  }

  const normalizedPhone = phone.replace(/[\s-]/g, '');

  lastRequestLog = { method: 'GET', url: '/api/crm/buyers/lookup/by-phone', params: { phone: normalizedPhone } };
  const res = await crmClient.get('/api/crm/buyers/lookup/by-phone', { params: { phone: normalizedPhone } });
  logApiCall(SCRIPT_NAME, lastRequestLog, res.data, SKILL_NAME);

  const { found, roles } = res.data;
  if (!found || !roles?.length) {
    console.log('No buyer found with this phone number.');
    logExecution({ skill: SKILL_NAME, script: SCRIPT_NAME, status: 'success', duration_ms: timer.end(), request: lastRequestLog, response: { found: false } });
    return;
  }

  const buyerRole = roles.find((r: any) => r.role === 'buyer');
  if (buyerRole) {
    const b = buyerRole.data;
    console.log(`Found buyer: ${b.name} [${b.buyerId}]`);
    console.log(`Phone: ${b.phone || 'N/A'} | Email: ${b.email || 'N/A'}`);
    console.log(`Priority: ${b.priority || 'medium'} | Status: ${b.status || 'active'}`);
    if (b.budget) console.log(`Budget: ₹${b.budget}`);
    if (b.preferredArea) console.log(`Area: ${b.preferredArea}`);
  } else {
    console.log('No buyer found with this phone number.');
  }

  const otherRoles = roles.filter((r: any) => r.role !== 'buyer');
  if (otherRoles.length) {
    console.log(`\nNote: This phone also matches ${otherRoles.map((r: any) => r.role).join(', ')}.`);
  }

  logExecution({ skill: SKILL_NAME, script: SCRIPT_NAME, status: 'success', duration_ms: timer.end(), request: lastRequestLog, response: { found: true } });
}

main().catch(e => {
  logApiError(SCRIPT_NAME, lastRequestLog, isCrmError(e) ? e.crmError : (e.response?.data || e.message), SKILL_NAME);
  if (isCrmError(e)) { console.error('Error:', e.crmError.message); }
  else { console.error('Error:', e.response?.data?.error || e.message); }
  process.exit(1);
});