import { crmClient, isCrmError } from '../../utils/crm-client';
import { logApiCall, logApiError, logExecution, startTimer } from '../../utils/logger';

const SCRIPT_NAME = 'get-owner';
const SKILL_NAME = 'owner-management';
let lastRequestLog: any = null;

async function main() {
  const timer = startTimer();
  const ownerId = process.argv[2];

  if (!ownerId) {
    console.error('Usage: get-owner.ts <ownerId>');
    process.exit(1);
  }

  lastRequestLog = { method: 'GET', url: `/api/crm/owners/${ownerId}` };
  const res = await crmClient.get(`/api/crm/owners/${ownerId}`);
  logApiCall(SCRIPT_NAME, lastRequestLog, res.data, SKILL_NAME);

  const o = res.data;
  console.log(`Owner: ${o.name} [${o.ownerId}]`);
  console.log(`Phone: ${o.phone || 'N/A'} | Email: ${o.email || 'N/A'}`);
  console.log(`Address: ${o.address || 'N/A'}`);
  console.log(`Status: ${o.status} | Source: ${o.source || 'N/A'}`);
  if (o.panNumber) console.log(`PAN: ${o.panNumber}`);
  if (o.aadharNumber) console.log(`Aadhar: ${o.aadharNumber}`);
  if (o.bankName || o.accountNumber || o.ifscCode) {
    console.log(`Bank: ${o.bankName || 'N/A'} | Account: ${o.accountNumber || 'N/A'} | IFSC: ${o.ifscCode || 'N/A'}`);
  }
  if (o.tags?.length) console.log(`Tags: ${o.tags.join(', ')}`);
  if (o.notes) console.log(`Notes: ${o.notes}`);
  if (o.photoS3Key) console.log('Photo: uploaded');
  if (o.panDocS3Key) console.log('PAN doc: uploaded');
  if (o.aadharDocS3Key) console.log('Aadhar doc: uploaded');
  console.log(`Created: ${o.createdAt}`);

  logExecution({ skill: SKILL_NAME, script: SCRIPT_NAME, status: 'success', duration_ms: timer.end(), request: lastRequestLog, response: { ownerId: o.ownerId, name: o.name } });
}

main().catch(e => {
  logApiError(SCRIPT_NAME, lastRequestLog, isCrmError(e) ? e.crmError : (e.response?.data || e.message), SKILL_NAME);
  if (isCrmError(e)) { console.error('Error:', e.crmError.message); }
  else { const status = e.response?.status; if (status === 404) console.error('Owner not found.'); else console.error('Error:', e.response?.data?.error || e.message); }
  process.exit(1);
});