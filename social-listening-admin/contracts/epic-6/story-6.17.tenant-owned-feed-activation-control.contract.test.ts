/**
 * Contract: Story 6.17 — Tenant-wide activate/deactivate control on the
 * tenant-owned-feed connector screen.
 * See docs/user-stories/epic-6-tenant-admin-ui.md#story-617
 *
 * Intent: `tenant-owned-feed` (ADR-0050, Story 2.11/6.12) has two entirely
 * separate pieces of state — per-domain DNS verification
 * (`tenant_owned_feed_activations.status`) and tenant-wide connector
 * activation (`connector_activations.is_active`, ADR-0051, Story 1.11).
 * Nothing anywhere ever bridges them: a tenant can DNS-verify any number
 * of domains and `shouldAttemptIngestion('tenant-owned-feed')` — the live
 * scheduler's own eligibility gate (Story 1.13/ADR-0052) — still always
 * returns `false`, since no `connector_activations` row is ever created
 * for this platform. `tenant-owned-feed` was deliberately excluded from
 * Story 6.3's `PLATFORMS` array (its own two-step DNS flow doesn't fit
 * `ConnectForm`), so it never got Story 6.15's `ActivateDeactivateButton`
 * wiring either — this story closes that gap on its own dedicated screen.
 *
 * Scope: social-listening-admin/{src/app/tenant/connectors/tenant-owned-feed/page.tsx
 * (extended — reads real isActive via the already-existing
 * getConnectorStatus(), computes isTenantAdmin), src/app/tenant/connectors/
 * tenant-owned-feed/TenantOwnedFeedSetup.tsx (extended — renders the
 * already-existing, unmodified ActivateDeactivateButton in the verified
 * state, corrects the previously-unconditional "connected and active"
 * copy)}. Zero backend changes (the generic POST /v1/connectors/:platformId/
 * activate|deactivate, Story 1.11, already accepts any registered
 * platformId) and zero new core-client.ts functions (getConnectorStatus,
 * activatePlatform, deactivatePlatform, ActivateDeactivateButton all
 * already exist, unmodified, from Stories 1.12/6.15).
 *
 * Testing approach — a deliberate, documented split, not a shortcut:
 * page.tsx's own logic (computing isActive/isTenantAdmin and passing them
 * down) is proven with real, behavioral Page() renders — mocked session +
 * mocked fetch, the exact technique story-6.12's and story-6.15's own
 * contracts already established for this codebase. TenantOwnedFeedSetup's
 * *internal* conditional render logic (whether it renders
 * ActivateDeactivateButton, and with what copy, once `verified` is true)
 * is proven structurally (source-pattern checks), because it is a Client
 * Component that calls `useState` — calling it as a bare function outside
 * React's own renderer throws an invalid-hook-call error, and this repo
 * has no React rendering/click-simulation dependency (no
 * @testing-library/react, no react-test-renderer — confirmed by grepping
 * package.json and every existing contract file before writing this one).
 * Story 6.15's own contract already made exactly this same choice, for
 * exactly this same reason, for this same component
 * (`ActivateDeactivateButton`) on two other screens — this is not a new,
 * weaker precedent, it is the existing one applied consistently. What the
 * structural checks actually prove: ActivateDeactivateButton is rendered
 * with `platformId="tenant-owned-feed"` and `ownerType="tenant"` — since
 * that component's own fetch-call behavior (POST to
 * `/api/connectors/${platformId}/${action}` with `{ ownerType }`) is
 * already sealed and proven correct by story-6.15's own contract, keyed
 * purely off those two props, proving the right props are passed is
 * sufficient composition, not a gap.
 *
 * Explicitly out of scope: any change to per-domain verification state
 * (`tenant_owned_feed_activations`) or to `pollTenantOwnedFeed()`/
 * `shouldAttemptIngestion()`/the Story 1.13 scheduler itself — all working
 * exactly as designed; ADR-0051's own Context-section inaccuracy about
 * ADR-0050 (named in the story text, left for a separate dated-note pass);
 * a `story-6.2`-style resolved-identity-migration-ripple block for this
 * screen (a pre-existing gap from Story 6.12, not created or required to
 * be closed here).
 */

