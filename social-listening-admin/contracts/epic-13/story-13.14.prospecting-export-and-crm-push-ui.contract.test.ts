/**
 * Contract: Story 13.14 (ADR-0117, BRD-0117, FDD-0117) — Prospecting export and CRM push UI.
 * See docs/user-stories/epic-13-adr-0109-to-0117.md#story-1314
 *
 * Intent:
 *   Add "Export CSV" and "Push to CRM" actions to the prospecting list detail screen so a
 *   Social-Selling-Strategist can download a bounded, metadata-only CSV or push selected
 *   (or all) entries to a connected CRM as leads. The UI must go through the BFF proxy, never
 *   bypass social-listening-core, respect the `exports` and `prospecting_crm` feature gates,
 *   and enforce owner-only visibility (ADR-0086 / Story 13.13).
 *
 * Scope:
 *   - social-listening-admin/contracts/epic-13/story-13.14.prospecting-export-and-crm-push-ui.contract.test.ts
 *   - social-listening-admin/src/lib/core-client.ts (exportProspectingListCsv, pushProspectingListToCrm, types)
 *   - social-listening-admin/src/app/api/prospecting-lists/[id]/export.csv/route.ts (BFF GET proxy)
 *   - social-listening-admin/src/app/api/prospecting-lists/[id]/crm-handoff/route.ts (BFF POST proxy)
 *   - social-listening-admin/src/app/tenant/prospecting/ProspectingListDetailView.tsx
 *   - social-listening-admin/src/app/tenant/prospecting/ProspectingListCrmPushModal.tsx
 *   - social-listening-admin/src/app/tenant/prospecting/[id]/page.tsx
 *   - social-listening-admin/src/components/plan/FeatureToggleList.tsx (feature keys)
 *   - social-listening-admin/.claude/skills/core-api-client/SKILL.md
 *   - social-listening-admin/.claude/skills/crm-handoff-ui/SKILL.md
 *
 * Contract to encode:
 *   (1) core-client.ts exposes `exportProspectingListCsv(listId, limit)` that calls
 *       `GET /v1/prospecting-lists/:id/export.csv?limit=...` and returns the raw Response.
 *   (2) core-client.ts exposes `pushProspectingListToCrm(listId, payload)` that calls
 *       `POST /v1/prospecting-lists/:id/crm-handoff` with `crmConnectorId`, `caseType='lead'`,
 *       optional `selectedEntryIds`, and optional `customFields`.
 *   (3) BFF routes `GET /api/prospecting-lists/:id/export.csv` and
 *       `POST /api/prospecting-lists/:id/crm-handoff` proxy to the matching core-client
 *       functions and pass the response through unchanged.
 *   (4) ProspectingListDetailView renders owner-only "Export CSV" and "Push to CRM" buttons
 *       when the matching feature gates are enabled, and opens a modal for the CRM push.
 *   (5) The CRM push modal lets the user pick a CRM connector and select specific entries
 *       (or all), then POSTs to the BFF and, on success, shows a link to the CRM record(s).
 *   (6) Feature gates (`exports`, `prospecting_crm`) and the owner-only rule gate visibility
 *       of the actions.
 *
 * Explicitly out of scope:
 *   - Backend export and CRM-handoff implementation (Story 13.13).
 *   - Async export UI and job-polling for lists above 5,000 rows.
 *   - Single-entry CRM push, per-entry CRM record links beyond the single returned crmUrl,
 *     PDF/Excel export, scheduled pushes, CRM campaign/list creation.
 *   - Tenant-admin or edit-share override (deferred to ADR-0129).
 */

import fs from 'fs';
import path from 'path';
import { randomBytes } from 'crypto';

const ADMIN_ROOT = path.resolve(__dirname, '..', '..');

function readSrc(...segments: string[]): string {
  return fs.readFileSync(path.join(ADMIN_ROOT, 'src', ...segments), 'utf8');
}

