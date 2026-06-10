import axios from 'axios';
import { logApiCall, logApiError } from '../../utils/logger';

const BASE = process.env.CRM_API_BASE;
const TOKEN = process.env.CRM_TOKEN;
const SCRIPT_NAME = 'update-lead';
let lastRequestLog: any = null;

async function main() {
  if (!process.argv[2]) {
    console.error("Usage: update-lead.ts '<json with leadId>'");
    process.exit(1);
  }

  const { leadId, ...updates } = JSON.parse(process.argv[2]);

  if (!leadId) {
    console.error('Error: leadId is required.');
    process.exit(1);
  }

  lastRequestLog = { method: 'PUT', url: `${BASE}/api/crm/leads/${leadId}`, body: updates };
  const res = await axios.put(`${BASE}/api/crm/leads/${leadId}`, updates, {
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
  });
  logApiCall(SCRIPT_NAME, lastRequestLog, res.data);

  const l = res.data;
  console.log(`Lead updated: ${l.name} | ${l.leadType} | ${l.status} | ${l.priority} priority | ID: ${l.leadId}`);
  if (updates.status === 'lost' && l.lostReason) {
    console.log(`Lost reason: ${l.lostReason}`);
  }
}

main().catch(e => {
  logApiError(SCRIPT_NAME, lastRequestLog, e.response?.data || e.message);
  const status = e.response?.status;
  if (status === 400 && e.response?.data?.error?.includes('converted')) {
    console.error('Cannot update a converted lead.');
  } else if (status === 404) {
    console.error('Lead not found.');
  } else {
    console.error('Error:', e.response?.data?.error || e.message);
  }
  process.exit(1);
});
