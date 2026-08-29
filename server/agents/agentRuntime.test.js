/**
 * Unit tests for the unified agent runtime + supporting modules.
 * Covers: role prompts, domain-scoped tool declarations, domain routing,
 * tool-result truncation, and tenant docs.
 */

import { buildSystemPrompt, loadTenantDocs, buildSystemPromptWithContext } from './prompts.js';
import { buildGeminiToolDefinitions, buildAnthropicToolDefinitions, truncateToolResultForLlm } from './agentRuntime.js';
import { routeDomainsFast } from './domainRouter.js';
import { getToolsForDomain, DOMAINS, TOOL_NAMES_BY_DOMAIN } from '../shared/toolDefinitions.js';

describe('Role prompts (non-conversational agents)', () => {
  test('qualifier agent has qualification rules', () => {
    const prompt = buildSystemPrompt('qualifier', 'tenant-123');
    expect(prompt).toContain('Lead Qualifier');
    expect(prompt).toContain('HOT');
    expect(prompt).toContain('COLD');
  });

  test('router agent has assignment rules', () => {
    const prompt = buildSystemPrompt('router', 'tenant-123');
    expect(prompt).toContain('Lead Router');
    expect(prompt).toContain('assignedTo');
  });

  test('followup agent has message rules', () => {
    const prompt = buildSystemPrompt('followup', 'tenant-123');
    expect(prompt).toContain('Follow-up Agent');
    expect(prompt).toContain('Hinglish');
  });

  test('prompt includes tenant id and is trimmed', () => {
    const prompt = buildSystemPrompt('qualifier', 'tenant-xyz');
    expect(prompt).toContain('tenant-xyz');
    expect(prompt).toBe(prompt.trim());
  });
});

describe('Tool declarations', () => {
  test('buildGeminiToolDefinitions returns all tools when unscoped', () => {
    const tools = buildGeminiToolDefinitions();
    expect(Array.isArray(tools)).toBe(true);
    expect(tools.length).toBeGreaterThan(30);
    const createMeeting = tools.find((t) => t.name === 'create_meeting');
    expect(createMeeting).toBeDefined();
    expect(createMeeting.parameters.properties.title.type).toBe('string');
  });

  test('buildGeminiToolDefinitions scopes to a domain when given tool names', () => {
    const buyerTools = getToolsForDomain('buyers');
    const tools = buildGeminiToolDefinitions(buyerTools);
    expect(tools.length).toBe(buyerTools.length);
    expect(tools.every((t) => buyerTools.includes(t.name))).toBe(true);
    // No cross-domain leakage (e.g. no property tools in the buyers scope).
    expect(tools.find((t) => t.name === 'search_properties')).toBeUndefined();
  });

  test('unknown/empty scope falls back to all tools (never zero)', () => {
    expect(buildGeminiToolDefinitions([]).length).toBeGreaterThan(30);
    expect(buildGeminiToolDefinitions(['not_a_real_tool']).length).toBeGreaterThan(30);
  });

  test('buildAnthropicToolDefinitions honours scoping too', () => {
    const meetingTools = getToolsForDomain('meetings');
    const tools = buildAnthropicToolDefinitions(meetingTools);
    expect(tools.length).toBe(meetingTools.length);
    expect(tools.every((t) => meetingTools.includes(t.name))).toBe(true);
  });
});

describe('Domain grouping', () => {
  test('every domain has at least one tool', () => {
    for (const d of DOMAINS) {
      expect(TOOL_NAMES_BY_DOMAIN[d].length).toBeGreaterThan(0);
    }
  });

  test('domains are disjoint (each tool in exactly one domain)', () => {
    const seen = new Set();
    for (const d of DOMAINS) {
      for (const name of TOOL_NAMES_BY_DOMAIN[d]) {
        expect(seen.has(name)).toBe(false);
        seen.add(name);
      }
    }
  });
});

describe('Domain router (rules fast-path)', () => {
  test('greeting is small talk', () => {
    expect(routeDomainsFast('hi').smalltalk).toBe(true);
    expect(routeDomainsFast('thanks bhai').smalltalk).toBe(true);
  });

  test('buyer query routes to buyers', () => {
    const r = routeDomainsFast('show me all buyers');
    expect(r.smalltalk).toBe(false);
    expect(r.domains).toContain('buyers');
  });

  test('lead query routes to leads', () => {
    expect(routeDomainsFast('sari leads dikhao').domains).toContain('leads');
    expect(routeDomainsFast('seller leads').domains).toContain('leads');
  });

  test('property query routes to properties', () => {
    expect(routeDomainsFast('properties in Bandra').domains).toContain('properties');
  });

  test('count question pulls in analytics', () => {
    const r = routeDomainsFast('how many buyers do I have');
    expect(r.domains).toContain('analytics');
  });

  test('unknown/no-keyword message defers to LLM (returns null)', () => {
    expect(routeDomainsFast('what about that thing we discussed')).toBeNull();
  });
});

describe('truncateToolResultForLlm', () => {
  test('passes through errors and small results', () => {
    expect(truncateToolResultForLlm('get_lead', { ok: false, error: 'x' })).toEqual({ ok: false, error: 'x' });
    const small = { ok: true, data: { leadId: 'a', name: 'Raj' } };
    expect(truncateToolResultForLlm('get_lead', small)).toEqual(small);
  });

  test('collapses long lists to count + top N', () => {
    const items = Array.from({ length: 25 }, (_, i) => ({ leadId: `id${i}`, name: `L${i}`, leadType: 'buyer' }));
    const out = truncateToolResultForLlm('search_leads', { ok: true, data: { items } });
    expect(out.data.total).toBe(25);
    expect(out.data.items.length).toBeLessThanOrEqual(3);
  });

  test('never truncates curated summary tools', () => {
    const summary = { ok: true, data: { total: 100, byType: { buyer: 40 } } };
    expect(truncateToolResultForLlm('get_leads_summary', summary)).toEqual(summary);
  });
});

describe('Tenant docs', () => {
  test('returns object for existing tenant', async () => {
    const docs = await loadTenantDocs('example-tenant');
    expect(typeof docs).toBe('object');
  });

  test('returns empty object for non-existent tenant', async () => {
    expect(await loadTenantDocs('non-existent-tenant-xyz')).toEqual({});
  });

  test('buildSystemPromptWithContext includes tenant id', async () => {
    const prompt = await buildSystemPromptWithContext('qualifier', 'example-tenant', 'professional');
    expect(prompt).toContain('example-tenant');
  });
});
