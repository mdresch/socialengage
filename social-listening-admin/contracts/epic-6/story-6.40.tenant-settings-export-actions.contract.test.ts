/**
 * Contract: Story 6.40 (ADR-0074) — Tenant settings screen: styled workspace
 * profile, export actions, and offboarding link.
 *
 * Intent:
 *   Story 6.40 — Tenant settings screen: styled workspace profile, export
 *   actions, and offboarding link.
 *   Source ADR: ADR-0074 (Accepted 2026-08-23) — Tenant-Facing Workspace and
 *   Matched-Posts Export.
 *   BRD: BRD-0074 — BRU-001 (tenant_admin only for workspace export),
 *   BRU-002 (both roles for CSV), BRU-003 (platform_admin blocked),
 *   BRU-004 (no secrets in export), BRU-005 (synchronous, capped).
 *   FDD: FDD-0074 §5.3 — UI export actions call real core-client.ts-mediated
 *   endpoints; workspace button disabled (not hidden) for tenant_user; CSV
 *   button available to both roles; no useApp()/exportTenantData() helper.
 *
 * Scope: social-listening-admin/{src/app/tenant/settings/page.tsx (rewritten),
 *   src/lib/core-client.ts (extended — exportWorkspace(), exportPostsCsv()),
 *   src/app/api/tenants/export/workspace/route.ts (new proxy),
 *   src/app/api/posts/export.csv/route.ts (new proxy)}
 *
 * Contract to encode:
 *   AC1: page renders name, domain, activeSeatCount/licenseSeatCount (as
 *        "N of M active"), and createdAt in a styled "Workspace Configuration"
 *        card, using only getMyTenant() data — no mock/fallback.
 *   AC2: page gated only on 'tenant' shell; offboarding section rendered only
 *        when identity.role === 'tenant_admin', linking to /tenant/settings/delete.
 *   AC3: two export buttons — "Export Full Workspace (JSON)" and "Export Matched
 *        Posts (CSV)" — calling real Story 3.16 endpoints via core-client.ts;
 *        disabled (not hidden) with explanatory state when unauthorized or
 *        unreachable.
 *   AC4: export buttons are real links/proxy handlers via core-client.ts, not
 *        any client-side useApp() context or exportTenantData() helper.
 *   AC5: createdAt formatted with toLocaleDateString(); domain renders as plain
 *        text with fallback to "—" when null.
 *   AC6: tenant_admin sees offboarding card + workspace export button;
 *        tenant_user sees settings page but NOT workspace export or offboarding
 *        link; no <form>/<input> edit affordance exists.
 *
 * Explicitly out of scope:
 *   - Re-proving Story 3.16's backend endpoints (workspace JSON assembly, CSV
 *     streaming, size caps) — that's Story 3.16's own contract.
 *   - Editing tenant metadata — this screen remains read-only.
 *   - lucide-react icons — explicitly out of scope per the story.
 *   - Workspace export for tenant_user — BRU-001 restricts it to tenant_admin.
 */

import fs from 'fs';
import path from 'path';

const ADMIN_ROOT = path.resolve(__dirname, '..', '..');

function readSrc(...segments: string[]): string {
  return fs.readFileSync(path.join(ADMIN_ROOT, 'src', ...segments), 'utf8');
}

function srcExists(...segments: string[]): boolean {
  return fs.existsSync(path.join(ADMIN_ROOT, 'src', ...segments));
}

