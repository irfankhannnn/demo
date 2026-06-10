import axios from 'axios';
import { logApiCall, logApiError } from '../../utils/logger';

const BASE = process.env.CRM_API_BASE;
const TOKEN = process.env.CRM_TOKEN;
const headers = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };
const SCRIPT_NAME = 'buyer-notes';
let lastRequestLog: any = null;

async function main() {
  const raw = process.argv[2];
  if (!raw) {
    console.error('Usage: buyer-notes.ts \'<json with action and buyerId>\'');
    process.exit(1);
  }

  const { action, buyerId, content } = JSON.parse(raw);
  if (!buyerId) { console.error('Error: buyerId is required.'); process.exit(1); }

  if (action === 'list') {
    lastRequestLog = { method: 'GET', url: `${BASE}/api/crm/buyers/${buyerId}/notes` };
    const res = await axios.get(`${BASE}/api/crm/buyers/${buyerId}/notes`, { headers });
    logApiCall(SCRIPT_NAME, lastRequestLog, res.data);
    const notes = res.data;
    if (!notes.length) { console.log('No notes found.'); return; }
    notes.forEach((n: any) => console.log(`- [${n.noteId}] ${n.content} (${n.createdAt?.slice(0,10)})`));

  } else if (action === 'add') {
    if (!content) { console.error('Error: content is required for add.'); process.exit(1); }
    lastRequestLog = { method: 'POST', url: `${BASE}/api/crm/buyers/${buyerId}/notes`, body: { content } };
    const res = await axios.post(`${BASE}/api/crm/buyers/${buyerId}/notes`, { content }, { headers });
    logApiCall(SCRIPT_NAME, lastRequestLog, res.data);
    console.log(`Note added: [${res.data.noteId}] ${res.data.content}`);

  } else {
    console.error('Unknown action. Use: list | add');
    process.exit(1);
  }
}

main().catch(e => {
  logApiError(SCRIPT_NAME, lastRequestLog, e.response?.data || e.message);
  console.error('Error:', e.response?.data?.error || e.message);
  process.exit(1);
});
