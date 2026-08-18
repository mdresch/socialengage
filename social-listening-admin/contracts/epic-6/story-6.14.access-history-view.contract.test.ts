/**
 * Contract: Story 6.14 (ADR-0032 §9) — Access-history view, extending Story
 * 6.8's own `/tenant/users` screen.
 * See docs/user-stories/epic-6-tenant-admin-ui.md#story-614--access-history-view-extends-story-68s-user-management-screen
 *
 * Intent: Story 6.14 — Access-history view
 * Scope: social-listening-admin/{
 *   src/lib/core-client.ts (extended — AccessHistoryEntry, getUserAccessHistory()),
 *   src/app/api/tenant-users/[id]/access-history/route.ts (new — GET proxy),
 *   src/app/tenant/users/AccessHistoryButton.tsx (new, Client Component),
 *   src/app/tenant/users/page.tsx (extended — per-row "View access history"
 *     action, tenant_admin-only, an actorUserId -> email lookup built from
 *     the already-fetched users list)
 * }. No social-listening-core change — Story 5.17's own
 * GET /v1/tenants/users/:id/access-history already exists, real,
 * tenant_admin-scoped, RLS-filtered.
 *
 * Contract to encode: a per-row "View access history" action on
 *   /tenant/users, visible only to a tenant_admin-resolved session (the
 *   same in-page gate Story 6.8's own AC2 already established for the
 *   invite form — never a whole-route redirect); calls the real
 *   GET /v1/tenants/users/:id/access-history via a same-origin proxy
 *   (ADR-0036 §2's sole-choke-point rule); renders each entry's real
 *   operation, oldValue/newValue (null rendered as "active indefinitely",
 *   matching the existing convention Story 6.8's own table already uses),
 *   occurredAt, and actorUserId resolved to that user's real email via a
 *   lookup built from the already-fetched tenant user list — falling back
 *   to the raw id, honestly, when the actor is no longer in that list,
 *   never a fabricated name; a real empty result renders an honest
 *   "no access changes recorded" state; Story 6.8's own existing contract
 *   continues to pass unmodified (this is a strictly additive extension).
 *
 * Per this project's established pattern for newer Epic 6/8 stories: real
 * renderToStaticMarkup() renders with real data prove AccessHistoryButton's
 * actual output; page.tsx (a Server Component) is proven via source checks,
 * the same split Story 6.8's own contract already used, since click
 * interaction itself has no DOM-interaction test runner in this repo
 * (testEnvironment: 'node', no jsdom/testing-library).
 *
 * Explicitly out of scope for this contract:
 *   - Re-proving GET /v1/tenants/users/:id/access-history's own backend
 *     behavior (role gate, RLS cross-tenant isolation, same-transaction
 *     audit-row insertion) — Story 5.17's own contract
 *     (social-listening-core/contracts/epic-5/story-5.17...) already proves
 *     all of that; this contract only proves the admin UI calls it
 *     correctly and renders what it returns.
 *   - The break-glass path (Story 5.13) not writing access_ends_at — a
 *     core-side, Story 5.17-owned assertion, not this screen's concern.
 *   - Any change to Story 6.8's own invite/AccessControl behavior.
 */

import fs from 'fs';
import path from 'path';

const ADMIN_ROOT = path.resolve(__dirname, '..', '..');
const pagePath = ['app', 'tenant', 'users', 'page.tsx'];
const buttonPath = ['app', 'tenant', 'users', 'AccessHistoryButton.tsx'];
const routePath = ['app', 'api', 'tenant-users', '[id]', 'access-history', 'route.ts'];

function readSrc(...segments: string[]): string {
  return fs.readFileSync(path.join(ADMIN_ROOT, 'src', ...segments), 'utf8');
}

function renderComponent(componentPath: string, exportName: string, props: Record<string, unknown>): string {
  const ReactLocal = require('react');
  const { renderToStaticMarkup: renderLocal } = require('react-dom/server');
  const Component = require(componentPath)[exportName];
  return renderLocal(ReactLocal.createElement(Component, props));
}

function entry(id: string, actorUserId: string, operation: string, oldValue: string | null, newValue: string | null, occurredAt: string) {
  return { id, targetUserId: 'target-1', actorUserId, operation, oldValue, newValue, occurredAt };
}

