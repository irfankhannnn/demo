import axios from 'axios';
import { logApiCall, logApiError } from '../../utils/logger';

const BASE = process.env.CRM_API_BASE;
const TOKEN = process.env.CRM_TOKEN;
const SCRIPT_NAME = 'buyer-metrics';
let lastRequestLog: any = null;

async function main() {
  lastRequestLog = { method: 'GET', url: `${BASE}/api/crm/buyers/metrics/summary` };
  const res = await axios.get(`${BASE}/api/crm/buyers/metrics/summary`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  logApiCall(SCRIPT_NAME, lastRequestLog, res.data);

  const m = res.data;
  console.log(`=== Buyer Metrics ===`);
  console.log(`Total buyers: ${m.total}`);
  if (m.avgBudget) console.log(`Avg budget: ₹${m.avgBudget}`);

  if (m.byStatus && Object.keys(m.byStatus).length) {
    console.log('By status:');
    Object.entries(m.byStatus).forEach(([k, v]) => console.log(`  ${k}: ${v}`));
  }
  if (m.byPriority && Object.keys(m.byPriority).length) {
    console.log('By priority:');
    Object.entries(m.byPriority).forEach(([k, v]) => console.log(`  ${k}: ${v}`));
  }
  if (m.byPropertyType && Object.keys(m.byPropertyType).length) {
    console.log('By property type:');
    Object.entries(m.byPropertyType).forEach(([k, v]) => console.log(`  ${k}: ${v}`));
  }
}

main().catch(e => {
  logApiError(SCRIPT_NAME, lastRequestLog, e.response?.data || e.message);
  console.error('Error fetching buyer metrics:', e.response?.data?.error || e.message);
  process.exit(1);
});
