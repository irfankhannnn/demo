import { crmClient, isCrmError } from '../../utils/crm-client';
import { logApiCall, logApiError, logExecution, startTimer } from '../../utils/logger';

const SCRIPT_NAME = 'buyer-notes';
const SKILL_NAME = 'buyer-management';
let lastRequestLog: any = null;

async function main() {
  const timer = startTimer();
  const raw = process.argv[2];

  if (!raw) {
    console.error('Usage: buyer-notes.ts \'<json with action and buyerId>\'');
    process.exit(1);
  }

  const payload = JSON.parse(raw);
  const { action, buyerId, content, _meta } = payload;

  if (!buyerId) { console.error('Error: buyerId is required.'); process.exit(1); }

  if (action === 'list') {
    lastRequestLog = { method: 'GET', url: `/api/crm/buyers/${buyerId}/notes` };
    const res = await crmClient.get(`/api/crm/buyers/${buyerId}/notes`);
    logApiCall(SCRIPT_NAME, lastRequestLog, res.data, SKILL_NAME);
    const notes = res.data;
    if (!notes.length) { console.log('No notes found.'); logExecution({ skill: SKILL_NAME, script: SCRIPT_NAME, status: 'success', duration_ms: timer.end(), userMessage: _meta?.userMessage, intent: _meta?.intent, request: lastRequestLog, response: { count: 0 } }); return; }
    notes.forEach((n: any) => console.log(`- [${n.noteId}] ${n.content} (${n.createdAt?.slice(0, 10)})`));
    logExecution({ skill: SKILL_NAME, script: SCRIPT_NAME, status: 'success', duration_ms: timer.end(), userMessage: _meta?.userMessage, intent: _meta?.intent, request: lastRequestLog, response: { count: notes.length } });

  } else if (action === 'add') {
    if (!content) { console.error('Error: content is required for add.'); process.exit(1); }
    lastRequestLog = { method: 'POST', url: `/api/crm/buyers/${buyerId}/notes`, body: { content } };
    const res = await crmClient.post(`/api/crm/buyers/${buyerId}/notes`, { content });
    logApiCall(SCRIPT_NAME, lastRequestLog, res.data, SKILL_NAME);
    console.log(`Note added: [${res.data.noteId}] ${res.data.content}`);
    logExecution({ skill: SKILL_NAME, script: SCRIPT_NAME, status: 'success', duration_ms: timer.end(), userMessage: _meta?.userMessage, intent: _meta?.intent, request: lastRequestLog, response: { noteId: res.data.noteId } });

  } else {
    console.error('Unknown action. Use: list | add');
    process.exit(1);
  }
}

main().catch(e => {
  logApiError(SCRIPT_NAME, lastRequestLog, isCrmError(e) ? e.crmError : (e.response?.data || e.message), SKILL_NAME);
  if (isCrmError(e)) { console.error('Error:', e.crmError.message); }
  else { console.error('Error:', e.response?.data?.error || e.message); }
  process.exit(1);
});