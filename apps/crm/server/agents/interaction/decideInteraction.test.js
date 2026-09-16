/**
 * Unit tests for apps/crm/server/agents/interaction/decideInteraction.js
 */

import { decideInteraction } from './decideInteraction.js';

const okList = { ok: true, data: { data: [{ leadId: 'lead-1', name: 'A' }], metadata: {} } };
const emptyList = { ok: true, data: { data: [], metadata: {} } };
const okDetail = { ok: true, data: { data: { leadId: 'lead-1', name: 'A' } } };
const errResult = { ok: false, error: 'boom' };

describe('decideInteraction', () => {
  test('chat instruction', () => {
    const d = decideInteraction({ kind: 'chat' });
    expect(d.mode).toBe('chat');
    expect(d.text).toBeTruthy();
  });

  test('clarify instruction carries text', () => {
    const d = decideInteraction({ kind: 'clarify', clarifyQuestion: 'Which one?' });
    expect(d.mode).toBe('clarify');
    expect(d.text).toBe('Which one?');
  });

  test('archive tool -> mutation mode (same as any other mutate tool)', () => {
    const d = decideInteraction(
      { kind: 'tool', toolName: 'archive_lead', input: { leadId: 'lead-1' } },
      { ok: true, data: { leadId: 'lead-1', status: 'archived' } },
    );
    expect(d.mode).toBe('mutation');
  });

  test('list tool -> list mode, formatter, allow-short intro', () => {
    const d = decideInteraction({ kind: 'tool', toolName: 'search_leads', input: {} }, okList);
    expect(d.mode).toBe('list');
    expect(d.replyOwner).toBe('formatter');
    expect(d.introPolicy).toBe('allow-short');
  });

  test('empty list -> empty mode', () => {
    const d = decideInteraction({ kind: 'tool', toolName: 'search_leads', input: {} }, emptyList);
    expect(d.mode).toBe('empty');
  });

  test('detail tool -> detail mode', () => {
    const d = decideInteraction({ kind: 'tool', toolName: 'get_lead', input: { leadId: 'lead-1' } }, okDetail);
    expect(d.mode).toBe('detail');
    expect(d.replyOwner).toBe('formatter');
  });

  test('summary insight tool -> llm reply owner', () => {
    const d = decideInteraction({ kind: 'tool', toolName: 'get_pipeline_summary', input: {} }, { ok: true, data: { data: { total: 5 } } });
    expect(d.mode).toBe('summary');
    expect(d.replyOwner).toBe('llm');
  });

  test('error result -> error mode', () => {
    const d = decideInteraction({ kind: 'tool', toolName: 'search_leads', input: {} }, errResult);
    expect(d.mode).toBe('error');
  });
});
