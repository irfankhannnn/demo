import axios from 'axios';

const BASE = process.env.CRM_API_BASE;
const TOKEN = process.env.CRM_TOKEN;

async function main() {
  const raw = process.argv[2];
  if (!raw) {
    console.error('Usage: create-tenant.ts \'<json>\'');
    process.exit(1);
  }

  const payload = JSON.parse(raw);
  if (!payload.name?.trim()) {
    console.error('Error: name is required.');
    process.exit(1);
  }

  const res = await axios.post(`${BASE}/api/crm/customers`, payload, {
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
  });

  const t = res.data;
  console.log(`Tenant created: ${t.name} [${t.customerId}]`);
  console.log(`Phone: ${t.phone || 'N/A'} | Email: ${t.email || 'N/A'}`);
  console.log(`Status: ${t.status}`);
}

main().catch(e => {
  console.error('Error creating tenant:', e.response?.data?.error || e.message);
  process.exit(1);
});
