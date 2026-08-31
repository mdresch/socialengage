/**
 * Contract: Story 13.3 (ADR-0110, BRD-0110, FDD-0110) — Query capability warnings in watchlist builder (frontend).
 * See docs/user-stories/epic-13-adr-0109-to-0117.md#story-133--query-capability-warnings-in-watchlist-builder-frontend
 * and docs/adr/0110-per-connector-query-translation-and-validation.md
 *
 * Intent: Story 13.3 — Query capability warnings in watchlist builder (frontend)
 * Scope:
 *   - social-listening-admin/contracts/epic-13/story-13.3.query-capability-warnings-in-watchlist-builder.contract.test.ts
 *   - social-listening-admin/src/lib/watchlist-ast.ts (per-clause warning map, query limit errors)
 *   - social-listening-admin/src/components/watchlists/BooleanQueryBuilder.tsx (per-clause warning chips + tooltips, error callback)
 *   - social-listening-admin/src/app/tenant/watchlists/WatchlistForm.tsx (save gating on errors, not warnings)
 *   - social-listening-admin/src/app/api/connectors/[platformId]/query-capabilities/route.ts (BFF proxy)
 *   - social-listening-admin/.claude/skills/watchlist-builder/SKILL.md
 *   - social-listening-admin/.claude/skills/boolean-query-visual-builder/SKILL.md (update)
 *
 * Contract to encode:
 *   (1) The watchlist builder highlights unsupported clauses for the selected platform(s).
 *   (2) A tooltip explains the platform-specific limitation and that fallback matching will still run.
 *   (3) The save button is disabled only for actual 422-style errors (maxClauses/maxQueryLength), not for warnings.
 *   (4) The platform selector updates warnings when it changes, by re-fetching query capabilities per selected platform.
 *
 * Explicitly out of scope:
 *   - Backend translator/validation implementation (Story 13.2).
 *   - Visual styling beyond warning chips and native title tooltips.
 *   - Refactoring the legacy AstNode-based preview path (Story 9.1).
 */

import fs from 'fs';
import path from 'path';
import {
  WatchlistAST,
  ConnectorQueryCapabilities,
  getWarningsByClausePath,
  validateAstQueryLimits,
} from '../../src/lib/watchlist-ast';

const ADMIN_ROOT = path.resolve(__dirname, '..', '..');

function readSrc(...segments: string[]): string {
  return fs.readFileSync(path.join(ADMIN_ROOT, 'src', ...segments), 'utf8');
}

