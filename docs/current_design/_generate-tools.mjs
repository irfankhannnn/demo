import { toolDefinitions } from '../../apps/crm/server/shared/toolDefinitions.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function escapeTable(s) {
  return String(s || '').replace(/\|/g, '/').replace(/\n/g, ' ');
}

// 02-tool-definitions.md
let md = '# Tool Definitions (SyncBot / Gemini)\n\n';
md += 'Source: `apps/crm/server/shared/toolDefinitions.js`\n\n';
md += `Total tools: **${toolDefinitions.length}**\n\n`;
md += '> Descriptions below are what Gemini sees via `descriptions.internal` in tool schemas.\n\n';

for (const t of toolDefinitions) {
  md += `## ${t.name}\n\n`;
  md += `- **Category:** ${t.category}\n`;
  md += `- **Read-only:** ${t.readOnly}\n`;
  md += `- **Handler:** ${t.handler}\n\n`;
  md += '### When to use (internal / WhatsApp)\n\n';
  md += `${t.descriptions.internal}\n\n`;
  md += '### MCP description\n\n';
  md += `${t.descriptions.mcp}\n\n`;
  if (t.parameters.length) {
    md += '### Parameters\n\n';
    md += '| Name | Type | Required | Description |\n';
    md += '|------|------|----------|-------------|\n';
    for (const p of t.parameters) {
      const en = p.enum ? ` (${p.enum.join(', ')})` : '';
      md += `| ${p.name} | ${p.type}${en} | ${p.required} | ${escapeTable(p.description)} |\n`;
    }
    md += '\n';
  } else {
    md += '### Parameters\n\nNone.\n\n';
  }
  md += '---\n\n';
}

fs.writeFileSync(path.join(__dirname, '02-tool-definitions.md'), md);

// 05-tool-inventory.md
const byCat = {};
for (const t of toolDefinitions) {
  const cat = t.category || 'other';
  if (!byCat[cat]) byCat[cat] = [];
  byCat[cat].push(t.name);
}

let inv = '# Complete Tool Inventory\n\n';
inv += 'Grouped by category. No implementation — names only.\n\n';
inv += `Total: **${toolDefinitions.length}** tools\n\n`;

for (const [cat, names] of Object.entries(byCat).sort()) {
  inv += `## ${cat.charAt(0).toUpperCase() + cat.slice(1)} (${names.length})\n\n`;
  for (const n of names.sort()) inv += `- ${n}\n`;
  inv += '\n';
}

inv += '## CRUD pattern (repeated per entity)\n\n';
inv += 'Most entities follow: `create_*`, `get_*` or `search_*`, `update_*`, `delete_*`, `create_*_note`, `get_*_notes`\n\n';
inv += 'Exceptions:\n';
inv += '- Leads: `convert_lead`, `search_leads` (not get_leads list)\n';
inv += '- Owners: `get_owners` (list) not search_owners\n';
inv += '- Contacts: unified model + `update_contact_role`, `find_contact_by_phone`\n';
inv += '- Properties: document sub-tools\n';
inv += '- Metrics: read-only insight tools only\n\n';

inv += '## Potential Overlaps (for redesign review)\n\n';
inv += '| Intent | Competing tools | Notes |\n';
inv += '|--------|-----------------|-------|\n';
inv += '| How many leads? | get_leads_summary, get_crm_metrics, search_leads | Prompt prefers *_summary |\n';
inv += '| Show all leads | get_leads_summary, search_leads | Summary vs list — prompt uses summary |\n';
inv += '| Who to call? | get_priority_leads, get_followup_summary, suggest_next_actions | Different ranking logic |\n';
inv += '| Dashboard | get_dashboard_snapshot, get_crm_metrics, get_business_health | Layered vs raw |\n';
inv += '| Find by phone | find_contact_by_phone, get_owner_by_phone, get_tenant_by_phone, search_leads | Entity-specific vs generic |\n';
inv += '| Hot leads | get_priority_leads, search_leads (priority filter) | Insight vs filtered search |\n';
inv += '| Buyer vs buyer lead | search_buyers, search_leads {leadType:buyer} | Parallel entity models |\n';
inv += '| Tenant vs tenant lead | search_tenants, search_leads {leadType:tenant} | Parallel entity models |\n';

fs.writeFileSync(path.join(__dirname, '05-tool-inventory.md'), inv);
console.log('Generated', toolDefinitions.length, 'tools');
