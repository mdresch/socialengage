// Contract: Story 6.23 (ADR-0059, against Story 2.15's real backend surface) —
// Facebook connector: OAuth connect flow with Page selection.
// See docs/user-stories/epic-6-tenant-admin-ui.md#story-623 and
// docs/adr/0059-facebook-connector-tenant-owned-page-scope-organization-as-author.md
//
// Intent: Facebook is this project's first authMode:'oauth' connector and
// first Tier-3-only connector (ADR-0059 Decision §4 — no ownerType:'tenant'
// path exists on the backend at all). Story 6.3's existing ConnectForm/
// ConnectModal assumes a single-step credential-field submission — it has no
// redirect-based OAuth mechanism and no concept of a provider returning a
// *list* of connectable assets (Meta's /me/accounts) the caller must choose
// among. This story adds: a real browser redirect to Facebook's OAuth
// dialog (src/lib/facebookOAuth.ts, new); an admin-owned callback route
// (src/app/api/connectors/facebook/oauth/callback/route.ts, new) that
// verifies CSRF state, exchanges the code via social-listening-core's own
// Story 2.15 OAuth-exchange endpoint (never talking to Meta directly from
// admin), and stashes the returned {sessionToken, pages} in a short-lived
// cookie; a pending-result read route (.../pending/route.ts, new); a
// select-page proxy route (.../select-page/route.ts, new) that also caches
// the selected Page's name in a long-lived cookie (core has no field for
// this today — a named, honest gap, not a backend change); PLATFORMS
// entries on both tenant/connectors/page.tsx and .../status/page.tsx
// labelled "Facebook Page (Owned Feed)" (never bare "Facebook", ADR-0059
// Decision §2's hard naming constraint); a new tenantScopeAllowed flag
// suppressing every tenant-wide connect/activate/disconnect control for
// this platform, even for a tenant_admin session (ADR-0059 Decision §4);
// and a new 'reconnect_required' StatusBadgeVariant/ConnectorStatus.status
// value (Story 2.15 AC7's backend addition) surfaced distinctly on both
// screens, whose action re-enters the same OAuth start route.
//
// Scope: src/lib/core-client.ts (ConnectorStatus.status widened;
// exchangeFacebookOAuthCode()/selectFacebookPage() added), src/lib/
// facebookOAuth.ts (new), src/app/api/connectors/facebook/oauth/{start,
// callback,pending,select-page}/route.ts (new), src/app/tenant/connectors/
// page.tsx (facebook PLATFORMS entry, cookie read for cached Page name),
// src/app/tenant/connectors/ConnectorsClient.tsx (oauth branch, Page picker
// modal, reconnect_required variant, tenantScopeAllowed gating),
// src/app/tenant/connectors/status/page.tsx (facebook PLATFORMS entry),
// src/app/tenant/connectors/status/ConnectorStatusClient.tsx
// (reconnect_required variant + reconnect action, tenantScopeAllowed
// gating), src/components/ui/StatusBadge.tsx (new variant), src/app/
// globals.css (new variant's dot colour), .env.example (new env vars).
//
// Contract to encode: AC1 facebook PLATFORMS entry with authMode:'oauth',
// personalScopeAllowed:true, tenantScopeAllowed:false (suppresses the
// tenant-wide option unconditionally, even for tenant_admin); AC2 the label
// "Facebook Page (Owned Feed)" on both screens, never bare "Facebook"; AC3
// a real redirect to Facebook's OAuth dialog and a callback route that
// exchanges the code via core's own endpoint (Meta itself mocked at the
// boundary — core-client.ts's exchangeFacebookOAuthCode()); AC4 a rendered
// picker, one row per returned Page, none pre-selected; AC5 selecting a
// Page submits exactly that Page's id to select-page; AC6 zero Pages shows
// a specific, non-generic message; AC7 the connected state shows the
// connected Page's own name; AC8 disconnect keeps Story 6.3 AC4's existing
// confirm-modal pattern, and no "reconnect on this user's behalf" control
// exists for any other role; AC9 'reconnect_required' renders a distinct
// badge on both screens and its action targets the same OAuth start route.
//
// Explicitly out of scope, per the story's own boundary (not tested):
// comment/mention ingestion UI; a "switch to a different Page" flow;
// tenant/watchlists/page.tsx's SOCIAL_PLATFORMS list; actually submitting
// SocialEngage's own Meta App for Business Verification/App Review.

import fs from 'fs';
import path from 'path';

const ADMIN_ROOT = path.resolve(__dirname, '..', '..');

