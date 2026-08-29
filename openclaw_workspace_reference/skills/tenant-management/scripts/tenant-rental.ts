import { crmClient, isCrmError } from '../../utils/crm-client';
import { logApiCall, logApiError, logExecution, startTimer } from '../../utils/logger';

const SCRIPT_NAME = 'tenant-rental';
const SKILL_NAME = 'tenant-management';
let lastRequestLog: any = null;

async function main() {
  const timer = startTimer();
  const raw = process.argv[2];

  if (!raw) { console.error('Usage: tenant-rental.ts \'<json with action and customerId>\''); process.exit(1); }

  const payload = JSON.parse(raw);
  const { action, customerId, _meta, ...rest } = payload;

  if (!customerId) { console.error('Error: customerId is required.'); process.exit(1); }

  if (action === 'history') {
    lastRequestLog = { method: 'GET', url: `/api/crm/customers/${customerId}/rental-history` };
    const res = await crmClient.get(`/api/crm/customers/${customerId}/rental-history`);
    logApiCall(SCRIPT_NAME, lastRequestLog, res.data, SKILL_NAME);
    const { currentRental, rentalHistory } = res.data;
    if (currentRental) {
      console.log(`Current rental: Property [${currentRental.propertyId}] | ₹${currentRental.monthlyRent}/mo`);
      console.log(`  Lease: ${currentRental.leaseStartDate} → ${currentRental.leaseEndDate}`);
    } else { console.log('No current rental.'); }
    if (rentalHistory?.length) {
      console.log(`Rental history (${rentalHistory.length}):`);
      rentalHistory.forEach((r: any) => console.log(`  - [${r.propertyId}] ₹${r.monthlyRent}/mo | ${r.leaseStartDate} → ${r.leaseEndDate}`));
    }
    logExecution({ skill: SKILL_NAME, script: SCRIPT_NAME, status: 'success', duration_ms: timer.end(), userMessage: _meta?.userMessage, intent: _meta?.intent, request: lastRequestLog, response: { action: 'history' } });

  } else if (action === 'update') {
    const rentalDetails: Record<string, any> = {};
    if (rest.propertyId) rentalDetails.propertyId = rest.propertyId;
    if (rest.leaseStartDate) rentalDetails.leaseStartDate = rest.leaseStartDate;
    if (rest.leaseEndDate) rentalDetails.leaseEndDate = rest.leaseEndDate;
    if (rest.monthlyRent) rentalDetails.monthlyRent = rest.monthlyRent;
    if (rest.securityDeposit !== undefined) rentalDetails.securityDeposit = rest.securityDeposit;

    lastRequestLog = { method: 'PUT', url: `/api/crm/customers/${customerId}/current-rental`, body: rentalDetails };
    const updRes = await crmClient.put(`/api/crm/customers/${customerId}/current-rental`, rentalDetails);
    logApiCall(SCRIPT_NAME, lastRequestLog, updRes.data, SKILL_NAME);
    console.log(`Rental updated for tenant [${customerId}].`);
    console.log(`Fields: ${Object.keys(rentalDetails).join(', ')}`);
    logExecution({ skill: SKILL_NAME, script: SCRIPT_NAME, status: 'success', duration_ms: timer.end(), userMessage: _meta?.userMessage, intent: _meta?.intent, request: lastRequestLog, response: { action: 'update' } });

  } else if (action === 'archive') {
    lastRequestLog = { method: 'POST', url: `/api/crm/customers/${customerId}/archive-rental`, body: {} };
    const res = await crmClient.post(`/api/crm/customers/${customerId}/archive-rental`, {});
    logApiCall(SCRIPT_NAME, lastRequestLog, res.data, SKILL_NAME);
    console.log(`Rental archived for tenant [${customerId}]. ${res.data.message || ''}`);
    logExecution({ skill: SKILL_NAME, script: SCRIPT_NAME, status: 'success', duration_ms: timer.end(), userMessage: _meta?.userMessage, intent: _meta?.intent, request: lastRequestLog, response: { action: 'archive' } });

  } else {
    console.error('Unknown action. Use: history | update | archive');
    process.exit(1);
  }
}

main().catch(e => {
  logApiError(SCRIPT_NAME, lastRequestLog, isCrmError(e) ? e.crmError : (e.response?.data || e.message), SKILL_NAME);
  if (isCrmError(e)) { console.error('Error:', e.crmError.message); }
  else { const status = e.response?.status; if (status === 404) console.error('Tenant not found.'); else console.error('Error:', e.response?.data?.error || e.message); }
  process.exit(1);
});