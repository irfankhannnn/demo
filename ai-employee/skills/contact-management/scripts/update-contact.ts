import { crmClient, isCrmError } from '../../utils/crm-client';
import { logApiCall, logApiError, logExecution, startTimer } from '../../utils/logger';

const SCRIPT_NAME = 'update-contact';
const SKILL_NAME = 'contact-management';
let lastRequestLog: any = null;

async function main() {
  const timer = startTimer();
  const raw = process.argv[2];

  if (!raw) { console.error('Usage: update-contact.ts \'<json with contactId>\''); process.exit(1); }

  const payload = JSON.parse(raw);
  const { contactId, _meta, ...updates } = payload;

  if (!contactId) { console.error('Error: contactId is required.'); process.exit(1); }

  lastRequestLog = { method: 'PUT', url: `/api/crm/contacts/${contactId}`, body: updates };
  const res = await crmClient.put(`/api/crm/contacts/${contactId}`, updates);
  logApiCall(SCRIPT_NAME, lastRequestLog, res.data, SKILL_NAME);

  const c = res.data;
  const updated = Object.keys(updates).join(', ');
  console.log(`Contact updated: ${c.name} [${c.contactId}]`);
  console.log(`Fields updated: ${updated}`);

  logExecution({ skill: SKILL_NAME, script: SCRIPT_NAME, status: 'success', duration_ms: timer.end(), userMessage: _meta?.userMessage, intent: _meta?.intent, request: lastRequestLog, response: { contactId: c.contactId } });
}

main().catch(e => {
  logApiError(SCRIPT_NAME, lastRequestLog, isCrmError(e) ? e.crmError : (e.response?.data || e.message), SKILL_NAME);
  if (isCrmError(e)) { console.error('Error:', e.crmError.message); }
  else { const status = e.response?.status; if (status === 404) console.error('Contact not found.'); else console.error('Error updating contact:', e.response?.data?.error || e.message); }
  process.exit(1);
});