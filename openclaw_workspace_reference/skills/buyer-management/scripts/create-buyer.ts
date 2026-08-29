import { crmClient, isCrmError } from '../../utils/crm-client';
import { logApiCall, logApiError, logExecution, startTimer } from '../../utils/logger';

const SCRIPT_NAME = 'create-buyer';
const SKILL_NAME = 'buyer-management';
let lastRequestLog: any = null;

async function main() {
  const timer = startTimer();
  const raw = process.argv[2];

  if (!raw) {
    console.error('Usage: create-buyer.ts \'<json>\'');
    process.exit(1);
  }

  const payload = JSON.parse(raw);
  const { _meta, ...buyerData } = payload;

  if (!buyerData.name?.trim()) {
    console.error('Error: name is required.');
    process.exit(1);
  }

  lastRequestLog = { method: 'POST', url: '/api/crm/buyers', body: buyerData };
  const res = await crmClient.post('/api/crm/buyers', buyerData);
  logApiCall(SCRIPT_NAME, lastRequestLog, res.data, SKILL_NAME);

  const b = res.data;
  console.log(`Buyer created: ${b.name} [${b.buyerId}]`);
  console.log(`Phone: ${b.phone || 'N/A'} | Priority: ${b.priority}`);
  if (b.budget) console.log(`Budget: ₹${b.budget}`);
  if (b.crossRoleInfo) console.log(`Note: ${b.crossRoleInfo.message}`);

  logExecution({ skill: SKILL_NAME, script: SCRIPT_NAME, status: 'success', duration_ms: timer.end(), userMessage: _meta?.userMessage, intent: _meta?.intent, request: lastRequestLog, response: { buyerId: b.buyerId, name: b.name } });
}

main().catch(e => {
  logApiError(SCRIPT_NAME, lastRequestLog, isCrmError(e) ? e.crmError : (e.response?.data || e.message), SKILL_NAME);
  if (isCrmError(e)) { console.error('Error:', e.crmError.message); }
  else { console.error('Error creating buyer:', e.response?.data?.error || e.message); }
  process.exit(1);
});