describe('Story 6.40 — Tenant settings screen: styled workspace profile, export actions, and offboarding link', () => {
  const pagePath = ['app', 'tenant', 'settings', 'page.tsx'];

  describe('AC1: renders workspace metadata in styled cards from getMyTenant() only', () => {
    it('reads getMyTenant() for workspace metadata — no mock/fallback', () => {
      const source = readSrc(...pagePath);
      expect(source).toContain('getMyTenant');
    });

    it('renders name, domain, seat counts, and createdAt', () => {
      const source = readSrc(...pagePath);
      expect(source).toMatch(/tenant\.name/);
      expect(source).toMatch(/tenant\.domain/);
      expect(source).toMatch(/tenant\.activeSeatCount/);
      expect(source).toMatch(/tenant\.licenseSeatCount/);
      expect(source).toMatch(/tenant\.createdAt/);
    });

    it('renders seat counts as "N of M active" phrasing', () => {
      const source = readSrc(...pagePath);
      expect(source).toMatch(/active/i);
      // Must show both counts in relation, not raw numbers alone
      expect(source).toMatch(/activeSeatCount.*licenseSeatCount|licenseSeatCount.*activeSeatCount/);
    });
  });

  describe('AC2: gated on tenant shell; offboarding section is tenant_admin-only', () => {
    it("gates only on the 'tenant' shell (Story 6.2), not on a specific role for page access", () => {
      const source = readSrc(...pagePath);
      expect(source).toContain("isShellAllowed(identity, 'tenant')");
    });

    it('renders the offboarding/decommission section only when role === tenant_admin', () => {
      const source = readSrc(...pagePath);
      // The page must conditionally render the offboarding section based on
      // identity.role === 'tenant_admin' — a role-gated affordance, not a
      // role gate on the page itself.
      expect(source).toMatch(/tenant_admin/);
      expect(source).toMatch(/delete|offboard|decommission/i);
    });

    it('links to the existing /tenant/settings/delete page (Story 6.13)', () => {
      const source = readSrc(...pagePath);
      expect(source).toMatch(/\/tenant\/settings\/delete/);
    });
  });

  describe('AC3: two export buttons calling real Story 3.16 endpoints via core-client.ts', () => {
    it('offers an "Export Full Workspace (JSON)" button', () => {
      const source = readSrc(...pagePath);
      expect(source).toMatch(/export.*workspace|workspace.*export/i);
      expect(source).toMatch(/json/i);
    });

    it('offers an "Export Matched Posts (CSV)" button', () => {
      const source = readSrc(...pagePath);
      expect(source).toMatch(/export.*matched.*post|matched.*post.*export|export.*csv|csv.*export/i);
    });

    it('workspace export button is disabled (not hidden) for tenant_user', () => {
      const source = readSrc(...pagePath);
      // The page must conditionally disable the workspace export button for
      // non-tenant_admin, not omit it entirely.
      expect(source).toMatch(/disabled|aria-disabled/i);
    });

    it('references the proxy routes or core-client functions for export, not a client-side helper', () => {
      const source = readSrc(...pagePath);
      // Must NOT use useApp() or exportTenantData() client-side helpers
      expect(source).not.toMatch(/useApp/);
      expect(source).not.toMatch(/exportTenantData/);
    });
  });

  describe('AC4: export buttons are real proxy routes via core-client.ts, not client-side helpers', () => {
    it('core-client.ts has an exportWorkspace() function calling GET /v1/tenants/me/export/workspace', () => {
      const source = readSrc('lib', 'core-client.ts');
      expect(source).toMatch(/exportWorkspace|exportTenantWorkspace/);
      expect(source).toMatch(/\/v1\/tenants\/me\/export\/workspace/);
    });

    it('core-client.ts has an exportPostsCsv() function calling GET /v1/posts?format=csv', () => {
      const source = readSrc('lib', 'core-client.ts');
      expect(source).toMatch(/exportPostsCsv|exportPosts/);
      expect(source).toMatch(/format=csv|format.*csv/);
    });

    it('a same-origin proxy route exists for workspace export', () => {
      expect(srcExists('app', 'api', 'tenants', 'export', 'workspace', 'route.ts')).toBe(true);
    });

    it('a same-origin proxy route exists for posts CSV export', () => {
      expect(
        srcExists('app', 'api', 'posts', 'export.csv', 'route.ts') ||
        srcExists('app', 'api', 'posts', 'export-csv', 'route.ts')
      ).toBe(true);
    });

    it('no useApp() or exportTenantData() client-side helper exists anywhere in src/', () => {
      const offenders: string[] = [];
      const walk = (dir: string) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            walk(full);
            continue;
          }
          if (!full.endsWith('.ts') && !full.endsWith('.tsx')) continue;
          const content = fs.readFileSync(full, 'utf8');
          if (/\buseApp\b/.test(content) || /\bexportTenantData\b/.test(content)) {
            offenders.push(full);
          }
        }
      };
      walk(path.join(ADMIN_ROOT, 'src'));
      expect(offenders).toEqual([]);
    });
  });

  describe('AC5: createdAt formatted with toLocaleDateString(); domain fallback to "—" when null', () => {
    it('formats createdAt with toLocaleDateString()', () => {
      const source = readSrc(...pagePath);
      expect(source).toMatch(/toLocaleDateString/);
    });

    it('domain renders with a fallback to "—" (em dash) when null', () => {
      const source = readSrc(...pagePath);
      // Must handle null domain — either via ?? '—' or a ternary
      expect(source).toMatch(/—|\\u2014|&mdash;|em dash/);
    });
  });

  describe('AC6: no edit affordance; role-gated visibility of workspace export and offboarding', () => {
    it('renders no form, input, or edit affordance anywhere on the screen', () => {
      const source = readSrc(...pagePath);
      expect(source).not.toMatch(/<form/i);
      expect(source).not.toMatch(/<input/i);
    });

    it('does not contain an "edit" affordance for tenant metadata', () => {
      const source = readSrc(...pagePath);
      // "edit" as a verb/action is out of scope — but "edited" or "EditProfile"
      // in comments would be false positives; check for actual edit buttons/links
      expect(source).not.toMatch(/onClick.*edit|edit.*tenant|update.*tenant.*name/i);
    });
  });

  describe('core-client.ts stays the sole Bearer-attachment choke point', () => {
    it('no second ad hoc fetch-with-Authorization-header call exists anywhere else in src/ (outside core-client.ts and auth callback)', () => {
      const offenders: string[] = [];
      const exempt = [
        path.join(ADMIN_ROOT, 'src', 'lib', 'core-client.ts'),
        path.join(ADMIN_ROOT, 'src', 'app', 'api', 'auth', 'callback', 'route.ts'),
        path.join(ADMIN_ROOT, 'src', 'app', 'api', 'auth', 'signup', 'route.ts'),
        path.join(ADMIN_ROOT, 'src', 'lib', 'entra.ts'),
      ];
      const walk = (dir: string) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            walk(full);
            continue;
          }
          if (!full.endsWith('.ts') && !full.endsWith('.tsx')) continue;
          if (exempt.includes(full)) continue;
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

  it('documents this component in a SKILL.md', () => {
    expect(fs.existsSync(path.join(ADMIN_ROOT, '.claude', 'skills', 'tenant-settings', 'SKILL.md'))).toBe(true);
  });
});
