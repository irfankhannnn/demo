import { crmClient, isCrmError } from '../../utils/crm-client';
import { logApiCall, logApiError, logExecution, startTimer } from '../../utils/logger';

const SCRIPT_NAME = 'create-owner';
const SKILL_NAME = 'owner-management';
let lastRequestLog: any = null;

async function main() {
  const timer = startTimer();
  const raw = process.argv[2];

  if (!raw) { console.error('Usage: create-owner.ts \'<json>\''); process.exit(1); }

  const payload = JSON.parse(raw);
  const { _meta, ...ownerData } = payload;

  if (!ownerData.name?.trim()) { console.error('Error: name is required.'); process.exit(1); }

  lastRequestLog = { method: 'POST', url: '/api/crm/owners', body: ownerData };
  const res = await crmClient.post('/api/crm/owners', ownerData);
  logApiCall(SCRIPT_NAME, lastRequestLog, res.data, SKILL_NAME);

  const o = res.data;
  console.log(`Owner created: ${o.name} [${o.ownerId}]`);
  console.log(`Phone: ${o.phone || 'N/A'} | Email: ${o.email || 'N/A'}`);
  console.log(`Status: ${o.status}`);

  logExecution({ skill: SKILL_NAME, script: SCRIPT_NAME, status: 'success', duration_ms: timer.end(), userMessage: _meta?.userMessage, intent: _meta?.intent, request: lastRequestLog, response: { ownerId: o.ownerId, name: o.name } });
}

main().catch(e => {
  logApiError(SCRIPT_NAME, lastRequestLog, isCrmError(e) ? e.crmError : (e.response?.data || e.message), SKILL_NAME);
  if (isCrmError(e)) { console.error('Error:', e.crmError.message); }
  else { console.error('Error creating owner:', e.response?.data?.error || e.message); }
  process.exit(1);
});