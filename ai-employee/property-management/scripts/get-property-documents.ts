import axios from 'axios';

const BASE = process.env.CRM_API_BASE;
const TOKEN = process.env.CRM_TOKEN;

async function main() {
  const propertyId = process.argv[2];
  if (!propertyId) {
    console.error('Usage: get-property-documents.ts <propertyId>');
    process.exit(1);
  }

  const res = await axios.get(`${BASE}/api/crm/properties/${propertyId}/documents`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });

  const docs = res.data;
  if (!docs || docs.length === 0) {
    console.log(`No documents found for property [${propertyId}].`);
    return;
  }

  console.log(`${docs.length} document(s) for property [${propertyId}]:`);
  docs.forEach((d: any) => {
    const size = d.fileSize ? ` (${Math.round(d.fileSize / 1024)}KB)` : '';
    console.log(`- [${d.documentId}] ${d.documentType} | ${d.fileName}${size} | ${d.createdAt?.slice(0, 10)}`);
    if (d.description) console.log(`  Description: ${d.description}`);
  });
}

main().catch(e => {
  const status = e.response?.status;
  if (status === 404) console.error('Property not found.');
  else console.error('Error:', e.response?.data?.error || e.message);
  process.exit(1);
});
