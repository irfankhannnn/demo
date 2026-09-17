/**
 * Verify the OAuth scope mapping is internally consistent.
 *
 * Runs on `prebuild` and in CI. This is a script rather than a unit test
 * because this service has no test framework, and adding one to enforce four
 * invariants would be a larger change than the thing being enforced.
 *
 * The invariants exist because each was violated in the shipped code:
 *
 *  1. Every scope `inferScope` emits must exist in `OAUTH_SCOPES`, or no
 *     client can ever hold it. `read_contacts` / `write_contacts` /
 *     `read_metrics` were emitted but absent, making all contact and metrics
 *     tools permanently 403 over OAuth.
 *  2. Every tool must have a scope. `mcpController` treats a missing scope as
 *     "no check", so an unscoped tool is callable by any authenticated client.
 *     Twelve tools were unscoped, including the khata (financial ledger) reads.
 *  3. A read-only tool must not require a write scope, and vice versa — this
 *     is what caught `archive_*` being granted read scope.
 *  4. Every declared scope should be reachable, so the catalogue does not
 *     accumulate scopes nothing uses (warning only — a scope may legitimately
 *     be declared ahead of the tools that will need it).
 */

import { TOOL_SCOPES, ALLOWED_TOOL_NAMES } from '../src/services/toolDefinitions';
import { OAUTH_SCOPES } from '../src/services/oauthProviders';
import { generatedToolDefinitions } from '../src/services/generatedToolDefinitions';

const WILDCARD = 'crm';
const failures: string[] = [];
const granted = new Set(OAUTH_SCOPES);

// 1. No scope may be ungrantable.
const ungrantable = [...new Set(Object.values(TOOL_SCOPES))].filter((s) => !granted.has(s));
if (ungrantable.length > 0) {
  failures.push(
    `Scopes required by tools but missing from OAUTH_SCOPES: ${ungrantable.join(', ')}\n` +
    `  → every tool needing them returns "Insufficient scope" for every client.`
  );
}

// 2. No tool may be unscoped.
const unscoped = ALLOWED_TOOL_NAMES.filter((name) => !TOOL_SCOPES[name]);
if (unscoped.length > 0) {
  failures.push(
    `Tools with no required scope: ${unscoped.join(', ')}\n` +
    `  → mcpController skips the check entirely, so any authenticated client can call them.`
  );
}

// 3. read/write must match the registry's own readOnly flag.
for (const tool of generatedToolDefinitions) {
  const scope = TOOL_SCOPES[tool.name];
  if (!scope || scope === WILDCARD) continue;
  const isWriteScope = scope.startsWith('write_');
  if (tool.readOnly && isWriteScope) {
    failures.push(`${tool.name} is readOnly but requires the write scope ${scope}.`);
  }
  if (!tool.readOnly && !isWriteScope) {
    failures.push(
      `${tool.name} MUTATES data but only requires ${scope}. ` +
      `A read-scoped client could call it — privilege escalation.`
    );
  }
}

// 4. Unused scopes are a warning, not a failure.
const used = new Set(Object.values(TOOL_SCOPES));
const unused = OAUTH_SCOPES.filter((s) => s !== WILDCARD && !used.has(s));

if (failures.length > 0) {
  console.error('❌ OAuth scope mapping is inconsistent:\n');
  failures.forEach((f) => console.error(`  • ${f}\n`));
  process.exit(1);
}

console.log(`✅ Scope mapping consistent — ${ALLOWED_TOOL_NAMES.length} tools, ${used.size} scopes in use.`);
if (unused.length > 0) {
  console.log(`   note: declared but unused: ${unused.join(', ')}`);
}
