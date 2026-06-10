import axios from 'axios';
import { logApiCall, logApiError } from '../../utils/logger';

const BASE = process.env.CRM_API_BASE;
const TOKEN = process.env.CRM_TOKEN;
const headers = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };
const SCRIPT_NAME = 'tenant-notes';
let lastRequestLog: any = null;

async function main() {
  const raw = process.argv[2];
  if (!raw) {
    console.error('Usage: tenant-notes.ts \'<json with action and customerId>\'');
    process.exit(1);
  }

  const { action, customerId, noteId, content } = JSON.parse(raw);
  if (!customerId) { console.error('Error: customerId is required.'); process.exit(1); }

  if (action === 'list') {
    lastRequestLog = { method: 'GET', url: `${BASE}/api/crm/customers/${customerId}/notes` };
    const res = await axios.get(`${BASE}/api/crm/customers/${customerId}/notes`, { headers });
    logApiCall(SCRIPT_NAME, lastRequestLog, res.data);
    const notes = res.data;
    if (!notes.length) { console.log('No notes found.'); return; }
    notes.forEach((n: any) => console.log(`- [${n.noteId}] ${n.content} (${n.createdAt?.slice(0,10)})`));

  } else if (action === 'add') {
    if (!content) { console.error('Error: content is required for add.'); process.exit(1); }
    lastRequestLog = { method: 'POST', url: `${BASE}/api/crm/customers/${customerId}/notes`, body: { content } };
    const res = await axios.post(`${BASE}/api/crm/customers/${customerId}/notes`, { content }, { headers });
    logApiCall(SCRIPT_NAME, lastRequestLog, res.data);
    console.log(`Note added: [${res.data.noteId}] ${res.data.content}`);

  } else if (action === 'update') {
    if (!noteId || !content) { console.error('Error: noteId and content required for update.'); process.exit(1); }
    lastRequestLog = { method: 'PUT', url: `${BASE}/api/crm/customers/${customerId}/notes/${noteId}`, body: { content } };
    const updRes = await axios.put(`${BASE}/api/crm/customers/${customerId}/notes/${noteId}`, { content }, { headers });
    logApiCall(SCRIPT_NAME, lastRequestLog, updRes.data);
    console.log(`Note [${noteId}] updated.`);

  } else if (action === 'delete') {
    if (!noteId) { console.error('Error: noteId required for delete.'); process.exit(1); }
    lastRequestLog = { method: 'DELETE', url: `${BASE}/api/crm/customers/${customerId}/notes/${noteId}` };
    const delRes = await axios.delete(`${BASE}/api/crm/customers/${customerId}/notes/${noteId}`, { headers });
    logApiCall(SCRIPT_NAME, lastRequestLog, delRes.data ?? {});
    console.log(`Note [${noteId}] deleted.`);

  } else {
    console.error('Unknown action. Use: list | add | update | delete');
    process.exit(1);
  }
}

main().catch(e => {
  logApiError(SCRIPT_NAME, lastRequestLog, e.response?.data || e.message);
  console.error('Error:', e.response?.data?.error || e.message);
  process.exit(1);
});
