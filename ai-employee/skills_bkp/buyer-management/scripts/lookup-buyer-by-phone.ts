import axios from 'axios';

const BASE = process.env.CRM_API_BASE;
const TOKEN = process.env.CRM_TOKEN;

async function main() {
  const phone = process.argv[2];
  if (!phone) {
    console.error('Usage: lookup-buyer-by-phone.ts <phone>');
    process.exit(1);
  }

  const normalizedPhone = phone.replace(/[\s-]/g, '');

  const res = await axios.get(`${BASE}/api/crm/buyers/lookup/by-phone`, {
    params: { phone: normalizedPhone },
    headers: { Authorization: `Bearer ${TOKEN}` },
  });

  const { found, roles } = res.data;
  if (!found || !roles?.length) {
    console.log('No buyer found with this phone number.');
    return;
  }

  const buyerRole = roles.find((r: any) => r.role === 'buyer');
  if (buyerRole) {
    const b = buyerRole.data;
    console.log(`Found buyer: ${b.name} [${b.buyerId}]`);
    console.log(`Phone: ${b.phone || 'N/A'} | Email: ${b.email || 'N/A'}`);
    console.log(`Priority: ${b.priority || 'medium'} | Status: ${b.status || 'active'}`);
    if (b.budget) console.log(`Budget: ₹${b.budget}`);
    if (b.preferredArea) console.log(`Area: ${b.preferredArea}`);
  } else {
    console.log('No buyer found with this phone number.');
  }

  const otherRoles = roles.filter((r: any) => r.role !== 'buyer');
  if (otherRoles.length) {
    console.log(`\nNote: This phone also matches ${otherRoles.map((r: any) => r.role).join(', ')}.`);
  }
}

main().catch(e => {
  console.error('Error:', e.response?.data?.error || e.message);
  process.exit(1);
});
