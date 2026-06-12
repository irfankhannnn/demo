import axios from 'axios';
import { logApiCall, logApiError } from '../../utils/logger';

const BASE = process.env.CRM_API_BASE;
const TOKEN = process.env.CRM_TOKEN;
const SCRIPT_NAME = 'delete-lead';
let lastRequestLog: any = null;

async function main() {
  const leadId = process.argv[2];
  if (!leadId) {
    console.error('Usage: delete-lead.ts <leadId>');
    process.exit(1);
  }

  lastRequestLog = { method: 'DELETE', url: `${BASE}/api/crm/leads/${leadId}` };
  const res = await axios.delete(`${BASE}/api/crm/leads/${leadId}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  logApiCall(SCRIPT_NAME, lastRequestLog, res.data ?? {});

  console.log(`Lead [${leadId}] deleted.`);
}

main().catch(e => {
  logApiError(SCRIPT_NAME, lastRequestLog, e.response?.data || e.message);
  const status = e.response?.status;
  if (status === 400 && e.response?.data?.error?.includes('converted')) {
    console.error('Cannot delete a converted lead.');
  } else if (status === 404) {
    console.error('Lead not found.');
  } else {
    console.error('Error:', e.response?.data?.error || e.message);
  }
  process.exit(1);
});
