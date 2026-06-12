import axios from 'axios';

const BASE = process.env.CRM_API_BASE;
const TOKEN = process.env.CRM_TOKEN;

async function main() {
  const raw = process.argv[2];
  if (!raw) {
    console.error('Usage: update-owner.ts \'<json with ownerId>\'');
    process.exit(1);
  }

  const { ownerId, ...updates } = JSON.parse(raw);
  if (!ownerId) {
    console.error('Error: ownerId is required.');
    process.exit(1);
  }

  const res = await axios.put(`${BASE}/api/crm/owners/${ownerId}`, updates, {
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
  });

  const o = res.data;
  const updated = Object.keys(updates).join(', ');
  console.log(`Owner updated: ${o.name} [${o.ownerId}]`);
  console.log(`Fields updated: ${updated}`);
}

main().catch(e => {
  const status = e.response?.status;
  if (status === 404) console.error('Owner not found.');
  else console.error('Error updating owner:', e.response?.data?.error || e.message);
  process.exit(1);
});
