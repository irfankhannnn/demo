/**
 * Phase 3e — analytics tool consolidation.
 *
 * The analytics domain had twelve tools whose triggers overlapped heavily
 * ("summary", "overview", "dashboard", "how are we doing", "what should I
 * do"). The router hands the planner a whole domain at once, so the model had
 * to guess between twelve near-synonyms — and different guesses returned
 * different shapes for the same question.
 *
 * The consolidation is only safe because it HIDES rather than DELETES. These
 * tests hold that line: the planner's view shrinks, the callable surface does
 * not.
 */

import {
  ALLOWED_TOOL_NAMES,
  DEPRECATED_TOOL_NAMES,
  TOOL_NAMES_BY_DOMAIN,
  toolDefinitions,
  getToolsForDomain,
  getHandler,
} from './toolDefinitions.js';

const SUPERSEDED = [
  'get_crm_metrics', 'get_properties_summary', 'get_buyers_summary', 'get_pipeline_summary',
  'get_followup_summary', 'get_priority_leads', 'get_recent_activity', 'get_daily_brief',
  'suggest_next_actions', 'get_business_health', 'get_dashboard_snapshot',
];
const CONSOLIDATED = ['get_crm_summary', 'get_work_queue', 'get_business_trends'];

describe('analytics consolidation', () => {
  it('shrinks what the planner chooses from', () => {
    expect(TOOL_NAMES_BY_DOMAIN.analytics).toHaveLength(4);
    expect(TOOL_NAMES_BY_DOMAIN.analytics).toEqual(
      expect.arrayContaining(['get_leads_summary', ...CONSOLIDATED]),
    );
  });

  it.each(SUPERSEDED)('%s stays callable — hiding is not deleting', (name) => {
    // MCP clients and saved automations already name these. Removing them
    // would be a breaking change for a tool-choice improvement.
    expect(ALLOWED_TOOL_NAMES).toContain(name);
    expect(DEPRECATED_TOOL_NAMES).toContain(name);
  });

  it.each(SUPERSEDED)('%s is hidden from every domain the planner can route to', (name) => {
    for (const domain of Object.keys(TOOL_NAMES_BY_DOMAIN)) {
      expect(TOOL_NAMES_BY_DOMAIN[domain]).not.toContain(name);
    }
    expect(getToolsForDomain(['analytics'])).not.toContain(name);
  });

  it('keeps get_leads_summary visible — it has a bespoke card', () => {
    // Folding it in would silently downgrade "kitni leads hain" from the
    // summary_leads_card to generic LLM prose.
    const def = toolDefinitions.find((t) => t.name === 'get_leads_summary');
    expect(def.deprecated).toBeUndefined();
    expect(def.meta.presentationTemplate).toBe('summary_leads_card');
    expect(TOOL_NAMES_BY_DOMAIN.analytics).toContain('get_leads_summary');
  });

  it.each(CONSOLIDATED)('%s has a real handler', (name) => {
    expect(getHandler(name)).toBeTruthy();
  });

  it.each(CONSOLIDATED)('%s exposes its intent as an enum, not free text', (name) => {
    // The whole point: the planner picks a tool, then STATES an intent. A free
    // string would just move the guessing one level down.
    const def = toolDefinitions.find((t) => t.name === name);
    const enums = def.parameters.filter((p) => Array.isArray(p.enum) && p.enum.length > 0);
    if (name === 'get_business_trends') {
      expect(def.parameters.length).toBeGreaterThan(0); // days only — no branch to state
    } else {
      expect(enums.length).toBeGreaterThan(0);
    }
  });

  it('every consolidated tool is read-only', () => {
    for (const name of CONSOLIDATED) {
      expect(toolDefinitions.find((t) => t.name === name).readOnly).toBe(true);
    }
  });

  it('no deprecated tool is left without a replacement in the planner view', () => {
    // A deprecated tool with nothing to take its place is a capability the
    // agent silently lost.
    expect(TOOL_NAMES_BY_DOMAIN.analytics.length).toBeGreaterThan(0);
    for (const name of DEPRECATED_TOOL_NAMES) {
      const def = toolDefinitions.find((t) => t.name === name);
      expect(TOOL_NAMES_BY_DOMAIN[def.domain].length).toBeGreaterThan(0);
    }
  });
});
