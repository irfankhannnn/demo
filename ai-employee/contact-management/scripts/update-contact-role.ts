import axios from 'axios';
import { logApiCall, logApiError } from '../../utils/logger';

const BASE = process.env.CRM_API_BASE;
const TOKEN = process.env.CRM_TOKEN;
const SCRIPT_NAME = 'update-contact-role';
let lastRequestLog: any = null;

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

  const body = { role, enabled: enabled !== false, profileData: profileData || undefined };
  lastRequestLog = { method: 'PUT', url: `${BASE}/api/crm/contacts/${contactId}/role`, body };
  const res = await axios.put(`${BASE}/api/crm/contacts/${contactId}/role`, body, {
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
  });
  logApiCall(SCRIPT_NAME, lastRequestLog, res.data);

  const c = res.data;
  const action = enabled !== false ? 'added' : 'removed';
  console.log(`Role "${role}" ${action} for contact: ${c.name} [${c.contactId}]`);
}

main().catch(e => {
  logApiError(SCRIPT_NAME, lastRequestLog, e.response?.data || e.message);
  const status = e.response?.status;
  if (status === 404) console.error('Contact not found.');
  else console.error('Error updating role:', e.response?.data?.error || e.message);
  process.exit(1);
});
