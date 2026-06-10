import axios from 'axios';
import { logApiCall, logApiError } from '../../utils/logger';

const BASE = process.env.CRM_API_BASE;
const TOKEN = process.env.CRM_TOKEN;
const SCRIPT_NAME = 'get-contacts';
let lastRequestLog: any = null;

async function main() {
  const raw = process.argv[2] || '{}';
  const { role, status } = JSON.parse(raw);

  const params: Record<string, string> = {};
  if (role) params.role = role;
  if (status) params.status = status;

  const res = await axios.get(`${BASE}/api/crm/contacts`, {
    params,
    headers: { Authorization: `Bearer ${TOKEN}` },
  });

  const contacts = res.data;
  if (!contacts || contacts.length === 0) {
    console.log('No contacts found.');
    return;
  }

  const label = Object.keys(params).length ? JSON.stringify(params) : 'all';
  console.log(`${contacts.length} contact(s) [${label}]:`);
  contacts.forEach((c: any) => {
    const roles = c.roles ? Object.keys(c.roles).filter(r => c.roles[r]).join('/') : '';
    const roleLabel = roles ? ` [${roles}]` : '';
    console.log(`- [${c.contactId}] ${c.name} | ${c.phone || 'no phone'}${roleLabel} | ${c.status || 'active'}`);
  });
}

main().catch(e => {
  console.error('Error fetching contacts:', e.response?.data?.error || e.message);
  process.exit(1);
});
