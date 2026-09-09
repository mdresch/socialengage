/**
 * Contract: Story 13.6 (ADR-0112, BRD-0112, FDD-0112) — Plan and seat management UI (frontend).
 * See docs/user-stories/epic-13-adr-0109-to-0117.md#story-136
 *
 * Intent:
 *   Provide a tenant-facing plan/seat view and a Platform-Admin plan/seat edit surface.
 *   Reuse the backend endpoints from Story 13.5:
 *     - GET /v1/tenants/plan for the caller's own tenant view.
 *     - GET /v1/admin/tenants/:tenantId/plan for a Platform-Admin to read a specific tenant's plan.
 *     - PATCH /v1/admin/tenants/:tenantId for a Platform-Admin to update plan and featureGates.
 *
 * Scope:
 *   - social-listening-admin/contracts/epic-13/story-13.6.plan-and-seat-management-ui.contract.test.ts
 *   - social-listening-admin/src/lib/core-client.ts (getMyPlan, getAdminTenantPlan, updateAdminTenant input)
 *   - social-listening-admin/src/app/api/admin/tenants/[tenantId]/route.ts (forward plan/featureGates)
 *   - social-listening-admin/src/app/api/admin/tenants/[tenantId]/plan/route.ts (GET proxy)
 *   - social-listening-admin/src/components/plan/PlanSelector.tsx
 *   - social-listening-admin/src/components/plan/FeatureToggleList.tsx
 *   - social-listening-admin/src/components/plan/SeatUsageCard.tsx
 *   - social-listening-admin/src/app/tenant/plan/page.tsx
 *   - social-listening-admin/src/app/platform-admin/tenants/[tenantId]/plan/page.tsx
 *   - social-listening-admin/src/app/platform-admin/tenants/[tenantId]/plan/TenantPlanForm.tsx
 *   - social-listening-admin/src/app/platform-admin/page.tsx (per-tenant plan link)
 *   - social-listening-admin/src/components/shell/AppSidebar.tsx (tenant nav link)
 *   - social-listening-admin/.claude/skills/plan-management/SKILL.md
 *   - social-listening-core/src/http/versions/v1/adminTenantsRouter.ts (GET /:id/plan)
 *   - social-listening-core/src/tenants/tenantStore.ts (getAdminTenantPlan)
 *   - social-listening-core/.claude/skills/feature-gating/SKILL.md
 *
 * Contract to encode:
 *   (1) /tenant/plan is a tenant-shell-gated Server Component that reads GET /v1/tenants/plan
 *       and renders plan, used/max seats, effective feature gates, and upgrade messaging.
 *   (2) /platform-admin/tenants/:tenantId/plan is a platform-admin-gated Server Component
 *       that reads GET /v1/admin/tenants/:tenantId/plan and mounts an editable form.
 *   (3) The Platform-Admin form uses reusable PlanSelector, FeatureToggleList, and SeatUsageCard
 *       components; it validates max_seats >= 1 and PATCHes /api/admin/tenants/:tenantId with
 *       plan and featureGates.
 *   (4) The BFF proxies forward calls correctly and never expose activeSeatCount to the client.
 *   (5) core-client.ts remains the sole bearer-token attachment point.
 *
 * Explicitly out of scope:
 *   - Re-proving Story 13.5's backend seat/feature-gate behavior (proven in core contract).
 *   - Billing, invoicing, or plan definitions beyond the existing PLANS table.
 *   - Client-side interactive/DOM rendering — this repo uses node test environment and
 *     structural/Route Handler/core-client unit tests.
 */

import fs from 'fs';
import path from 'path';
import { randomBytes } from 'crypto';

const ADMIN_ROOT = path.resolve(__dirname, '..', '..');
const CORE_ROOT = path.resolve(ADMIN_ROOT, '..', 'social-listening-core');

function readAdminSrc(...segments: string[]): string {
  return fs.readFileSync(path.join(ADMIN_ROOT, 'src', ...segments), 'utf8');
}

function readCoreSrc(...segments: string[]): string {
  return fs.readFileSync(path.join(CORE_ROOT, 'src', ...segments), 'utf8');
}

if (!process.env.CORE_API_BASE_URL) {
  process.env.CORE_API_BASE_URL = 'http://localhost:3001';
}
if (!process.env.SESSION_SECRET) {
  process.env.SESSION_SECRET = randomBytes(32).toString('base64');
}

