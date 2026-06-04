import axios from 'axios';

const BASE = process.env.CRM_API_BASE;
const TOKEN = process.env.CRM_TOKEN;

async function main() {
  const res = await axios.get(`${BASE}/api/crm/buyers/metrics/summary`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });

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
  console.error('Error fetching buyer metrics:', e.response?.data?.error || e.message);
  process.exit(1);
});
