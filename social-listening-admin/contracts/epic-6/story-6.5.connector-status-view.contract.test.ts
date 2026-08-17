/**
 * Contract: Story 6.5 (Phase 1 "also build, not storied") — Connector status
 * view, real rework (fixture data replaced with the real endpoint).
 * See docs/user-stories/epic-6-tenant-admin-ui.md#story-65
 *
 * Intent: Story 6.5 — Connector status view, real rework
 * Scope: social-listening-admin/{src/app/tenant/connectors/status/page.tsx
 *   (rewrite)}. No core-client.ts change — getConnectorStatus() already
 *   returns the full ConnectorHealth shape (status, lastSuccessfulFetchAt,
 *   lastAttemptAt, consecutiveFailures, credentialStatus), added for
 *   Story 6.3.
 *
 * Correction, 2026-08-12: the prior version of this contract (Story 6.5,
 * "Built" 2026-08-05) only did fs.readFileSync + string-literal checks
 * against a hardcoded gnews/newswire/reddit fixture — it could not detect
 * that nothing was ever wired to social-listening-core. This rewrite proves
 * real behavior: a real GET /v1/connectors/:platformId call per connected
 * platform (per Story 6.3's own connected-platform list — no real
 * "list this tenant's connectors" endpoint exists yet, a named, unchanged
 * gap), rendering the real ConnectorHealth shape, a failing connector
 * visually distinguished from degraded/healthy, and no tenant-content data
 * anywhere on the screen.
 *
 * Enhancement, 2026-08-12, later the same day — Menno's own direct request
 * ("could you provide an indicator of inactive or active on the connector
 * page?"), against the connector status page specifically (confirmed via a
 * clarifying question). Previously this screen omitted any platform whose
 * credentialStatus was null (an api_key platform never connected) entirely
 * — a tenant had no way to see that GNews/Azure AI Language/Azure OpenAI
 * even existed as options until connecting one. Now every platform in
 * PLATFORMS is always listed, with a plain "Active"/"Inactive" indicator
 * (derived from the same `connected` boolean loadConnectorStatusRow()
 * already computed) as the primary signal, and the finer ConnectorHealth
 * status (healthy/degraded/failing, or "no ingestion runs yet" for the
 * connected-but-never-polled case) shown as secondary detail only when
 * Active. A real, previously-unnoticed bug fixed in the same pass:
 * loadConnectorStatusRow() discarded the already-fetched ConnectorHealth
 * object for any unconnected platform (`health: connected ? health : null`)
 * even though the fetch had already succeeded — wasteful and now actively
 * wrong once inactive platforms are rendered too, since their real
 * lastSuccessfulFetchAt/lastAttemptAt/consecutiveFailures fields (all
 * legitimately null/zero, not fixture data) are worth showing.
 *
 * Explicitly out of scope for this contract:
 *   - Re-proving GET /v1/connectors/:platformId's own backend behavior
 *     (health derivation, ADR-0009/ADR-0022/ADR-0023) — Story 4.3's own
 *     contract already proves that; this contract only proves the admin UI
 *     calls it correctly and renders what it returns.
 *   - AC2 (surfacing resolveWatchlistAstDispatch()'s unsupportedNodeTypes
 *     per watchlist/connector pair) — a REAL, CONFIRMED GAP found while
 *     scoping this rework, not silently dropped: resolveWatchlistAstDispatch()
 *     (social-listening-core/src/watchlists/dispatch.ts) is a core-internal
 *     function with no REST endpoint exposing its result anywhere — its own
 *     doc comment says as much ("no such view exists yet, so this is proven
 *     at the data level only," Story 3.6 AC2). Building one is real,
 *     non-trivial social-listening-core scope (a new endpoint design, not
 *     "just call an existing one") — outside this story's own Source line
 *     (Story 4.3's ConnectorHealth only) and outside social-listening-admin
 *     entirely. Flagged here and in the story's own dated note as a named,
 *     deferred gap for a future story, the same treatment already given to
 *     the "no list-all-connectors endpoint" gap this story's own text names.
 *   - Client-side interactive rendering — this screen has no forms/mutations
 *     at all (read-only), so no Route Handler / mocked-DOM-interaction split
 *     is needed the way Stories 6.3/6.4/6.8 required; real behavior is
 *     proven via a real-session-plus-fetch-mocking render test (the same
 *     pattern story-6.2.resolved-identity-migration-ripple...'s own upgraded
 *     blocks already use), plus structural source checks.
 *
 * Healing pass, 2026-08-17 (Menno's explicit sign-off, same session as
 * Story 8.1): `tenant/connectors/status/page.tsx` was split into a thin
 * Server Component (data-fetching, gating, the `PLATFORMS` list) and a new
 * `ConnectorStatusClient.tsx` Client Component, which now owns every
 * rendering concern this contract checks (the health-field display, the
 * failing-status branch, the "every platform always listed" map, the
 * watchlist-compatibility gap notice). Assertions below that read
 * page.tsx's own source now read ConnectorStatusClient.tsx instead,
 * verified present, not assumed identical, before repointing. Two genuine
 * reconciliations, not relocations: (1) the Active/Inactive label is now
 * the shared `StatusBadge` component (`src/components/ui`), whose variants
 * are `'inactive'` ("Paused", matching `frontend-design-specification.md`
 * §6.1's own documented "watchlist or connector paused" semantics) and,
 * once active, the real, richer `healthy`/`degraded`/`failing` health
 * status rather than a flat "Active" — a strictly more informative signal
 * for a screen literally named "Connector Health & Telemetry," fully
 * consistent with this story's own AC3 ("a failing connector visually
 * distinguished from degraded/healthy"); (2) `JSON.stringify(await Page())`
 * only serializes the raw `rows` prop data passed to
 * `ConnectorStatusClient` (a Client Component, never actually invoked by
 * this technique — proven independently while building Story 8.1) — real
 * rendered-markup assertions below use `renderToStaticMarkup` on
 * `ConnectorStatusClient` directly instead, the same pattern Story 6.15's
 * own healing pass this same session already established.
 */

