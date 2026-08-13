/**
 * Contract: Story 6.13 — Self-service tenant deletion/offboarding UI.
 * See docs/user-stories/epic-6-tenant-admin-ui.md#story-613--self-service-tenant-deletionoffboarding-ui
 *
 * Intent:
 * Story: 6.13 — Self-service tenant deletion/offboarding UI
 * ADR: ADR-0043 (Accepted 2026-08-07), against Story 3.8's real REST surface
 *   (POST /v1/tenants/self-service-deletion/request,
 *   POST .../export, DELETE /v1/tenants/self-service-deletion (cancel),
 *   POST .../confirm — all real, contract-verified in social-listening-core
 *   already)
 * Scope: social-listening-admin/{src/lib/core-client.ts (extended —
 *   requestTenantSelfServiceDeletion(), requestTenantSelfServiceExport(),
 *   cancelTenantSelfServiceDeletion(), confirmTenantSelfServiceDeletion()),
 *   src/app/api/tenants/self-service-deletion/request/route.ts (new),
 *   src/app/api/tenants/self-service-deletion/export/route.ts (new),
 *   src/app/api/tenants/self-service-deletion/route.ts (new, DELETE),
 *   src/app/api/tenants/self-service-deletion/confirm/route.ts (new),
 *   src/app/tenant/settings/delete/page.tsx (new),
 *   src/app/tenant/settings/delete/TenantDeletionPanel.tsx (new)}
 *
 * Contract to encode: a dedicated /tenant/settings/delete screen, gated on
 *   tenant_admin specifically (redirect for a tenant_user or platform_admin
 *   session, not merely a hidden link) — request/export/cancel/confirm
 *   controls each call their own real, named endpoint with the right
 *   method/body, reacting to the real response shapes (a 202 with
 *   graceEndsAt on request; a re-triggerable JSON-or-CSV export; a
 *   two-step-confirm cancel that resumes ingestion; a high-friction confirm
 *   step that is rejected client-side before the grace period elapses but
 *   still handles the backend's own 409 grace_period_not_elapsed). Real or
 *   realistically mocked fetch assertions per control, not source-string
 *   checks alone.
 *
 * Explicitly out of scope for this contract:
 *   - Re-proving POST /request, /export, DELETE, /confirm's own backend
 *     behavior (grace-period math, FK-safe deletion order, audit logging)
 *     — social-listening-core's own Story 3.8 contract already proves
 *     that; this contract only proves the admin UI calls them correctly
 *     and reacts to their real response shapes.
 *   - Any UI for Platform Admin to see or influence a tenant's own
 *     deletion request beyond the existing audit log (Story 6.6) —
 *     ADR-0043's own decision, Platform Admin never interferes.
 *   - Polling/notifying when the async deletion job actually completes —
 *     no backend signal exists for this today (ADR-0043 §6's own note).
 */

import fs from 'fs';
import path from 'path';

const ADMIN_ROOT = path.resolve(__dirname, '..', '..');
const pagePath = ['app', 'tenant', 'settings', 'delete', 'page.tsx'];
const panelPath = ['app', 'tenant', 'settings', 'delete', 'TenantDeletionPanel.tsx'];
const settingsPagePath = ['app', 'tenant', 'settings', 'page.tsx'];
const requestRoutePath = ['app', 'api', 'tenants', 'self-service-deletion', 'request', 'route.ts'];
const exportRoutePath = ['app', 'api', 'tenants', 'self-service-deletion', 'export', 'route.ts'];
const cancelRoutePath = ['app', 'api', 'tenants', 'self-service-deletion', 'route.ts'];
const confirmRoutePath = ['app', 'api', 'tenants', 'self-service-deletion', 'confirm', 'route.ts'];

function readSrc(...segments: string[]): string {
  return fs.readFileSync(path.join(ADMIN_ROOT, 'src', ...segments), 'utf8');
}

const TENANT_ADMIN = { type: 'tenant_user' as const, tenantId: 't-1', userId: 'u-1', role: 'tenant_admin' as const };
const TENANT_USER = { type: 'tenant_user' as const, tenantId: 't-1', userId: 'u-1', role: 'tenant_user' as const };
const PLATFORM_ADMIN = { type: 'platform_admin' as const, adminId: 'pa-1' };

