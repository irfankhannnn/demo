import axios from 'axios';

const BASE = process.env.CRM_API_BASE;
const TOKEN = process.env.CRM_TOKEN;

async function main() {
  const contactId = process.argv[2];
  if (!contactId) {
    console.error('Usage: delete-contact.ts <contactId>');
    process.exit(1);
  }

  await axios.delete(`${BASE}/api/crm/contacts/${contactId}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });

  console.log(`Contact [${contactId}] deleted successfully.`);
}

main().catch(e => {
  const status = e.response?.status;
  if (status === 404) console.error('Contact not found.');
  else console.error('Error deleting contact:', e.response?.data?.error || e.message);
  process.exit(1);
});
