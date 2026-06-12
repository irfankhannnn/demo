import axios from 'axios';

const BASE = process.env.CRM_API_BASE;
const TOKEN = process.env.CRM_TOKEN;

async function main() {
  const leadId = process.argv[2];
  if (!leadId) {
    console.error('Usage: delete-lead.ts <leadId>');
    process.exit(1);
  }

  await axios.delete(`${BASE}/api/crm/leads/${leadId}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });

  console.log(`Lead [${leadId}] deleted.`);
}

main().catch(e => {
  const status = e.response?.status;
  if (status === 400 && e.response?.data?.error?.includes('converted')) {
    console.error('Cannot delete a converted lead.');
  } else if (status === 404) {
    console.error('Lead not found.');
  } else {
    console.error('Error:', e.response?.data?.error || e.message);
  }
  process.exit(1);
});
