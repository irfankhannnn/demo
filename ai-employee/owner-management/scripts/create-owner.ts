import axios from 'axios';

const BASE = process.env.CRM_API_BASE;
const TOKEN = process.env.CRM_TOKEN;

async function main() {
  const raw = process.argv[2];
  if (!raw) {
    console.error('Usage: create-owner.ts \'<json>\'');
    process.exit(1);
  }

  const payload = JSON.parse(raw);
  if (!payload.name?.trim()) {
    console.error('Error: name is required.');
    process.exit(1);
  }

  const res = await axios.post(`${BASE}/api/crm/owners`, payload, {
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
  });

  const o = res.data;
  console.log(`Owner created: ${o.name} [${o.ownerId}]`);
  console.log(`Phone: ${o.phone || 'N/A'} | Email: ${o.email || 'N/A'}`);
  console.log(`Status: ${o.status}`);
}

main().catch(e => {
  console.error('Error creating owner:', e.response?.data?.error || e.message);
  process.exit(1);
});