import fs from 'fs';
import path from 'path';

const ADMIN_ROOT = path.resolve(__dirname, '..', '..');
const pagePath = ['app', 'tenant', 'connectors', 'tenant-owned-feed', 'page.tsx'];
const setupPath = ['app', 'tenant', 'connectors', 'tenant-owned-feed', 'TenantOwnedFeedSetup.tsx'];

function readSrc(...segments: string[]): string {
  return fs.readFileSync(path.join(ADMIN_ROOT, 'src', ...segments), 'utf8');
}

const TENANT_ADMIN = { type: 'tenant_user' as const, tenantId: 't-1', userId: 'admin-1', role: 'tenant_admin' as const };
const TENANT_USER = { type: 'tenant_user' as const, tenantId: 't-1', userId: 'u-1', role: 'tenant_user' as const };

// Dated correction, 2026-08-17 (Story 6.20/ADR-0057): page.tsx no longer
// takes a searchParams prop — see story-6.12's own matching dated note.
async function renderPageAs(identity: unknown, isActive: boolean) {
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
  jest.spyOn(global, 'fetch').mockResolvedValue(
    new Response(
      JSON.stringify({
        status: 'disconnected',
        lastSuccessfulFetchAt: null,
        lastAttemptAt: null,
        consecutiveFailures: 0,
        credentialStatus: null,
        isActive,
      }),
      { status: 200 }
    )
  );

  const { default: Page } = await import('../../src/app/tenant/connectors/tenant-owned-feed/page');
  return Page();
}

afterEach(() => {
  jest.dontMock('next/headers');
  jest.dontMock('next/navigation');
  jest.resetModules();
  jest.restoreAllMocks();
});

