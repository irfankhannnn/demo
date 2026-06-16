import { crmClient, isCrmError } from '../../utils/crm-client';
import { logApiCall, logApiError, logExecution, startTimer } from '../../utils/logger';

const SCRIPT_NAME = 'get-lead-metrics';
const SKILL_NAME = 'lead-management';
let lastRequestLog: any = null;

async function main() {
  const timer = startTimer();
  const payload = process.argv[2] ? JSON.parse(process.argv[2]) : {};
  const { _meta, ...filters } = payload;

  const params = new URLSearchParams();
  if (filters.from) params.append('from', filters.from);
  if (filters.to) params.append('to', filters.to);

  const query = params.toString() ? `?${params.toString()}` : '';
  lastRequestLog = { method: 'GET', url: `/api/crm/leads/metrics${query}` };
  const res = await crmClient.get(`/api/crm/leads/metrics${query}`);
  logApiCall(SCRIPT_NAME, lastRequestLog, res.data, SKILL_NAME);

  const m = res.data;
  console.log(`Lead metrics${filters.from ? ` (from ${filters.from})` : ''}:`);
  console.log(`Total: ${m.total} | Conversion rate: ${m.conversionRate}%`);
  console.log(`By status: ${Object.entries(m.byStatus || {}).map(([k, v]) => `${k} ${v}`).join(' | ')}`);
  console.log(`By priority: ${Object.entries(m.byPriority || {}).map(([k, v]) => `${k} ${v}`).join(' | ')}`);
  console.log(`By type: ${Object.entries(m.byType || {}).map(([k, v]) => `${k} ${v}`).join(' | ')}`);

  logExecution({
    skill: SKILL_NAME, script: SCRIPT_NAME, status: 'success',
    duration_ms: timer.end(),
    userMessage: _meta?.userMessage, intent: _meta?.intent,
    request: lastRequestLog, response: { total: m.total, conversionRate: m.conversionRate },
  });
}

main().catch(e => {
  logApiError(SCRIPT_NAME, lastRequestLog, isCrmError(e) ? e.crmError : (e.response?.data || e.message), SKILL_NAME);
  if (isCrmError(e)) {
    console.error('Error:', e.crmError.message);
  } else {
    console.error('Error:', e.response?.data?.error || e.message);
  }
  process.exit(1);
});