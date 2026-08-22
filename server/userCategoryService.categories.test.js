/**
 * Guards the RBAC category allowlists against drift from the tool registry.
 *
 * These lists were hand-maintained copies of the tool list and had rotted
 * badly: `admin` — described in its own definition as "full access to all
 * tools" — was missing 13 live tools (every briefing/summary tool, plus
 * contact notes) while still naming 13 that had been deleted from the registry
 * in an earlier phase.
 *
 * That was not cosmetic. `canUserAccessTool` is fail-closed, and the MCP
 * endpoint always passes a userId, so a provisioned admin calling
 * `get_daily_brief` through MCP was denied by a stale array.
 */

import { ALLOWED_TOOL_NAMES, toolDefinitions } from './shared/toolDefinitions.js';
import { USER_CATEGORIES } from './userCategoryService.js';

const registry = new Set(ALLOWED_TOOL_NAMES);
const categoryNames = Object.keys(USER_CATEGORIES);
const readOnly = new Set(toolDefinitions.filter((t) => t.readOnly).map((t) => t.name));
const writeTools = ALLOWED_TOOL_NAMES.filter((name) => !readOnly.has(name));

describe('USER_CATEGORIES allowlists', () => {
  it.each(categoryNames)('%s names no tool that does not exist', (name) => {
    const unknown = USER_CATEGORIES[name].allowedTools.filter((tool) => !registry.has(tool));
    expect(unknown).toEqual([]);
  });

  it.each(categoryNames)('%s has no duplicate entries', (name) => {
    const tools = USER_CATEGORIES[name].allowedTools;
    expect(tools.length).toBe(new Set(tools).size);
  });

  it('admin covers the entire registry — its description promises exactly that', () => {
    const missing = ALLOWED_TOOL_NAMES.filter((tool) => !USER_CATEGORIES.admin.allowedTools.includes(tool));
    expect(missing).toEqual([]);
  });

  it('every category can reach the read-only briefing surface', () => {
    // The regression that started this: these were absent everywhere, so the
    // daily-brief tools failed for every provisioned user regardless of role.
    for (const name of categoryNames) {
      const allowed = new Set(USER_CATEGORIES[name].allowedTools);
      const missing = [...readOnly].filter((tool) => !allowed.has(tool));
      expect({ category: name, missing }).toEqual({ category: name, missing: [] });
    }
  });

  it('viewer grants no write tool', () => {
    const writes = USER_CATEGORIES.viewer.allowedTools.filter((tool) => !readOnly.has(tool));
    expect(writes).toEqual([]);
  });

  it('whatsapp_bot stays genuinely narrower than admin', () => {
    // If this ever equals admin, the category is decoration. The specific
    // omissions are the reason an agency would choose it.
    const botWrites = USER_CATEGORIES.whatsapp_bot.allowedTools.filter((t) => !readOnly.has(t));
    expect(botWrites.length).toBeLessThan(writeTools.length);
    for (const denied of ['create_property', 'update_property', 'create_buyer', 'update_buyer', 'convert_lead']) {
      expect(USER_CATEGORIES.whatsapp_bot.allowedTools).not.toContain(denied);
    }
  });
});
