import axios from 'axios';

const BASE = process.env.CRM_API_BASE;
const TOKEN = process.env.CRM_TOKEN;

async function main() {
  const ownerId = process.argv[2];
  if (!ownerId) {
    console.error('Usage: get-owner.ts <ownerId>');
    process.exit(1);
  }

  const res = await axios.get(`${BASE}/api/crm/owners/${ownerId}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });

  const o = res.data;
  console.log(`Owner: ${o.name} [${o.ownerId}]`);
  console.log(`Phone: ${o.phone || 'N/A'} | Email: ${o.email || 'N/A'}`);
  console.log(`Address: ${o.address || 'N/A'}`);
  console.log(`Status: ${o.status} | Source: ${o.source || 'N/A'}`);
  if (o.panNumber) console.log(`PAN: ${o.panNumber}`);
  if (o.aadharNumber) console.log(`Aadhar: ${o.aadharNumber}`);
  if (o.bankName || o.accountNumber || o.ifscCode) {
    console.log(`Bank: ${o.bankName || 'N/A'} | Account: ${o.accountNumber || 'N/A'} | IFSC: ${o.ifscCode || 'N/A'}`);
  }
  if (o.tags?.length) console.log(`Tags: ${o.tags.join(', ')}`);
  if (o.notes) console.log(`Notes: ${o.notes}`);
  if (o.photoS3Key) console.log(`Photo: uploaded`);
  if (o.panDocS3Key) console.log(`PAN doc: uploaded`);
  if (o.aadharDocS3Key) console.log(`Aadhar doc: uploaded`);
  console.log(`Created: ${o.createdAt}`);
}

main().catch(e => {
  const status = e.response?.status;
  if (status === 404) console.error('Owner not found.');
  else console.error('Error:', e.response?.data?.error || e.message);
  process.exit(1);
});
