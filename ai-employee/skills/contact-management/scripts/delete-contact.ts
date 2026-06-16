import { crmClient, isCrmError } from '../../utils/crm-client';
import { logApiCall, logApiError, logExecution, startTimer } from '../../utils/logger';

const SCRIPT_NAME = 'delete-contact';
const SKILL_NAME = 'contact-management';
let lastRequestLog: any = null;

async function main() {
  const timer = startTimer();
  const contactId = process.argv[2];

  if (!contactId) { console.error('Usage: delete-contact.ts <contactId>'); process.exit(1); }

  lastRequestLog = { method: 'DELETE', url: `/api/crm/contacts/${contactId}` };
  const res = await crmClient.delete(`/api/crm/contacts/${contactId}`);
  logApiCall(SCRIPT_NAME, lastRequestLog, res.data ?? {}, SKILL_NAME);

  console.log(`Contact [${contactId}] deleted successfully.`);

  logExecution({ skill: SKILL_NAME, script: SCRIPT_NAME, status: 'success', duration_ms: timer.end(), request: lastRequestLog, response: { contactId, deleted: true } });
}

main().catch(e => {
  logApiError(SCRIPT_NAME, lastRequestLog, isCrmError(e) ? e.crmError : (e.response?.data || e.message), SKILL_NAME);
  if (isCrmError(e)) { console.error('Error:', e.crmError.message); }
  else { const status = e.response?.status; if (status === 404) console.error('Contact not found.'); else console.error('Error deleting contact:', e.response?.data?.error || e.message); }
  process.exit(1);
});