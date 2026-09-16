import { crmClient, isCrmError } from '../../utils/crm-client';
import { logApiCall, logApiError, logExecution, startTimer } from '../../utils/logger';

const SCRIPT_NAME = 'create-tenant';
const SKILL_NAME = 'tenant-management';
let lastRequestLog: any = null;

async function main() {
  const timer = startTimer();
  const raw = process.argv[2];

  if (!raw) { console.error('Usage: create-tenant.ts \'<json>\''); process.exit(1); }

  const payload = JSON.parse(raw);
  const { _meta, ...tenantData } = payload;

  if (!tenantData.name?.trim()) { console.error('Error: name is required.'); process.exit(1); }

  lastRequestLog = { method: 'POST', url: '/api/crm/customers', body: tenantData };
  const res = await crmClient.post('/api/crm/customers', tenantData);
  logApiCall(SCRIPT_NAME, lastRequestLog, res.data, SKILL_NAME);

  const t = res.data;
  console.log(`Tenant created: ${t.name} [${t.customerId}]`);
  console.log(`Phone: ${t.phone || 'N/A'} | Email: ${t.email || 'N/A'}`);
  console.log(`Status: ${t.status}`);

  logExecution({ skill: SKILL_NAME, script: SCRIPT_NAME, status: 'success', duration_ms: timer.end(), userMessage: _meta?.userMessage, intent: _meta?.intent, request: lastRequestLog, response: { customerId: t.customerId, name: t.name } });
}

main().catch(e => {
  logApiError(SCRIPT_NAME, lastRequestLog, isCrmError(e) ? e.crmError : (e.response?.data || e.message), SKILL_NAME);
  if (isCrmError(e)) { console.error('Error:', e.crmError.message); }
  else { console.error('Error creating tenant:', e.response?.data?.error || e.message); }
  process.exit(1);
});