function readSrc(...segments: string[]): string {
  return fs.readFileSync(path.join(ADMIN_ROOT, 'src', ...segments), 'utf8');
}

afterEach(() => {
  jest.dontMock('next/headers');
  jest.dontMock('next/navigation');
  jest.dontMock('../../src/lib/core-client');
  jest.resetModules();
  jest.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Real Client Component rendering (Story 6.15/6.5's own established pattern:
// require React/react-dom/server and the component fresh inside the test, so
// jest.resetModules() doesn't leave useState pointed at a stale React module).
// ---------------------------------------------------------------------------

function renderComponent(componentPath: string, exportName: string, props: Record<string, unknown>): string {
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const mod = require(componentPath);
  const Component = mod[exportName];
  return renderToStaticMarkup(React.createElement(Component, props));
}

describe('Story 6.23 — Facebook OAuth connect flow with Page selection', () => {
  describe('AC1 (ADR-0059 §4): facebook PLATFORMS entry — oauth, personal-only, no tenant-wide option ever', () => {
    it('tenant/connectors/page.tsx defines a facebook entry with authMode "oauth", personalScopeAllowed true, tenantScopeAllowed false', () => {
      const source = readSrc('app', 'tenant', 'connectors', 'page.tsx');
      const facebookBlock = source.slice(source.indexOf("id: 'facebook'"), source.indexOf("id: 'facebook'") + 600);
      expect(facebookBlock).toContain("authMode: 'oauth'");
      expect(facebookBlock).toContain('personalScopeAllowed: true');
      expect(facebookBlock).toContain('tenantScopeAllowed: false');
    });

    it('ConnectorsClient never renders a tenant-wide ActivateDeactivateButton or a Scope selector for a tenantScopeAllowed:false platform, even when isTenantAdmin is true', () => {
      const markup = renderComponent(
        path.join(ADMIN_ROOT, 'src', 'app', 'tenant', 'connectors', 'ConnectorsClient.tsx'),
        'ConnectorsClient',
        {
          platforms: [FACEBOOK_PLATFORM],
          initialStates: [{ platformId: 'facebook', connected: true, credentialStatus: 'valid', isActive: true, status: 'healthy', maskedHint: null }],
          isTenantAdmin: true,
          facebookConnectedPageName: null,
        }
      );
      // A tenant-wide ActivateDeactivateButton renders with ownerType="tenant" —
      // its own data-testid/prop is not directly inspectable via static markup,
      // so this asserts the source itself gates the tenant-wide render on the
      // new flag, the same structural-check convention Story 6.15's own
      // contract already uses for personalScopeAllowed.
      const source = readSrc('app', 'tenant', 'connectors', 'ConnectorsClient.tsx');
      expect(source).toMatch(/isTenantAdmin\s*&&\s*platform\.tenantScopeAllowed\s*!==\s*false/);
      expect(markup).not.toContain('Disconnect');
    });
  });

  describe('AC2 (ADR-0059 §2): connector label is always "Facebook Page (Owned Feed)", never bare "Facebook"', () => {
    it('both PLATFORMS arrays use the full disclosed label', () => {
      const connectSource = readSrc('app', 'tenant', 'connectors', 'page.tsx');
      const statusSource = readSrc('app', 'tenant', 'connectors', 'status', 'page.tsx');
      expect(connectSource).toContain("name: 'Facebook Page (Owned Feed)'");
      expect(statusSource).toContain("name: 'Facebook Page (Owned Feed)'");
      // Never a bare, unqualified "Facebook" name field anywhere in either file.
      expect(connectSource).not.toMatch(/name: 'Facebook'/);
      expect(statusSource).not.toMatch(/name: 'Facebook'/);
    });
  });

  describe('AC3 (ADR-0059 §3/§4): real OAuth redirect and callback exchange, Meta mocked at the boundary', () => {
    it('the start route redirects to a real Facebook OAuth dialog URL carrying a fresh CSRF state cookie', async () => {
      process.env.FACEBOOK_APP_ID = 'test-app-id';
      process.env.FACEBOOK_OAUTH_REDIRECT_URI = 'http://localhost:3000/api/connectors/facebook/oauth/callback';
      const { GET } = await import('../../src/app/api/connectors/facebook/oauth/start/route');
      const response = await GET();
      expect(response.status).toBe(307);
      const location = response.headers.get('location') ?? '';
      expect(location).toContain('https://www.facebook.com/');
      expect(location).toContain('/dialog/oauth');
      expect(location).toContain('client_id=test-app-id');
      expect(location).toContain(encodeURIComponent('http://localhost:3000/api/connectors/facebook/oauth/callback'));
      const setCookie = response.headers.get('set-cookie') ?? '';
      expect(setCookie).toContain('se_fb_oauth_state=');
      expect(setCookie).toMatch(/HttpOnly/i);
    });

    it('the callback route rejects a mismatched/missing state before ever calling core', async () => {
      jest.doMock('../../src/lib/core-client', () => ({
        exchangeFacebookOAuthCode: jest.fn(),
      }));
      const { GET } = await import('../../src/app/api/connectors/facebook/oauth/callback/route');
      const request = new Request('http://localhost:3000/api/connectors/facebook/oauth/callback?code=abc&state=wrong', {
        headers: { cookie: 'se_fb_oauth_state=right' },
      });
      const response = await GET(request);
      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toContain('fbError=');
      const { exchangeFacebookOAuthCode } = await import('../../src/lib/core-client');
      expect(exchangeFacebookOAuthCode).not.toHaveBeenCalled();
    });

    it('a matching state calls core-client\'s exchangeFacebookOAuthCode() (the real Meta exchange, mocked here at that boundary) and stashes its result for the picker', async () => {
      const exchangeMock = jest.fn().mockResolvedValue({
        status: 200,
        body: { sessionToken: 'sess-1', pages: [{ id: 'p1', name: 'Test Page', category: 'Business' }] },
      });
      jest.doMock('../../src/lib/core-client', () => ({ exchangeFacebookOAuthCode: exchangeMock }));
      const { GET } = await import('../../src/app/api/connectors/facebook/oauth/callback/route');
      const request = new Request('http://localhost:3000/api/connectors/facebook/oauth/callback?code=real-code&state=match', {
        headers: { cookie: 'se_fb_oauth_state=match' },
      });
      const response = await GET(request);
      expect(exchangeMock).toHaveBeenCalledWith('real-code', expect.any(String));
      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toContain('fbConnect=1');
      const setCookie = response.headers.get('set-cookie') ?? '';
      expect(setCookie).toContain('se_fb_oauth_pending=');
    });

    it('a failed core exchange redirects with a distinct error marker, no pending cookie set', async () => {
      jest.doMock('../../src/lib/core-client', () => ({
        exchangeFacebookOAuthCode: jest.fn().mockResolvedValue({ status: 401, body: { error: 'Facebook OAuth exchange failed.' } }),
      }));
      const { GET } = await import('../../src/app/api/connectors/facebook/oauth/callback/route');
      const request = new Request('http://localhost:3000/api/connectors/facebook/oauth/callback?code=bad&state=match', {
        headers: { cookie: 'se_fb_oauth_state=match' },
      });
      const response = await GET(request);
      expect(response.headers.get('location')).toContain('fbError=exchange_failed');
      expect(response.headers.get('set-cookie') ?? '').not.toContain('se_fb_oauth_pending=');
    });
  });

  describe('AC4 (ADR-0059 §3): /me/accounts is fetched via core, never the browser directly, and renders a selectable picker', () => {
    it('the pending route reads and clears the callback\'s own stashed session/pages, never a direct Meta call', async () => {
      const source = readSrc('app', 'api', 'connectors', 'facebook', 'oauth', 'pending', 'route.ts');
      expect(source).not.toMatch(/graph\.facebook\.com/);
      const { GET } = await import('../../src/app/api/connectors/facebook/oauth/pending/route');
      const request = new Request('http://localhost:3000/api/connectors/facebook/oauth/pending', {
        headers: { cookie: `se_fb_oauth_pending=${encodeURIComponent(JSON.stringify({ sessionToken: 'sess-1', pages: [{ id: 'p1', name: 'Test Page' }] }))}` },
      });
      const response = await GET(request);
      const body = await response.json();
      expect(body).toEqual({ sessionToken: 'sess-1', pages: [{ id: 'p1', name: 'Test Page' }] });
      const setCookie = response.headers.get('set-cookie') ?? '';
      expect(setCookie).toContain('se_fb_oauth_pending=;');
    });

    it('a real render of the picker shows one row per returned Page, with no Page pre-selected', () => {
      const markup = renderComponent(
        path.join(ADMIN_ROOT, 'src', 'app', 'tenant', 'connectors', 'ConnectorsClient.tsx'),
        'ConnectorsClient',
        {
          platforms: [FACEBOOK_PLATFORM],
          initialStates: [{ platformId: 'facebook', connected: false, credentialStatus: null, isActive: false, status: null, maskedHint: null }],
          isTenantAdmin: false,
          facebookConnectedPageName: null,
          initialFacebookPending: {
            sessionToken: 'sess-1',
            pages: [
              { id: 'p1', name: 'First Test Page', category: 'Business' },
              { id: 'p2', name: 'Second Test Page', category: 'Media' },
            ],
          },
        }
      );
      expect(markup).toContain('First Test Page');
      expect(markup).toContain('Second Test Page');
      expect(markup).not.toMatch(/checked(?:=["']?(?:true|checked)["']?)?[^>]*(First|Second) Test Page/);
    });
  });

  describe('AC5: selecting Pages submits their ids to select-page (2026-08-18, dated note — Story 6.27/ADR-0060 Decision §5 revised this to a plural, multi-select shape; see that story\'s own contract for the new multi-select picker UI itself)', () => {
    it('core-client.ts\'s selectFacebookPages() posts the given sessionToken/pageIds to the real endpoint', async () => {
      const sessionModule = await import('../../src/lib/session');
      const identity = { type: 'tenant_user' as const, tenantId: 't-1', userId: 'u-1', role: 'tenant_user' as const };
      const encrypted = await sessionModule.encryptSession({ idToken: 'x', accessToken: 'y', identity });
      jest.doMock('next/headers', () => ({
        cookies: async () => ({ get: (name: string) => (name === sessionModule.SESSION_COOKIE_NAME ? { value: encrypted } : undefined) }),
      }));
      const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ connected: [{ pageId: 'p2', pageName: 'Second Test Page' }], errors: [] }), { status: 201 })
      );
      const { selectFacebookPages } = await import('../../src/lib/core-client');
      const outcome = await selectFacebookPages('sess-1', ['p2']);
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/v1/connectors/facebook/oauth/select-page'),
        expect.objectContaining({ method: 'POST', body: JSON.stringify({ sessionToken: 'sess-1', pageIds: ['p2'] }) })
      );
      expect(outcome.status).toBe(201);
      expect(outcome.body.connected).toEqual([{ pageId: 'p2', pageName: 'Second Test Page' }]);
    });

    it('the select-page proxy route forwards the given sessionToken/pageIds unchanged and returns the structured connected/errors response — no cosmetic Page-name cookie anymore (Story 6.27 retired it in favor of the real GET /v1/connectors/facebook/pages list)', async () => {
      jest.doMock('../../src/lib/core-client', () => ({
        selectFacebookPages: jest.fn().mockResolvedValue({
          status: 201,
          body: { connected: [{ pageId: 'p2', pageName: 'Second Test Page' }], errors: [] },
        }),
      }));
      const { POST } = await import('../../src/app/api/connectors/facebook/oauth/select-page/route');
      const request = new Request('http://localhost:3000/api/connectors/facebook/oauth/select-page', {
        method: 'POST',
        body: JSON.stringify({ sessionToken: 'sess-1', pageIds: ['p2'] }),
      });
      const response = await POST(request);
      const { selectFacebookPages } = await import('../../src/lib/core-client');
      expect(selectFacebookPages).toHaveBeenCalledWith('sess-1', ['p2']);
      expect(response.status).toBe(201);
      const body = await response.json();
      expect(body.connected).toEqual([{ pageId: 'p2', pageName: 'Second Test Page' }]);
      expect(response.headers.get('set-cookie') ?? '').not.toContain('se_fb_connected_page=');
    });
  });

  describe('AC6: zero Pages shows a specific, non-generic message', () => {
    it('a real render with an empty pages list shows the named empty-state copy, not a blank picker', () => {
      const markup = renderComponent(
        path.join(ADMIN_ROOT, 'src', 'app', 'tenant', 'connectors', 'ConnectorsClient.tsx'),
        'ConnectorsClient',
        {
          platforms: [FACEBOOK_PLATFORM],
          initialStates: [{ platformId: 'facebook', connected: false, credentialStatus: null, isActive: false, status: null, maskedHint: null }],
          isTenantAdmin: false,
          facebookConnectedPageName: null,
          initialFacebookPending: { sessionToken: 'sess-1', pages: [] },
        }
      );
      expect(markup).toContain('No Facebook Pages found for this account');
    });
  });

  describe('AC7: the connected state shows the connected Page\'s own name (2026-08-18, dated note — Story 6.27/ADR-0060 Decision §6 replaced the single cached-name footer with a real per-Page list; see that story\'s own contract for the fuller per-Page list behavior)', () => {
    it('a real render with a real connected-Pages list (the initialFacebookPages testability seam) shows the connected Page\'s own name, not just the generic platform label alone', () => {
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
              {
                id: 'row-1',
                pageId: 'p2',
                pageName: 'My Real Connected Page',
                status: 'connected',
                connectorHealth: { status: 'healthy', lastSuccessfulFetchAt: null, lastAttemptAt: null, consecutiveFailures: 0, credentialStatus: 'valid' },
              },
            ],
          },
        }
      );
      expect(markup).toContain('My Real Connected Page');
    });
  });

  describe('AC8 (ADR-0059 §4): disconnect keeps Story 6.3 AC4\'s confirm-modal pattern; no "reconnect on this user\'s behalf" control for any other role', () => {
    it('ConnectorsClient.tsx never renders a control offering to reconnect Facebook on another user\'s behalf', () => {
      const source = readSrc('app', 'tenant', 'connectors', 'ConnectorsClient.tsx');
      expect(source).not.toMatch(/reconnect.{0,40}on (their|this user'?s) behalf/i);
      expect(source).not.toMatch(/reconnectUserId/i);
    });
  });

  describe('AC9 (Story 2.15 AC7): reconnect_required renders a distinct badge on both screens and targets the same OAuth entry point', () => {
    it('StatusBadge supports a real, distinct reconnect_required variant with its own label', () => {
      const { StatusBadge } = require(path.join(ADMIN_ROOT, 'src', 'components', 'ui', 'StatusBadge.tsx'));
      const React = require('react');
      const { renderToStaticMarkup } = require('react-dom/server');
      const markup = renderToStaticMarkup(React.createElement(StatusBadge, { variant: 'reconnect_required' }));
      expect(markup).toContain('data-variant="reconnect_required"');
      expect(markup).not.toContain('data-variant="failing"');
      expect(markup.toLowerCase()).toContain('reconnect');
    });

    it('the connector-status screen maps a reconnect_required health status to the reconnect_required badge variant, distinct from failing/inactive', () => {
      const source = readSrc('app', 'tenant', 'connectors', 'status', 'ConnectorStatusClient.tsx');
      expect(source).toMatch(/row\.health\?\.status === 'reconnect_required'\)\s*return 'reconnect_required'/);
    });

    it('both screens\' reconnect action targets the same real OAuth start route, not a dead end', () => {
      const connectSource = readSrc('app', 'tenant', 'connectors', 'ConnectorsClient.tsx');
      const statusSource = readSrc('app', 'tenant', 'connectors', 'status', 'ConnectorStatusClient.tsx');
      expect(connectSource).toContain('/api/connectors/facebook/oauth/start');
      expect(statusSource).toContain('/api/connectors/facebook/oauth/start');
    });
  });

  describe('Sole-Bearer-attachment choke point (ADR-0036 §2) — unaffected by this story\'s new routes', () => {
    it('none of the new Facebook OAuth files construct their own Authorization header — core-client.ts stays the only one', () => {
      function walk(dir: string): string[] {
        let results: string[] = [];
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) results = results.concat(walk(full));
          else if (/\.(ts|tsx)$/.test(entry.name)) results.push(full);
        }
        return results;
      }
      const offenders: string[] = [];
      for (const file of walk(path.join(ADMIN_ROOT, 'src'))) {
        if (file.endsWith(path.join('lib', 'core-client.ts'))) continue;
        const content = fs.readFileSync(file, 'utf8');
        if (/Authorization/.test(content) && /fetch\(/.test(content)) offenders.push(file);
      }
      expect(offenders).toEqual([]);
    });
  });

  describe('SKILL.md coverage', () => {
    it('connector-connect-disconnect/SKILL.md documents the Facebook OAuth flow', () => {
      const skill = fs.readFileSync(
        path.join(ADMIN_ROOT, '.claude', 'skills', 'connector-connect-disconnect', 'SKILL.md'),
        'utf8'
      );
      expect(skill).toContain('facebook');
      expect(skill).toContain('story-6.23');
    });

    it('connector-status-view/SKILL.md documents the reconnect_required variant', () => {
      const skill = fs.readFileSync(
        path.join(ADMIN_ROOT, '.claude', 'skills', 'connector-status-view', 'SKILL.md'),
        'utf8'
      );
      expect(skill).toContain('reconnect_required');
      expect(skill).toContain('story-6.23');
    });
  });
});

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
