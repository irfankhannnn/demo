/**
 * Unit tests for followUpResolver auto-open gating.
 */

import { shouldAutoOpenAfterSearch } from './followUpResolver.js';

describe('shouldAutoOpenAfterSearch', () => {
  test('true when query is set', () => {
    expect(shouldAutoOpenAfterSearch({ query: 'Sakina' })).toBe(true);
  });

  test('false for filter-only searches', () => {
    expect(shouldAutoOpenAfterSearch({ priority: 'low' })).toBe(false);
    expect(shouldAutoOpenAfterSearch({ leadType: 'seller', status: 'new' })).toBe(false);
    expect(shouldAutoOpenAfterSearch({})).toBe(false);
  });
});
