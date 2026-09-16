#!/usr/bin/env node
/**
 * Generate the MCP service's tool-definition data from the canonical registry.
 *
 * `services/reality-flow-mcp/src/services/toolDefinitions.ts` used to be a hand-typed
 * copy of `apps/crm/server/shared/toolDefinitions.js`. Hand-maintained copies drift, and
 * this one had drifted twice over: 46 tools in the copy against 66 canonical,
 * with a header comment still claiming 54. External clients had no way to
 * archive a record at all, because Slice 5 removed `delete_*` from the copy and
 * nobody added the `archive_*` replacements.
 *
 * WHAT THIS WRITES, AND WHAT IT DELIBERATELY DOES NOT
 *
 * Output is `generatedToolDefinitions.ts` — the tool **data** only. The MCP
 * service's own logic (the exported interfaces, `convertToMcpTools`, and
 * `inferScope`'s OAuth scope mapping) stays hand-written in
 * `toolDefinitions.ts`, which imports this file. A generator that rewrote the
 * scope mapping would be one bad template away from handing a read-scoped
 * client a write tool; keeping the security-relevant logic out of generated
 * output means that class of mistake cannot happen here.
 *
 * Only the fields the MCP service actually consumes are emitted. `meta` and
 * `domain` drive server-side routing and have no meaning across the boundary.
 *
 * Usage:
 *   node apps/crm/server/scripts/generate-mcp-tools.mjs           # write the file
 *   node apps/crm/server/scripts/generate-mcp-tools.mjs --check   # verify it is current
 */

import { readFileSync, writeFileSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..', '..', '..');
const OUT_PATH = join(
  REPO_ROOT, 'services', 'reality-flow-mcp', 'src', 'services', 'generatedToolDefinitions.ts',
);

const { toolDefinitions } = await import('../shared/toolDefinitions.js');

/** JSON that is also valid TypeScript, indented to sit inside the array literal. */
function lit(value, indent) {
  return JSON.stringify(value, null, 2)
    .split('\n')
    .map((line, i) => (i === 0 ? line : indent + line))
    .join('\n');
}

function emitParameter(param, indent) {
  const out = {
    name: param.name,
    type: param.type,
    required: Boolean(param.required),
    description: param.description,
  };
  if (Array.isArray(param.enum) && param.enum.length > 0) out.enum = param.enum;
  if (param.default !== undefined) out.default = param.default;
  // Nested object shape. Without this an MCP client sees `buyerRequirement:
  // {type: 'object'}` with no fields and has to guess them.
  if (param.type === 'object' && param.properties) {
    out.properties = Object.fromEntries(
      Object.entries(param.properties).map(([key, spec]) => [
        key,
        {
          type: spec.type,
          description: spec.description,
          ...(Array.isArray(spec.enum) && spec.enum.length > 0 ? { enum: spec.enum } : {}),
        },
      ]),
    );
  }
  return lit(out, indent);
}

function emitTool(tool) {
  const params = tool.parameters.map((p) => `      ${emitParameter(p, '      ')}`).join(',\n');
  return `  {
    name: ${JSON.stringify(tool.name)},
    category: ${JSON.stringify(tool.category)},
    readOnly: ${Boolean(tool.readOnly)},
    descriptions: {
      internal: ${JSON.stringify(tool.descriptions.internal)},
      mcp: ${JSON.stringify(tool.descriptions.mcp)},
    },
    handler: ${JSON.stringify(tool.handler)},
    parameters: [
${params}
    ],
  }`;
}

function render() {
  const body = toolDefinitions.map(emitTool).join(',\n');
  return `/**
 * AUTO-GENERATED — DO NOT EDIT BY HAND.
 *
 * Source:    apps/crm/server/shared/toolDefinitions.js (canonical registry)
 * Generator: apps/crm/server/scripts/generate-mcp-tools.mjs
 * Regenerate: npm run generate:mcp-tools   (also runs on the MCP prebuild)
 *
 * Any edit here is lost on the next build. Change the canonical registry
 * instead — that is what makes the WhatsApp agent, the CRM backend and this
 * MCP service expose the same ${toolDefinitions.length} tools.
 *
 * The interfaces, the MCP schema conversion and the OAuth scope mapping are
 * NOT generated; they live in ./toolDefinitions.ts, which imports this file.
 */

import type { ToolDefinition } from './toolDefinitions';

/** ${toolDefinitions.length} CRM tools, generated from the canonical registry. */
export const generatedToolDefinitions: ToolDefinition[] = [
${body},
];
`;
}

const rendered = render();
const isCheck = process.argv.includes('--check');

if (isCheck) {
  let current = null;
  try {
    current = readFileSync(OUT_PATH, 'utf8');
  } catch {
    console.error('❌ generatedToolDefinitions.ts does not exist. Run: npm run generate:mcp-tools');
    process.exit(1);
  }
  if (current !== rendered) {
    console.error('❌ generatedToolDefinitions.ts is out of date with the canonical registry.');
    console.error('   Run: npm run generate:mcp-tools  (and commit the result)');
    process.exit(1);
  }
  console.log(`✅ MCP tool definitions are in sync (${toolDefinitions.length} tools).`);
  process.exit(0);
}

writeFileSync(OUT_PATH, rendered, 'utf8');
console.log(`✅ Wrote ${toolDefinitions.length} tools to ${OUT_PATH}`);
