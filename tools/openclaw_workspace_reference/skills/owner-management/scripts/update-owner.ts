import { crmClient, isCrmError } from '../../utils/crm-client';
import { logApiCall, logApiError, logExecution, startTimer } from '../../utils/logger';

const SCRIPT_NAME = 'update-owner';
const SKILL_NAME = 'owner-management';
let lastRequestLog: any = null;

async function main() {
  const timer = startTimer();
  const raw = process.argv[2];

  if (!raw) {
    console.error('Usage: update-owner.ts \'<json with ownerId>\'');
    process.exit(1);
  }

  const payload = JSON.parse(raw);
  const { ownerId, _meta, ...updates } = payload;

  if (!ownerId) {
    console.error('Error: ownerId is required.');
    process.exit(1);
  }

  lastRequestLog = { method: 'PUT', url: `/api/crm/owners/${ownerId}`, body: updates };
  const res = await crmClient.put(`/api/crm/owners/${ownerId}`, updates);
  logApiCall(SCRIPT_NAME, lastRequestLog, res.data, SKILL_NAME);

  const o = res.data;
  const updated = Object.keys(updates).join(', ');
  console.log(`Owner updated: ${o.name} [${o.ownerId}]`);
  console.log(`Fields updated: ${updated}`);

  logExecution({ skill: SKILL_NAME, script: SCRIPT_NAME, status: 'success', duration_ms: timer.end(), userMessage: _meta?.userMessage, intent: _meta?.intent, request: lastRequestLog, response: { ownerId: o.ownerId } });
}

main().catch(e => {
  logApiError(SCRIPT_NAME, lastRequestLog, isCrmError(e) ? e.crmError : (e.response?.data || e.message), SKILL_NAME);
  if (isCrmError(e)) { console.error('Error:', e.crmError.message); }
  else { const status = e.response?.status; if (status === 404) console.error('Owner not found.'); else console.error('Error updating owner:', e.response?.data?.error || e.message); }
  process.exit(1);
});