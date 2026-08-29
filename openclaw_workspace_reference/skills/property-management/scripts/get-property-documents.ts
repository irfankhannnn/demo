import { crmClient, isCrmError } from '../../utils/crm-client';
import { logApiCall, logApiError, logExecution, startTimer } from '../../utils/logger';

const SCRIPT_NAME = 'get-property-documents';
const SKILL_NAME = 'property-management';
let lastRequestLog: any = null;

async function main() {
  const timer = startTimer();
  const propertyId = process.argv[2];

  if (!propertyId) { console.error('Usage: get-property-documents.ts <propertyId>'); process.exit(1); }

  lastRequestLog = { method: 'GET', url: `/api/crm/properties/${propertyId}/documents` };
  const res = await crmClient.get(`/api/crm/properties/${propertyId}/documents`);
  logApiCall(SCRIPT_NAME, lastRequestLog, res.data, SKILL_NAME);

  const docs = res.data;
  if (!docs || docs.length === 0) {
    console.log(`No documents found for property [${propertyId}].`);
    logExecution({ skill: SKILL_NAME, script: SCRIPT_NAME, status: 'success', duration_ms: timer.end(), request: lastRequestLog, response: { count: 0 } });
    return;
  }

  console.log(`${docs.length} document(s) for property [${propertyId}]:`);
  docs.forEach((d: any) => {
    const size = d.fileSize ? ` (${Math.round(d.fileSize / 1024)}KB)` : '';
    console.log(`- [${d.documentId}] ${d.documentType} | ${d.fileName}${size} | ${d.createdAt?.slice(0, 10)}`);
    if (d.description) console.log(`  Description: ${d.description}`);
  });

  logExecution({ skill: SKILL_NAME, script: SCRIPT_NAME, status: 'success', duration_ms: timer.end(), request: lastRequestLog, response: { count: docs.length } });
}

main().catch(e => {
  logApiError(SCRIPT_NAME, lastRequestLog, isCrmError(e) ? e.crmError : (e.response?.data || e.message), SKILL_NAME);
  if (isCrmError(e)) { console.error('Error:', e.crmError.message); }
  else { const status = e.response?.status; if (status === 404) console.error('Property not found.'); else console.error('Error:', e.response?.data?.error || e.message); }
  process.exit(1);
});