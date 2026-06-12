import axios from 'axios';
import { logApiCall, logApiError } from '../../utils/logger';

const BASE = process.env.CRM_API_BASE;
const TOKEN = process.env.CRM_TOKEN;
const SCRIPT_NAME = 'delete-contact';
let lastRequestLog: any = null;

async function main() {
  const contactId = process.argv[2];
  if (!contactId) {
    console.error('Usage: delete-contact.ts <contactId>');
    process.exit(1);
  }

  lastRequestLog = { method: 'DELETE', url: `${BASE}/api/crm/contacts/${contactId}` };
  const res = await axios.delete(`${BASE}/api/crm/contacts/${contactId}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  logApiCall(SCRIPT_NAME, lastRequestLog, res.data ?? {});

  console.log(`Contact [${contactId}] deleted successfully.`);
}

main().catch(e => {
  logApiError(SCRIPT_NAME, lastRequestLog, e.response?.data || e.message);
  const status = e.response?.status;
  if (status === 404) console.error('Contact not found.');
  else console.error('Error deleting contact:', e.response?.data?.error || e.message);
  process.exit(1);
});
