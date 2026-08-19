// Contract: Story 6.27 (ADR-0060, against Story 6.27's own real backend
// surface in social-listening-core) — Facebook: support connecting more
// than one Page per user (Admin UI half).
// See docs/user-stories/epic-6-tenant-admin-ui.md#story-627 and
// docs/adr/0060-facebook-connector-multiple-pages-per-user.md
//
// Intent: Story 6.23's own Page picker was single-select (a radiogroup)
// and the connected state showed exactly one cached Page name. ADR-0060
// Decision §6 redesigns both for real multi-Page cardinality: a
// multi-select picker submitting a plural pageIds array with a structured
// partial-failure confirmation; and a real per-Page connected list
// (GET /v1/connectors/facebook/pages) replacing the single cached-name
// footer, with per-Page health badges, a distinct orphaned-row render, a
// parentConnectionActive-driven deactivation banner, and a redesigned
// card-level reconnect_required action that no longer restarts the whole
// flow.
//
// Scope: src/lib/core-client.ts (selectFacebookPages() plural,
// listFacebookPages(), disconnectFacebookPage(), new), src/app/api/
// connectors/facebook/oauth/select-page/route.ts (plural pageIds, cosmetic
// cookie retired), src/app/api/connectors/facebook/pages/route.ts (new),
// src/app/api/connectors/facebook/pages/[id]/route.ts (new), src/app/
// tenant/connectors/ConnectorsClient.tsx (multi-select picker,
// FacebookConnectedPagesList/FacebookPageRow, card-footer redesign),
// src/lib/facebookOAuth.ts (FACEBOOK_CONNECTED_PAGE_COOKIE_NAME retired),
// src/app/tenant/connectors/page.tsx (cookie read removed), src/app/
// globals.css (new cv-fb-* classes).
//
// Contract to encode: AC1 the picker renders checkboxes (multi-select),
// not the original radiogroup, and submits every checked id in one
// pageIds array; AC2 a partial-success response (some connected, some
// errors) renders both lists, never collapsed into one opaque outcome;
// AC3 the real per-Page list (GET .../pages) renders one row per
// connected/orphaned Page with its own health badge, never a removed row;
// AC4 an orphaned row renders its own distinct, honestly-labeled state,
// never as if it were still healthy; AC5 parentConnectionActive:false
// renders the deactivation banner; AC6 the card-level reconnect_required
// badge no longer renders a link that restarts the whole OAuth flow once
// connected — the persistent "Connect another Page" action and the
// per-Page list's own row-level "Reconnect" actions carry the real
// remediation instead; AC7 a Page's own "Disconnect this Page" action
// calls DELETE /api/connectors/facebook/pages/:id, scoped to that one row.
//
// Explicitly out of scope, per this story's own boundary (not tested):
// RequestGate re-keying; the real per-Page rate ceiling; the
// two-users-same-Page health-blending edge case; pagination; comment/
// mention ingestion; the backend half (a separate contract file,
// social-listening-core/contracts/epic-2/story-6.27...).

import path from 'path';

const ADMIN_ROOT = path.resolve(__dirname, '..', '..');

function readSrc(...segments: string[]): string {
  return require('fs').readFileSync(path.join(ADMIN_ROOT, 'src', ...segments), 'utf8');
}

afterEach(() => {
  jest.dontMock('next/headers');
  jest.dontMock('../../src/lib/core-client');
  jest.resetModules();
  jest.restoreAllMocks();
});

function renderComponent(componentPath: string, exportName: string, props: Record<string, unknown>): string {
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const mod = require(componentPath);
  const Component = mod[exportName];
  return renderToStaticMarkup(React.createElement(Component, props));
}

const FACEBOOK_PLATFORM = {
  id: 'facebook',
  name: 'Facebook Page (Owned Feed)',
  subtitle: 'OAuth Ingestion Source',
  description: "Ingests your own connected Facebook Page's own posts (ADR-0059).",
  authMode: 'oauth' as const,
  color: 'blue' as const,
  icon: 'facebook' as const,
  adNotice: null,
  credentialFields: [],
  personalScopeAllowed: true,
  tenantScopeAllowed: false,
};

const HEALTHY = { status: 'healthy' as const, lastSuccessfulFetchAt: null, lastAttemptAt: null, consecutiveFailures: 0, credentialStatus: 'valid' };
const RECONNECT_REQUIRED = { status: 'reconnect_required' as const, lastSuccessfulFetchAt: null, lastAttemptAt: null, consecutiveFailures: 1, credentialStatus: 'revoked' };

