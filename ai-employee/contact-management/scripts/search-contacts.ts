import axios from 'axios';

const BASE = process.env.CRM_API_BASE;
const TOKEN = process.env.CRM_TOKEN;

async function main() {
  const query = process.argv[2];
  if (!query) {
    console.error('Usage: search-contacts.ts <name or phone>');
    process.exit(1);
  }

  // Try phone lookup first (exact)
  if (/^\d{6,}$/.test(query.replace(/\D/g, ''))) {
    try {
      const res = await axios.get(`${BASE}/api/crm/contacts/lookup/by-phone`, {
        params: { phone: query },
        headers: { Authorization: `Bearer ${TOKEN}` },
      });
      const c = res.data;
      const roles = c.roles ? Object.keys(c.roles).filter((r: string) => c.roles[r]).join(', ') : 'none';
      console.log(`Found by phone: ${c.name} [${c.contactId}]`);
      console.log(`Phone: ${c.phone} | Email: ${c.email || 'N/A'} | Roles: ${roles}`);
      return;
    } catch (e: any) {
      if (e.response?.status !== 404) throw e;
    }
  }

  // Fallback: get all and filter by name
  const res = await axios.get(`${BASE}/api/crm/contacts`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });

  const all = res.data as any[];
  const q = query.toLowerCase();
  const matches = all.filter((c: any) =>
    c.name?.toLowerCase().includes(q) ||
    c.phone?.includes(query) ||
    c.email?.toLowerCase().includes(q)
  );

  if (!matches.length) {
    console.log(`No contacts found for "${query}".`);
    return;
  }

  console.log(`Found ${matches.length} contact(s) for "${query}":`);
  matches.forEach((c: any) => {
    const roles = c.roles ? Object.keys(c.roles).filter((r: string) => c.roles[r]).join('/') : '';
    const roleLabel = roles ? ` [${roles}]` : '';
    console.log(`- [${c.contactId}] ${c.name} | ${c.phone || 'no phone'}${roleLabel}`);
  });
}

main().catch(e => {
  console.error('Error searching contacts:', e.response?.data?.error || e.message);
  process.exit(1);
});
