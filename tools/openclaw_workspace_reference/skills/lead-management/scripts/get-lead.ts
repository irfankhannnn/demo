import { crmClient, isCrmError } from '../../utils/crm-client';
import { logApiCall, logApiError, logExecution, startTimer } from '../../utils/logger';

const SCRIPT_NAME = 'get-lead';
const SKILL_NAME = 'lead-management';
let lastRequestLog: any = null;

async function main() {
  const timer = startTimer();
  const leadId = process.argv[2];

  if (!leadId) {
    console.error('Usage: get-lead.ts <leadId>');
    process.exit(1);
  }

  lastRequestLog = { method: 'GET', url: `/api/crm/leads/${leadId}` };
  const res = await crmClient.get(`/api/crm/leads/${leadId}`);
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

  function fmtMoney(v: number | undefined): string {
    if (!v) return '';
    if (v >= 10000000) return `₹${(v / 10000000).toFixed(1)}Cr`;
    if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
    if (v >= 1000) return `₹${(v / 1000).toFixed(0)}k`;
    return `₹${v}`;
  }

  console.log(`${l.name} [${l.leadId}]`);
  console.log(`${l.leadType} | ${l.status} | ${l.priority} priority${l.convertedAt ? ' | CONVERTED' : ''}`);
  if (budget) console.log(`Budget: ${fmtMoney(budget)}`);
  if (area) console.log(`Area: ${area}`);
  if (l.assignedTo) console.log(`Assigned: ${l.assignedTo}`);
  if (l.source) console.log(`Source: ${l.source}`);

  if (l.phone || l.email) {
    const contacts: string[] = [];
    if (l.phone) contacts.push(`Phone: ${l.phone}`);
    if (l.email) contacts.push(`Email: ${l.email}`);
    console.log(contacts.join(' | '));
  }

  logExecution({
    skill: SKILL_NAME, script: SCRIPT_NAME, status: 'success',
    duration_ms: timer.end(),
    request: lastRequestLog, response: { leadId: l.leadId, name: l.name },
  });
}

main().catch(e => {
  logApiError(SCRIPT_NAME, lastRequestLog, isCrmError(e) ? e.crmError : (e.response?.data || e.message), SKILL_NAME);
  if (isCrmError(e)) {
    console.error('Error:', e.crmError.message);
  } else {
    const status = e.response?.status;
    if (status === 404) console.error('Lead not found.');
    else console.error('Error:', e.response?.data?.error || e.message);
  }
  process.exit(1);
});