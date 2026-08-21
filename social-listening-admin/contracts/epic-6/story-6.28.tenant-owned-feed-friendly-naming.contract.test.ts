/**
 * Contract: Story 6.28 (ADR-0050's 2026-08-20 Amendment Log entry) —
 * friendly per-feed naming in the tenant-owned-feed connector setup UI.
 * See docs/user-stories/epic-6-tenant-admin-ui.md#story-628
 *
 * Intent: requested directly by Menno, having just been given this
 * screen's own URL — a tenant with more than one connected feed (Story
 * 6.20/ADR-0057) could only tell them apart by a raw domain string. The
 * backend half (social-listening-core@2f52c0f, Story 2.19) already added
 * an optional `name` column/API field; this story is the admin-side UI
 * that lets a tenant actually set and see it.
 * Scope: social-listening-admin/{
 *   src/lib/core-client.ts (extended — TenantOwnedFeedActivationDetail.name,
 *     connectTenantOwnedFeed() gains an optional third `name` param,
 *     updateTenantOwnedFeedActivation() widened from a positional
 *     (id, feedUrl) signature to (id, updates: {feedUrl?, name?})),
 *   src/app/api/connectors/tenant-owned-feed/connect/route.ts (extended —
 *     forwards body.name), src/app/api/connectors/tenant-owned-feed/[id]/
 *     route.ts (extended — forwards whichever of feedUrl/name the client
 *     actually sent, so name:null (explicit clear) is distinguishable from
 *     "not being changed"),
 *   src/app/tenant/connectors/tenant-owned-feed/TenantOwnedFeedSetup.tsx
 *     (extended — an optional Name field in both the connect and edit
 *     modals; the list row shows the name when set, falling back to the
 *     domain, with the domain shown as a secondary line once a name is set)
 * }.
 * Contract to encode:
 * - AC1: the connect modal has an optional Name field; submitting with a
 *   non-empty name sends it to the connect proxy; submitting with a blank
 *   name omits the field entirely (never sends an empty string).
 * - AC2: the edit modal is pre-filled with the activation's current name
 *   (or blank if unset); submitting sends `name: null` when the field is
 *   left blank (an explicit clear, not "leave unchanged" — the edit form
 *   always re-sends both feedUrl and name together).
 * - AC3: the list row shows the activation's `name` as its primary label
 *   when set, falling back to `domain`; when a name is set, the domain is
 *   still shown, as a secondary line — never hidden entirely.
 * - AC4: core-client.ts's connectTenantOwnedFeed()/
 *   updateTenantOwnedFeedActivation() attach the bearer token correctly
 *   and both API proxy routes forward outcomes verbatim, the same pattern
 *   every other action in this repo already establishes.
 * Explicitly out of scope: any change to what `extractAuthor()`/
 * `extractProviderBadge()` do with `rawPayload.feedName` on already-
 * ingested posts (social-listening-core's own Story 2.19 denormalizes it,
 * but nothing in social-listening-admin reads it yet — a separate,
 * not-yet-scoped follow-on, named in that story's own SKILL.md); a
 * name-uniqueness check (none decided — a label, not an id); re-proving
 * the backend's own name validation (empty-string rejection, PATCH
 * requiring at least one of feedUrl/name) — social-listening-core's own
 * Story 2.19 contract already proves that.
 */

import fs from 'fs';
import path from 'path';

const ADMIN_ROOT = path.resolve(__dirname, '..', '..');
const setupPath = ['app', 'tenant', 'connectors', 'tenant-owned-feed', 'TenantOwnedFeedSetup.tsx'];
const connectRoutePath = ['app', 'api', 'connectors', 'tenant-owned-feed', 'connect', 'route.ts'];
const idRoutePath = ['app', 'api', 'connectors', 'tenant-owned-feed', '[id]', 'route.ts'];

function readSrc(...segments: string[]): string {
  return fs.readFileSync(path.join(ADMIN_ROOT, 'src', ...segments), 'utf8');
}

