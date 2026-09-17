// Checks every event schema under events/: valid JSON, draft 2020-12, an object
// schema with tenantId, and the x-* metadata consumers rely on. No dependencies
// so it runs in any unit's CI without an install step.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..');
const EVENTS_DIR = join(ROOT, 'events');
const ID_PREFIX = 'https://contracts.realestateflow.in/events/';

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (name.endsWith('.json')) out.push(p);
  }
  return out;
}

const failures = [];
const files = walk(EVENTS_DIR);

for (const file of files) {
  const rel = relative(EVENTS_DIR, file).replace(/\\/g, '/');
  const fail = (msg) => failures.push(`${rel}: ${msg}`);

  let schema;
  try {
    schema = JSON.parse(readFileSync(file, 'utf8'));
  } catch (err) {
    fail(`not valid JSON (${err.message})`);
    continue;
  }

  if (schema.$schema !== 'https://json-schema.org/draft/2020-12/schema') fail('$schema must be draft 2020-12');
  if (schema.$id !== ID_PREFIX + rel) fail(`$id must be ${ID_PREFIX}${rel}`);
  if (schema.type !== 'object') fail('type must be "object"');
  if (!schema.properties || typeof schema.properties !== 'object') fail('properties missing');
  // Every event is tenant-scoped: either it carries tenantId, or it says how
  // the consumer derives the tenant (e.g. from the agency's WhatsApp number).
  const derivesTenant = typeof schema['x-tenant-resolution'] === 'string' && schema['x-tenant-resolution'];
  if (!derivesTenant) {
    if (!schema.properties?.tenantId) fail('properties.tenantId missing (or add x-tenant-resolution)');
    if (!Array.isArray(schema.required) || !schema.required.includes('tenantId')) fail('required must include tenantId');
  }

  const [source, fileName] = rel.split('/');
  const detailType = fileName?.replace(/\.v\d+\.json$/, '');
  if (schema['x-source'] !== source) fail(`x-source must be "${source}" (from the folder name)`);
  const declared = schema['x-detail-type'];
  const types = Array.isArray(declared) ? declared : [declared];
  if (!types.includes(detailType)) fail(`x-detail-type must include "${detailType}" (from the file name)`);
  if (typeof schema['x-producer'] !== 'string' || !schema['x-producer']) fail('x-producer missing');
  if (!Array.isArray(schema['x-consumers'])) fail('x-consumers must be an array (empty is fine)');
}

if (failures.length) {
  console.error(`${failures.length} problem(s) in ${files.length} event schema(s):`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(`${files.length} event schema(s) OK`);
