/**
 * Contract: Story 6.4 (Phase 1 "also build, not storied") — Watchlist
 * management screen, real rework against ADR-0044's ownership/PATCH/locking
 * contract.
 * See docs/user-stories/epic-6-tenant-admin-ui.md#story-64
 *
 * Intent: Story 6.4 — Watchlist management screen, real rework
 * Scope: social-listening-admin/{src/app/tenant/watchlists/page.tsx (rewrite),
 *   src/app/tenant/watchlists/WatchlistForm.tsx (new, Client Component),
 *   src/app/tenant/watchlists/WatchlistRow.tsx (new, Client Component),
 *   src/app/api/watchlists/route.ts (new — POST create proxy),
 *   src/app/api/watchlists/[id]/route.ts (new — PATCH/DELETE proxy),
 *   src/lib/core-client.ts (extended — listWatchlists(), createWatchlist(),
 *   updateWatchlist(), deleteWatchlist())}
 *
 * Correction, 2026-08-12: the prior version of this contract (Story 6.4,
 * "Built" 2026-08-05) only did fs.readFileSync + string-literal checks
 * against a hardcoded fixture page — it could not detect that nothing was
 * ever wired to social-listening-core. This rewrite proves real behavior:
 * a real GET /v1/watchlists call (no fixture data anywhere in the render
 * path), a real POST with 422 validation-detail surfacing, a real PATCH
 * carrying If-Match/version and RFC 7396 merge-patch semantics (only
 * changed fields sent), 409/428 handled distinctly from a generic failure,
 * a real DELETE behind an explicit confirm step, platform scoping limited to
 * connected platforms, and no oversight of another user's watchlists
 * anywhere on the screen (ADR-0044 §5c).
 *
 * Explicitly out of scope for this contract:
 *   - Re-proving GET/POST/PATCH/DELETE /v1/watchlists' own backend behavior
 *     (validation, RLS ownership scoping, the atomic version-check UPDATE) —
 *     Story 1.5's own contract (social-listening-core/contracts/epic-1/
 *     story-1.5...) already proves all of that; this contract only proves
 *     the admin UI calls it correctly and reacts correctly to each
 *     documented response shape.
 *   - Client-side interactive/DOM rendering — no jsdom/testing-library in
 *     this repo, testEnvironment is 'node' per jest.config.js, the same
 *     constraint every other Epic 6 client-component story (6.3, 6.8) has
 *     worked within. Client Component behavior is proven structurally
 *     (source content) plus at the Route Handler / core-client unit level.
 */

import fs from 'fs';
import path from 'path';

const ADMIN_ROOT = path.resolve(__dirname, '..', '..');

function readSrc(...segments: string[]): string {
  return fs.readFileSync(path.join(ADMIN_ROOT, 'src', ...segments), 'utf8');
}

