/**
 * Contract: Story 11.2 (ADR-0095, BRD-0095, FDD-0095) — Case and Lead Handoff to CRM UI.
 * See docs/user-stories/epic-11-adr-0095-to-0100.md#story-112--case-handoff-to-crm-ui-frontend
 */

import fs from 'fs';
import path from 'path';

const ADMIN_ROOT = path.resolve(__dirname, '..', '..');

function readSrc(...segments: string[]): string {
  return fs.readFileSync(path.join(ADMIN_ROOT, 'src', ...segments), 'utf8');
}

describe('Story 11.2 — Case Handoff to CRM UI Contract', () => {
  describe('AC1: core-client.ts exports CRM API client methods', () => {
    it('exports pushCaseToCRM, listCRMConnectors, listCRMFieldMappings, upsertCRMFieldMapping, deleteCRMFieldMapping', () => {
      const src = readSrc('lib', 'core-client.ts');
      expect(src).toMatch(/export\s+async\s+function\s+pushCaseToCRM\s*\(/);
      expect(src).toMatch(/export\s+async\s+function\s+listCRMConnectors\s*\(/);
      expect(src).toMatch(/export\s+async\s+function\s+listCRMFieldMappings\s*\(/);
      expect(src).toMatch(/export\s+async\s+function\s+upsertCRMFieldMapping\s*\(/);
      expect(src).toMatch(/export\s+async\s+function\s+deleteCRMFieldMapping\s*\(/);
    });
  });

  describe('AC2: Proxy Route Handlers exist for CRM client operations', () => {
    it('exists for /api/crm/push (or /api/inbox/items/[id]/case)', () => {
      const routePath = path.join(ADMIN_ROOT, 'src', 'app', 'api', 'crm', 'push', 'route.ts');
      expect(fs.existsSync(routePath)).toBe(true);
      const src = readSrc('app', 'api', 'crm', 'push', 'route.ts');
      expect(src).toMatch(/pushCaseToCRM\s*\(/);
    });

    it('exists for /api/crm/connectors', () => {
      const routePath = path.join(ADMIN_ROOT, 'src', 'app', 'api', 'crm', 'connectors', 'route.ts');
      expect(fs.existsSync(routePath)).toBe(true);
      const src = readSrc('app', 'api', 'crm', 'connectors', 'route.ts');
      expect(src).toMatch(/listCRMConnectors\s*\(/);
    });

    it('exists for /api/crm/field-mappings', () => {
      const routePath = path.join(ADMIN_ROOT, 'src', 'app', 'api', 'crm', 'field-mappings', 'route.ts');
      expect(fs.existsSync(routePath)).toBe(true);
      const src = readSrc('app', 'api', 'crm', 'field-mappings', 'route.ts');
      expect(src).toMatch(/listCRMFieldMappings\s*\(/);
      expect(src).toMatch(/upsertCRMFieldMapping\s*\(/);
    });
  });

  describe('AC3: CRMHandoffModal component exists and supports Dynamics 365, Salesforce, and HubSpot', () => {
    it('renders modal with provider selector, entity type options, 409 conflict handling, and deep link output', () => {
      const modalPath = path.join(ADMIN_ROOT, 'src', 'components', 'crm', 'CRMHandoffModal.tsx');
      expect(fs.existsSync(modalPath)).toBe(true);
      const src = readSrc('components', 'crm', 'CRMHandoffModal.tsx');
      expect(src).toContain('dynamics365');
      expect(src).toContain('salesforce');
      expect(src).toContain('hubspot');
      expect(src).toContain('allowDuplicate');
      expect(src).toContain('crmRecordUrl');
    });
  });

  describe('AC4: PostDetailPanel integrates CRM handoff modal', () => {
    it('renders a button to trigger CRM handoff and includes CRMHandoffModal', () => {
      const panelSrc = readSrc('app', 'tenant', 'posts', 'PostDetailPanel.tsx');
      expect(panelSrc).toContain('CRMHandoffModal');
      expect(panelSrc).toMatch(/CRM/);
    });
  });

  describe('AC5: ProspectingListDetailView integrates CRM handoff modal', () => {
    it('renders a CRM push button for prospecting authors and includes CRMHandoffModal', () => {
      const viewSrc = readSrc('app', 'tenant', 'prospecting', 'ProspectingListDetailView.tsx');
      expect(viewSrc).toContain('CRMHandoffModal');
      expect(viewSrc).toMatch(/CRM|crm/);
    });
  });
});
