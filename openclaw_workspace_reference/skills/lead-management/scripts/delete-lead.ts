import { crmClient, isCrmError } from '../../utils/crm-client';
import { logApiCall, logApiError, logExecution, startTimer } from '../../utils/logger';

const SCRIPT_NAME = 'delete-lead';
const SKILL_NAME = 'lead-management';
let lastRequestLog: any = null;

async function main() {
  const timer = startTimer();
  const leadId = process.argv[2];

  if (!leadId) {
    console.error('Usage: delete-lead.ts <leadId>');
    process.exit(1);
  }

  lastRequestLog = { method: 'DELETE', url: `/api/crm/leads/${leadId}` };
  const res = await crmClient.delete(`/api/crm/leads/${leadId}`);
  logApiCall(SCRIPT_NAME, lastRequestLog, res.data ?? {}, SKILL_NAME);

  console.log(`Lead [${leadId}] deleted.`);

  logExecution({
    skill: SKILL_NAME, script: SCRIPT_NAME, status: 'success',
    duration_ms: timer.end(),
    request: lastRequestLog, response: { leadId, deleted: true },
  });
}

main().catch(e => {
  logApiError(SCRIPT_NAME, lastRequestLog, isCrmError(e) ? e.crmError : (e.response?.data || e.message), SKILL_NAME);
  if (isCrmError(e)) {
    console.error('Error:', e.crmError.message);
  } else {
    const status = e.response?.status;
    if (status === 400 && e.response?.data?.error?.includes('converted')) {
      console.error('Cannot delete a converted lead.');
    } else if (status === 404) {
      console.error('Lead not found.');
    } else {
      console.error('Error:', e.response?.data?.error || e.message);
    }
  }
  process.exit(1);
});