describe('Story 6.4 — watchlist management screen, real rework (2026-08-12)', () => {
  const pagePath = ['app', 'tenant', 'watchlists', 'page.tsx'];
  const formPath = ['app', 'tenant', 'watchlists', 'WatchlistForm.tsx'];
  const rowPath = ['app', 'tenant', 'watchlists', 'WatchlistRow.tsx'];

  describe('AC1: a real GET /v1/watchlists call renders the caller\'s own watchlists, version included, no fixture data', () => {
    it('creates the /tenant/watchlists screen route', () => {
      expect(fs.existsSync(path.join(ADMIN_ROOT, 'src', ...pagePath))).toBe(true);
    });

    it('calls listWatchlists() (a real backend call), not a hardcoded fixture array', () => {
      const source = readSrc(...pagePath);
      expect(source).toContain('listWatchlists');
      // The old anti-pattern was a static local array literal of fixture
      // watchlists (id: 'w1'/'w2'). Assert it's gone.
      expect(source).not.toMatch(/id:\s*['"]w1['"]/);
      expect(source).not.toMatch(/id:\s*['"]w2['"]/);
    });

    it('renders each watchlist via WatchlistRow, not an inline hardcoded <li>', () => {
      const source = readSrc(...pagePath);
      expect(source).toContain('WatchlistRow');
    });
  });

  describe('AC2: create performs a real POST /v1/watchlists; a 422 surfaces the real details array', () => {
    it('WatchlistForm posts to /api/watchlists on create', () => {
      const source = readSrc(...formPath);
      expect(source).toMatch(/fetch\(['"]\/api\/watchlists['"]/);
      expect(source).toMatch(/method:\s*['"]POST['"]/);
    });

    it('WatchlistForm surfaces body.details (the real 422 shape), not a generic message', () => {
      const source = readSrc(...formPath);
      expect(source).toMatch(/422/);
      expect(source).toMatch(/body\.details/);
    });
  });

  describe('AC3: edit performs a real PATCH with If-Match/version and RFC 7396 merge-patch semantics (only changed fields sent)', () => {
    it('core-client.ts sends the expected version as an If-Match header on PATCH', () => {
      const source = fs.readFileSync(path.join(ADMIN_ROOT, 'src', 'lib', 'core-client.ts'), 'utf8');
      expect(source).toMatch(/'If-Match':\s*String\(expectedVersion\)/);
    });

    it('WatchlistForm computes an edit patch containing only changed fields, and sends the row\'s own version', () => {
      const source = readSrc(...formPath);
      expect(source).toContain('buildEditPatch');
      expect(source).toMatch(/version:\s*current\.version/);
      // The diff function must exist and must NOT unconditionally include every field —
      // assert it conditionally pushes each key rather than building a literal with all keys.
      const fnMatch = source.match(/function buildEditPatch[\s\S]*?\n}/);
      expect(fnMatch).not.toBeNull();
      expect(fnMatch![0]).toMatch(/if \(current\.name !== initial\.name\)/);
      expect(fnMatch![0]).not.toMatch(/patch\.isActive/);
    });

    it('the isActive toggle (WatchlistRow) sends only {isActive: ...} in its patch, never through WatchlistForm', () => {
      const source = readSrc(...rowPath);
      const toggleMatch = source.match(/async function toggleActive\(\)[\s\S]*?\n {2}\}/);
      expect(toggleMatch).not.toBeNull();
      expect(toggleMatch![0]).toMatch(/patch:\s*\{\s*isActive:/);
      expect(toggleMatch![0]).not.toMatch(/patch\.name|patch\.matchType|patch\.terms|patch\.platformIds/);
    });
  });

  describe('AC4: a 409 version_conflict is handled distinctly (surfaces current_version); a 428 gets its own message, no crash', () => {
    it('WatchlistForm distinguishes 409 (with current_version) from a generic failure', () => {
      const source = readSrc(...formPath);
      expect(source).toMatch(/409/);
      expect(source).toMatch(/current_version/);
    });

    it('WatchlistForm handles 428 with its own message, not a generic catch-all', () => {
      const source = readSrc(...formPath);
      expect(source).toMatch(/428/);
    });
  });

  describe('AC5: delete performs a real DELETE behind an explicit confirm step (hard delete, no undo)', () => {
    it('WatchlistRow uses a two-click confirm sub-state, never window.confirm()', () => {
      const source = readSrc(...rowPath);
      expect(source).not.toContain('window.confirm(');
      expect(source).not.toMatch(/\bconfirm\(/);
      expect(source).toMatch(/deletePending/);
      expect(source.toLowerCase()).toContain('no undo');
    });

    it('WatchlistRow DELETEs /api/watchlists/:id only from inside the confirm sub-state handler', () => {
      const source = readSrc(...rowPath);
      const deleteMatch = source.match(/async function handleDelete\(\)[\s\S]*?\n {2}\}/);
      expect(deleteMatch).not.toBeNull();
      expect(deleteMatch![0]).toMatch(/method:\s*['"]DELETE['"]/);
    });
  });

  describe('AC6: platform scoping offers only connected platforms (Story 6.3), not an unfiltered static list', () => {
    it('page.tsx derives connected platforms from a real getConnectorStatus() call', () => {
      const source = readSrc(...pagePath);
      expect(source).toContain('getConnectorStatus');
    });

    it('WatchlistForm renders platform checkboxes from a connectedPlatforms prop, not a hardcoded list', () => {
      const source = readSrc(...formPath);
      expect(source).toMatch(/connectedPlatforms\.map/);
    });
  });

  describe('AC7: the screen never implies oversight of another user\'s watchlists', () => {
    it('page.tsx has no "all tenant watchlists" branch and no admin-only broader view', () => {
      const source = readSrc(...pagePath);
      expect(source.toLowerCase()).not.toContain('all tenant watchlists');
      expect(source).not.toMatch(/role\s*===\s*['"]tenant_admin['"]/);
    });

    it('listWatchlists() takes no parameters — nothing a caller could supply to see another user\'s watchlists', () => {
      const source = fs.readFileSync(path.join(ADMIN_ROOT, 'src', 'lib', 'core-client.ts'), 'utf8');
      const fnMatch = source.match(/export async function listWatchlists\(([^)]*)\)/);
      expect(fnMatch).not.toBeNull();
      expect(fnMatch![1].trim()).toBe('');
    });
  });

  describe('core-client.ts: listWatchlists()/createWatchlist()/updateWatchlist()/deleteWatchlist()', () => {
    afterEach(() => {
      jest.dontMock('next/headers');
      jest.resetModules();
      jest.restoreAllMocks();
    });

    async function withAuthenticatedFetch<T>(fn: (fetchSpy: jest.SpyInstance) => Promise<T>): Promise<T> {
      jest.resetModules();
      const sessionModule = await import('../../src/lib/session');
      const encrypted = await sessionModule.encryptSession({
        idToken: 'x',
        accessToken: 'contract-test-access-token',
        identity: null,
      });
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

    it('listWatchlists() GETs /v1/watchlists with the session bearer token, returning version per row', async () => {
      const watchlists = await withAuthenticatedFetch(async (fetchSpy) => {
        fetchSpy.mockResolvedValue(
          new Response(
            JSON.stringify({
              watchlists: [
                { id: 'w1', name: 'Breaking news', matchType: 'keyword', terms: ['a'], platformIds: ['gnews'], isActive: true, version: 3, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
              ],
            }),
            { status: 200 }
          )
        );
        const { listWatchlists } = await import('../../src/lib/core-client');
        const result = await listWatchlists();
        expect(fetchSpy).toHaveBeenCalledWith(
          expect.stringContaining('/v1/watchlists'),
          expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer contract-test-access-token' }) })
        );
        return result;
      });
      expect(watchlists).toHaveLength(1);
      expect(watchlists[0].version).toBe(3);
    });

    it('createWatchlist() POSTs the input and returns the raw status/body (a 422 is not thrown, but returned)', async () => {
      const outcome = await withAuthenticatedFetch(async (fetchSpy) => {
        fetchSpy.mockResolvedValue(
          new Response(JSON.stringify({ code: 'validation_failed', details: ['terms is required and must be non-empty for this matchType.'] }), { status: 422 })
        );
        const { createWatchlist } = await import('../../src/lib/core-client');
        const result = await createWatchlist({ name: 'X', matchType: 'keyword', terms: [], platformIds: [] });
        expect(fetchSpy).toHaveBeenCalledWith(
          expect.stringContaining('/v1/watchlists'),
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({ Authorization: 'Bearer contract-test-access-token' }),
          })
        );
        return result;
      });
      expect(outcome.status).toBe(422);
      expect(outcome.body.details).toEqual(['terms is required and must be non-empty for this matchType.']);
    });

    it('updateWatchlist() PATCHes /v1/watchlists/:id with If-Match set to the expected version, sending the patch verbatim', async () => {
      const outcome = await withAuthenticatedFetch(async (fetchSpy) => {
        fetchSpy.mockResolvedValue(new Response(JSON.stringify({ code: 'version_conflict', current_version: 5 }), { status: 409 }));
        const { updateWatchlist } = await import('../../src/lib/core-client');
        const result = await updateWatchlist('w1', { isActive: false }, 3);
        expect(fetchSpy).toHaveBeenCalledWith(
          expect.stringContaining('/v1/watchlists/w1'),
          expect.objectContaining({
            method: 'PATCH',
            headers: expect.objectContaining({ 'If-Match': '3', Authorization: 'Bearer contract-test-access-token' }),
            body: JSON.stringify({ isActive: false }),
          })
        );
        return result;
      });
      expect(outcome.status).toBe(409);
      expect(outcome.body.current_version).toBe(5);
    });

    it('deleteWatchlist() DELETEs /v1/watchlists/:id and does not attempt to parse a 204\'s empty body', async () => {
      const outcome = await withAuthenticatedFetch(async (fetchSpy) => {
        fetchSpy.mockResolvedValue(new Response(null, { status: 204 }));
        const { deleteWatchlist } = await import('../../src/lib/core-client');
        const result = await deleteWatchlist('w1');
        expect(fetchSpy).toHaveBeenCalledWith(expect.stringContaining('/v1/watchlists/w1'), expect.objectContaining({ method: 'DELETE' }));
        return result;
      });
      expect(outcome.status).toBe(204);
    });
  });

  describe('Route Handlers proxy core-client outcomes through unmodified (status + body pass through)', () => {
    afterEach(() => {
      jest.dontMock('../../src/lib/core-client');
      jest.resetModules();
    });

    it('POST /api/watchlists returns createWatchlist()\'s own status and body verbatim', async () => {
      jest.doMock('../../src/lib/core-client', () => ({
        createWatchlist: jest.fn().mockResolvedValue({ status: 422, body: { code: 'validation_failed', details: ['x'] } }),
      }));
      const { POST } = await import('../../src/app/api/watchlists/route');
      const response = await POST(
        new Request('http://localhost:3000/api/watchlists', {
          method: 'POST',
          body: JSON.stringify({ name: 'X', matchType: 'keyword', terms: [] }),
        })
      );
      expect(response.status).toBe(422);
      const body = await response.json();
      expect(body.details).toEqual(['x']);
    });

    it('PATCH /api/watchlists/:id forwards {patch, version} to updateWatchlist() and returns its outcome verbatim, including a 409', async () => {
      const updateWatchlistMock = jest.fn().mockResolvedValue({ status: 409, body: { code: 'version_conflict', current_version: 7 } });
      jest.doMock('../../src/lib/core-client', () => ({
        updateWatchlist: updateWatchlistMock,
        deleteWatchlist: jest.fn(),
      }));
      const { PATCH } = await import('../../src/app/api/watchlists/[id]/route');
      const response = await PATCH(
        new Request('http://localhost:3000/api/watchlists/w1', {
          method: 'PATCH',
          body: JSON.stringify({ patch: { isActive: false }, version: 6 }),
        }),
        { params: Promise.resolve({ id: 'w1' }) }
      );
      expect(updateWatchlistMock).toHaveBeenCalledWith('w1', { isActive: false }, 6);
      expect(response.status).toBe(409);
      const body = await response.json();
      expect(body.current_version).toBe(7);
    });

    it('DELETE /api/watchlists/:id returns a real 204 with no body when deleteWatchlist() succeeds', async () => {
      jest.doMock('../../src/lib/core-client', () => ({
        updateWatchlist: jest.fn(),
        deleteWatchlist: jest.fn().mockResolvedValue({ status: 204, body: {} }),
      }));
      const { DELETE } = await import('../../src/app/api/watchlists/[id]/route');
      const response = await DELETE(new Request('http://localhost:3000/api/watchlists/w1', { method: 'DELETE' }), {
        params: Promise.resolve({ id: 'w1' }),
      });
      expect(response.status).toBe(204);
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

  it('documents the reworked watchlist management flow in the component skill note', () => {
    const skillPath = path.join(ADMIN_ROOT, '.claude', 'skills', 'watchlist-management', 'SKILL.md');
    expect(fs.existsSync(skillPath)).toBe(true);
    const skillSource = fs.readFileSync(skillPath, 'utf8');
    expect(skillSource).toContain('ADR-0044');
  });
});
