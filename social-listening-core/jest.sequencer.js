const Sequencer = require('@jest/test-sequencer').default;

/**
 * Deterministic, numeric epic/story-ordered sequencing. Jest's default
 * sequencer reorders by failed-tests-first then by file size, so full-suite
 * execution order shifts between runs — that made it impossible to
 * reproduce which combination of contract files precedes a given failure.
 * This sequencer always runs the same file in the same position (epic-1
 * through epic-5, story N.1 through N.16 in numeric order — NOT the plain
 * string order that would otherwise sort "story-5.13" before "story-5.7"),
 * so a failure that only shows up in the full suite can be pinned to a
 * stable predecessor and reproduced on demand.
 *
 * Story 3.8 (self-service tenant deletion — Story 3.7's Platform-Admin-
 * gated design was retired the same night before ever being committed, see
 * ADR-0039's "Superseding note") is pinned to run last, right before
 * teardown: it's the one contract that performs real, irreversible,
 * cross-table deletion against shared infrastructure, so it's the single
 * highest-risk file to run ahead of anything else — isolating it at the
 * tail removes that risk entirely rather than relying on fixture-level
 * collision avoidance alone.
 */
const RUNS_LAST = /story-3\.8\.self-service-tenant-initiated-deletion\.contract\.test\.ts$/;
const STORY_NUMBER = /epic-(\d+)[\\/]story-(\d+)\.(\d+)/;

function sortKey(path) {
  const match = path.match(STORY_NUMBER);
  if (!match) return null;
  const [, epic, major, minor] = match;
  return [Number(epic), Number(major), Number(minor)];
}

class DeterministicSequencer extends Sequencer {
  sort(tests) {
    return Array.from(tests).sort((a, b) => {
      const aLast = RUNS_LAST.test(a.path);
      const bLast = RUNS_LAST.test(b.path);
      if (aLast !== bLast) return aLast ? 1 : -1;

      const aKey = sortKey(a.path);
      const bKey = sortKey(b.path);
      if (aKey && bKey) {
        for (let i = 0; i < 3; i++) {
          if (aKey[i] !== bKey[i]) return aKey[i] - bKey[i];
        }
        return a.path < b.path ? -1 : a.path > b.path ? 1 : 0;
      }
      // Non-contract test files (src/**/*.test.ts) fall back to plain path order.
      if (aKey) return -1;
      if (bKey) return 1;
      return a.path < b.path ? -1 : a.path > b.path ? 1 : 0;
    });
  }
}

module.exports = DeterministicSequencer;
