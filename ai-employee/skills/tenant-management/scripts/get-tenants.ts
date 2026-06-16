import { crmClient, isCrmError } from '../../utils/crm-client';
import { renderTenants, ResponseMode } from './tenant-formatter';
import { logApiCall, logApiError, logExecution, startTimer } from '../../utils/logger';

const SCRIPT_NAME = 'get-tenants';
const SKILL_NAME = 'tenant-management';
let lastRequestLog: any = null;

async function main() {
  const timer = startTimer();
  const payload = process.argv[2] ? JSON.parse(process.argv[2]) : {};
  const { responseMode = 'summary', _meta, ...filters } = payload;

  const params = new URLSearchParams();
  for (const [key, val] of Object.entries(filters)) {
    if (val !== undefined && val !== null && val !== '') {
      params.append(key, String(val));
    }
  }

  const query = params.toString() ? `?${params.toString()}` : '';
  lastRequestLog = { method: 'GET', url: `/api/crm/customers${query}` };
  const res = await crmClient.get(`/api/crm/customers${query}`);
  logApiCall(SCRIPT_NAME, lastRequestLog, res.data, SKILL_NAME);

  const data = res.data;
  const customers = data.customers ?? data;
  const total = data.total ?? customers.length;
  const offset = data.offset ?? 0;
  const tenants: any[] = Array.isArray(customers) ? customers : [];

  if (!tenants.length) {
    console.log('No tenants found.');
    logExecution({ skill: SKILL_NAME, script: SCRIPT_NAME, status: 'success', duration_ms: timer.end(), userMessage: _meta?.userMessage, intent: _meta?.intent, request: lastRequestLog, response: { total: 0 } });
    return;
  }

  renderTenants(tenants, total, offset, responseMode as ResponseMode);

  logExecution({ skill: SKILL_NAME, script: SCRIPT_NAME, status: 'success', duration_ms: timer.end(), userMessage: _meta?.userMessage, intent: _meta?.intent, request: lastRequestLog, response: { total, returned: tenants.length } });
}

main().catch(e => {
  logApiError(SCRIPT_NAME, lastRequestLog, isCrmError(e) ? e.crmError : (e.response?.data || e.message), SKILL_NAME);
  if (isCrmError(e)) { console.error('Error:', e.crmError.message); }
  else { console.error('Error:', e.response?.data?.error || e.message); }
  process.exit(1);
});