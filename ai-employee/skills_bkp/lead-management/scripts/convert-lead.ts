import axios from 'axios';

const BASE = process.env.CRM_API_BASE;
const TOKEN = process.env.CRM_TOKEN;

async function main() {
  if (!process.argv[2]) {
    console.error("Usage: convert-lead.ts '<json with leadId>'");
    process.exit(1);
  }

  const { leadId, ...options } = JSON.parse(process.argv[2]);
  if (!leadId) {
    console.error('Error: leadId is required.');
    process.exit(1);
  }

  const res = await axios.post(`${BASE}/api/crm/leads/${leadId}/convert`, options, {
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
  });

  const { lead, entity, entityType } = res.data;
  console.log(`Converted: ${lead.name} (${lead.leadType}) → ${entityType}`);

  if (entity) {
    const entityId = entity.buyerId || entity.tenantId || entity.ownerId || entity.customerId || entity.id || '';
    const entityName = entity.name || entity.firstName || lead.name;
    console.log(`${entityType} created: ${entityName}${entityId ? ` | ID: ${entityId}` : ''}`);
  }
}

main().catch(e => {
  const status = e.response?.status;
  const msg = e.response?.data?.error || e.message;
  if (status === 400) {
    if (msg.includes('already been converted')) console.error('Lead has already been converted.');
    else if (msg.includes('phone')) console.error('Lead must have a phone number before conversion.');
    else if (msg.includes('required')) console.error(`Missing: ${msg}`);
    else console.error(`Error: ${msg}`);
  } else if (status === 404) {
    console.error('Lead not found.');
  } else {
    console.error('Error:', msg);
  }
  process.exit(1);
});
