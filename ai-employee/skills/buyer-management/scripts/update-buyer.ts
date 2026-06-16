import { crmClient, isCrmError } from '../../utils/crm-client';
import { logApiCall, logApiError, logExecution, startTimer } from '../../utils/logger';

const SCRIPT_NAME = 'update-buyer';
const SKILL_NAME = 'buyer-management';
let lastRequestLog: any = null;

async function main() {
  const timer = startTimer();
  const raw = process.argv[2];

  if (!raw) {
    console.error('Usage: update-buyer.ts \'<json with buyerId>\'');
    process.exit(1);
  }

  const payload = JSON.parse(raw);
  const { buyerId, _meta, ...updates } = payload;

  if (!buyerId) {
    console.error('Error: buyerId is required.');
    process.exit(1);
  }

  lastRequestLog = { method: 'PUT', url: `/api/crm/buyers/${buyerId}`, body: updates };
  const res = await crmClient.put(`/api/crm/buyers/${buyerId}`, updates);
  logApiCall(SCRIPT_NAME, lastRequestLog, res.data, SKILL_NAME);

  const b = res.data;
  const updated = Object.keys(updates).join(', ');
  console.log(`Buyer updated: ${b.name} [${b.buyerId}]`);
  console.log(`Fields updated: ${updated}`);

  logExecution({
    skill: SKILL_NAME, script: SCRIPT_NAME, status: 'success',
    duration_ms: timer.end(),
    userMessage: _meta?.userMessage, intent: _meta?.intent,
    request: lastRequestLog, response: { buyerId: b.buyerId },
  });
}

main().catch(e => {
  logApiError(SCRIPT_NAME, lastRequestLog, isCrmError(e) ? e.crmError : (e.response?.data || e.message), SKILL_NAME);
  if (isCrmError(e)) {
    console.error('Error:', e.crmError.message);
  } else {
    const status = e.response?.status;
    if (status === 404) console.error('Buyer not found.');
    else console.error('Error updating buyer:', e.response?.data?.error || e.message);
  }
  process.exit(1);
});