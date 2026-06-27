import { crmClient, isCrmError } from '../../utils/crm-client';
import { logApiCall, logApiError, logExecution, startTimer } from '../../utils/logger';

const SCRIPT_NAME = 'lead-notes';
const SKILL_NAME = 'lead-management';
let lastRequestLog: any = null;

async function main() {
  const timer = startTimer();

  if (!process.argv[2]) {
    console.error("Usage: lead-notes.ts '<json>'");
    process.exit(1);
  }

  const payload = JSON.parse(process.argv[2]);
  const { action, leadId, noteId, content, _meta } = payload;

  if (!leadId) {
    console.error('Error: leadId is required.');
    process.exit(1);
  }

  const base = `/api/crm/leads/${leadId}/notes`;

  switch (action) {
    case 'list': {
      lastRequestLog = { method: 'GET', url: base };
      const res = await crmClient.get(base);
      logApiCall(SCRIPT_NAME, lastRequestLog, res.data, SKILL_NAME);
      const notes: any[] = res.data;
      if (!notes.length) {
        console.log('No notes found.');
        logExecution({ skill: SKILL_NAME, script: SCRIPT_NAME, status: 'success', duration_ms: timer.end(), userMessage: _meta?.userMessage, intent: _meta?.intent, request: lastRequestLog, response: { count: 0 } });
        return;
      }
      console.log(`${notes.length} note(s):`);
      notes.forEach((n: any) => {
        const date = n.createdAt?.split('T')[0] || '';
        console.log(`- [${date}] ${n.content} | ID: ${n.noteId}`);
      });
      logExecution({ skill: SKILL_NAME, script: SCRIPT_NAME, status: 'success', duration_ms: timer.end(), userMessage: _meta?.userMessage, intent: _meta?.intent, request: lastRequestLog, response: { count: notes.length } });
      return;
    }

    case 'add': {
      if (!content) {
        console.error('Error: content is required for add.');
        process.exit(1);
      }
      lastRequestLog = { method: 'POST', url: base, body: { content } };
      const res = await crmClient.post(base, { content });
      logApiCall(SCRIPT_NAME, lastRequestLog, res.data, SKILL_NAME);
      const n = res.data;
      console.log(`Note added: "${n.content}" | ID: ${n.noteId}`);
      logExecution({ skill: SKILL_NAME, script: SCRIPT_NAME, status: 'success', duration_ms: timer.end(), userMessage: _meta?.userMessage, intent: _meta?.intent, request: lastRequestLog, response: { noteId: n.noteId } });
      return;
    }

    case 'update': {
      if (!noteId || !content) {
        console.error('Error: noteId and content are required for update.');
        process.exit(1);
      }
      lastRequestLog = { method: 'PUT', url: `${base}/${noteId}`, body: { content } };
      const res = await crmClient.put(`${base}/${noteId}`, { content });
      logApiCall(SCRIPT_NAME, lastRequestLog, res.data, SKILL_NAME);
      console.log(`Note updated: "${res.data?.content || content}"`);
      logExecution({ skill: SKILL_NAME, script: SCRIPT_NAME, status: 'success', duration_ms: timer.end(), userMessage: _meta?.userMessage, intent: _meta?.intent, request: lastRequestLog, response: { noteId } });
      return;
    }

    case 'delete': {
      if (!noteId) {
        console.error('Error: noteId is required for delete.');
        process.exit(1);
      }
      lastRequestLog = { method: 'DELETE', url: `${base}/${noteId}` };
      const delRes = await crmClient.delete(`${base}/${noteId}`);
      logApiCall(SCRIPT_NAME, lastRequestLog, delRes.data ?? {}, SKILL_NAME);
      console.log(`Note deleted: ${noteId}`);
      logExecution({ skill: SKILL_NAME, script: SCRIPT_NAME, status: 'success', duration_ms: timer.end(), userMessage: _meta?.userMessage, intent: _meta?.intent, request: lastRequestLog, response: { noteId, deleted: true } });
      return;
    }

    default:
      console.error('Error: action must be list | add | update | delete.');
      process.exit(1);
  }
}

main().catch(e => {
  logApiError(SCRIPT_NAME, lastRequestLog, isCrmError(e) ? e.crmError : (e.response?.data || e.message), SKILL_NAME);
  if (isCrmError(e)) {
    console.error('Error:', e.crmError.message);
  } else if (e.response?.status === 404) {
    console.error('Lead or note not found.');
  } else {
    console.error('Error:', e.response?.data?.error || e.message);
  }
  process.exit(1);
});