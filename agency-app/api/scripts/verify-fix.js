import { buildGeminiToolDefinitions } from '../agents/agentRuntime.js';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

const tools = buildGeminiToolDefinitions();
const sl = tools.find(t => t.name === 'search_leads');
const cm = tools.find(t => t.name === 'get_crm_metrics');

const count = (sl.description.match(/Use this when/g) || []).length;

const report = [
  '=== search_leads description ===',
  sl.description,
  '',
  '=== query param description ===',
  JSON.stringify(sl.parameters.properties.query, null, 2),
  '',
  `=== Has duplicate "Use this when"? Count: ${count} ===`,
  '',
  '=== get_crm_metrics description ===',
  cm.description,
];

const outputPath = join(rootDir, 'verify-fix-output.txt');
writeFileSync(outputPath, report.join('\n'));
