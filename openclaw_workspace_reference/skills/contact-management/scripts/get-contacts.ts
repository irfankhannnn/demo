import { crmClient, isCrmError } from '../../utils/crm-client';
import { logApiCall, logApiError, logExecution, startTimer } from '../../utils/logger';

const SCRIPT_NAME = 'get-contacts';
const SKILL_NAME = 'contact-management';
let lastRequestLog: any = null;

async function main() {
  const timer = startTimer();
  const raw = process.argv[2] || '{}';
  const payload = JSON.parse(raw);
  const { role, status, _meta } = payload;

  const params: Record<string, string> = {};
  if (role) params.role = role;
  if (status) params.status = status;

  lastRequestLog = { method: 'GET', url: '/api/crm/contacts', params };
  const res = await crmClient.get('/api/crm/contacts', { params });
  logApiCall(SCRIPT_NAME, lastRequestLog, res.data, SKILL_NAME);

  const contacts = res.data;
  if (!contacts || contacts.length === 0) {
    console.log('No contacts found.');
    logExecution({ skill: SKILL_NAME, script: SCRIPT_NAME, status: 'success', duration_ms: timer.end(), userMessage: _meta?.userMessage, intent: _meta?.intent, request: lastRequestLog, response: { count: 0 } });
    return;
  }

  const label = Object.keys(params).length ? JSON.stringify(params) : 'all';
  console.log(`${contacts.length} contact(s) [${label}]:`);
  contacts.forEach((c: any) => {
    const roles = c.roles ? Object.keys(c.roles).filter((r: string) => c.roles[r]).join('/') : '';
    const roleLabel = roles ? ` [${roles}]` : '';
    console.log(`- [${c.contactId}] ${c.name} | ${c.phone || 'no phone'}${roleLabel} | ${c.status || 'active'}`);
  });

  logExecution({ skill: SKILL_NAME, script: SCRIPT_NAME, status: 'success', duration_ms: timer.end(), userMessage: _meta?.userMessage, intent: _meta?.intent, request: lastRequestLog, response: { count: contacts.length } });
}

main().catch(e => {
  logApiError(SCRIPT_NAME, lastRequestLog, isCrmError(e) ? e.crmError : (e.response?.data || e.message), SKILL_NAME);
  if (isCrmError(e)) { console.error('Error:', e.crmError.message); }
  else { console.error('Error fetching contacts:', e.response?.data?.error || e.message); }
  process.exit(1);
});