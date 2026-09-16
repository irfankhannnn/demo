import { crmClient, isCrmError } from '../../utils/crm-client';
import { logApiCall, logApiError, logExecution, startTimer } from '../../utils/logger';

const SCRIPT_NAME = 'search-contacts';
const SKILL_NAME = 'contact-management';
let lastRequestLog: any = null;

async function main() {
  const timer = startTimer();
  const query = process.argv[2];

  if (!query) { console.error('Usage: search-contacts.ts <name or phone>'); process.exit(1); }

  if (/^\d{6,}$/.test(query.replace(/\D/g, ''))) {
    try {
      lastRequestLog = { method: 'GET', url: '/api/crm/contacts/lookup/by-phone', params: { phone: query } };
      const res = await crmClient.get('/api/crm/contacts/lookup/by-phone', { params: { phone: query } });
      logApiCall(SCRIPT_NAME, lastRequestLog, res.data, SKILL_NAME);
      const c = res.data;
      const roles = c.roles ? Object.keys(c.roles).filter((r: string) => c.roles[r]).join(', ') : 'none';
      console.log(`Found by phone: ${c.name} [${c.contactId}]`);
      console.log(`Phone: ${c.phone} | Email: ${c.email || 'N/A'} | Roles: ${roles}`);
      logExecution({ skill: SKILL_NAME, script: SCRIPT_NAME, status: 'success', duration_ms: timer.end(), request: lastRequestLog, response: { found: true, contactId: c.contactId } });
      return;
    } catch (e: any) {
      if (isCrmError(e)) {
        if (e.crmError.status !== 404) throw e;
      } else if (e.response?.status !== 404) throw e;
    }
  }

  lastRequestLog = { method: 'GET', url: '/api/crm/contacts' };
  const res = await crmClient.get('/api/crm/contacts');
  logApiCall(SCRIPT_NAME, lastRequestLog, res.data, SKILL_NAME);

  const all = res.data as any[];
  const q = query.toLowerCase();
  const matches = all.filter((c: any) =>
    c.name?.toLowerCase().includes(q) ||
    c.phone?.includes(query) ||
    c.email?.toLowerCase().includes(q)
  );

  if (!matches.length) {
    console.log(`No contacts found for "${query}".`);
    logExecution({ skill: SKILL_NAME, script: SCRIPT_NAME, status: 'success', duration_ms: timer.end(), request: lastRequestLog, response: { total: 0, query } });
    return;
  }

  console.log(`Found ${matches.length} contact(s) for "${query}":`);
  matches.forEach((c: any) => {
    const roles = c.roles ? Object.keys(c.roles).filter((r: string) => c.roles[r]).join('/') : '';
    const roleLabel = roles ? ` [${roles}]` : '';
    console.log(`- [${c.contactId}] ${c.name} | ${c.phone || 'no phone'}${roleLabel}`);
  });

  logExecution({ skill: SKILL_NAME, script: SCRIPT_NAME, status: 'success', duration_ms: timer.end(), request: lastRequestLog, response: { total: matches.length, query } });
}

main().catch(e => {
  logApiError(SCRIPT_NAME, lastRequestLog, isCrmError(e) ? e.crmError : (e.response?.data || e.message), SKILL_NAME);
  if (isCrmError(e)) { console.error('Error:', e.crmError.message); }
  else { console.error('Error searching contacts:', e.response?.data?.error || e.message); }
  process.exit(1);
});