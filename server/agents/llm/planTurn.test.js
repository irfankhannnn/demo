/**
 * Contract tests for planTurn (mocked Gemini — no live API).
 */

import { jest } from '@jest/globals';

const mockGenerateContent = jest.fn();

jest.unstable_mockModule('@google/generative-ai', () => ({
  GoogleGenerativeAI: class MockGenAI {
    getGenerativeModel() {
      return {
        generateContent: mockGenerateContent,
      };
    }
  },
}));

const { planTurn } = await import('./planTurn.js');

describe('planTurn (mocked)', () => {
  beforeEach(() => {
    mockGenerateContent.mockReset();
    process.env.GEMINI_API_KEY = 'test-key';
    process.env.GEMINI_MODEL = 'gemini-test';
  });

  test('returns tool when model issues function call', async () => {
    mockGenerateContent.mockResolvedValue({
      response: {
        text: () => '',
        functionCalls: () => [{ name: 'search_leads', args: { temperature: 'cold' } }],
      },
    });

    const plan = await planTurn('list cold leads', { tenantId: 't1' });
    expect(plan.kind).toBe('tool');
    expect(plan.toolName).toBe('search_leads');
    expect(plan.input.temperature).toBe('cold');
  });

  test('returns chat when model replies with text only', async () => {
    mockGenerateContent.mockResolvedValue({
      response: {
        text: () => 'Namaste! Kaise help kar sakta hoon?',
        functionCalls: () => [],
      },
    });

    const plan = await planTurn('hello', { tenantId: 't1' });
    expect(plan.kind).toBe('chat');
    expect(plan.text).toContain('Namaste');
  });

  test('strips default. prefix from tool names', async () => {
    mockGenerateContent.mockResolvedValue({
      response: {
        text: () => '',
        functionCalls: () => [{ name: 'default.search_leads', args: {} }],
      },
    });

    const plan = await planTurn('show leads', { tenantId: 't1' });
    expect(plan.toolName).toBe('search_leads');
  });

  test('clarify when required fields missing on create', async () => {
    mockGenerateContent.mockResolvedValue({
      response: {
        text: () => '',
        functionCalls: () => [{ name: 'create_lead', args: { name: 'X' } }],
      },
    });

    const plan = await planTurn('create lead X', { tenantId: 't1' });
    expect(plan.kind).toBe('clarify');
    expect(plan.text).toMatch(/more info/i);
  });

  test('create_meeting with all required fields plans a tool call, not a clarify', async () => {
    // Regression guard: required-field validation must run against the args
    // AS THE MODEL PROVIDED THEM. normalizeToolInput() maps `scheduledDate`
    // to meetingDate+meetingTime and DELETES it, so validating after
    // normalizing made every well-formed meeting request answer
    // "I need a bit more info to do that: scheduledDate" -- meeting creation
    // from WhatsApp was completely broken. See phase3-imp/01-....md.
    mockGenerateContent.mockResolvedValue({
      response: {
        text: () => '',
        functionCalls: () => [{
          name: 'create_meeting',
          args: {
            title: 'Site visit',
            scheduledDate: '2026-08-22T10:00',
            relatedEntityType: 'lead',
            relatedEntityId: '11111111-1111-4111-8111-111111111111',
          },
        }],
      },
    });

    const plan = await planTurn('kal site visit schedule karo', { tenantId: 't1' });

    expect(plan.kind).toBe('tool');
    expect(plan.toolName).toBe('create_meeting');
    // Normalization still happened -- it just runs after validation now.
    expect(plan.input.meetingDate).toBe('2026-08-22');
    expect(plan.input.meetingTime).toBe('10:00');
  });
});
