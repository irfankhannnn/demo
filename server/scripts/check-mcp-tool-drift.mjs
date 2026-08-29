/**
 * MCP tool-registry drift check (Phase 6).
 *
 * `reality-flow-mcp/src/services/generatedToolDefinitions.ts` is now GENERATED
 * from the canonical registry by `generate-mcp-tools.mjs`, so drift should be
 * structurally impossible. This check remains as the backstop that proves it:
 * it verifies the file actually committed to the repo — the one the MCP
 * service deploys — exposes exactly the canonical tool set.
 *
 * `generate-mcp-tools.mjs --check` compares rendered output byte-for-byte and
 * is the stricter test. This one is deliberately independent of the generator:
 * it re-derives the tool list by parsing the committed file, so a bug in the
 * generator that produced consistent-but-wrong output would still be caught
 * here. Two checks that share no code are worth more than one run twice.
 *
 * Before generation existed, the copy was hand-maintained and had drifted
 * twice over: 46 exposed against 66 canonical, with a doc-comment claiming 54
 * (see docs/proposals/agent-channel-architecture/flows/06-mcp-external.md).
 *
 * Usage:  node scripts/check-mcp-tool-drift.mjs
 * Exit 0 = in sync, exit 1 = drift found.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ALLOWED_TOOL_NAMES } from '../shared/toolDefinitions.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MCP_TOOLS_PATH = path.resolve(__dirname, '../../reality-flow-mcp/src/services/generatedToolDefinitions.ts');

function readMcpToolNames(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  // The generator emits each tool entry's name at exactly 4-space indent as
  // `    name: "search_leads",` (double quotes -- it renders through
  // JSON.stringify). Nested parameter names sit deeper and do not match.
  const names = [...source.matchAll(/^ {4}name: "([a-z0-9_]+)",$/gm)].map((m) => m[1]);
  return [...new Set(names)];
}

function main() {
  if (!fs.existsSync(MCP_TOOLS_PATH)) {
    console.error(`MCP tool definitions not found at ${MCP_TOOLS_PATH}`);
    process.exit(1);
  }

  const canonical = new Set(ALLOWED_TOOL_NAMES);
  const mcpNames = readMcpToolNames(MCP_TOOLS_PATH);
  const mcp = new Set(mcpNames);

  if (mcpNames.length === 0) {
    console.error('Parsed 0 tools out of the MCP file — the expected shape may have changed.');
    console.error('Fix this script rather than ignoring it: a silent 0 would make drift invisible.');
    process.exit(1);
  }

  const missingFromMcp = [...canonical].filter((n) => !mcp.has(n)).sort();
  const staleInMcp = [...mcp].filter((n) => !canonical.has(n)).sort();

  console.log(`canonical (server/shared/toolDefinitions.js): ${canonical.size} tools`);
  console.log(`mcp copy  (reality-flow-mcp/.../toolDefinitions.ts): ${mcp.size} tools`);

  if (missingFromMcp.length === 0 && staleInMcp.length === 0) {
    console.log('\n✅ In sync — every canonical tool is exposed over MCP, and nothing extra.');
    process.exit(0);
  }

  if (missingFromMcp.length > 0) {
    console.log(`\n❌ ${missingFromMcp.length} canonical tool(s) NOT reachable from an external MCP client:`);
    for (const n of missingFromMcp) console.log(`   - ${n}`);
  }
  if (staleInMcp.length > 0) {
    console.log(`\n❌ ${staleInMcp.length} tool(s) advertised over MCP that no longer exist canonically:`);
    for (const n of staleInMcp) console.log(`   - ${n}`);
    console.log('   (these are the dangerous ones: a client sees the tool, calls it, and gets a 400)');
  }
  process.exit(1);
}

main();
