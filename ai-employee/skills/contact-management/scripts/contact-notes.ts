import { crmClient, isCrmError } from '../../utils/crm-client';
import { logApiCall, logApiError, logExecution, startTimer } from '../../utils/logger';

const SCRIPT_NAME = 'contact-notes';
const SKILL_NAME = 'contact-management';
let lastRequestLog: any = null;

async function main() {
  const timer = startTimer();
  const raw = process.argv[2];

  if (!raw) { console.error('Usage: contact-notes.ts \'<json with action and contactId>\''); process.exit(1); }

  const payload = JSON.parse(raw);
  const { action, contactId, noteId, content, _meta } = payload;

  if (!contactId) { console.error('Error: contactId is required.'); process.exit(1); }

  const base = `/api/crm/contacts/${contactId}/notes`;

  if (action === 'list') {
    lastRequestLog = { method: 'GET', url: base };
    const res = await crmClient.get(base);
    logApiCall(SCRIPT_NAME, lastRequestLog, res.data, SKILL_NAME);
    const notes = res.data;
    if (!notes.length) { console.log('No notes found.'); logExecution({ skill: SKILL_NAME, script: SCRIPT_NAME, status: 'success', duration_ms: timer.end(), userMessage: _meta?.userMessage, intent: _meta?.intent, request: lastRequestLog, response: { count: 0 } }); return; }
    notes.forEach((n: any) => console.log(`- [${n.noteId}] ${n.content} (${n.createdAt?.slice(0, 10)})`));
    logExecution({ skill: SKILL_NAME, script: SCRIPT_NAME, status: 'success', duration_ms: timer.end(), userMessage: _meta?.userMessage, intent: _meta?.intent, request: lastRequestLog, response: { count: notes.length } });

  } else if (action === 'add') {
    if (!content) { console.error('Error: content is required for add.'); process.exit(1); }
    lastRequestLog = { method: 'POST', url: base, body: { content } };
    const res = await crmClient.post(base, { content });
    logApiCall(SCRIPT_NAME, lastRequestLog, res.data, SKILL_NAME);
    console.log(`Note added: [${res.data.noteId}] ${res.data.content}`);
    logExecution({ skill: SKILL_NAME, script: SCRIPT_NAME, status: 'success', duration_ms: timer.end(), userMessage: _meta?.userMessage, intent: _meta?.intent, request: lastRequestLog, response: { noteId: res.data.noteId } });

  } else if (action === 'update') {
    if (!noteId || !content) { console.error('Error: noteId and content required for update.'); process.exit(1); }
    lastRequestLog = { method: 'PUT', url: `${base}/${noteId}`, body: { content } };
    const updRes = await crmClient.put(`${base}/${noteId}`, { content });
    logApiCall(SCRIPT_NAME, lastRequestLog, updRes.data, SKILL_NAME);
    console.log(`Note [${noteId}] updated.`);
    logExecution({ skill: SKILL_NAME, script: SCRIPT_NAME, status: 'success', duration_ms: timer.end(), userMessage: _meta?.userMessage, intent: _meta?.intent, request: lastRequestLog, response: { noteId } });

  } else if (action === 'delete') {
    if (!noteId) { console.error('Error: noteId required for delete.'); process.exit(1); }
    lastRequestLog = { method: 'DELETE', url: `${base}/${noteId}` };
    const delRes = await crmClient.delete(`${base}/${noteId}`);
    logApiCall(SCRIPT_NAME, lastRequestLog, delRes.data ?? {}, SKILL_NAME);
    console.log(`Note [${noteId}] deleted.`);
    logExecution({ skill: SKILL_NAME, script: SCRIPT_NAME, status: 'success', duration_ms: timer.end(), userMessage: _meta?.userMessage, intent: _meta?.intent, request: lastRequestLog, response: { noteId, deleted: true } });

  } else {
    console.error('Unknown action. Use: list | add | update | delete');
    process.exit(1);
  }
}

main().catch(e => {
  logApiError(SCRIPT_NAME, lastRequestLog, isCrmError(e) ? e.crmError : (e.response?.data || e.message), SKILL_NAME);
  if (isCrmError(e)) { console.error('Error:', e.crmError.message); }
  else { console.error('Error:', e.response?.data?.error || e.message); }
  process.exit(1);
});