import axios from 'axios';

const BASE = process.env.CRM_API_BASE;
const TOKEN = process.env.CRM_TOKEN;

async function main() {
  const raw = process.argv[2];
  if (!raw) {
    console.error('Usage: create-contact.ts \'<json>\'');
    process.exit(1);
  }

  const payload = JSON.parse(raw);
  if (!payload.name?.trim()) {
    console.error('Error: name is required.');
    process.exit(1);
  }

  const res = await axios.post(`${BASE}/api/crm/contacts`, payload, {
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
  });

  const c = res.data;
  const roles = c.roles ? Object.keys(c.roles).filter((r: string) => c.roles[r]).join(', ') : 'none';
  console.log(`Contact created: ${c.name} [${c.contactId}]`);
  console.log(`Phone: ${c.phone || 'N/A'} | Email: ${c.email || 'N/A'}`);
  console.log(`Roles: ${roles}`);
}

main().catch(e => {
  console.error('Error creating contact:', e.response?.data?.error || e.message);
  process.exit(1);
});
