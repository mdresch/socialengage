/**
 * Contract: Story 12.4 (ADR-0102, BRD-0102, FDD-0102) — Boolean query visual builder (frontend).
 * See docs/user-stories/epic-12-adr-0101-to-0108.md#story-124--boolean-query-visual-builder-frontend
 * and docs/adr/0102-boolean-query-ast-and-visual-builder.md
 */

import fs from 'fs';
import path from 'path';
import {
  parseBooleanQueryToAst,
  astToBooleanQuery,
  validateAstAgainstCapabilities,
  WatchlistAST,
  ClauseType,
} from '../../src/lib/watchlist-ast';

const ADMIN_ROOT = path.resolve(__dirname, '..', '..');

function readSrc(...segments: string[]): string {
  return fs.readFileSync(path.join(ADMIN_ROOT, 'src', ...segments), 'utf8');
}

describe('Story 12.4 — Boolean query visual builder (frontend)', () => {
  describe('AC1: BooleanQueryBuilder component with clause rows, operators, nested groups, and mode toggle', () => {
    it('implements BooleanQueryBuilder component with Guided and Advanced modes', () => {
      const compPath = path.join(ADMIN_ROOT, 'src', 'components', 'watchlists', 'BooleanQueryBuilder.tsx');
      expect(fs.existsSync(compPath)).toBe(true);
      const src = readSrc('components', 'watchlists', 'BooleanQueryBuilder.tsx');
      expect(src).toContain('BooleanQueryBuilder');
      expect(src).toContain('Guided');
      expect(src).toContain('Advanced');
      expect(src).toContain('AND');
      expect(src).toContain('OR');
      expect(src).toContain('NOT');
    });
  });

  describe('AC2: Clause type selector and nested groups', () => {
    it('supports all canonical clause types and nesting', () => {
      const src = readSrc('components', 'watchlists', 'BooleanQueryBuilder.tsx');
      expect(src).toContain('keyword');
      expect(src).toContain('phrase');
      expect(src).toContain('hashtag');
      expect(src).toContain('mention');
      expect(src).toContain('author');
      expect(src).toContain('source');
      expect(src).toContain('sentiment');
      expect(src).toContain('date');
      expect(src).toContain('nested');
    });
  });

  describe('AC3: Platform capability warnings for unsupported clauses', () => {
    it('validates AST against platform query capabilities and detects unsupported clauses', () => {
      const ast: WatchlistAST = {
        operator: 'AND',
        clauses: [
          { type: 'hashtag', value: 'tech' },
          { type: 'sentiment', value: 'positive' },
        ],
      };

      const gnewsCaps = {
        platformId: 'gnews',
        supportedClauses: ['keyword', 'phrase', 'source', 'date', 'nested'] as ClauseType[],
        supportedOperators: ['AND', 'OR', 'NOT'] as Array<'AND' | 'OR' | 'NOT'>,
      };

      const warnings = validateAstAgainstCapabilities(ast, [gnewsCaps]);
      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings.some((w) => w.clause.type === 'sentiment')).toBe(true);
    });

    it('BFF proxy endpoint exists for connector query capabilities', () => {
      const routePath = path.join(ADMIN_ROOT, 'src', 'app', 'api', 'connectors', '[platformId]', 'query-capabilities', 'route.ts');
      expect(fs.existsSync(routePath)).toBe(true);
      const src = readSrc('app', 'api', 'connectors', '[platformId]', 'query-capabilities', 'route.ts');
      expect(src).toContain('getConnectorQueryCapabilities');
    });
  });

  describe('AC4: Text preview and bidirectional round-trip parser', () => {
    it('parses boolean text queries to WatchlistAST and converts AST back to string', () => {
      const rawQuery = 'AI AND #OpenSource AND NOT spam';
      const ast = parseBooleanQueryToAst(rawQuery);
      expect(ast.operator).toBe('AND');
      expect(ast.clauses.some((c) => c.type === 'hashtag' && c.value === 'OpenSource')).toBe(true);

      const generated = astToBooleanQuery(ast);
      expect(generated).toContain('AI');
      expect(generated).toContain('#OpenSource');
    });
  });

  describe('AC5: WatchlistForm integration and AST transmission', () => {
    it('integrates BooleanQueryBuilder into WatchlistForm and sends ast in payload', () => {
      const src = readSrc('app', 'tenant', 'watchlists', 'WatchlistForm.tsx');
      expect(src).toContain('BooleanQueryBuilder');
      expect(src).toContain('ast');
      expect(src).toContain('UNSUPPORTED_QUERY_CLAUSE');
    });
  });
});