function activation(overrides: Record<string, unknown> = {}) {
  return {
    id: 'act-1',
    domain: 'blog.example.com',
    feedUrl: 'https://blog.example.com/feed',
    status: 'verified',
    txtRecordHost: '_socialengage-verify.blog.example.com',
    txtRecordValue: 'socialengage-verify=abc123',
    tokenExpiresAt: '2026-08-24T00:00:00.000Z',
    verifiedAt: '2026-08-17T00:00:00.000Z',
    createdAt: '2026-08-16T00:00:00.000Z',
    name: null,
    ...overrides,
  };
}

afterEach(() => {
  jest.resetModules();
  jest.restoreAllMocks();
});

describe('Story 6.28 — tenant-owned-feed friendly naming (admin UI)', () => {
  describe('AC3: the list row shows name when set, falling back to domain — domain never hidden', () => {
    it('renders the name as the primary label and the domain as a secondary line when a name is set', () => {
      const React = require('react');
      const { renderToStaticMarkup } = require('react-dom/server');
      const { TenantOwnedFeedSetup } = require('../../src/app/tenant/connectors/tenant-owned-feed/TenantOwnedFeedSetup');

      const html = renderToStaticMarkup(
        React.createElement(TenantOwnedFeedSetup, {
          activations: [activation({ name: 'Company Blog', domain: 'blog.acme.com' })],
          isActive: true,
          isTenantAdmin: true,
        })
      );

      expect(html).toContain('Company Blog');
      expect(html).toContain('blog.acme.com');
    });

    it('falls back to the domain as the primary label when no name is set', () => {
      const React = require('react');
      const { renderToStaticMarkup } = require('react-dom/server');
      const { TenantOwnedFeedSetup } = require('../../src/app/tenant/connectors/tenant-owned-feed/TenantOwnedFeedSetup');

      const html = renderToStaticMarkup(
        React.createElement(TenantOwnedFeedSetup, {
          activations: [activation({ name: null, domain: 'blog.acme.com' })],
          isActive: true,
          isTenantAdmin: true,
        })
      );

      expect(html).toContain('blog.acme.com');
      expect(html).not.toContain('tof-item-domain-secondary');
    });
  });

  describe('AC1/AC2: connect and edit modals carry an optional Name field', () => {
    it('the connect modal renders a Name field, distinct from Domain/Feed URL', () => {
      const source = readSrc(...setupPath);
      const connectModalBlock = source.slice(source.indexOf('Connect a tenant-owned feed'), source.indexOf('</Modal>', source.indexOf('Connect a tenant-owned feed')));
      expect(connectModalBlock).toMatch(/Name \(optional\)/);
      expect(connectModalBlock).toMatch(/setName/);
    });

    it('the edit modal renders a Name field, pre-filled from the activation being edited', () => {
      const source = readSrc(...setupPath);
      expect(source).toMatch(/setEditName\(activation\.name \?\? ''\)/);
      const editModalBlock = source.slice(source.indexOf('Edit feed URL"'), source.indexOf('</Modal>', source.indexOf('Edit feed URL"')));
      expect(editModalBlock).toMatch(/Name \(optional\)/);
      expect(editModalBlock).toMatch(/setEditName/);
    });

    it('submitting the edit form always sends name (null when blank), never omitting it', () => {
      const source = readSrc(...setupPath);
      expect(source).toMatch(/name:\s*editName\.trim\(\)\s*\?\s*editName\.trim\(\)\s*:\s*null/);
    });

    it('submitting the connect form with a blank name omits the field entirely (never an empty string)', () => {
      const source = readSrc(...setupPath);
      expect(source).toMatch(/name\.trim\(\)\s*\?\s*\{\s*domain,\s*feedUrl,\s*name:\s*name\.trim\(\)\s*\}\s*:\s*\{\s*domain,\s*feedUrl\s*\}/);
    });
  });

  describe('AC4: proxy routes forward the name field', () => {
    it('the connect route forwards body.name to connectTenantOwnedFeed()', () => {
      const source = readSrc(...connectRoutePath);
      expect(source).toMatch(/connectTenantOwnedFeed\(body\.domain,\s*body\.feedUrl,\s*body\.name\)/);
    });

    it('the [id] PATCH route forwards whichever of feedUrl/name the client sent, distinguishing name:null from name-not-sent', () => {
      const source = readSrc(...idRoutePath);
      expect(source).toMatch(/hasOwnProperty\.call\(body,\s*['"]feedUrl['"]\)/);
      expect(source).toMatch(/hasOwnProperty\.call\(body,\s*['"]name['"]\)/);
    });
  });

  describe('core-client.ts: connectTenantOwnedFeed()/updateTenantOwnedFeedActivation() carry name correctly', () => {
    async function withAuthenticatedFetch<T>(fn: (fetchSpy: jest.SpyInstance) => Promise<T>): Promise<T> {
      jest.resetModules();
      const sessionModule = await import('../../src/lib/session');
      const encrypted = await sessionModule.encryptSession({ idToken: 'x', accessToken: 'contract-test-token', identity: null });
      jest.doMock('next/headers', () => ({
        cookies: async () => ({
          get: (name: string) => (name === sessionModule.SESSION_COOKIE_NAME ? { value: encrypted } : undefined),
        }),
      }));
      const fetchSpy = jest.spyOn(global, 'fetch');
      try {
        return await fn(fetchSpy);
      } finally {
        fetchSpy.mockRestore();
      }
    }

    it('connectTenantOwnedFeed() includes name in the request body when supplied', async () => {
      await withAuthenticatedFetch(async (fetchSpy) => {
        fetchSpy.mockResolvedValue(new Response(JSON.stringify(activation({ name: 'Company Blog' })), { status: 201 }));
        const { connectTenantOwnedFeed } = await import('../../src/lib/core-client');
        await connectTenantOwnedFeed('blog.example.com', 'https://blog.example.com/feed', 'Company Blog');
        expect(fetchSpy).toHaveBeenCalledWith(
          expect.stringContaining('/v1/connectors/tenant-owned-feed/connect'),
          expect.objectContaining({ body: JSON.stringify({ domain: 'blog.example.com', feedUrl: 'https://blog.example.com/feed', name: 'Company Blog' }) })
        );
      });
    });

    it('connectTenantOwnedFeed() omits name from the request body when not supplied', async () => {
      await withAuthenticatedFetch(async (fetchSpy) => {
        fetchSpy.mockResolvedValue(new Response(JSON.stringify(activation()), { status: 201 }));
        const { connectTenantOwnedFeed } = await import('../../src/lib/core-client');
        await connectTenantOwnedFeed('blog.example.com', 'https://blog.example.com/feed');
        expect(fetchSpy).toHaveBeenCalledWith(
          expect.stringContaining('/v1/connectors/tenant-owned-feed/connect'),
          expect.objectContaining({ body: JSON.stringify({ domain: 'blog.example.com', feedUrl: 'https://blog.example.com/feed' }) })
        );
      });
    });

    it('updateTenantOwnedFeedActivation() sends whatever updates object it is given, including an explicit name: null', async () => {
      await withAuthenticatedFetch(async (fetchSpy) => {
        fetchSpy.mockResolvedValue(new Response(JSON.stringify(activation({ name: null })), { status: 200 }));
        const { updateTenantOwnedFeedActivation } = await import('../../src/lib/core-client');
        const result = await updateTenantOwnedFeedActivation('act-1', { feedUrl: 'https://blog.example.com/feed', name: null });
        expect(fetchSpy).toHaveBeenCalledWith(
          expect.stringContaining('/v1/connectors/tenant-owned-feed/act-1'),
          expect.objectContaining({ body: JSON.stringify({ feedUrl: 'https://blog.example.com/feed', name: null }) })
        );
        expect(result.body.name).toBeNull();
      });
    });
  });

  it('documents this addition in the component SKILL.md', () => {
    const skillPath = path.join(ADMIN_ROOT, '.claude', 'skills', 'tenant-owned-feed-connector-setup', 'SKILL.md');
    expect(fs.existsSync(skillPath)).toBe(true);
    const skillSource = fs.readFileSync(skillPath, 'utf8');
    expect(skillSource).toMatch(/Story 6\.28|story-6\.28/);
  });
});
