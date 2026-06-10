import axios from 'axios';
import { logApiCall, logApiError } from '../../utils/logger';

const BASE = process.env.CRM_API_BASE;
const TOKEN = process.env.CRM_TOKEN;
const SCRIPT_NAME = 'get-lead';
let lastRequestLog: any = null;

async function main() {
  const leadId = process.argv[2];
  if (!leadId) {
    console.error('Usage: get-lead.ts <leadId>');
    process.exit(1);
  }

  lastRequestLog = { method: 'GET', url: `${BASE}/api/crm/leads/${leadId}` };
  const res = await axios.get(`${BASE}/api/crm/leads/${leadId}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  logApiCall(SCRIPT_NAME, lastRequestLog, res.data);

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

  // Include contact only if available; do not dump raw notes by default
  if (l.phone || l.email) {
    const contacts: string[] = [];
    if (l.phone) contacts.push(`Phone: ${l.phone}`);
    if (l.email) contacts.push(`Email: ${l.email}`);
    console.log(contacts.join(' | '));
  }
}

main().catch(e => {
  logApiError(SCRIPT_NAME, lastRequestLog, e.response?.data || e.message);
  const status = e.response?.status;
  if (status === 404) console.error('Lead not found.');
  else console.error('Error:', e.response?.data?.error || e.message);
  process.exit(1);
});