describe('Story 6.27 — Facebook multi-Page picker and connected-Pages list', () => {
  describe('AC1 (ADR-0060 Decision §6): the picker is multi-select, submitting every checked id in one pageIds array', () => {
    it('renders checkboxes, not a radiogroup, one per returned Page', () => {
      const markup = renderComponent(
        path.join(ADMIN_ROOT, 'src', 'app', 'tenant', 'connectors', 'ConnectorsClient.tsx'),
        'ConnectorsClient',
        {
          platforms: [FACEBOOK_PLATFORM],
          initialStates: [{ platformId: 'facebook', connected: false, credentialStatus: null, isActive: false, status: null, maskedHint: null }],
          isTenantAdmin: false,
          initialFacebookPending: {
            sessionToken: 'sess-1',
            pages: [
              { id: 'p1', name: 'First Test Page', category: 'Business' },
              { id: 'p2', name: 'Second Test Page', category: 'Media' },
            ],
          },
        }
      );
      expect(markup).toMatch(/type="checkbox"/);
      expect(markup).not.toMatch(/type="radio"/);
      expect(markup).toContain('First Test Page');
      expect(markup).toContain('Second Test Page');
    });

    it('core-client.ts\'s selectFacebookPages() posts a plural pageIds array', async () => {
      const sessionModule = await import('../../src/lib/session');
      const identity = { type: 'tenant_user' as const, tenantId: 't-1', userId: 'u-1', role: 'tenant_user' as const };
      const encrypted = await sessionModule.encryptSession({ idToken: 'x', accessToken: 'y', identity });
      jest.doMock('next/headers', () => ({
        cookies: async () => ({ get: (name: string) => (name === sessionModule.SESSION_COOKIE_NAME ? { value: encrypted } : undefined) }),
      }));
      const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ connected: [{ pageId: 'p1', pageName: 'A' }, { pageId: 'p2', pageName: 'B' }], errors: [] }), { status: 201 })
      );
      const { selectFacebookPages } = await import('../../src/lib/core-client');
      const outcome = await selectFacebookPages('sess-1', ['p1', 'p2']);
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/v1/connectors/facebook/oauth/select-page'),
        expect.objectContaining({ body: JSON.stringify({ sessionToken: 'sess-1', pageIds: ['p1', 'p2'] }) })
      );
      expect(outcome.body.connected).toHaveLength(2);
    });
  });

  describe('AC2 (ADR-0060 Decision §5): the select-page proxy route forwards a structured partial-failure response unchanged', () => {
    it('the proxy passes pageIds through and never collapses connected/errors into one opaque status', async () => {
      jest.doMock('../../src/lib/core-client', () => ({
        selectFacebookPages: jest.fn().mockResolvedValue({
          status: 201,
          body: { connected: [{ pageId: 'p1', pageName: 'A' }], errors: [{ pageId: 'p2', reason: 'Failed to store credential.' }] },
        }),
      }));
      const { POST } = await import('../../src/app/api/connectors/facebook/oauth/select-page/route');
      const request = new Request('http://localhost:3000/api/connectors/facebook/oauth/select-page', {
        method: 'POST',
        body: JSON.stringify({ sessionToken: 'sess-1', pageIds: ['p1', 'p2'] }),
      });
      const response = await POST(request);
      const body = await response.json();
      expect(body.connected).toEqual([{ pageId: 'p1', pageName: 'A' }]);
      expect(body.errors).toEqual([{ pageId: 'p2', reason: 'Failed to store credential.' }]);
    });
  });

  describe('AC3 (ADR-0060 Decision §4/§6): the real per-Page list renders one row per connected/orphaned Page, never a removed row, each with its own health badge', () => {
    it('a real render with the initialFacebookPages testability seam shows every connected/orphaned Page, excludes a removed one', () => {
      const markup = renderComponent(
        path.join(ADMIN_ROOT, 'src', 'app', 'tenant', 'connectors', 'ConnectorsClient.tsx'),
        'ConnectorsClient',
        {
          platforms: [FACEBOOK_PLATFORM],
          initialStates: [{ platformId: 'facebook', connected: true, credentialStatus: 'valid', isActive: true, status: 'healthy', maskedHint: null }],
          isTenantAdmin: false,
          initialFacebookPages: {
            parentConnectionActive: true,
            pages: [
              { id: 'row-1', pageId: 'p1', pageName: 'Connected Page One', status: 'connected', connectorHealth: HEALTHY },
              { id: 'row-2', pageId: 'p2', pageName: 'Long Gone Page', status: 'removed', connectorHealth: HEALTHY },
            ],
          },
        }
      );
      expect(markup).toContain('Connected Page One');
      expect(markup).not.toContain('Long Gone Page');
      expect(markup).toMatch(/status-badge-healthy/);
    });
  });

  describe('AC4 (ADR-0060 Decision §1/§6): an orphaned row renders its own distinct, honestly-labeled state', () => {
    it('an orphaned Page never renders the ordinary health badge, shows the named "access lost" copy instead', () => {
      const markup = renderComponent(
        path.join(ADMIN_ROOT, 'src', 'app', 'tenant', 'connectors', 'ConnectorsClient.tsx'),
        'ConnectorsClient',
        {
          platforms: [FACEBOOK_PLATFORM],
          initialStates: [{ platformId: 'facebook', connected: true, credentialStatus: 'valid', isActive: true, status: 'healthy', maskedHint: null }],
          isTenantAdmin: false,
          initialFacebookPages: {
            parentConnectionActive: true,
            pages: [{ id: 'row-1', pageId: 'p1', pageName: 'Orphaned Page', status: 'orphaned', connectorHealth: HEALTHY }],
          },
        }
      );
      expect(markup).toContain('Orphaned Page');
      expect(markup).toContain('Access lost — reconnect to restore this Page');
      expect(markup).not.toMatch(/status-badge-healthy/);
    });
  });

  describe('AC5 (ADR-0060 Decision §5/§6): parentConnectionActive:false renders the deactivation banner', () => {
    it('shows the named banner when the personal Facebook connection is deactivated', () => {
      const markup = renderComponent(
        path.join(ADMIN_ROOT, 'src', 'app', 'tenant', 'connectors', 'ConnectorsClient.tsx'),
        'ConnectorsClient',
        {
          platforms: [FACEBOOK_PLATFORM],
          initialStates: [{ platformId: 'facebook', connected: true, credentialStatus: 'valid', isActive: true, status: 'healthy', maskedHint: null }],
          isTenantAdmin: false,
          initialFacebookPages: {
            parentConnectionActive: false,
            pages: [{ id: 'row-1', pageId: 'p1', pageName: 'Still Listed Page', status: 'connected', connectorHealth: HEALTHY }],
          },
        }
      );
      expect(markup).toMatch(/currently deactivated/);
    });

    it('shows no banner when the personal Facebook connection is active', () => {
      const markup = renderComponent(
        path.join(ADMIN_ROOT, 'src', 'app', 'tenant', 'connectors', 'ConnectorsClient.tsx'),
        'ConnectorsClient',
        {
          platforms: [FACEBOOK_PLATFORM],
          initialStates: [{ platformId: 'facebook', connected: true, credentialStatus: 'valid', isActive: true, status: 'healthy', maskedHint: null }],
          isTenantAdmin: false,
          initialFacebookPages: {
            parentConnectionActive: true,
            pages: [{ id: 'row-1', pageId: 'p1', pageName: 'Active Page', status: 'connected', connectorHealth: HEALTHY }],
          },
        }
      );
      expect(markup).not.toMatch(/currently deactivated/);
    });
  });

  describe('AC6 (ADR-0060 Decision §6, last bullet): the card-level reconnect_required action no longer restarts the whole flow once connected', () => {
    it('a connected, reconnect_required platform renders a rollup note, not a "Reconnect Facebook" primary action', () => {
      const markup = renderComponent(
        path.join(ADMIN_ROOT, 'src', 'app', 'tenant', 'connectors', 'ConnectorsClient.tsx'),
        'ConnectorsClient',
        {
          platforms: [FACEBOOK_PLATFORM],
          initialStates: [{ platformId: 'facebook', connected: true, credentialStatus: 'revoked', isActive: true, status: 'reconnect_required', maskedHint: null }],
          isTenantAdmin: false,
          initialFacebookPages: {
            parentConnectionActive: true,
            pages: [{ id: 'row-1', pageId: 'p1', pageName: 'Broken Page', status: 'connected', connectorHealth: RECONNECT_REQUIRED }],
          },
        }
      );
      expect(markup).not.toMatch(/Reconnect Facebook Page \(Owned Feed\)/);
      expect(markup).toMatch(/need attention/);
      // The persistent "Connect another Page" action and the per-row
      // "Reconnect" remediation for the specific broken Page are both
      // still present — the real backend mechanism (re-entering OAuth) is
      // unaffected, only the card-level entry point/copy changed.
      expect(markup).toContain('Connect another Page');
      expect(markup).toContain('Reconnect');
    });

    it('a never-connected platform still shows the ordinary "Connect" action, unaffected', () => {
      const markup = renderComponent(
        path.join(ADMIN_ROOT, 'src', 'app', 'tenant', 'connectors', 'ConnectorsClient.tsx'),
        'ConnectorsClient',
        {
          platforms: [FACEBOOK_PLATFORM],
          initialStates: [{ platformId: 'facebook', connected: false, credentialStatus: null, isActive: false, status: null, maskedHint: null }],
          isTenantAdmin: false,
        }
      );
      expect(markup).toContain('Connect Facebook Page (Owned Feed)');
    });
  });

  describe('AC7 (ADR-0060 Decision §5): a Page\'s own "Disconnect this Page" action calls DELETE on its own row id', () => {
    it('core-client.ts\'s disconnectFacebookPage() calls DELETE /v1/connectors/facebook/pages/:id', async () => {
      const sessionModule = await import('../../src/lib/session');
      const identity = { type: 'tenant_user' as const, tenantId: 't-1', userId: 'u-1', role: 'tenant_user' as const };
      const encrypted = await sessionModule.encryptSession({ idToken: 'x', accessToken: 'y', identity });
      jest.doMock('next/headers', () => ({
        cookies: async () => ({ get: (name: string) => (name === sessionModule.SESSION_COOKIE_NAME ? { value: encrypted } : undefined) }),
      }));
      const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ id: 'row-1', pageId: 'p1', status: 'removed' }), { status: 200 })
      );
      const { disconnectFacebookPage } = await import('../../src/lib/core-client');
      const outcome = await disconnectFacebookPage('row-1');
      expect(fetchSpy).toHaveBeenCalledWith(expect.stringContaining('/v1/connectors/facebook/pages/row-1'), expect.objectContaining({ method: 'DELETE' }));
      expect(outcome.body.status).toBe('removed');
    });

    it('the [id] proxy route forwards the path id to disconnectFacebookPage() unchanged', async () => {
      jest.doMock('../../src/lib/core-client', () => ({
        disconnectFacebookPage: jest.fn().mockResolvedValue({ status: 200, body: { id: 'row-1', pageId: 'p1', status: 'removed' } }),
      }));
      const { DELETE } = await import('../../src/app/api/connectors/facebook/pages/[id]/route');
      const request = new Request('http://localhost:3000/api/connectors/facebook/pages/row-1', { method: 'DELETE' });
      const response = await DELETE(request, { params: Promise.resolve({ id: 'row-1' }) });
      const { disconnectFacebookPage } = await import('../../src/lib/core-client');
      expect(disconnectFacebookPage).toHaveBeenCalledWith('row-1');
      expect(response.status).toBe(200);
    });

    it('the pages list proxy route forwards to listFacebookPages() unchanged', async () => {
      jest.doMock('../../src/lib/core-client', () => ({
        listFacebookPages: jest.fn().mockResolvedValue({ status: 200, body: { parentConnectionActive: true, pages: [] } }),
      }));
      const { GET } = await import('../../src/app/api/connectors/facebook/pages/route');
      const response = await GET();
      const { listFacebookPages } = await import('../../src/lib/core-client');
      expect(listFacebookPages).toHaveBeenCalled();
      expect(response.status).toBe(200);
    });
  });

  describe('The retired cosmetic Page-name cookie no longer appears anywhere in this component\'s own source', () => {
    it('ConnectorsClient.tsx and facebookOAuth.ts no longer reference FACEBOOK_CONNECTED_PAGE_COOKIE_NAME', () => {
      const clientSource = readSrc('app', 'tenant', 'connectors', 'ConnectorsClient.tsx');
      const oauthLibSource = readSrc('lib', 'facebookOAuth.ts');
      expect(clientSource).not.toMatch(/FACEBOOK_CONNECTED_PAGE_COOKIE_NAME/);
      expect(oauthLibSource).not.toMatch(/export const FACEBOOK_CONNECTED_PAGE_COOKIE_NAME/);
    });
  });
});