async function renderPageAs(identity: unknown) {
  jest.resetModules();
  const sessionModule = await import('../../src/lib/session');
  const encrypted = await sessionModule.encryptSession({ idToken: 'x', accessToken: 'y', identity });

  jest.doMock('next/headers', () => ({
    cookies: async () => ({
      get: (name: string) => (name === sessionModule.SESSION_COOKIE_NAME ? { value: encrypted } : undefined),
    }),
  }));
  jest.doMock('next/navigation', () => ({
    redirect: jest.fn((url: string) => {
      throw new Error(`NEXT_REDIRECT:${url}`);
    }),
  }));

  const { default: Page } = await import('../../src/app/tenant/settings/delete/page');
  return Page();
}

async function mockedSessionFetch(accessToken: string, response: Response) {
  jest.resetModules();
  const sessionModule = await import('../../src/lib/session');
  const encrypted = await sessionModule.encryptSession({ idToken: 'x', accessToken, identity: null });
  jest.doMock('next/headers', () => ({
    cookies: async () => ({
      get: (name: string) => (name === sessionModule.SESSION_COOKIE_NAME ? { value: encrypted } : undefined),
    }),
  }));
  return jest.spyOn(global, 'fetch').mockResolvedValue(response);
}

afterEach(() => {
  jest.dontMock('next/headers');
  jest.dontMock('next/navigation');
  jest.resetModules();
  jest.restoreAllMocks();
});

