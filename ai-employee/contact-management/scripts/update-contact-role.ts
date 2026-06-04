import axios from 'axios';

const BASE = process.env.CRM_API_BASE;
const TOKEN = process.env.CRM_TOKEN;

async function main() {
  const raw = process.argv[2];
  if (!raw) {
    console.error('Usage: update-contact-role.ts \'<json with contactId, role, enabled>\'');
    process.exit(1);
  }

  const { contactId, role, enabled, profileData } = JSON.parse(raw);
  if (!contactId || !role) {
    console.error('Error: contactId and role are required.');
    process.exit(1);
  }

  const validRoles = ['owner', 'buyer', 'seller', 'tenant'];
  if (!validRoles.includes(role)) {
    console.error(`Error: role must be one of: ${validRoles.join(', ')}`);
    process.exit(1);
  }

  const res = await axios.put(`${BASE}/api/crm/contacts/${contactId}/role`, {
    role,
    enabled: enabled !== false,
    profileData: profileData || undefined,
  }, {
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
  });

  const c = res.data;
  const action = enabled !== false ? 'added' : 'removed';
  console.log(`Role "${role}" ${action} for contact: ${c.name} [${c.contactId}]`);
}

main().catch(e => {
  const status = e.response?.status;
  if (status === 404) console.error('Contact not found.');
  else console.error('Error updating role:', e.response?.data?.error || e.message);
  process.exit(1);
});
