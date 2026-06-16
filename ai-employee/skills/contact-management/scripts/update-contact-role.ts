import { crmClient, isCrmError } from '../../utils/crm-client';
import { logApiCall, logApiError, logExecution, startTimer } from '../../utils/logger';

const SCRIPT_NAME = 'update-contact-role';
const SKILL_NAME = 'contact-management';
let lastRequestLog: any = null;

async function main() {
  const timer = startTimer();
  const raw = process.argv[2];

  if (!raw) { console.error('Usage: update-contact-role.ts \'<json with contactId, role, enabled>\''); process.exit(1); }

  const payload = JSON.parse(raw);
  const { contactId, role, enabled, profileData, _meta } = payload;

  if (!contactId || !role) { console.error('Error: contactId and role are required.'); process.exit(1); }

  const validRoles = ['owner', 'buyer', 'seller', 'tenant'];
  if (!validRoles.includes(role)) { console.error(`Error: role must be one of: ${validRoles.join(', ')}`); process.exit(1); }

  const body = { role, enabled: enabled !== false, profileData: profileData || undefined };
  lastRequestLog = { method: 'PUT', url: `/api/crm/contacts/${contactId}/role`, body };
  const res = await crmClient.put(`/api/crm/contacts/${contactId}/role`, body);
  logApiCall(SCRIPT_NAME, lastRequestLog, res.data, SKILL_NAME);

  const c = res.data;
  const action = enabled !== false ? 'added' : 'removed';
  console.log(`Role "${role}" ${action} for contact: ${c.name} [${c.contactId}]`);

  logExecution({ skill: SKILL_NAME, script: SCRIPT_NAME, status: 'success', duration_ms: timer.end(), userMessage: _meta?.userMessage, intent: _meta?.intent, request: lastRequestLog, response: { contactId: c.contactId, role } });
}

main().catch(e => {
  logApiError(SCRIPT_NAME, lastRequestLog, isCrmError(e) ? e.crmError : (e.response?.data || e.message), SKILL_NAME);
  if (isCrmError(e)) { console.error('Error:', e.crmError.message); }
  else { const status = e.response?.status; if (status === 404) console.error('Contact not found.'); else console.error('Error updating role:', e.response?.data?.error || e.message); }
  process.exit(1);
});