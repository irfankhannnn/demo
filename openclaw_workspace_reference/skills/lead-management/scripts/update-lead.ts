import { crmClient, isCrmError } from '../../utils/crm-client';
import { logApiCall, logApiError, logExecution, startTimer } from '../../utils/logger';

const SCRIPT_NAME = 'update-lead';
const SKILL_NAME = 'lead-management';
let lastRequestLog: any = null;

async function main() {
  const timer = startTimer();

  if (!process.argv[2]) {
    console.error("Usage: update-lead.ts '<json with leadId>'");
    process.exit(1);
  }

  const payload = JSON.parse(process.argv[2]);
  const { leadId, _meta, ...updates } = payload;

  if (!leadId) {
    console.error('Error: leadId is required.');
    process.exit(1);
  }

  lastRequestLog = { method: 'PUT', url: `/api/crm/leads/${leadId}`, body: updates };
  const res = await crmClient.put(`/api/crm/leads/${leadId}`, updates);
  logApiCall(SCRIPT_NAME, lastRequestLog, res.data, SKILL_NAME);

  const l = res.data;
  console.log(`Lead updated: ${l.name} | ${l.leadType} | ${l.status} | ${l.priority} priority | ID: ${l.leadId}`);
  if (updates.status === 'lost' && l.lostReason) {
    console.log(`Lost reason: ${l.lostReason}`);
  }

  logExecution({
    skill: SKILL_NAME, script: SCRIPT_NAME, status: 'success',
    duration_ms: timer.end(),
    userMessage: _meta?.userMessage, intent: _meta?.intent,
    request: lastRequestLog, response: { leadId: l.leadId, status: l.status },
  });
}

main().catch(e => {
  logApiError(SCRIPT_NAME, lastRequestLog, isCrmError(e) ? e.crmError : (e.response?.data || e.message), SKILL_NAME);
  if (isCrmError(e)) {
    console.error('Error:', e.crmError.message);
  } else {
    const status = e.response?.status;
    if (status === 400 && e.response?.data?.error?.includes('converted')) {
      console.error('Cannot update a converted lead.');
    } else if (status === 404) {
      console.error('Lead not found.');
    } else {
      console.error('Error:', e.response?.data?.error || e.message);
    }
  }
  process.exit(1);
});