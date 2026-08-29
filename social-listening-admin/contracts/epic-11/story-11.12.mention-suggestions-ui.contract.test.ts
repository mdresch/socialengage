/**
 * Contract: Story 11.12 (ADR-0100, BRD-0100, FDD-0100) — Composed Post Mention Suggestions UI.
 * See docs/user-stories/epic-11-adr-0095-to-0100.md#story-1112--composed-post-mention-suggestions-ui-frontend
 */

import fs from 'fs';
import path from 'path';

const ADMIN_ROOT = path.resolve(__dirname, '..', '..');

function readSrc(...segments: string[]): string {
  return fs.readFileSync(path.join(ADMIN_ROOT, 'src', ...segments), 'utf8');
}

describe('Story 11.12 — Composed Post Mention Suggestions UI Contract', () => {
  describe('AC1: core-client.ts exports getMentionSuggestions', () => {
    it('exports getMentionSuggestions and MentionSuggestionItem interface', () => {
      const src = readSrc('lib', 'core-client.ts');
      expect(src).toMatch(/export\s+async\s+function\s+getMentionSuggestions\s*\(/);
      expect(src).toContain('MentionSuggestionItem');
      expect(src).toContain('GetMentionSuggestionsParams');
    });
  });

  describe('AC2: BFF API Route Proxy for Mention Suggestions', () => {
    it('exists for /api/composer/mention-suggestions (POST)', () => {
      const routePath = path.join(ADMIN_ROOT, 'src', 'app', 'api', 'composer', 'mention-suggestions', 'route.ts');
      expect(fs.existsSync(routePath)).toBe(true);
      const src = readSrc('app', 'api', 'composer', 'mention-suggestions', 'route.ts');
      expect(src).toMatch(/getMentionSuggestions\s*\(/);
    });
  });

  describe('AC3: MentionSuggestionsDropdown component renders suggestion pills with badges', () => {
    it('renders suggested mentions with topic/rag/keyword badges and click handlers', () => {
      const compPath = path.join(ADMIN_ROOT, 'src', 'components', 'composer', 'MentionSuggestionsDropdown.tsx');
      expect(fs.existsSync(compPath)).toBe(true);
      const src = readSrc('components', 'composer', 'MentionSuggestionsDropdown.tsx');
      expect(src).toContain('MentionSuggestionsDropdown');
      expect(src).toContain('TOPIC');
      expect(src).toContain('RAG');
      expect(src).toContain('KEYWORD');
      expect(src).toContain('onSelectMention');
    });
  });

  describe('AC4: OutboundComposerModal integrates mention suggestions with debounce and insertion', () => {
    it('provides debounced suggestions fetch and mention insertion callback', () => {
      const modalPath = path.join(ADMIN_ROOT, 'src', 'components', 'composer', 'OutboundComposerModal.tsx');
      expect(fs.existsSync(modalPath)).toBe(true);
      const src = readSrc('components', 'composer', 'OutboundComposerModal.tsx');
      expect(src).toContain('MentionSuggestionsDropdown');
      expect(src).toContain('handleInsertMention');
      expect(src).toContain('mentionSuggestions');
      expect(src).toContain('/api/composer/mention-suggestions');
      expect(src).toContain('300'); // 300ms debounce
    });
  });
});
