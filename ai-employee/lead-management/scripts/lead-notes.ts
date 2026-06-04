import axios from 'axios';

const BASE = process.env.CRM_API_BASE;
const TOKEN = process.env.CRM_TOKEN;

async function main() {
  if (!process.argv[2]) {
    console.error("Usage: lead-notes.ts '<json>'");
    process.exit(1);
  }

  const { action, leadId, noteId, content } = JSON.parse(process.argv[2]);
  if (!leadId) {
    console.error('Error: leadId is required.');
    process.exit(1);
  }

  const base = `${BASE}/api/crm/leads/${leadId}/notes`;
  const headers = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };

  switch (action) {
    case 'list': {
      const res = await axios.get(base, { headers });
      const notes: any[] = res.data;
      if (!notes.length) {
        console.log('No notes found.');
        return;
      }
      console.log(`${notes.length} note(s):`);
      notes.forEach((n: any) => {
        const date = n.createdAt?.split('T')[0] || '';
        console.log(`- [${date}] ${n.content} | ID: ${n.noteId}`);
      });
      return;
    }

    case 'add': {
      if (!content) {
        console.error('Error: content is required for add.');
        process.exit(1);
      }
      const res = await axios.post(base, { content }, { headers });
      const n = res.data;
      console.log(`Note added: "${n.content}" | ID: ${n.noteId}`);
      return;
    }

    case 'update': {
      if (!noteId || !content) {
        console.error('Error: noteId and content are required for update.');
        process.exit(1);
      }
      const res = await axios.put(`${base}/${noteId}`, { content }, { headers });
      console.log(`Note updated: "${res.data?.content || content}"`);
      return;
    }

    case 'delete': {
      if (!noteId) {
        console.error('Error: noteId is required for delete.');
        process.exit(1);
      }
      await axios.delete(`${base}/${noteId}`, { headers });
      console.log(`Note deleted: ${noteId}`);
      return;
    }

    default:
      console.error('Error: action must be list | add | update | delete.');
      process.exit(1);
  }
}

main().catch(e => {
  if (e.response?.status === 404) {
    console.error('Lead or note not found.');
  } else {
    console.error('Error:', e.response?.data?.error || e.message);
  }
  process.exit(1);
});
