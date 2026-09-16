import { crmClient, isCrmError } from '../../utils/crm-client';
import { logApiCall, logApiError, logExecution, startTimer } from '../../utils/logger';

const SCRIPT_NAME = 'convert-lead';
const SKILL_NAME = 'lead-management';
let lastRequestLog: any = null;

async function main() {
  const timer = startTimer();

  if (!process.argv[2]) {
    console.error("Usage: convert-lead.ts '<json with leadId>'");
    process.exit(1);
  }

  const payload = JSON.parse(process.argv[2]);
  const { leadId, _meta, ...options } = payload;

  if (!leadId) {
    console.error('Error: leadId is required.');
    process.exit(1);
  }

  lastRequestLog = { method: 'POST', url: `/api/crm/leads/${leadId}/convert`, body: options };
  const res = await crmClient.post(`/api/crm/leads/${leadId}/convert`, options);
  logApiCall(SCRIPT_NAME, lastRequestLog, res.data, SKILL_NAME);

  const { lead, entity, entityType } = res.data;
  console.log(`Converted: ${lead.name} (${lead.leadType}) → ${entityType}`);

  if (entity) {
    const entityId = entity.buyerId || entity.tenantId || entity.ownerId || entity.customerId || entity.id || '';
    const entityName = entity.name || entity.firstName || lead.name;
    console.log(`${entityType} created: ${entityName}${entityId ? ` | ID: ${entityId}` : ''}`);
  }

  logExecution({
    skill: SKILL_NAME, script: SCRIPT_NAME, status: 'success',
    duration_ms: timer.end(),
    userMessage: _meta?.userMessage, intent: _meta?.intent,
    request: lastRequestLog, response: { leadId, entityType },
  });
}

main().catch(e => {
  logApiError(SCRIPT_NAME, lastRequestLog, isCrmError(e) ? e.crmError : (e.response?.data || e.message), SKILL_NAME);
  if (isCrmError(e)) {
    console.error('Error:', e.crmError.message);
  } else {
    const status = e.response?.status;
    const msg = e.response?.data?.error || e.message;
    if (status === 400) {
      if (msg.includes('already been converted')) console.error('Lead has already been converted.');
      else if (msg.includes('phone')) console.error('Lead must have a phone number before conversion.');
      else if (msg.includes('required')) console.error(`Missing: ${msg}`);
      else console.error(`Error: ${msg}`);
    } else if (status === 404) {
      console.error('Lead not found.');
    } else {
      console.error('Error:', msg);
    }
  }
  process.exit(1);
});