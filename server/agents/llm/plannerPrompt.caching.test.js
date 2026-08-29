/**
 * Phase 3f — prompt-prefix stability.
 *
 * Explicit context caching does not apply at this prompt size (measured: the
 * full tool set across all nine domains is ~12k tokens, a single domain
 * 700-3,800 — an order of magnitude below Gemini's explicit-cache floor).
 * Implicit caching, which keys on an exact shared prefix, is the only lever
 * that works here.
 *
 * That makes prompt ORDER a cost property, and one that fails silently: put
 * per-turn content early and nothing errors, the cache just never hits. These
 * tests make the ordering explicit so a future edit has to break them on
 * purpose.
 */

import { buildPlannerSystemPrompt } from './plannerPrompt.js';

const TENANT = 'tenant-abc';

/** Longest common prefix of two strings, in characters. */
function sharedPrefixLength(a, b) {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i += 1;
  return i;
}

describe('planner prompt prefix stability', () => {
  it('shares a large prefix across different routed domains', () => {
    // The regression: the domain note used to sit on line 4, before the whole
    // rules block, so a different routing decision changed every byte after it.
    const a = buildPlannerSystemPrompt(TENANT, 'friendly', null, ['leads']);
    const b = buildPlannerSystemPrompt(TENANT, 'friendly', null, ['properties', 'owners']);

    const shared = sharedPrefixLength(a, b);
    expect(shared).toBeGreaterThan(2500);
    // Sanity: the prompts really are different, so this is not a trivial pass.
    expect(a).not.toBe(b);
  });

  it('shares a large prefix across different conversation states', () => {
    const a = buildPlannerSystemPrompt(TENANT, 'friendly', null, ['leads']);
    const b = buildPlannerSystemPrompt(TENANT, 'friendly', {
      intent: 'search', topic: 'leads', context: { currentEntity: { id: 'x', type: 'lead' } },
    }, ['leads']);

    expect(sharedPrefixLength(a, b)).toBeGreaterThan(2500);
  });

  it('shares a large prefix when both the domain AND the state differ', () => {
    // The real per-turn case: routing and state both move together.
    const a = buildPlannerSystemPrompt(TENANT, 'friendly', null, ['leads']);
    const b = buildPlannerSystemPrompt(TENANT, 'friendly', {
      intent: 'detail', topic: 'properties', context: { currentEntity: { id: 'p1', type: 'property' } },
    }, ['properties']);

    expect(sharedPrefixLength(a, b)).toBeGreaterThan(2500);
  });

  it('emits per-turn content only in the tail', () => {
    const prompt = buildPlannerSystemPrompt(TENANT, 'friendly', {
      intent: 'search', topic: 'leads', context: {},
    }, ['analytics']);

    const domainAt = prompt.indexOf('routed to the analytics area');
    const rulesAt = prompt.indexOf('RULES:');
    expect(domainAt).toBeGreaterThan(rulesAt);
    // And in the last quarter of the prompt, not merely after RULES.
    expect(domainAt).toBeGreaterThan(prompt.length * 0.75);
  });

  it('is deterministic — the same inputs produce the same bytes', () => {
    // A timestamp or a Math.random() anywhere in here would defeat caching
    // entirely, and nothing else would notice.
    const once = buildPlannerSystemPrompt(TENANT, 'friendly', null, ['leads']);
    const twice = buildPlannerSystemPrompt(TENANT, 'friendly', null, ['leads']);
    expect(once).toBe(twice);
  });

  it('still contains the domain constraint it is responsible for', () => {
    // Moving it must not lose it.
    const prompt = buildPlannerSystemPrompt(TENANT, 'friendly', null, ['leads', 'meetings']);
    expect(prompt).toContain('leads + meetings');
    expect(prompt).toContain('only those tools are available to you this turn');
  });
});