import fs from 'fs';
import path from 'path';

const ADMIN_ROOT = path.resolve(__dirname, '..', '..');
const pagePath = ['app', 'tenant', 'connectors', 'status', 'page.tsx'];
const clientPath = ['app', 'tenant', 'connectors', 'status', 'ConnectorStatusClient.tsx'];

function readSrc(...segments: string[]): string {
  return fs.readFileSync(path.join(ADMIN_ROOT, 'src', ...segments), 'utf8');
}

function renderComponent(componentPath: string, exportName: string, props: Record<string, unknown>): string {
  const ReactLocal = require('react');
  const { renderToStaticMarkup: renderLocal } = require('react-dom/server');
  const Component = require(componentPath)[exportName];
  return renderLocal(ReactLocal.createElement(Component, props));
}

describe('Story 6.5 — connector status view, real rework (2026-08-12, re-healed 2026-08-17)', () => {
  describe('AC1: a real GET /v1/connectors/:platformId call per platform (connected or not), no fixture data', () => {
    it('creates the /tenant/connectors/status screen route', () => {
      expect(fs.existsSync(path.join(ADMIN_ROOT, 'src', ...pagePath))).toBe(true);
    });

    it('calls getConnectorStatus() (a real backend call), not a hardcoded fixture array', () => {
      const source = readSrc(...pagePath);
      expect(source).toContain('getConnectorStatus');
      expect(source).not.toMatch(/status:\s*['"]healthy['"],/);
      expect(source).not.toContain('reddit');
    });

    it('renders the real ConnectorHealth fields — lastSuccessfulFetchAt, lastAttemptAt, consecutiveFailures', () => {
      const source = readSrc(...clientPath);
      expect(source).toMatch(/lastSuccessfulFetchAt/);
      expect(source).toMatch(/lastAttemptAt/);
      expect(source).toMatch(/consecutiveFailures/);
    });
  });

  describe('AC2 (real gap, named not silently dropped): unsupportedNodeTypes has no backend endpoint to call', () => {
    it('the screen names the gap in its own copy rather than rendering fake compatibility warnings', () => {
      const source = readSrc(...clientPath);
      expect(source.toLowerCase()).toMatch(/not (shown|available) (here )?yet|deferred|no endpoint/);
    });
  });

  describe('AC3: a failing connector is visually distinguished from degraded/healthy', () => {
    it('the failing branch renders materially different markup/copy than the default status text', () => {
      const source = readSrc(...clientPath);
      expect(source).toMatch(/failing/);
      // The old fixture rendered every status the same way (`{connector.status}`
      // alone) — assert a real conditional branch exists for the failing case.
      expect(source).toMatch(/status\s*===\s*['"]failing['"]/);
    });

    it('a real render gives a failing connector a distinct data-variant/card class from a healthy one', () => {
      const rows = [
        { platform: { id: 'gnews', name: 'GNews API', authMode: 'api_key', category: 'Ingestion', description: 'x' }, isActive: true, health: { status: 'failing', lastSuccessfulFetchAt: null, lastAttemptAt: null, consecutiveFailures: 4, credentialStatus: 'valid', isActive: true } },
        { platform: { id: 'newswire', name: 'Global Newswire Feeds', authMode: 'none', category: 'Ingestion', description: 'x' }, isActive: true, health: { status: 'healthy', lastSuccessfulFetchAt: null, lastAttemptAt: null, consecutiveFailures: 0, credentialStatus: null, isActive: true } },
      ];
      const html = renderComponent('../../src/app/tenant/connectors/status/ConnectorStatusClient', 'ConnectorStatusClient', { rows, isTenantAdmin: false });
      expect(html).toContain('data-variant="failing"');
      expect(html).toContain('data-variant="healthy"');
      expect(html).toContain('cs-card-failing');
    });
  });

  describe('AC6 (added 2026-08-12): every platform is always listed, with a plain Active/Inactive indicator', () => {
    it('renders every platform, not filtered down to connected-only', () => {
      const source = readSrc(...clientPath);
      // The old anti-pattern filtered to a connectedRows subset before
      // rendering — assert that filter is gone and rows itself is mapped.
      expect(source).not.toMatch(/connectedRows/);
      expect(source).toMatch(/rows\.map/);
    });

    // 2026-08-17: reconciled from a literal "Inactive"/"Active" text
    // expectation to the real, shared StatusBadge variant this screen
    // actually renders — see this file's own 2026-08-17 healing note.
    it("renders the shared StatusBadge's 'inactive' variant for an inactive platform, 'healthy'/'degraded'/'failing' (never a flat 'active') once active, driven by real isActive/health.status", () => {
      const source = readSrc(...clientPath);
      expect(source).toMatch(/!row\.isActive|!isActive/);
      expect(source).toContain('StatusBadge');
    });

    it("loadConnectorStatusRow() keeps the real fetched health for every platform, never discarding it for an inactive one", () => {
      const source = readSrc(...pagePath);
      expect(source).not.toMatch(/health:\s*isActive\s*\?\s*health\s*:\s*null/);
    });
  });

  describe('AC4: no tenant-content data (post text, raw payload) is shown', () => {
    it('the screen renders no post/watchlist content fields', () => {
      const source = readSrc(...clientPath);
      expect(source).not.toMatch(/rawPayload|post\.text|watchlist\.query/);
    });
  });

  describe('AC5: this contract makes real behavioral assertions (a real page render, real fetch mocking), not source-string-containment alone', () => {
    afterEach(() => {
      jest.dontMock('next/headers');
      jest.dontMock('next/navigation');
      jest.resetModules();
      jest.restoreAllMocks();
    });

    async function renderStatusPageAs(fetchImpl: (url: string) => Response) {
      jest.resetModules();
      const sessionModule = await import('../../src/lib/session');
      const identity = { type: 'tenant_user' as const, tenantId: 't-1', userId: 'u-1', role: 'tenant_user' as const };
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

      jest.spyOn(global, 'fetch').mockImplementation(async (input: RequestInfo | URL) => fetchImpl(String(input)));

      const { default: Page } = await import('../../src/app/tenant/connectors/status/page');
      return Page;
    }

    it('renders a real failing status from a real mocked GET /v1/connectors/gnews response, no fixture text', async () => {
      // 2026-08-12 (Story 6.15): isActive: true added — the failing/⚠
      // branch only renders when active (health data still shown either
      // way, but this test's own intent is "an active, failing connector",
      // a real, meaningful scenario, not an inactive one that happens to
      // have failing runs in its history).
      const Page = await renderStatusPageAs((url) => {
        if (url.includes('/v1/connectors/gnews')) {
          return new Response(
            JSON.stringify({ status: 'failing', lastSuccessfulFetchAt: '2026-08-01T00:00:00.000Z', lastAttemptAt: '2026-08-12T00:00:00.000Z', consecutiveFailures: 4, credentialStatus: 'valid', isActive: true }),
            { status: 200 }
          );
        }
        return new Response(
          JSON.stringify({ status: 'disconnected', lastSuccessfulFetchAt: null, lastAttemptAt: null, consecutiveFailures: 0, credentialStatus: null, isActive: false }),
          { status: 200 }
        );
      });

      const element = await Page();
      const rendered = JSON.stringify(element);
      expect(rendered).toContain('GNews');
      expect(rendered).toContain('failing');
      expect(rendered).not.toContain('Breaking news');
      expect(rendered).not.toContain('healthy');
    });

    it('an api_key platform whose credentialStatus is null is still listed, marked isActive: false (never omitted)', async () => {
      const Page = await renderStatusPageAs(() =>
        new Response(
          JSON.stringify({ status: 'disconnected', lastSuccessfulFetchAt: null, lastAttemptAt: null, consecutiveFailures: 0, credentialStatus: null, isActive: false }),
          { status: 200 }
        )
      );

      const element = await Page();
      const rendered = JSON.stringify(element);
      // All four platforms are always listed now — never omitted. Real
      // props data (platform.name, isActive), the part JSON.stringify(Page())
      // can actually see — see this file's own 2026-08-17 healing note on
      // why the rendered "Paused"/health-variant text itself needs a real
      // ConnectorStatusClient render instead (the next test, below).
      expect(rendered).toContain('Newswire');
      expect(rendered).toContain('GNews');
      expect(rendered).toContain('Azure AI Language');
      expect(rendered).toContain('Azure OpenAI Service');
      expect(rendered).toMatch(/"isActive":false/);
    });

    it('a real render of ConnectorStatusClient shows the shared StatusBadge "Paused" label for every inactive platform, never a fabricated Active state', () => {
      const rows = [
        { platform: { id: 'gnews', name: 'GNews API', authMode: 'api_key', category: 'Ingestion', description: 'x' }, isActive: false, health: { status: 'disconnected', lastSuccessfulFetchAt: null, lastAttemptAt: null, consecutiveFailures: 0, credentialStatus: null } },
        { platform: { id: 'newswire', name: 'Global Newswire Feeds', authMode: 'none', category: 'Ingestion', description: 'x' }, isActive: false, health: { status: 'disconnected', lastSuccessfulFetchAt: null, lastAttemptAt: null, consecutiveFailures: 0, credentialStatus: null } },
        { platform: { id: 'azure-ai-language', name: 'Azure AI Language', authMode: 'api_key', category: 'Enrichment', description: 'x' }, isActive: false, health: { status: 'disconnected', lastSuccessfulFetchAt: null, lastAttemptAt: null, consecutiveFailures: 0, credentialStatus: null } },
        { platform: { id: 'azure-openai', name: 'Azure OpenAI Service', authMode: 'api_key', category: 'Enrichment', description: 'x' }, isActive: false, health: { status: 'disconnected', lastSuccessfulFetchAt: null, lastAttemptAt: null, consecutiveFailures: 0, credentialStatus: null } },
      ];
      const html = renderComponent('../../src/app/tenant/connectors/status/ConnectorStatusClient', 'ConnectorStatusClient', { rows, isTenantAdmin: true });
      expect(html).toContain('Newswire');
      expect(html).toContain('GNews');
      expect((html.match(/data-variant="inactive"/g) ?? []).length).toBe(4);
      expect(html).not.toMatch(/data-variant="(healthy|degraded|failing)"/);
    });

    // 2026-08-12 (Story 6.15, ADR-0051): this assertion previously read
    // "newswire (authMode 'none') always renders Active, regardless of
    // credentialStatus" — real, deliberate behavior under this story's own
    // original (pre-ADR-0051) model, where authMode === 'none' alone meant
    // "always on." ADR-0051 named this exact behavior as Bug 1 (the
    // Newswire always-active bug) and Story 6.15 replaced the Active/
    // Inactive derivation with the real, persisted isActive field
    // (Story 1.12) — so this is now the OPPOSITE of correct behavior, not
    // a coincidental drift. Rewritten with this dated note per this
    // project's "regression, not rewrite" convention, not silently changed.
    it('newswire (authMode "none") is fetched with isActive: false by default — isActive drives the label, not authMode alone', async () => {
      const Page = await renderStatusPageAs(() =>
        new Response(
          JSON.stringify({ status: 'disconnected', lastSuccessfulFetchAt: null, lastAttemptAt: null, consecutiveFailures: 0, credentialStatus: null, isActive: false }),
          { status: 200 }
        )
      );

      const element = await Page();
      const rendered = JSON.stringify(element);
      expect(rendered).toMatch(/"isActive":false/);
    });

    it('a real render shows newswire (authMode "none") as inactive by default, healthy once isActive is real and true — never derived from authMode alone', () => {
      const inactiveRows = [{ platform: { id: 'newswire', name: 'Global Newswire Feeds', authMode: 'none', category: 'Ingestion', description: 'x' }, isActive: false, health: { status: 'disconnected', lastSuccessfulFetchAt: null, lastAttemptAt: null, consecutiveFailures: 0, credentialStatus: null } }];
      const inactiveHtml = renderComponent('../../src/app/tenant/connectors/status/ConnectorStatusClient', 'ConnectorStatusClient', { rows: inactiveRows, isTenantAdmin: false });
      expect(inactiveHtml).toContain('data-variant="inactive"');

      const activeRows = [{ platform: { id: 'newswire', name: 'Global Newswire Feeds', authMode: 'none', category: 'Ingestion', description: 'x' }, isActive: true, health: { status: 'healthy', lastSuccessfulFetchAt: null, lastAttemptAt: null, consecutiveFailures: 0, credentialStatus: null } }];
      const activeHtml = renderComponent('../../src/app/tenant/connectors/status/ConnectorStatusClient', 'ConnectorStatusClient', { rows: activeRows, isTenantAdmin: false });
      expect(activeHtml).toContain('data-variant="healthy"');
      expect(activeHtml).not.toContain('data-variant="inactive"');
    });

    it('a connected platform with real lastSuccessfulFetchAt/lastAttemptAt/consecutiveFailures data renders those real values, not discarded (the loadConnectorStatusRow() fix)', async () => {
      const Page = await renderStatusPageAs((url) => {
        if (url.includes('/v1/connectors/gnews')) {
          return new Response(
            JSON.stringify({ status: 'healthy', lastSuccessfulFetchAt: '2026-08-11T09:00:00.000Z', lastAttemptAt: '2026-08-12T09:00:00.000Z', consecutiveFailures: 0, credentialStatus: 'valid', isActive: true }),
            { status: 200 }
          );
        }
        return new Response(
          JSON.stringify({ status: 'disconnected', lastSuccessfulFetchAt: null, lastAttemptAt: null, consecutiveFailures: 0, credentialStatus: null, isActive: false }),
          { status: 200 }
        );
      });

      const element = await Page();
      const rendered = JSON.stringify(element);
      expect(rendered).toContain('2026-08-11T09:00:00.000Z');
      expect(rendered).toContain('2026-08-12T09:00:00.000Z');
    });
  });

  describe('core-client.ts stays the sole Bearer-attachment choke point (re-checked after this story\'s changes)', () => {
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

  it('documents the reworked connector status flow in the component skill note', () => {
    const skillPath = path.join(ADMIN_ROOT, '.claude', 'skills', 'connector-status-view', 'SKILL.md');
    expect(fs.existsSync(skillPath)).toBe(true);
    const skillSource = fs.readFileSync(skillPath, 'utf8');
    expect(skillSource).toContain('resolveWatchlistAstDispatch');
  });
});