describe('Story 13.6 — Plan and seat management UI (frontend)', () => {
  describe('Core backend exposes a Platform-Admin plan read endpoint', () => {
    it('adminTenantsRouter adds GET /:id/plan using getAdminTenantPlan', () => {
      const source = readCoreSrc('http', 'versions', 'v1', 'adminTenantsRouter.ts');
      expect(source).toMatch(/GET\s+\/v1\/admin\/tenants\/:id\/plan/i);
      expect(source).toMatch(/\/admin\/tenants\/:\s*id\s*\/\s*plan/i);
      expect(source).toContain('getAdminTenantPlan');
      expect(source).toContain('requirePlatformAdmin');
    });

    it('tenantStore exports getAdminTenantPlan that returns TenantPlanView', () => {
      const source = readCoreSrc('tenants', 'tenantStore.ts');
      expect(source).toContain('export async function getAdminTenantPlan');
      expect(source).toContain('TenantPlanView');
      expect(source).toMatch(/getPlatformAdminPool\(\)/);
    });
  });

  describe('AC1: /tenant/plan shows the caller their plan, seat usage, feature gates, and upgrade messaging', () => {
    const pagePath = ['app', 'tenant', 'plan', 'page.tsx'];

    it('creates the /tenant/plan screen route', () => {
      expect(fs.existsSync(path.join(ADMIN_ROOT, 'src', ...pagePath))).toBe(true);
    });

    it('is gated on the tenant shell and calls getMyPlan()', () => {
      const source = readAdminSrc(...pagePath);
      expect(source).toContain("isShellAllowed(identity, 'tenant')");
      expect(source).toContain('getMyPlan');
    });

    it('renders plan, used seats, max seats, and license seat count', () => {
      const source = readAdminSrc(...pagePath);
      expect(source).toMatch(/plan\.plan/);
      expect(source).toMatch(/plan\.usedSeats/);
      expect(source).toMatch(/plan\.maxSeats/);
      expect(source).toMatch(/plan\.licenseSeatCount/);
    });

    it('renders effective feature gates with disabled/upgrade messaging', () => {
      const source = readAdminSrc(...pagePath);
      expect(source).toMatch(/featureGates/);
      expect(source).toMatch(/Upgrade|upgrade/);
      expect(source).toMatch(/disabled|gated/);
    });

    it('shows seat-limit upgrade messaging when used >= max', () => {
      const source = readAdminSrc(...pagePath);
      expect(source).toMatch(/(?:plan\.)?usedSeats\s*>=\s*(?:plan\.)?maxSeats|(?:plan\.)?maxSeats\s*<=\s*(?:plan\.)?usedSeats/);
      expect(source).toMatch(/seat\s*limit|Seat\s*limit/);
    });
  });

  describe('AC2: /platform-admin/tenants/:tenantId/plan lets a Platform-Admin view and edit a tenant plan', () => {
    const pagePath = ['app', 'platform-admin', 'tenants', '[tenantId]', 'plan', 'page.tsx'];

    it('creates the Platform-Admin tenant plan route', () => {
      expect(fs.existsSync(path.join(ADMIN_ROOT, 'src', ...pagePath))).toBe(true);
    });

    it('is gated on the platform-admin shell and calls getAdminTenantPlan()', () => {
      const source = readAdminSrc(...pagePath);
      expect(source).toContain("isShellAllowed(identity, 'platform-admin')");
      expect(source).toContain('getAdminTenantPlan');
    });

    it('mounts a TenantPlanForm client component with the plan data', () => {
      const source = readAdminSrc(...pagePath);
      expect(source).toContain('TenantPlanForm');
      expect(source).toMatch(/tenantId/);
      expect(source).toMatch(/initialPlan/);
    });

    const formPath = ['app', 'platform-admin', 'tenants', '[tenantId]', 'plan', 'TenantPlanForm.tsx'];

    it('the form is a client component that submits to /api/admin/tenants/:tenantId', () => {
      const source = readAdminSrc(...formPath);
      expect(source).toContain("'use client'");
      expect(source).toMatch(/fetch\(`\/api\/admin\/tenants\/\$\{/);
      expect(source).toMatch(/method:\s*['"]PATCH['"]/);
    });

    it('the form sends plan and featureGates with max_seats', () => {
      const source = readAdminSrc(...formPath);
      expect(source).toMatch(/plan/);
      expect(source).toMatch(/featureGates/);
      expect(source).toMatch(/max_seats/);
    });

    it('the form validates max_seats >= 1 and requires a plan', () => {
      const source = readAdminSrc(...formPath);
      expect(source).toMatch(/min\s*=\s*\{\s*1\s*\}|min\s*=\s*['"]1['"]/);
      expect(source).toMatch(/required/);
      expect(source).toMatch(/Number\(.*max_seats.*\)|Number\(.*maxSeats.*\)/);
    });
  });

  describe('AC3: Reusable plan management components exist', () => {
    const planSelector = ['components', 'plan', 'PlanSelector.tsx'];
    const featureToggle = ['components', 'plan', 'FeatureToggleList.tsx'];
    const seatUsage = ['components', 'plan', 'SeatUsageCard.tsx'];

    it('PlanSelector renders starter/pro/enterprise options', () => {
      expect(fs.existsSync(path.join(ADMIN_ROOT, 'src', ...planSelector))).toBe(true);
      const source = readAdminSrc(...planSelector);
      expect(source).toContain('starter');
      expect(source).toContain('pro');
      expect(source).toContain('enterprise');
      expect(source).toMatch(/<select/);
    });

    it('FeatureToggleList renders feature toggles with a known feature key list', () => {
      expect(fs.existsSync(path.join(ADMIN_ROOT, 'src', ...featureToggle))).toBe(true);
      const source = readAdminSrc(...featureToggle);
      expect(source).toMatch(/featureGates/);
      expect(source).toMatch(/checkbox|type\s*=\s*['"]checkbox['"]/);
      expect(source).toMatch(/ai_assist|analytics_dashboard|multi_user/);
    });

    it('SeatUsageCard displays used and max seats', () => {
      expect(fs.existsSync(path.join(ADMIN_ROOT, 'src', ...seatUsage))).toBe(true);
      const source = readAdminSrc(...seatUsage);
      expect(source).toMatch(/usedSeats/);
      expect(source).toMatch(/maxSeats/);
      expect(source).toMatch(/\bof\b/);
    });

    it('the form uses all three reusable components', () => {
      const source = readAdminSrc('app', 'platform-admin', 'tenants', '[tenantId]', 'plan', 'TenantPlanForm.tsx');
      expect(source).toContain('PlanSelector');
      expect(source).toContain('FeatureToggleList');
      expect(source).toContain('SeatUsageCard');
    });
  });

  describe('BFF proxies forward plan calls safely', () => {
    afterEach(() => {
      jest.dontMock('../../src/lib/core-client');
      jest.resetModules();
      jest.restoreAllMocks();
    });

    it('GET /api/admin/tenants/:tenantId/plan calls getAdminTenantPlan()', async () => {
      const getAdminTenantPlanMock = jest.fn().mockResolvedValue({
        plan: 'pro',
        maxSeats: 25,
        usedSeats: 3,
        licenseSeatCount: 25,
        featureGates: { multi_user: true },
      });
      jest.doMock('../../src/lib/core-client', () => ({ getAdminTenantPlan: getAdminTenantPlanMock }));
      const { GET } = await import('../../src/app/api/admin/tenants/[tenantId]/plan/route');
      const response = await GET(
        new Request('http://localhost:3000/api/admin/tenants/t-1/plan'),
        { params: Promise.resolve({ tenantId: 't-1' }) }
      );
      expect(getAdminTenantPlanMock).toHaveBeenCalledWith('t-1');
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.plan).toBe('pro');
    });

    it('PATCH /api/admin/tenants/:tenantId forwards plan and featureGates', async () => {
      const updateAdminTenantMock = jest.fn().mockResolvedValue({
        status: 200,
        body: { id: 't-1', plan: 'pro', featureGates: { max_seats: 25, multi_user: true } },
      });
      jest.doMock('../../src/lib/core-client', () => ({ updateAdminTenant: updateAdminTenantMock }));
      const { PATCH } = await import('../../src/app/api/admin/tenants/[tenantId]/route');
      const response = await PATCH(
        new Request('http://localhost:3000/api/admin/tenants/t-1', {
          method: 'PATCH',
          body: JSON.stringify({ plan: 'pro', featureGates: { max_seats: 25, multi_user: true } }),
        }),
        { params: Promise.resolve({ tenantId: 't-1' }) }
      );
      expect(updateAdminTenantMock).toHaveBeenCalledWith('t-1', {
        plan: 'pro',
        featureGates: { max_seats: 25, multi_user: true },
      });
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.plan).toBe('pro');
    });

    it('PATCH /api/admin/tenants/:tenantId still rejects activeSeatCount', async () => {
      const updateAdminTenantMock = jest.fn();
      jest.doMock('../../src/lib/core-client', () => ({ updateAdminTenant: updateAdminTenantMock }));
      const { PATCH } = await import('../../src/app/api/admin/tenants/[tenantId]/route');
      const response = await PATCH(
        new Request('http://localhost:3000/api/admin/tenants/t-1', {
          method: 'PATCH',
          body: JSON.stringify({ activeSeatCount: 999 }),
        }),
        { params: Promise.resolve({ tenantId: 't-1' }) }
      );
      expect(updateAdminTenantMock).not.toHaveBeenCalled();
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toMatch(/activeSeatCount/);
    });
  });

  describe('core-client.ts exposes getMyPlan and getAdminTenantPlan', () => {
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

    it('getMyPlan() GETs /v1/tenants/plan with the session bearer token', async () => {
      const outcome = await withAuthenticatedFetch(async (fetchSpy) => {
        fetchSpy.mockResolvedValue(
          new Response(
            JSON.stringify({
              plan: 'pro',
              maxSeats: 25,
              usedSeats: 3,
              licenseSeatCount: 25,
              featureGates: { multi_user: true },
            }),
            { status: 200 }
          )
        );
        const { getMyPlan } = await import('../../src/lib/core-client');
        return getMyPlan();
      });
      expect(outcome.plan).toBe('pro');
      expect(outcome.maxSeats).toBe(25);
      expect(outcome.usedSeats).toBe(3);
    });

    it('getAdminTenantPlan() GETs /v1/admin/tenants/:tenantId/plan with the session bearer token', async () => {
      const outcome = await withAuthenticatedFetch(async (fetchSpy) => {
        fetchSpy.mockResolvedValue(
          new Response(
            JSON.stringify({
              plan: 'enterprise',
              maxSeats: 100,
              usedSeats: 12,
              licenseSeatCount: 100,
              featureGates: { compliance_packs: true },
            }),
            { status: 200 }
          )
        );
        const { getAdminTenantPlan } = await import('../../src/lib/core-client');
        return getAdminTenantPlan('t-1');
      });
      expect(outcome.plan).toBe('enterprise');
      expect(outcome.maxSeats).toBe(100);
    });

    it('updateAdminTenant() accepts plan and featureGates in the PATCH body', async () => {
      const outcome = await withAuthenticatedFetch(async (fetchSpy) => {
        fetchSpy.mockResolvedValue(
          new Response(
            JSON.stringify({
              id: 't-1',
              plan: 'pro',
              featureGates: { max_seats: 25, multi_user: true },
            }),
            { status: 200 }
          )
        );
        const { updateAdminTenant } = await import('../../src/lib/core-client');
        return updateAdminTenant('t-1', { plan: 'pro', featureGates: { max_seats: 25, multi_user: true } });
      });
      expect(outcome.status).toBe(200);
      expect(outcome.body.plan).toBe('pro');
    });
  });

  describe('Navigation and skill surfaces point to the new pages', () => {
    it('the tenant sidebar includes a link to /tenant/plan', () => {
      const source = readAdminSrc('components', 'shell', 'AppSidebar.tsx');
      expect(source).toMatch(/href[:=]\s*['"]\/tenant\/plan['"]/);
    });

    it('the platform-admin console links each tenant to its plan page', () => {
      const source = readAdminSrc('app', 'platform-admin', 'page.tsx');
      expect(source).toMatch(/platform-admin\/tenants/);
      expect(source).toMatch(/plan|Plan/);
    });

    it('documents the new page in a plan-management SKILL.md', () => {
      const skillPath = path.join(ADMIN_ROOT, '.claude', 'skills', 'plan-management', 'SKILL.md');
      expect(fs.existsSync(skillPath)).toBe(true);
      const source = fs.readFileSync(skillPath, 'utf8');
      expect(source).toContain('ADR-0112');
      expect(source).toContain('Story 13.6');
    });
  });

  describe('core-client.ts stays the sole bearer-token attachment point', () => {
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
});