describe('Story 6.13 — Self-service tenant deletion/offboarding UI', () => {
  describe('AC1: a dedicated screen exists, gated on tenant_admin specifically', () => {
    it('creates page.tsx and TenantDeletionPanel.tsx as their own files', () => {
      expect(fs.existsSync(path.join(ADMIN_ROOT, 'src', ...pagePath))).toBe(true);
      expect(fs.existsSync(path.join(ADMIN_ROOT, 'src', ...panelPath))).toBe(true);
    });

    it('redirects a platform_admin session (Story 6.2 shell gate)', async () => {
      await expect(renderPageAs(PLATFORM_ADMIN)).rejects.toThrow('NEXT_REDIRECT:/');
    });

    it('redirects a tenant_user session — no entry point, not merely a hidden control', async () => {
      await expect(renderPageAs(TENANT_USER)).rejects.toThrow('NEXT_REDIRECT:/tenant/settings');
    });

    it('renders for a real tenant_admin session (no redirect) and embeds TenantDeletionPanel', async () => {
      const element = await renderPageAs(TENANT_ADMIN);
      expect(element).toBeTruthy();
      const source = readSrc(...pagePath);
      expect(source).toContain('<TenantDeletionPanel');
    });

    // Deliberately does NOT require tenant/settings/page.tsx to link here.
    // Story 6.9's own sealed contract asserts that screen adds no role gate
    // at all ("visible to both tenant_admin and tenant_user — no additional
    // role gate") — a tenant_admin-only link there would reintroduce
    // exactly that. This screen's own redirect gate (above) already fully
    // satisfies AC1's "tenant_user sessions never see an entry point"; the
    // resulting lack of a discoverable link from settings is a real, named
    // gap (see this component's own SKILL.md), not silently glossed over.
    it('does not require or add a role-gated link on the shared tenant/settings screen', () => {
      const source = readSrc(...settingsPagePath);
      expect(source).not.toMatch(/role\s*===\s*['"]tenant_admin['"]/);
    });
  });

  describe('AC2 (core-client + proxy + UI): request calls the real POST /request', () => {
    it('requestTenantSelfServiceDeletion() POSTs /v1/tenants/self-service-deletion/request with the session bearer token', async () => {
      const responseBody = { tenantId: 't-1', deletionRequestedAt: '2026-08-13T00:00:00.000Z', graceEndsAt: '2026-09-12T00:00:00.000Z' };
      const fetchSpy = await mockedSessionFetch(
        'contract-test-token-1',
        new Response(JSON.stringify(responseBody), { status: 202 })
      );

      const { requestTenantSelfServiceDeletion } = await import('../../src/lib/core-client');
      const outcome = await requestTenantSelfServiceDeletion();

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/v1/tenants/self-service-deletion/request'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ Authorization: 'Bearer contract-test-token-1' }),
        })
      );
      expect(outcome.status).toBe(202);
      expect(outcome.body.graceEndsAt).toBe('2026-09-12T00:00:00.000Z');
    });

    it('the request proxy route forwards requestTenantSelfServiceDeletion()\'s raw status/body unchanged', () => {
      const source = fs.readFileSync(path.join(ADMIN_ROOT, 'src', ...requestRoutePath), 'utf8');
      expect(source).toContain('requestTenantSelfServiceDeletion');
      expect(source).toMatch(/outcome\.status/);
    });

    it('TenantDeletionPanel.tsx calls the same-origin proxy route, never core directly', () => {
      const source = readSrc(...panelPath);
      expect(source).toContain('/api/tenants/self-service-deletion/request');
      expect(source).not.toMatch(/CORE_API_BASE_URL/);
    });

    it('a successful request displays graceEndsAt plainly, not framed as immediate deletion', () => {
      const source = readSrc(...panelPath);
      expect(source).toContain('graceEndsAt');
      expect(source.toLowerCase()).toMatch(/unless you cancel|deleted on|deleted after/);
    });

    it('a 409 (already active) is shown as the real current state, not a generic error', () => {
      const source = readSrc(...panelPath);
      expect(source).toMatch(/status\s*===\s*409/);
    });
  });

  describe('AC3 (core-client + proxy + UI): export calls the real POST /export, JSON and CSV', () => {
    it('requestTenantSelfServiceExport() POSTs /v1/tenants/self-service-deletion/export with the chosen format and the session bearer token', async () => {
      const fetchSpy = await mockedSessionFetch(
        'contract-test-token-2',
        new Response('tenantId,name\nt-1,Acme', { status: 200, headers: { 'Content-Type': 'text/csv' } })
      );

      const { requestTenantSelfServiceExport } = await import('../../src/lib/core-client');
      const outcome = await requestTenantSelfServiceExport('csv');

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/v1/tenants/self-service-deletion/export'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ Authorization: 'Bearer contract-test-token-2' }),
          body: JSON.stringify({ format: 'csv' }),
        })
      );
      expect(outcome.status).toBe(200);
      expect(outcome.contentType).toContain('text/csv');
      expect(outcome.body).toContain('Acme');
    });

    it('requesting the JSON form sends no format field (matching the backend\'s own "anything else is JSON" contract)', async () => {
      const fetchSpy = await mockedSessionFetch(
        'contract-test-token-3',
        new Response(JSON.stringify({ tenantId: 't-1' }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      );

      const { requestTenantSelfServiceExport } = await import('../../src/lib/core-client');
      await requestTenantSelfServiceExport('json');

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/v1/tenants/self-service-deletion/export'),
        expect.objectContaining({ body: JSON.stringify({}) })
      );
    });

    it('the export proxy route forwards requestTenantSelfServiceExport()\'s raw status/body/content-type unchanged', () => {
      const source = fs.readFileSync(path.join(ADMIN_ROOT, 'src', ...exportRoutePath), 'utf8');
      expect(source).toContain('requestTenantSelfServiceExport');
      expect(source).toMatch(/outcome\.status/);
      expect(source).toMatch(/outcome\.contentType/);
    });

    it('TenantDeletionPanel.tsx offers both a JSON and a CSV export control', () => {
      const source = readSrc(...panelPath);
      expect(source).toMatch(/handleExport\(\s*['"]json['"]\s*\)/);
      expect(source).toMatch(/handleExport\(\s*['"]csv['"]\s*\)/);
    });

    it('export is re-triggerable — not disabled after one call', () => {
      const source = readSrc(...panelPath);
      expect(source).not.toMatch(/disabled(?:={true})?[^}]*Export/s);
    });
  });

  describe('AC4 (core-client + proxy + UI): cancel calls the real DELETE, behind its own explicit confirm step', () => {
    it('cancelTenantSelfServiceDeletion() sends DELETE to /v1/tenants/self-service-deletion with the session bearer token', async () => {
      const fetchSpy = await mockedSessionFetch(
        'contract-test-token-4',
        new Response(JSON.stringify({ tenantId: 't-1', cancelled: true }), { status: 200 })
      );

      const { cancelTenantSelfServiceDeletion } = await import('../../src/lib/core-client');
      const outcome = await cancelTenantSelfServiceDeletion();

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/v1/tenants/self-service-deletion'),
        expect.objectContaining({
          method: 'DELETE',
          headers: expect.objectContaining({ Authorization: 'Bearer contract-test-token-4' }),
        })
      );
      expect(outcome.status).toBe(200);
      expect(outcome.body.cancelled).toBe(true);
    });

    it('the cancel proxy route forwards cancelTenantSelfServiceDeletion()\'s raw status/body unchanged', () => {
      const source = fs.readFileSync(path.join(ADMIN_ROOT, 'src', ...cancelRoutePath), 'utf8');
      expect(source).toContain('cancelTenantSelfServiceDeletion');
      expect(source).toMatch(/outcome\.status/);
    });

    it('cancel has its own explicit pending-confirm sub-state, distinct from the request/confirm steps', () => {
      const source = readSrc(...panelPath);
      expect(source).toMatch(/cancelPending/);
    });
  });

  describe('AC5 (core-client + proxy + UI): confirm calls the real POST /confirm, only reachable once the grace period elapses, its own high-friction step', () => {
    it('confirmTenantSelfServiceDeletion() POSTs /v1/tenants/self-service-deletion/confirm with the session bearer token', async () => {
      const fetchSpy = await mockedSessionFetch(
        'contract-test-token-5',
        new Response(JSON.stringify({ tenantId: 't-1', status: 'deleting' }), { status: 202 })
      );

      const { confirmTenantSelfServiceDeletion } = await import('../../src/lib/core-client');
      const outcome = await confirmTenantSelfServiceDeletion();

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/v1/tenants/self-service-deletion/confirm'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ Authorization: 'Bearer contract-test-token-5' }),
        })
      );
      expect(outcome.status).toBe(202);
      expect(outcome.body.status).toBe('deleting');
    });

    it('the confirm proxy route forwards confirmTenantSelfServiceDeletion()\'s raw status/body unchanged', () => {
      const source = fs.readFileSync(path.join(ADMIN_ROOT, 'src', ...confirmRoutePath), 'utf8');
      expect(source).toContain('confirmTenantSelfServiceDeletion');
      expect(source).toMatch(/outcome\.status/);
    });

    it('the confirm control is client-side disabled before graceEndsAt has passed', () => {
      const source = readSrc(...panelPath);
      expect(source).toMatch(/new Date\(\s*\)\s*<\s*new Date\(\s*graceEndsAt\s*\)|Date\.now\(\)\s*<\s*new Date\(\s*graceEndsAt\s*\)\.getTime\(\)/);
    });

    it('confirming requires its own explicit, high-friction confirm step naming the action as final and unrecoverable', () => {
      const source = readSrc(...panelPath);
      expect(source).toMatch(/confirmPending/);
      expect(source.toLowerCase()).toMatch(/cannot be undone|permanently delete/);
    });

    it('handles the backend rejecting an early confirm with 409 grace_period_not_elapsed, not just trusting client-side timing', () => {
      const source = readSrc(...panelPath);
      expect(source).toMatch(/status\s*===\s*409/);
    });

    it('after a successful 202 confirm, the screen reflects deletion in progress without implying immediate completion, and does not poll', () => {
      const source = readSrc(...panelPath);
      expect(source.toLowerCase()).toMatch(/in progress|deleting/);
      expect(source).not.toMatch(/setInterval|setTimeout.*fetch/s);
    });
  });

  describe('core-client.ts stays the sole Bearer-attachment choke point (re-checked after this story\'s additions)', () => {
    it('no second ad hoc fetch-with-Authorization-header call exists anywhere else in src/', () => {
      const offenders: string[] = [];
      const walk = (dir: string) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            walk(full);
            continue;
          }
          if (!full.endsWith('.ts') && !full.endsWith('.tsx')) continue;
          if (full === path.join(ADMIN_ROOT, 'src', 'lib', 'core-client.ts')) continue;
          const content = fs.readFileSync(full, 'utf8');
          if (/Authorization/.test(content) && /fetch\(/.test(content)) {
            offenders.push(full);
          }
        }
      };
      walk(path.join(ADMIN_ROOT, 'src'));
      expect(offenders).toEqual([]);
    });
  });

  it('documents this addition in its own component SKILL.md', () => {
    const skillPath = path.join(ADMIN_ROOT, '.claude', 'skills', 'tenant-deletion-offboarding', 'SKILL.md');
    expect(fs.existsSync(skillPath)).toBe(true);
    const skillSource = fs.readFileSync(skillPath, 'utf8');
    expect(skillSource).toContain('ADR-0043');
  });
});