describe('Story 13.3 — Query capability warnings in watchlist builder (frontend)', () => {
  const builderPath = ['components', 'watchlists', 'BooleanQueryBuilder.tsx'];
  const formPath = ['app', 'tenant', 'watchlists', 'WatchlistForm.tsx'];

  describe('AC1: The builder highlights unsupported clauses for the selected platforms', () => {
    it('exposes a per-clause warning map helper in watchlist-ast', () => {
      const ast: WatchlistAST = {
        operator: 'AND',
        clauses: [
          { type: 'hashtag', value: 'AI' },
          { type: 'sentiment', value: 'positive' },
        ],
      };
      const gnewsCaps: ConnectorQueryCapabilities = {
        platformId: 'gnews',
        supportedClauses: ['keyword', 'phrase', 'source', 'date', 'nested'],
        supportedOperators: ['AND', 'OR', 'NOT'],
      };

      const map = getWarningsByClausePath(ast, [gnewsCaps]);
      expect(Object.keys(map).length).toBeGreaterThan(0);
      expect(map['root.clauses.0']).toBeDefined();
      expect(map['root.clauses.0'].some((w) => w.platformId === 'gnews' && w.clause.type === 'hashtag')).toBe(true);
      expect(map['root.clauses.1'].some((w) => w.platformId === 'gnews' && w.clause.type === 'sentiment')).toBe(true);
    });

    it('BooleanQueryBuilder renders per-clause warning indicators in the guided builder', () => {
      const src = readSrc(...builderPath);
      expect(src).toContain('getWarningsByClausePath');
      expect(src).toMatch(/ClauseRowItem[^>]*warnings/);
      expect(src).toMatch(/title\s*=\s*\{[^}]*warning/);
    });
  });

  describe('AC2: A tooltip explains the platform-specific limitation', () => {
    it('warning messages mention the platform and unsupported clause, and include fallback guidance', () => {
      const ast: WatchlistAST = {
        operator: 'AND',
        clauses: [{ type: 'sentiment', value: 'positive' }],
      };
      const gnewsCaps: ConnectorQueryCapabilities = {
        platformId: 'gnews',
        supportedClauses: ['keyword', 'phrase', 'source', 'date', 'nested'],
        supportedOperators: ['AND', 'OR', 'NOT'],
      };

      const map = getWarningsByClausePath(ast, [gnewsCaps]);
      const warning = map['root.clauses.0'][0];
      expect(warning.message).toContain('gnews');
      expect(warning.message.toLowerCase()).toContain('sentiment');
      expect(warning.message.toLowerCase()).toContain('fallback');
    });

    it('BooleanQueryBuilder exposes clause warning text as a native title tooltip', () => {
      const src = readSrc(...builderPath);
      expect(src).toMatch(/title\s*=\s*\{[^}]*warning[^}]*message/);
    });
  });

  describe('AC3: The save button is disabled only for errors, not warnings', () => {
    it('watchlist-ast can distinguish query-limit errors from warnings', () => {
      const ast: WatchlistAST = {
        operator: 'AND',
        clauses: Array.from({ length: 5 }, (_, i) => ({ type: 'keyword', value: `term${i}` })),
      };
      const caps: ConnectorQueryCapabilities = {
        platformId: 'gnews',
        supportedClauses: ['keyword', 'phrase', 'source', 'date', 'nested'],
        supportedOperators: ['AND', 'OR', 'NOT'],
        limits: { maxClauses: 3 },
      };

      const warnings = getWarningsByClausePath(ast, [caps]);
      const errors = validateAstQueryLimits(ast, [caps]);
      expect(Object.keys(warnings).length).toBe(0);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].code).toBe('TOO_MANY_CLAUSES');
    });

    it('watchlist-ast reports QUERY_TOO_LONG when the native query exceeds the connector limit', () => {
      const ast: WatchlistAST = {
        operator: 'AND',
        clauses: [{ type: 'keyword', value: 'a'.repeat(100) }],
      };
      const caps: ConnectorQueryCapabilities = {
        platformId: 'gnews',
        supportedClauses: ['keyword', 'phrase', 'source', 'date', 'nested'],
        supportedOperators: ['AND', 'OR', 'NOT'],
        limits: { maxLength: 50 },
      };

      const errors = validateAstQueryLimits(ast, [caps]);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].code).toBe('QUERY_TOO_LONG');
    });

    it('BooleanQueryBuilder reports hasErrors separately from hasWarnings', () => {
      const src = readSrc(...builderPath);
      expect(src).toContain('onValidationChange');
      expect(src).toContain('hasErrors');
      expect(src).toContain('validateAstQueryLimits');
    });

    it('WatchlistForm disables the save button for errors, not for warnings', () => {
      const src = readSrc(...formPath);
      expect(src).toContain('onValidationChange');
      expect(src).toContain('hasErrors');
      expect(src).toMatch(/disabled\s*=\s*\{\s*submitting\s*\|\|\s*hasErrors\s*\}/);
    });
  });

  describe('AC4: The platform selector updates warnings when it changes', () => {
    it('BooleanQueryBuilder fetches capabilities when selectedPlatformIds changes', () => {
      const src = readSrc(...builderPath);
      expect(src).toMatch(/useEffect[\s\S]*?selectedPlatformIds[\s\S]*?\]\s*\);/);
      expect(src).toContain('/api/connectors/');
      expect(src).toContain('query-capabilities');
    });

    it('WatchlistForm passes selected platforms to the builder and updates them from the platform selector', () => {
      const src = readSrc(...formPath);
      expect(src).toMatch(/selectedPlatformIds\s*=\s*\{\s*platformIds\s*\}/);
      expect(src).toMatch(/setPlatformIds\s*\(/);
    });
  });
});
