import { crmClient, isCrmError } from '../../utils/crm-client';
import { logApiCall, logApiError, logExecution, startTimer } from '../../utils/logger';

const SCRIPT_NAME = 'create-contact';
const SKILL_NAME = 'contact-management';
let lastRequestLog: any = null;

async function main() {
  const timer = startTimer();
  const raw = process.argv[2];

  if (!raw) { console.error('Usage: create-contact.ts \'<json>\''); process.exit(1); }

  const payload = JSON.parse(raw);
  const { _meta, ...contactData } = payload;

  if (!contactData.name?.trim()) { console.error('Error: name is required.'); process.exit(1); }

  lastRequestLog = { method: 'POST', url: '/api/crm/contacts', body: contactData };
  const res = await crmClient.post('/api/crm/contacts', contactData);
  logApiCall(SCRIPT_NAME, lastRequestLog, res.data, SKILL_NAME);

  const c = res.data;
  const roles = c.roles ? Object.keys(c.roles).filter((r: string) => c.roles[r]).join(', ') : 'none';
  console.log(`Contact created: ${c.name} [${c.contactId}]`);
  console.log(`Phone: ${c.phone || 'N/A'} | Email: ${c.email || 'N/A'}`);
  console.log(`Roles: ${roles}`);

  logExecution({ skill: SKILL_NAME, script: SCRIPT_NAME, status: 'success', duration_ms: timer.end(), userMessage: _meta?.userMessage, intent: _meta?.intent, request: lastRequestLog, response: { contactId: c.contactId, name: c.name } });
}

main().catch(e => {
  logApiError(SCRIPT_NAME, lastRequestLog, isCrmError(e) ? e.crmError : (e.response?.data || e.message), SKILL_NAME);
  if (isCrmError(e)) { console.error('Error:', e.crmError.message); }
  else { console.error('Error creating contact:', e.response?.data?.error || e.message); }
  process.exit(1);
});