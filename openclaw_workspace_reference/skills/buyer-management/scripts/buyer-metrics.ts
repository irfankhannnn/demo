import { crmClient, isCrmError } from '../../utils/crm-client';
import { logApiCall, logApiError, logExecution, startTimer } from '../../utils/logger';

const SCRIPT_NAME = 'buyer-metrics';
const SKILL_NAME = 'buyer-management';
let lastRequestLog: any = null;

async function main() {
  const timer = startTimer();
  const payload = process.argv[2] ? JSON.parse(process.argv[2]) : {};
  const { _meta } = payload;

  lastRequestLog = { method: 'GET', url: '/api/crm/buyers/metrics/summary' };
  const res = await crmClient.get('/api/crm/buyers/metrics/summary');
  logApiCall(SCRIPT_NAME, lastRequestLog, res.data, SKILL_NAME);

  const m = res.data;
  console.log('=== Buyer Metrics ===');
  console.log(`Total buyers: ${m.total}`);
  if (m.avgBudget) console.log(`Avg budget: ₹${m.avgBudget}`);

  if (m.byStatus && Object.keys(m.byStatus).length) {
    console.log('By status:');
    Object.entries(m.byStatus).forEach(([k, v]) => console.log(`  ${k}: ${v}`));
  }
  if (m.byPriority && Object.keys(m.byPriority).length) {
    console.log('By priority:');
    Object.entries(m.byPriority).forEach(([k, v]) => console.log(`  ${k}: ${v}`));
  }
  if (m.byPropertyType && Object.keys(m.byPropertyType).length) {
    console.log('By property type:');
    Object.entries(m.byPropertyType).forEach(([k, v]) => console.log(`  ${k}: ${v}`));
  }

  logExecution({
    skill: SKILL_NAME, script: SCRIPT_NAME, status: 'success',
    duration_ms: timer.end(),
    userMessage: _meta?.userMessage, intent: _meta?.intent,
    request: lastRequestLog, response: { total: m.total },
  });
}

main().catch(e => {
  logApiError(SCRIPT_NAME, lastRequestLog, isCrmError(e) ? e.crmError : (e.response?.data || e.message), SKILL_NAME);
  if (isCrmError(e)) { console.error('Error:', e.crmError.message); }
  else { console.error('Error fetching buyer metrics:', e.response?.data?.error || e.message); }
  process.exit(1);
});