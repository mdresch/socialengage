/**
 * Contract: Story 12.2 (ADR-0101, BRD-0101, FDD-0101) — Connector capability matrix UI (frontend).
 * See docs/user-stories/epic-12-adr-0101-to-0108.md#story-122--connector-capability-matrix-ui-frontend
 * and docs/adr/0101-multi-source-connector-capability-matrix.md
 */

import fs from 'fs';
import path from 'path';

const ADMIN_ROOT = path.resolve(__dirname, '..', '..');

function readSrc(...segments: string[]): string {
  return fs.readFileSync(path.join(ADMIN_ROOT, 'src', ...segments), 'utf8');
}

describe('Story 12.2 — Connector capability matrix UI (frontend)', () => {
  describe('AC1: core-client.ts exports getConnectorCapabilities and capability types', () => {
    it('exports getConnectorCapabilities and SocialConnectorCapabilities interface', () => {
      const src = readSrc('lib', 'core-client.ts');
      expect(src).toMatch(/export\s+async\s+function\s+getConnectorCapabilities\s*\(/);
      expect(src).toContain('SocialConnectorCapabilities');
      expect(src).toContain('ConnectorCapabilitySummary');
    });
  });

  describe('AC2: GET /api/connectors/capabilities BFF route', () => {
    it('proxies to core-client getConnectorCapabilities', () => {
      const routePath = path.join(ADMIN_ROOT, 'src', 'app', 'api', 'connectors', 'capabilities', 'route.ts');
      expect(fs.existsSync(routePath)).toBe(true);
      const src = readSrc('app', 'api', 'connectors', 'capabilities', 'route.ts');
      expect(src).toMatch(/getConnectorCapabilities\s*\(/);
      expect(src).toMatch(/NextResponse\.json/);
    });
  });

  describe('AC3: ConnectorCapabilityBadges component renders badges for capabilities', () => {
    it('renders capability chips for poll, publish, reply, count, backfill', () => {
      const compPath = path.join(ADMIN_ROOT, 'src', 'components', 'connectors', 'ConnectorCapabilityBadges.tsx');
      expect(fs.existsSync(compPath)).toBe(true);
      const src = readSrc('components', 'connectors', 'ConnectorCapabilityBadges.tsx');
      expect(src).toContain('ConnectorCapabilityBadges');
      expect(src).toContain('Poll');
      expect(src).toContain('Publish');
      expect(src).toContain('Reply');
      expect(src).toContain('Count');
      expect(src).toContain('Backfill');
    });
  });

  describe('AC4: OutboundComposerModal gates platform selection on publish capability', () => {
    it('queries /api/connectors/capabilities and checks publish capability before enabling', () => {
      const modalPath = path.join(ADMIN_ROOT, 'src', 'components', 'composer', 'OutboundComposerModal.tsx');
      expect(fs.existsSync(modalPath)).toBe(true);
      const src = readSrc('components', 'composer', 'OutboundComposerModal.tsx');
      expect(src).toContain('/api/connectors/capabilities');
      expect(src).toContain('capabilitiesMap');
    });
  });
});
