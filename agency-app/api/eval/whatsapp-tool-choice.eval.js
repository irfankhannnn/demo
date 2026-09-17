/**
 * Tool-choice eval harness (Slice 6 of docs/proposals/agent-channel-architecture).
 *
 * Runs the fixtures in eval/fixtures/whatsapp-tool-choice.json through the
 * REAL planner (agency-app/api/agents/llm/planTurn.js) against the REAL Gemini API,
 * and reports pass/fail per fixture plus an overall pass rate -- the number
 * this repo did not have before (see docs/proposals/agent-channel-architecture/
 * phase1-imp/06-slice6-eval-set.md for why).
 *
 * This is deliberately NOT wired into the default `npm test` path:
 *   - It costs real tokens and takes real network time per fixture.
 *   - It requires GEMINI_API_KEY, which most environments (including CI)
 *     should not need just to run the unit test suite.
 *   - A flaky/slow network call has no place gating every commit.
 *
 * Run it explicitly:
 *   GEMINI_API_KEY=... node --experimental-vm-modules node_modules/jest/bin/jest.js --config eval/jest.eval.config.js
 * or via the npm script:
 *   npm run eval
 *
 * Without GEMINI_API_KEY set, every test in this file is skipped (not
 * failed) so it never blocks anyone who doesn't have API access.
 */
import { describe, test, expect } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fixturesPath = path.join(__dirname, 'fixtures', 'whatsapp-tool-choice.json');
const fixtures = JSON.parse(fs.readFileSync(fixturesPath, 'utf8'));

const hasLiveCreds = !!process.env.GEMINI_API_KEY;
const describeIfLive = hasLiveCreds ? describe : describe.skip;

describeIfLive('WhatsApp tool-choice eval (live Gemini)', () => {
  let planTurn;

  beforeAll(async () => {
    ({ planTurn } = await import('../agents/llm/planTurn.js'));
  });

  const results = [];

  for (const fixture of fixtures) {
    test(`${fixture.id}: ${fixture.utterance}`, async () => {
      const plan = await planTurn(fixture.utterance, fixture.context || {});
      const pass = plan.kind === fixture.expected.kind
        && (fixture.expected.toolName ? plan.toolName === fixture.expected.toolName : true)
        && (fixture.expected.input
          ? Object.entries(fixture.expected.input).every(([k, v]) => plan.input?.[k] === v)
          : true);

      results.push({ id: fixture.id, pass, got: { kind: plan.kind, toolName: plan.toolName, input: plan.input } });

      expect(pass).toBe(true);
    });
  }

  afterAll(() => {
    if (results.length === 0) return;
    const passCount = results.filter((r) => r.pass).length;
    // eslint-disable-next-line no-console
    console.log(`\nTool-choice eval: ${passCount}/${results.length} passed (${((passCount / results.length) * 100).toFixed(0)}%)`);
    for (const r of results.filter((r) => !r.pass)) {
      // eslint-disable-next-line no-console
      console.log(`  FAIL ${r.id}: got ${JSON.stringify(r.got)}`);
    }
  });
});

if (!hasLiveCreds) {
  describe('WhatsApp tool-choice eval', () => {
    test.skip('skipped -- set GEMINI_API_KEY to run against the live model (see file header)', () => {});
  });
}