if (!process.env.CORE_API_BASE_URL) {
  process.env.CORE_API_BASE_URL = 'http://localhost:3001';
}
if (!process.env.SESSION_SECRET) {
  process.env.SESSION_SECRET = randomBytes(32).toString('base64');
}

describe('Story 13.14 — Prospecting export and CRM push UI', () => {
  afterEach(() => {
    jest.dontMock('../../src/lib/core-client');
    jest.dontMock('next/headers');
    jest.resetModules();
    jest.restoreAllMocks();
  });

  describe('AC1: core-client.ts exposes prospecting export and CRM push functions', () => {
    it('exports exportProspectingListCsv calling GET /v1/prospecting-lists/:id/export.csv', () => {
      const src = readSrc('lib', 'core-client.ts');
      expect(src).toMatch(/export\s+async\s+function\s+exportProspectingListCsv\s*\(/);
      expect(src).toMatch(/\/v1\/prospecting-lists\/\$\{[^}]*\}\/export\.csv/);
      expect(src).toMatch(/limit/);
    });

    it('exports pushProspectingListToCrm calling POST /v1/prospecting-lists/:id/crm-handoff', () => {
      const src = readSrc('lib', 'core-client.ts');
      expect(src).toMatch(/export\s+async\s+function\s+pushProspectingListToCrm\s*\(/);
      expect(src).toMatch(/\/v1\/prospecting-lists\/\$\{[^}]*\}\/crm-handoff/);
      expect(src).toMatch(/caseType/);
      expect(src).toMatch(/crmConnectorId/);
      expect(src).toMatch(/selectedEntryIds/);
    });

    it('PushProspectsToCrmResponse contains the required response fields', () => {
      const src = readSrc('lib', 'core-client.ts');
      expect(src).toMatch(/export\s+(?:interface|type)\s+PushProspectsToCrmResponse/);
      expect(src).toMatch(/outboundActivityIds/);
      expect(src).toMatch(/pushedCount/);
      expect(src).toMatch(/skippedCount/);
      expect(src).toMatch(/crmUrl/);
    });

    it('exportProspectingListCsv fetches the CSV with a bounded limit', async () => {
      jest.resetModules();
      const sessionModule = await import('../../src/lib/session');
      const encrypted = await sessionModule.encryptSession({
        idToken: 'x',
        accessToken: 'contract-test-access-token',
        identity: null,
      });
      jest.doMock('next/headers', () => ({
        cookies: async () => ({
          get: (name: string) =>
            name === sessionModule.SESSION_COOKIE_NAME ? { value: encrypted } : undefined,
        }),
      }));

      const csvText = 'author_id,author_name\nabc,Test';
      const fetchSpy = jest.spyOn(global, 'fetch');
      fetchSpy.mockResolvedValue(new Response(csvText, { status: 200 }));

      const { exportProspectingListCsv } = await import('../../src/lib/core-client');
      const response = await exportProspectingListCsv('list-1', 2500);
      expect(response.ok).toBe(true);

      expect(fetchSpy).toHaveBeenCalled();
      const url = fetchSpy.mock.calls[0][0] as string;
      expect(url).toMatch(/\/v1\/prospecting-lists\/list-1\/export\.csv/);
      expect(url).toMatch(/limit=2500/);
    });

    it('pushProspectingListToCrm POSTs the required CRM handoff payload', async () => {
      jest.resetModules();
      const sessionModule = await import('../../src/lib/session');
      const encrypted = await sessionModule.encryptSession({
        idToken: 'x',
        accessToken: 'contract-test-access-token',
        identity: null,
      });
      jest.doMock('next/headers', () => ({
        cookies: async () => ({
          get: (name: string) =>
            name === sessionModule.SESSION_COOKIE_NAME ? { value: encrypted } : undefined,
        }),
      }));

      const result = {
        outboundActivityIds: ['a-1'],
        pushedCount: 2,
        skippedCount: 0,
        crmUrl: 'https://test.example.com/records',
      };
      const fetchSpy = jest.spyOn(global, 'fetch');
      fetchSpy.mockResolvedValue(new Response(JSON.stringify(result), { status: 200 }));

      const { pushProspectingListToCrm } = await import('../../src/lib/core-client');
      await pushProspectingListToCrm('list-1', {
        crmConnectorId: 'hubspot',
        caseType: 'lead',
        selectedEntryIds: ['e-1', 'e-2'],
      });

      expect(fetchSpy).toHaveBeenCalled();
      const [url, init] = fetchSpy.mock.calls[0];
      expect(url).toMatch(/\/v1\/prospecting-lists\/list-1\/crm-handoff/);
      expect((init as any)?.method).toBe('POST');
      const body = JSON.parse((init as any)?.body as string);
      expect(body).toMatchObject({
        crmConnectorId: 'hubspot',
        caseType: 'lead',
        selectedEntryIds: ['e-1', 'e-2'],
      });
    });
  });

  describe('AC2: BFF routes proxy the export and CRM handoff endpoints', () => {
    it('GET /api/prospecting-lists/:id/export.csv exists and streams the CSV', async () => {
      const routePath = path.join(
        ADMIN_ROOT,
        'src',
        'app',
        'api',
        'prospecting-lists',
        '[id]',
        'export.csv',
        'route.ts'
      );
      expect(fs.existsSync(routePath)).toBe(true);
      const routeSrc = readSrc('app', 'api', 'prospecting-lists', '[id]', 'export.csv', 'route.ts');
      expect(routeSrc).toMatch(/exportProspectingListCsv/);
      expect(routeSrc).toMatch(/GET/);
      expect(routeSrc).toMatch(/Content-Disposition/);

      const exportProspectingListCsvMock = jest.fn().mockResolvedValue(
        new Response('author_id,author_name\na,Test', {
          status: 200,
          headers: { 'Content-Type': 'text/csv; charset=utf-8' },
        })
      );
      jest.doMock('../../src/lib/core-client', () => ({
        exportProspectingListCsv: exportProspectingListCsvMock,
      }));

      const { GET } = await import(
        '../../src/app/api/prospecting-lists/[id]/export.csv/route'
      );
      const response = await GET(
        new Request('http://localhost:3000/api/prospecting-lists/list-1/export.csv'),
        { params: Promise.resolve({ id: 'list-1' }) }
      );

      expect(exportProspectingListCsvMock).toHaveBeenCalledWith('list-1', 5000);
      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Disposition')).toMatch(/attachment/);
    });

    it('POST /api/prospecting-lists/:id/crm-handoff exists and proxies to core', async () => {
      const routePath = path.join(
        ADMIN_ROOT,
        'src',
        'app',
        'api',
        'prospecting-lists',
        '[id]',
        'crm-handoff',
        'route.ts'
      );
      expect(fs.existsSync(routePath)).toBe(true);
      const routeSrc = readSrc('app', 'api', 'prospecting-lists', '[id]', 'crm-handoff', 'route.ts');
      expect(routeSrc).toMatch(/pushProspectingListToCrm/);
      expect(routeSrc).toMatch(/POST/);

      const result = {
        outboundActivityIds: ['a-1'],
        pushedCount: 1,
        skippedCount: 0,
        crmUrl: 'https://test.example.com/record/1',
      };
      const pushProspectingListToCrmMock = jest.fn().mockResolvedValue(
        new Response(JSON.stringify(result), { status: 200 })
      );
      jest.doMock('../../src/lib/core-client', () => ({
        pushProspectingListToCrm: pushProspectingListToCrmMock,
      }));

      const { POST } = await import(
        '../../src/app/api/prospecting-lists/[id]/crm-handoff/route'
      );
      const request = new Request('http://localhost:3000/api/prospecting-lists/list-1/crm-handoff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          crmConnectorId: 'hubspot',
          caseType: 'lead',
          selectedEntryIds: ['e-1'],
        }),
      });
      const response = await POST(request, { params: Promise.resolve({ id: 'list-1' }) });

      expect(pushProspectingListToCrmMock).toHaveBeenCalledWith(
        'list-1',
        expect.objectContaining({
          crmConnectorId: 'hubspot',
          caseType: 'lead',
          selectedEntryIds: ['e-1'],
        })
      );
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.crmUrl).toBe('https://test.example.com/record/1');
    });
  });

  describe('AC3: Prospecting list screen exposes Export CSV and Push to CRM', () => {
    it('ProspectingListDetailView has owner-only Export CSV and Push to CRM buttons', () => {
      const src = readSrc('app', 'tenant', 'prospecting', 'ProspectingListDetailView.tsx');
      expect(src).toMatch(/btn-export-csv/);
      expect(src).toMatch(/btn-push-crm/);
      expect(src).toMatch(/Export CSV|Export\.csv/i);
      expect(src).toMatch(/Push to CRM|Push to CRM/);
    });

    it('the detail view fetches the export via the BFF', () => {
      const src = readSrc('app', 'tenant', 'prospecting', 'ProspectingListDetailView.tsx');
      expect(src).toMatch(/\/api\/prospecting-lists\/\$\{[^}]*\}\/export\.csv/);
    });

    it('a CRM push modal is rendered and includes connector and entry selection', () => {
      const modalPath = path.join(
        ADMIN_ROOT,
        'src',
        'app',
        'tenant',
        'prospecting',
        'ProspectingListCrmPushModal.tsx'
      );
      expect(fs.existsSync(modalPath)).toBe(true);
      const src = readSrc('app', 'tenant', 'prospecting', 'ProspectingListCrmPushModal.tsx');
      expect(src).toMatch(/crmConnectorId/);
      expect(src).toMatch(/selectedEntryIds/);
      expect(src).toMatch(/\/api\/prospecting-lists\/\$\{[^}]*\}\/crm-handoff/);
    });

    it('the success state of the CRM push shows a link to the CRM record(s)', () => {
      const src = readSrc('app', 'tenant', 'prospecting', 'ProspectingListCrmPushModal.tsx');
      expect(src).toMatch(/crmUrl/);
      expect(src).toMatch(/Open in CRM|View in CRM|View pushed records|crmRecordUrl/i);
    });
  });

  describe('AC4: feature gates and owner-only rules are respected', () => {
    it('ProspectingListDetailView accepts feature gate state from the page', () => {
      const src = readSrc('app', 'tenant', 'prospecting', 'ProspectingListDetailView.tsx');
      expect(src).toMatch(/featureGates/);
      expect(src).toMatch(/exports/);
      expect(src).toMatch(/prospecting_crm/);
    });

    it('the detail page loads the tenant plan and passes feature gates', () => {
      const src = readSrc('app', 'tenant', 'prospecting', '[id]', 'page.tsx');
      expect(src).toMatch(/getMyPlan/);
      expect(src).toMatch(/featureGates/);
    });

    it('Export CSV and Push to CRM buttons are conditional on isOwner and feature flags', () => {
      const src = readSrc('app', 'tenant', 'prospecting', 'ProspectingListDetailView.tsx');
      expect(src).toMatch(/isOwner/);
      expect(src).toMatch(/featureGates\[(?:['"]exports['"])\]|featureGates\.exports/);
      expect(src).toMatch(/featureGates\[(?:['"]prospecting_crm['"])\]|featureGates\.prospecting_crm/);
    });

    it('FeatureToggleList contains the export and prospecting CRM gate keys', () => {
      const src = readSrc('components', 'plan', 'FeatureToggleList.tsx');
      expect(src).toMatch(/['"]exports['"]/);
      expect(src).toMatch(/['"]prospecting_crm['"]/);
    });
  });
});
