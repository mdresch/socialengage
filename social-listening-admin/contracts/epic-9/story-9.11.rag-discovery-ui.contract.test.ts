/**
 * Contract: Story 9.11 (ADR-0085, BRD-0085, FDD-0085) — RAG Discovery UI & Streaming Q&A.
 * See docs/user-stories/epic-9-adr-0077-to-0085.md#story-911
 */

import fs from 'fs';
import path from 'path';

const ADMIN_ROOT = path.resolve(__dirname, '..', '..');

function readSrc(...segments: string[]): string {
  return fs.readFileSync(path.join(ADMIN_ROOT, 'src', ...segments), 'utf8');
}

describe('Story 9.11 — RAG Discovery UI Contract', () => {
  describe('AC1: core-client.ts exports RAG API helpers', () => {
    it('exports searchRAG, askRAG, and getRAGStatus', () => {
      const src = readSrc('lib', 'core-client.ts');
      expect(src).toMatch(/export\s+async\s+function\s+searchRAG\s*\(/);
      expect(src).toMatch(/export\s+async\s+function\s+askRAG\s*\(/);
      expect(src).toMatch(/export\s+async\s+function\s+getRAGStatus\s*\(/);
    });

    it('calls /v1/rag endpoints via authenticatedCoreFetch', () => {
      const src = readSrc('lib', 'core-client.ts');
      expect(src).toMatch(/authenticatedCoreFetch\s*\(\s*['"`]\/v1\/rag\/search['"`]/);
      expect(src).toMatch(/authenticatedCoreFetch\s*\(\s*['"`]\/v1\/rag\/ask['"`]/);
      expect(src).toMatch(/authenticatedCoreFetch\s*\(\s*['"`]\/v1\/rag\/status['"`]/);
    });
  });

  describe('AC2: Proxy Route Handlers exist', () => {
    it('exists for POST /api/rag/search', () => {
      const routePath = path.join(ADMIN_ROOT, 'src', 'app', 'api', 'rag', 'search', 'route.ts');
      expect(fs.existsSync(routePath)).toBe(true);
      const src = readSrc('app', 'api', 'rag', 'search', 'route.ts');
      expect(src).toMatch(/searchRAG\s*\(/);
    });

    it('exists for POST /api/rag/ask', () => {
      const routePath = path.join(ADMIN_ROOT, 'src', 'app', 'api', 'rag', 'ask', 'route.ts');
      expect(fs.existsSync(routePath)).toBe(true);
      const src = readSrc('app', 'api', 'rag', 'ask', 'route.ts');
      expect(src).toMatch(/askRAG\s*\(/);
    });

    it('exists for GET /api/rag/status', () => {
      const routePath = path.join(ADMIN_ROOT, 'src', 'app', 'api', 'rag', 'status', 'route.ts');
      expect(fs.existsSync(routePath)).toBe(true);
      const src = readSrc('app', 'api', 'rag', 'status', 'route.ts');
      expect(src).toMatch(/getRAGStatus\s*\(/);
    });
  });

  describe('AC3: Discovery Page & Client Component', () => {
    it('renders RAGDiscoveryPage Server Component at tenant/discovery/page.tsx', () => {
      const pagePath = path.join(ADMIN_ROOT, 'src', 'app', 'tenant', 'discovery', 'page.tsx');
      expect(fs.existsSync(pagePath)).toBe(true);
      const src = readSrc('app', 'tenant', 'discovery', 'page.tsx');
      expect(src).toMatch(/RAGDiscoveryClient/);
    });

    it('renders mode selectors for semantic search and ask AI assistant', () => {
      const src = readSrc('app', 'tenant', 'discovery', 'RAGDiscoveryClient.tsx');
      expect(src).toMatch(/data-testid="mode-search-btn"/);
      expect(src).toMatch(/data-testid="mode-ask-btn"/);
    });

    it('supports Cmd+K / Ctrl+K keyboard shortcuts and accessible search labels', () => {
      const src = readSrc('app', 'tenant', 'discovery', 'RAGDiscoveryClient.tsx');
      expect(src).toMatch(/aria-label="Semantic search and Q&A input"/);
      expect(src).toMatch(/key\.toLowerCase\(\)\s*===\s*['"`]k['"`]/);
    });

    it('renders normalized match badges and search result cards', () => {
      const src = readSrc('app', 'tenant', 'discovery', 'RAGDiscoveryClient.tsx');
      expect(src).toMatch(/data-testid="rag-result-card"/);
      expect(src).toMatch(/Strong Match/);
      expect(src).toMatch(/Relevant/);
    });

    it('supports interactive citations rail and honest refusal banner', () => {
      const src = readSrc('app', 'tenant', 'discovery', 'RAGDiscoveryClient.tsx');
      expect(src).toMatch(/data-testid="rag-citation-card"/);
      expect(src).toMatch(/data-testid="rag-refusal-callout"/);
      expect(src).toMatch(/aria-live="polite"/);
    });
  });
});
