import { describe, it, expect } from '@jest/globals';
import {
  extractJsonObject,
  normalizeAnalysis,
  emptyAnalysis,
  analyzeTranscript,
} from './analysisService.js';

describe('extractJsonObject', () => {
  it('parses plain JSON', () => {
    expect(extractJsonObject('{"summary":"hi"}')).toEqual({ summary: 'hi' });
  });

  it('parses JSON wrapped in a markdown fence', () => {
    expect(extractJsonObject('```json\n{"summary":"hi"}\n```')).toEqual({ summary: 'hi' });
  });

  it('parses JSON surrounded by prose', () => {
    expect(extractJsonObject('Here you go:\n{"summary":"hi"}\nHope that helps'))
      .toEqual({ summary: 'hi' });
  });

  it('returns null for unparseable text', () => {
    expect(extractJsonObject('not json at all')).toBeNull();
    expect(extractJsonObject('')).toBeNull();
    expect(extractJsonObject('{ broken')).toBeNull();
  });
});

describe('normalizeAnalysis', () => {
  it('coerces money strings into numbers', () => {
    const result = normalizeAnalysis({ requirements: { budgetMax: '1,50,00,000', budgetMin: 5000000 } });
    expect(result.requirements.budgetMax).toBe(15000000);
    expect(result.requirements.budgetMin).toBe(5000000);
  });

  it('drops topics outside the allowed list and defaults to other', () => {
    expect(normalizeAnalysis({ topics: ['budget', 'astrology'] }).topics).toEqual(['budget']);
    expect(normalizeAnalysis({ topics: ['astrology'] }).topics).toEqual(['other']);
  });

  it('normalizes topic spelling variants', () => {
    expect(normalizeAnalysis({ topics: ['Painting Whitewash', 'site-visit'] }).topics)
      .toEqual(['painting_whitewash', 'site_visit']);
  });

  it('rejects malformed dates and times', () => {
    const result = normalizeAnalysis({
      siteVisit: { requested: true, preferredDate: 'next saturday', preferredTime: '25:00' },
    });
    expect(result.siteVisit.preferredDate).toBeNull();
    expect(result.siteVisit.preferredTime).toBeNull();
  });

  it('accepts a valid ISO date and 24h time', () => {
    const result = normalizeAnalysis({
      siteVisit: { requested: 'true', preferredDate: '2026-08-15', preferredTime: '16:30' },
    });
    expect(result.siteVisit.requested).toBe(true);
    expect(result.siteVisit.preferredDate).toBe('2026-08-15');
    expect(result.siteVisit.preferredTime).toBe('16:30');
  });

  it('only allows known lead statuses', () => {
    expect(normalizeAnalysis({ suggestedLeadStatus: 'QUALIFIED' }).suggestedLeadStatus).toBe('qualified');
    expect(normalizeAnalysis({ suggestedLeadStatus: 'hot' }).suggestedLeadStatus).toBeNull();
  });

  it('survives entirely malformed input', () => {
    const result = normalizeAnalysis(null);
    expect(result.summary).toBe('');
    expect(result.topics).toEqual(['other']);
    expect(result.intentLevel).toBe('LOW');
    expect(result.siteVisit.requested).toBe(false);
    expect(result.requirements.locations).toEqual([]);
  });

  it('caps list fields so a runaway model cannot bloat the item', () => {
    const many = Array.from({ length: 50 }, (_, i) => `point ${i}`);
    expect(normalizeAnalysis({ keyPoints: many }).keyPoints).toHaveLength(10);
  });
});

describe('emptyAnalysis', () => {
  it('describes a silent recording without proposing anything', () => {
    const result = emptyAnalysis();
    expect(result.summary).toContain('No speech detected');
    expect(result.siteVisit.requested).toBe(false);
    expect(result.maintenance.required).toBe(false);
  });
});

describe('analyzeTranscript', () => {
  const originalKey = process.env.GEMINI_API_KEY;
  const originalModel = process.env.GEMINI_MODEL;

  afterEach(() => {
    process.env.GEMINI_API_KEY = originalKey;
    process.env.GEMINI_MODEL = originalModel;
  });

  it('short-circuits on an empty transcript without calling the model', async () => {
    let called = false;
    const result = await analyzeTranscript({
      tenantId: 't1',
      recordingId: 'r1',
      transcript: '   ',
      deps: { generate: async () => { called = true; return '{}'; } },
    });
    expect(called).toBe(false);
    expect(result.ok).toBe(true);
    expect(result.analysis.summary).toContain('No speech detected');
  });

  it('fails clearly when the model is not configured', async () => {
    delete process.env.GEMINI_API_KEY;
    const result = await analyzeTranscript({ tenantId: 't1', recordingId: 'r1', transcript: 'hello' });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('llm_not_configured');
  });

  it('parses and normalizes a model response', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    process.env.GEMINI_MODEL = 'test-model';
    const result = await analyzeTranscript({
      tenantId: 't1',
      recordingId: 'r1',
      transcript: 'Sir 2 BHK ka carpet area kitna hai?',
      deps: {
        generate: async () => JSON.stringify({
          summary: 'Buyer asked about carpet area.',
          topics: ['property_requirement'],
          intentLevel: 'HIGH',
          requirements: { bhk: '2BHK' },
        }),
      },
    });
    expect(result.ok).toBe(true);
    expect(result.analysis.intentLevel).toBe('HIGH');
    expect(result.analysis.requirements.bhk).toBe('2BHK');
  });

  it('retries once when the first response is not JSON', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    process.env.GEMINI_MODEL = 'test-model';
    let calls = 0;
    const result = await analyzeTranscript({
      tenantId: 't1',
      recordingId: 'r1',
      transcript: 'hello',
      deps: {
        generate: async () => {
          calls += 1;
          return calls === 1 ? 'sorry, I cannot' : '{"summary":"ok"}';
        },
      },
    });
    expect(calls).toBe(2);
    expect(result.ok).toBe(true);
    expect(result.analysis.summary).toBe('ok');
  });

  it('reports a parse failure after the repair attempt', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    process.env.GEMINI_MODEL = 'test-model';
    const result = await analyzeTranscript({
      tenantId: 't1',
      recordingId: 'r1',
      transcript: 'hello',
      deps: { generate: async () => 'still not json' },
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('analysis_parse_failed');
  });

  it('reports transport errors instead of throwing', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    process.env.GEMINI_MODEL = 'test-model';
    const result = await analyzeTranscript({
      tenantId: 't1',
      recordingId: 'r1',
      transcript: 'hello',
      deps: { generate: async () => { throw new Error('429 rate limited'); } },
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('429 rate limited');
  });
});
