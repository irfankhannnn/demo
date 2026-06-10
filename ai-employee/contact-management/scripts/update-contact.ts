import axios from 'axios';
import { logApiCall, logApiError } from '../../utils/logger';

const BASE = process.env.CRM_API_BASE;
const TOKEN = process.env.CRM_TOKEN;
const SCRIPT_NAME = 'update-contact';
let lastRequestLog: any = null;

async function main() {
  const raw = process.argv[2];
  if (!raw) {
    console.error('Usage: update-contact.ts \'<json with contactId>\'');
    process.exit(1);
  }

  const { contactId, ...updates } = JSON.parse(raw);
  if (!contactId) {
    console.error('Error: contactId is required.');
    process.exit(1);
  }

  lastRequestLog = { method: 'PUT', url: `${BASE}/api/crm/contacts/${contactId}`, body: updates };
  const res = await axios.put(`${BASE}/api/crm/contacts/${contactId}`, updates, {
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
  });
  logApiCall(SCRIPT_NAME, lastRequestLog, res.data);

  const c = res.data;
  const updated = Object.keys(updates).join(', ');
  console.log(`Contact updated: ${c.name} [${c.contactId}]`);
  console.log(`Fields updated: ${updated}`);
}

main().catch(e => {
  logApiError(SCRIPT_NAME, lastRequestLog, e.response?.data || e.message);
  const status = e.response?.status;
  if (status === 404) console.error('Contact not found.');
  else console.error('Error updating contact:', e.response?.data?.error || e.message);
  process.exit(1);
});
