/**
 * A14 - Backfill lane. PHASE 4 - NOT IMPLEMENTED.
 *
 * Wraps the repo's existing `instagram-dm-export` skill, which pulls DMs from a
 * logged-in Chrome session, and lands the result in the same SQLite tables the
 * API collector writes to (`conversations`, `messages`).
 *
 * Why this is safe when general browser automation is not: it runs ONCE,
 * manually, at human speed, in the owner's own browser, on their own inbox. It
 * is never scheduled and never looped. That distinction - one manual export
 * versus a bot polling in a loop - is exactly what Meta's detection looks at.
 * If anyone later wires this into the scheduler, that safety property is gone.
 *
 * In practice this is mostly redundant: `collectors/conversations.js` reads full
 * DM history through the official API at any age. This exists only to cover
 * threads the API omits.
 */
const NOT_IMPLEMENTED = 'Phase 4 - not implemented. See docs/insta-sol-ms-docs/01-PLAN.md section A14';

/**
 * Import an export produced by the `instagram-dm-export` skill.
 * @param {object} ctx runtime context
 * @param {string} filePath path to the exported .xlsx or .json
 */
export function importDmExport() {
  throw new Error(`importDmExport: ${NOT_IMPLEMENTED}`);
}

/** Guard so this can never be attached to the scheduler. */
export const SCHEDULABLE = false;

export default { importDmExport, SCHEDULABLE };
