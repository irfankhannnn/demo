import { crmClient, isCrmError } from '../../utils/crm-client';
import { logApiCall, logApiError, logExecution, startTimer } from '../../utils/logger';

const SCRIPT_NAME = 'update-tenant';
const SKILL_NAME = 'tenant-management';
let lastRequestLog: any = null;

async function main() {
  const timer = startTimer();
  const raw = process.argv[2];

  if (!raw) { console.error('Usage: update-tenant.ts \'<json with customerId>\''); process.exit(1); }

  const payload = JSON.parse(raw);
  const { customerId, _meta, ...updates } = payload;

  if (!customerId) { console.error('Error: customerId is required.'); process.exit(1); }

  lastRequestLog = { method: 'PUT', url: `/api/crm/customers/${customerId}`, body: updates };
  const res = await crmClient.put(`/api/crm/customers/${customerId}`, updates);
  logApiCall(SCRIPT_NAME, lastRequestLog, res.data, SKILL_NAME);

  const t = res.data;
  const updated = Object.keys(updates).join(', ');
  console.log(`Tenant updated: ${t.name} [${t.customerId}]`);
  console.log(`Fields updated: ${updated}`);

  logExecution({ skill: SKILL_NAME, script: SCRIPT_NAME, status: 'success', duration_ms: timer.end(), userMessage: _meta?.userMessage, intent: _meta?.intent, request: lastRequestLog, response: { customerId: t.customerId } });
}

main().catch(e => {
  logApiError(SCRIPT_NAME, lastRequestLog, isCrmError(e) ? e.crmError : (e.response?.data || e.message), SKILL_NAME);
  if (isCrmError(e)) { console.error('Error:', e.crmError.message); }
  else { const status = e.response?.status; if (status === 404) console.error('Tenant not found.'); else console.error('Error updating tenant:', e.response?.data?.error || e.message); }
  process.exit(1);
});