describe('Story 6.17 — tenant-owned-feed connector activation control', () => {
  describe('AC1: page.tsx reads real tenant-wide isActive via the already-existing getConnectorStatus(), no new core-client function', () => {
    it('imports getConnectorStatus from @/lib/core-client', () => {
      const source = readSrc(...pagePath);
      expect(source).toMatch(/import\s*\{[^}]*getConnectorStatus[^}]*\}\s*from\s*['"]@\/lib\/core-client['"]/);
    });

    it('a real Page() render passes the fetched isActive value down to TenantOwnedFeedSetup', async () => {
      const activeElement = await renderPageAs(TENANT_ADMIN, true);
      expect(JSON.stringify(activeElement)).toContain('"isActive":true');

      const inactiveElement = await renderPageAs(TENANT_ADMIN, false);
      expect(JSON.stringify(inactiveElement)).toContain('"isActive":false');
    });

    it('a failed status call degrades to isActive: false rather than crashing the page (mirrors tenant/connectors/page.tsx\'s own loadConnectorState())', async () => {
      jest.resetModules();
      const sessionModule = await import('../../src/lib/session');
      const encrypted = await sessionModule.encryptSession({ idToken: 'x', accessToken: 'y', identity: TENANT_ADMIN });
      jest.doMock('next/headers', () => ({
        cookies: async () => ({
          get: (name: string) => (name === sessionModule.SESSION_COOKIE_NAME ? { value: encrypted } : undefined),
        }),
      }));
      jest.doMock('next/navigation', () => ({ redirect: jest.fn() }));
      jest.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify({ error: 'boom' }), { status: 500 }));

      const { default: Page } = await import('../../src/app/tenant/connectors/tenant-owned-feed/page');
      const element = await Page();
      expect(JSON.stringify(element)).toContain('"isActive":false');
    });
  });

  describe('AC2: TenantOwnedFeedSetup renders the already-existing, unmodified ActivateDeactivateButton with the right props', () => {
    it('imports ActivateDeactivateButton from the sibling connectors directory, not a duplicate', () => {
      const source = readSrc(...setupPath);
      expect(source).toMatch(/import\s*\{\s*ActivateDeactivateButton\s*\}\s*from\s*['"]\.\.\/ActivateDeactivateButton['"]/);
    });

    it('renders it with platformId="tenant-owned-feed" and ownerType="tenant"', () => {
      const source = readSrc(...setupPath);
      expect(source).toMatch(/<ActivateDeactivateButton[\s\S]{0,120}platformId=["']tenant-owned-feed["']/);
      expect(source).toMatch(/<ActivateDeactivateButton[\s\S]{0,160}ownerType=["']tenant["']/);
    });

    it('ActivateDeactivateButton.tsx itself is not modified by this story (Story 6.15\'s own component, reused as-is)', () => {
      const source = fs.readFileSync(path.join(ADMIN_ROOT, 'src', 'app', 'tenant', 'connectors', 'ActivateDeactivateButton.tsx'), 'utf8');
      expect(source).toContain("'use client';");
      expect(source).toContain('callActivation');
    });
  });

  describe('AC3: the control is tenant_admin-only, mirroring connector-activation/SKILL.md\'s documented tenant-wide gate', () => {
    it('TenantOwnedFeedSetup gates ActivateDeactivateButton behind isTenantAdmin', () => {
      const source = readSrc(...setupPath);
      expect(source).toMatch(/isTenantAdmin\s*&&/);
    });

    it('a real Page() render computes isTenantAdmin correctly from the resolved role and passes it down', async () => {
      const adminElement = await renderPageAs(TENANT_ADMIN, false);
      expect(JSON.stringify(adminElement)).toContain('"isTenantAdmin":true');

      const userElement = await renderPageAs(TENANT_USER, false);
      expect(JSON.stringify(userElement)).toContain('"isTenantAdmin":false');
    });
  });

  describe('AC4: no ownerType: "user" control is ever offered on this screen', () => {
    it('TenantOwnedFeedSetup never renders an ownerType="user" ActivateDeactivateButton', () => {
      const source = readSrc(...setupPath);
      expect(source).not.toMatch(/ownerType=["']user["']/);
    });
  });

  describe('AC5: the "verified" copy reflects real activation state, and the activate control is reachable from that same state', () => {
    it('the old unconditional "connected and active" copy no longer renders regardless of isActive', () => {
      const source = readSrc(...setupPath);
      // Must be conditional on isActive now, not a bare unconditional string.
      const unconditional = /return\s*<p role="status">Domain verified — this feed is now connected and active\.<\/p>;/;
      expect(source).not.toMatch(unconditional);
    });

    // Dated correction, 2026-08-17 (Story 6.20/ADR-0057): the single-
    // activation state machine (a top-level `verified`/`activationId`
    // boolean pair, one unconditional "Domain verified..." sentence) is
    // gone by design — replaced by a real per-feed list, each row carrying
    // its own real status pill (StatusBadge). The honest, isActive-
    // conditional copy this AC actually cares about now lives at the list
    // level, not per-row: a banner (`tof-banner-inactive`) that only
    // renders when real feeds exist AND the tenant-wide switch is off —
    // literally the "distinct copy for not-yet-active vs. active" this AC
    // originally proved, just relocated to match the new information
    // architecture ADR-0057 Decision §6 requires. See story-6.20's own
    // contract for full behavioral proof (renderToStaticMarkup, real props).
    it('a real, honest banner distinguishes "feeds exist but connector is off" from the active state — conditional on real isActive, not a bare unconditional string', () => {
      const source = readSrc(...setupPath);
      expect(source).toContain('tof-banner-inactive');
      expect(source.toLowerCase()).toMatch(/currently\s+deactivated/);
      expect(source).toMatch(/!isActive/);
    });

    it('ActivateDeactivateButton is rendered on this same screen, gated tenant_admin-only, not only reachable from a separate screen', () => {
      const source = readSrc(...setupPath);
      expect(source).toMatch(/isTenantAdmin\s*&&[\s\S]{0,200}ActivateDeactivateButton/);
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
    const skillPath = path.join(ADMIN_ROOT, '.claude', 'skills', 'tenant-owned-feed-connector-setup', 'SKILL.md');
    const skillSource = fs.readFileSync(skillPath, 'utf8');
    expect(skillSource).toContain('ActivateDeactivateButton');
    expect(skillSource).toContain('6.17');
  });
});
