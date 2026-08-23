/**
 * Prompt files must not name a tool the planner cannot see.
 *
 * This has now bitten three times in this codebase:
 *   1. Slice 5 removed the delete_* tools, but live prompt text kept telling
 *      the model to ask for delete confirmation.
 *   2. Two later audits missed the same leftovers, because both searched for
 *      identifiers in code and prompts are prose.
 *   3. Phase 3e deprecated eleven analytics tools while prompts.js still
 *      instructed the model to call get_priority_leads, get_daily_brief and
 *      eight others — including a fully worked example.
 *
 * An instruction to call a tool that is not in the model's declared set does
 * not fail loudly. The model either invents a call that gets rejected or picks
 * something adjacent, and the reply just gets quietly worse.
 *
 * A grep for tool identifiers is exactly the right check here — the trap was
 * only ever that nobody ran one. So it runs on every commit now.
 */

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { ALLOWED_TOOL_NAMES, DEPRECATED_TOOL_NAMES, TOOL_NAMES_BY_DOMAIN } from '../shared/toolDefinitions.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Files whose text reaches a model as instructions. */
const PROMPT_FILES = [
  'prompts.js',
  'llm/plannerPrompt.js',
  'llm/composerPrompt.js',
];

/** Every tool the planner can actually be given, across all domains. */
const PLANNER_VISIBLE = new Set(Object.values(TOOL_NAMES_BY_DOMAIN).flat());

/** Tool-shaped identifiers that are not tools — verbs, prefixes, prose. */
const NOT_A_TOOL = new Set(['get_', 'create_', 'update_', 'archive_', 'search_', 'delete_']);

function readPrompt(file) {
  return readFileSync(join(__dirname, file), 'utf8');
}

describe.each(PROMPT_FILES)('%s', (file) => {
  const source = readPrompt(file);

  it('names no deprecated tool', () => {
    const named = DEPRECATED_TOOL_NAMES.filter((tool) => source.includes(tool));
    expect({ file, deprecatedToolsNamed: named }).toEqual({ file, deprecatedToolsNamed: [] });
  });

  it('names no tool that does not exist at all', () => {
    // Catches a rename or a typo in prompt prose, which nothing else would.
    const candidates = source.match(/\b(?:get|create|update|search|archive|convert|find|suggest)_[a-z0-9_]+\b/g) || [];
    const unknown = [...new Set(candidates)]
      .filter((name) => !NOT_A_TOOL.has(name))
      .filter((name) => !ALLOWED_TOOL_NAMES.includes(name));
    expect({ file, unknownToolsNamed: unknown }).toEqual({ file, unknownToolsNamed: [] });
  });

  it('names only tools the planner can be handed', () => {
    const candidates = source.match(/\b(?:get|create|update|search|archive|convert|find|suggest)_[a-z0-9_]+\b/g) || [];
    const invisible = [...new Set(candidates)]
      .filter((name) => ALLOWED_TOOL_NAMES.includes(name))
      .filter((name) => !PLANNER_VISIBLE.has(name));
    expect({ file, calledButInvisible: invisible }).toEqual({ file, calledButInvisible: [] });
  });
});
