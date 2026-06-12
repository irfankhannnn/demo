import axios from 'axios';

const BASE = process.env.CRM_API_BASE;
const TOKEN = process.env.CRM_TOKEN;

async function main() {
  const filters = process.argv[2] ? JSON.parse(process.argv[2]) : {};

  const params = new URLSearchParams();
  if (filters.from) params.append('from', filters.from);
  if (filters.to) params.append('to', filters.to);

  const query = params.toString() ? `?${params.toString()}` : '';
  const res = await axios.get(`${BASE}/api/crm/leads/metrics${query}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });

  const m = res.data;
  console.log(`Lead metrics${filters.from ? ` (from ${filters.from})` : ''}:`);
  console.log(`Total: ${m.total} | Conversion rate: ${m.conversionRate}%`);
  console.log(`By status: ${Object.entries(m.byStatus || {}).map(([k, v]) => `${k} ${v}`).join(' | ')}`);
  console.log(`By priority: ${Object.entries(m.byPriority || {}).map(([k, v]) => `${k} ${v}`).join(' | ')}`);
  console.log(`By type: ${Object.entries(m.byType || {}).map(([k, v]) => `${k} ${v}`).join(' | ')}`);
}

main().catch(e => {
  console.error('Error:', e.response?.data?.error || e.message);
  process.exit(1);
});
