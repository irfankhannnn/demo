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
        functionCalls: () => [{ name: 'search_leads', args: { priority: 'low' } }],
      },
    });

    const plan = await planTurn('list low priority leads', { tenantId: 't1' });
    expect(plan.kind).toBe('tool');
    expect(plan.toolName).toBe('search_leads');
    expect(plan.input.priority).toBe('low');
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
});
