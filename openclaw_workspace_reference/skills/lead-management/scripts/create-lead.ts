import { crmClient, isCrmError } from '../../utils/crm-client';
import { logApiCall, logApiError, logExecution, startTimer } from '../../utils/logger';

const SCRIPT_NAME = 'create-lead';
const SKILL_NAME = 'lead-management';
let lastRequestLog: any = null;

async function main() {
  const timer = startTimer();

  if (!process.argv[2]) {
    console.error('Usage: create-lead.ts \'<json>\'');
    process.exit(1);
  }

  const payload = JSON.parse(process.argv[2]);
  const { _meta, ...leadData } = payload;

  lastRequestLog = { method: 'POST', url: '/api/crm/leads', body: leadData };
  const res = await crmClient.post('/api/crm/leads', leadData);
  logApiCall(SCRIPT_NAME, lastRequestLog, res.data, SKILL_NAME);

  const l = res.data;
  const budget =
    l.buyerRequirement?.budget ||
    l.tenantRequirement?.budget ||
    l.sellerProperty?.expectedPrice ||
    l.ownerProperty?.rentExpected;
  const area =
    l.buyerRequirement?.preferredArea ||
    l.tenantRequirement?.preferredArea ||
    l.sellerProperty?.area ||
    l.ownerProperty?.area;

  console.log(`Lead created: ${l.name} | ${l.leadType} | ${l.status} | ${l.priority} priority${area ? ` | ${area}` : ''}${budget ? ` | ₹${Number(budget).toLocaleString()}` : ''}`);
  console.log(`Lead ID: ${l.leadId}`);
  if (l.phone) console.log(`Phone: ${l.phone}`);

  logExecution({
    skill: SKILL_NAME, script: SCRIPT_NAME, status: 'success',
    duration_ms: timer.end(),
    userMessage: _meta?.userMessage, intent: _meta?.intent,
    request: lastRequestLog, response: { leadId: l.leadId, name: l.name },
  });
}

main().catch(e => {
  logApiError(SCRIPT_NAME, lastRequestLog, isCrmError(e) ? e.crmError : (e.response?.data || e.message), SKILL_NAME);
  if (isCrmError(e)) {
    console.error('Error:', e.crmError.message);
  } else {
    const status = e.response?.status;
    if (status === 409) console.error('DUPLICATE: A lead with this phone number already exists.');
    else if (status === 400) console.error(`Validation error: ${e.response?.data?.error || 'Bad request'}`);
    else console.error('Error:', e.response?.data?.error || e.message);
  }
  process.exit(1);
});