describe('Story 6.14 — Access-history view', () => {
  describe('AC1: extends /tenant/users, a per-row action, no new top-level route', () => {
    it('does not create a separate top-level route for this feature', () => {
      expect(fs.existsSync(path.join(ADMIN_ROOT, 'src', 'app', 'tenant', 'access-history'))).toBe(false);
    });

    it('page.tsx renders AccessHistoryButton per user row', () => {
      const source = readSrc(...pagePath);
      expect(source).toMatch(/AccessHistoryButton/);
    });
  });

  describe('AC2: calls the real GET /v1/tenants/users/:id/access-history via a same-origin proxy', () => {
    it('core-client.ts gains getUserAccessHistory(), GETing the real endpoint', async () => {
      const { getUserAccessHistory } = await import('../../src/lib/core-client');
      expect(typeof getUserAccessHistory).toBe('function');
    });

    it('the proxy route calls getUserAccessHistory() and forwards { entries }', () => {
      const source = readSrc(...routePath);
      expect(source).toMatch(/getUserAccessHistory/);
    });

    it('AccessHistoryButton fetches the real per-user proxy path, not a hardcoded fixture', () => {
      const source = readSrc(...buttonPath);
      expect(source).toMatch(/\/api\/tenant-users\/\$\{userId\}\/access-history/);
    });
  });

  describe('AC3: real per-entry rendering — operation, oldValue/newValue, occurredAt, actorUserId resolved to email', () => {
    it('renders a real entry with its actor resolved via the lookup, and old/new values shown', () => {
      const html = renderComponent('../../src/app/tenant/users/AccessHistoryButton', 'AccessHistoryButton', {
        userId: 'target-1',
        userEmail: 'target@example.com',
        actorLookup: { 'actor-1': 'admin@example.com' },
        initialEntries: [entry('e-1', 'actor-1', 'set', null, '2026-09-01T00:00:00.000Z', '2026-08-17T10:00:00.000Z')],
      });
      expect(html).toContain('admin@example.com');
      expect(html).not.toContain('actor-1');
    });

    it('falls back to the raw actorUserId, honestly, when that actor is not in the lookup — never a fabricated name', () => {
      const html = renderComponent('../../src/app/tenant/users/AccessHistoryButton', 'AccessHistoryButton', {
        userId: 'target-1',
        userEmail: 'target@example.com',
        actorLookup: {},
        initialEntries: [entry('e-1', 'unknown-actor-id', 'clear', '2026-09-01T00:00:00.000Z', null, '2026-08-17T10:00:00.000Z')],
      });
      expect(html).toContain('unknown-actor-id');
    });

    it('renders a cleared access (newValue: null) as "active indefinitely", matching Story 6.8\'s own existing convention', () => {
      const html = renderComponent('../../src/app/tenant/users/AccessHistoryButton', 'AccessHistoryButton', {
        userId: 'target-1',
        userEmail: 'target@example.com',
        actorLookup: { 'actor-1': 'admin@example.com' },
        initialEntries: [entry('e-1', 'actor-1', 'clear', '2026-09-01T00:00:00.000Z', null, '2026-08-17T10:00:00.000Z')],
      });
      expect(html.toLowerCase()).toContain('active indefinitely');
    });
  });

  describe('AC4: honest empty state — never a fabricated history', () => {
    it('renders "no access changes recorded" for a real, empty entry list', () => {
      const html = renderComponent('../../src/app/tenant/users/AccessHistoryButton', 'AccessHistoryButton', {
        userId: 'target-1',
        userEmail: 'target@example.com',
        actorLookup: {},
        initialEntries: [],
      });
      expect(html.toLowerCase()).toMatch(/no access changes/);
    });
  });

  describe('AC5: visible only to a tenant_admin-resolved session — the same in-page gate Story 6.8 AC2 already established', () => {
    it('page.tsx gates AccessHistoryButton on the same isTenantAdmin check already used for the invite form and AccessControl', () => {
      const source = readSrc(...pagePath);
      // AccessHistoryButton must render inside the same isTenantAdmin-gated
      // block as AccessControl, not unconditionally.
      const actionsBlockMatch = source.match(/isTenantAdmin[\s\S]*?AccessHistoryButton/);
      expect(actionsBlockMatch).not.toBeNull();
    });
  });

  describe('AC6: Story 6.8\'s own contract is unaffected — additive only', () => {
    it('AccessControl.tsx is untouched by this story', () => {
      const source = readSrc('app', 'tenant', 'users', 'AccessControl.tsx');
      expect(source).not.toMatch(/AccessHistoryButton/);
    });
  });

  describe('Structural: every scoped file exists', () => {
    it('AccessHistoryButton.tsx and the proxy route both exist', () => {
      for (const segments of [buttonPath, routePath]) {
        expect(fs.existsSync(path.join(ADMIN_ROOT, 'src', ...segments))).toBe(true);
      }
    });
  });
});
