/**
 * Phase 5b — the qualifier's output contract.
 *
 * This flow writes a lead's temperature to the CRM unattended. The parser it
 * replaces searched raw prose for substrings like `'hot lead'` and
 * `'score: 72'`, which meant a reason line reading "not a hot lead at all"
 * scored the lead HOT. A heuristic that can invert its own meaning is not an
 * acceptable basis for an automated write.
 */

import {
  parseQualifierOutput,
  QUALIFIER_RESPONSE_SCHEMA,
  LEAD_SCORES,
  hasNamedAreaOrBuilding,
} from './leadRubric.js';

describe('QUALIFIER_RESPONSE_SCHEMA', () => {
  it('constrains score to the three buckets the CRM stores', () => {
    expect(QUALIFIER_RESPONSE_SCHEMA.properties.score.enum).toEqual(LEAD_SCORES);
  });

  it('requires both the label and the number', () => {
    expect(QUALIFIER_RESPONSE_SCHEMA.required).toEqual(expect.arrayContaining(['score', 'scoreValue']));
  });
});

describe('parseQualifierOutput', () => {
  it('reads a well-formed structured response', () => {
    const out = parseQualifierOutput(JSON.stringify({
      score: 'HOT', scoreValue: 88, reasons: ['Named Whitefield', 'Wants to buy now'],
    }));
    expect(out).toEqual({
      score: 'HOT', scoreValue: 88, reasons: 'Named Whitefield; Wants to buy now', parsed: true,
    });
  });

  it('unwraps a ```json fence, which models emit despite instructions', () => {
    const out = parseQualifierOutput('```json\n{"score":"COLD","scoreValue":15}\n```');
    expect(out.score).toBe('COLD');
    expect(out.parsed).toBe(true);
  });

  it('does NOT score prose that merely mentions a bucket', () => {
    // The exact regression: the old substring matcher returned HOT for this.
    const out = parseQualifierOutput('This is not a hot lead at all — score: cold, honestly.');
    expect(out.parsed).toBe(false);
    expect(out.score).toBe('WARM');
  });

  it('reports parsed:false so the caller can tell a default from a judgement', () => {
    // Storing the neutral default as if the model had decided would make a
    // broken qualifier indistinguishable from a working one.
    for (const bad of ['', null, undefined, 'not json', '{}', '{"score":"LUKEWARM","scoreValue":50}']) {
      expect(parseQualifierOutput(bad).parsed).toBe(false);
    }
  });

  it('keeps a valid label when the number is missing or garbage', () => {
    // A good judgement should not be discarded over a bad number.
    expect(parseQualifierOutput('{"score":"HOT"}')).toMatchObject({ score: 'HOT', scoreValue: 85, parsed: true });
    expect(parseQualifierOutput('{"score":"COLD","scoreValue":"abc"}')).toMatchObject({ score: 'COLD', scoreValue: 20 });
  });

  it('clamps the score into 0-100', () => {
    expect(parseQualifierOutput('{"score":"HOT","scoreValue":9999}').scoreValue).toBe(100);
    expect(parseQualifierOutput('{"score":"COLD","scoreValue":-40}').scoreValue).toBe(0);
  });

  it('accepts a lowercase label', () => {
    expect(parseQualifierOutput('{"score":"warm","scoreValue":50}').score).toBe('WARM');
  });

  it('ignores non-string entries in reasons rather than stringifying them', () => {
    const out = parseQualifierOutput('{"score":"HOT","scoreValue":80,"reasons":["ok",null,42]}');
    expect(out.reasons).toBe('ok');
  });

  it('bounds the reasons length for the DynamoDB item', () => {
    const long = JSON.stringify({ score: 'HOT', scoreValue: 80, reasons: ['x'.repeat(2000)] });
    expect(parseQualifierOutput(long).reasons.length).toBeLessThanOrEqual(300);
  });
});

describe('hasNamedAreaOrBuilding', () => {
  it('does not count a city as a named area', () => {
    expect(hasNamedAreaOrBuilding({ buyerRequirement: { preferredArea: 'Mumbai' } })).toBe(false);
    expect(hasNamedAreaOrBuilding({ buyerRequirement: { preferredArea: 'Whitefield' } })).toBe(true);
  });
});
