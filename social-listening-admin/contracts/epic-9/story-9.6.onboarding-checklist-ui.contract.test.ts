/**
 * Contract: Story 9.6 (ADR-0080) — Onboarding checklist UI (frontend).
 * See docs/user-stories/epic-9-adr-0077-to-0085.md#story-96
 *
 * Intent: Story 9.6 — Onboarding checklist UI (frontend)
 * Scope:
 *   social-listening-admin/src/lib/core-client.ts (extended — getOnboardingChecklist(), patchOnboardingChecklist()),
 *   social-listening-admin/src/app/api/onboarding-checklist/route.ts (new — BFF GET/PATCH proxy),
 *   social-listening-admin/src/components/OnboardingChecklist.tsx (new — Client Component),
 *   social-listening-admin/src/app/tenant/page.tsx (extended — mounts OnboardingChecklist),
 *   social-listening-admin/.claude/skills/onboarding-checklist-ui/SKILL.md (new)
 *
 * Acceptance Criteria to encode:
 *   AC1: OnboardingChecklist component displays core setup steps with completion status and progress percentage.
 *   AC2: Each step deep-links to the relevant screen (connectors, watchlists, invites, post feed).
 *   AC3: Completed steps reflect checkmarks and completion styling upon return navigation / refresh.
 *   AC4: The checklist can be dismissed and reopened (PATCH { dismissed: true } / { dismissed: false }).
 *   AC5: Empty (0%) and fully-completed (100%) states are handled gracefully with clear visual cues.
 *   AC6: Displays advanced steps (enable_enrichment, configure_alerts) and allows showing/hiding them without gating workflows.
 *   AC7: Role gating: tenant_admin can mutate (dismiss, reopen, hide/show advanced steps); tenant_user has read-only progress visibility.
 */

import fs from 'fs';
import path from 'path';
import {
  getOnboardingChecklist,
  patchOnboardingChecklist,
  type OnboardingChecklistResponse,
} from '../../src/lib/core-client';

const ADMIN_ROOT = path.resolve(__dirname, '..', '..');

function readSrc(...segments: string[]): string {
  return fs.readFileSync(path.join(ADMIN_ROOT, 'src', ...segments), 'utf8');
}

const mockChecklistResponse: OnboardingChecklistResponse = {
  isComplete: false,
  progressPercentage: 50,
  dismissed: false,
  dismissedAt: null,
  steps: {
    connect_source: { completed: true, completedAt: '2026-08-25T10:00:00.000Z', deepLink: '/settings/connectors' },
    build_watchlist: { completed: true, completedAt: '2026-08-25T10:15:00.000Z', deepLink: '/watchlists' },
    invite_user: { completed: false, completedAt: null, deepLink: '/settings/users' },
    verify_posts: { completed: false, completedAt: null, deepLink: '/posts' },
  },
  advancedSteps: {
    enable_enrichment: { completed: false, completedAt: null, deepLink: '/settings/enrichment', hidden: false },
    configure_alerts: { completed: false, completedAt: null, deepLink: '/settings/alerts', hidden: false },
  },
};

describe('Story 9.6 — Onboarding checklist UI (frontend)', () => {
  const componentPath = ['components', 'OnboardingChecklist.tsx'];
  const routePath = ['app', 'api', 'onboarding-checklist', 'route.ts'];
  const dashboardPath = ['app', 'tenant', 'page.tsx'];

  describe('AC1: core-client and OnboardingChecklist component show steps and progress', () => {
    it('creates the OnboardingChecklist component', () => {
      expect(fs.existsSync(path.join(ADMIN_ROOT, 'src', ...componentPath))).toBe(true);
    });

    it('core-client.ts exports getOnboardingChecklist and patchOnboardingChecklist', () => {
      const source = readSrc('lib', 'core-client.ts');
      expect(source).toContain('export async function getOnboardingChecklist');
      expect(source).toContain('export async function patchOnboardingChecklist');
      expect(source).toContain('export interface OnboardingChecklistResponse');
    });

    it('OnboardingChecklist renders progress indicators and core step titles', () => {
      const source = readSrc(...componentPath);
      expect(source).toContain('progressPercentage');
      expect(source).toContain('connect_source');
      expect(source).toContain('build_watchlist');
      expect(source).toContain('invite_user');
      expect(source).toContain('verify_posts');
    });
  });

  describe('AC2: Each step deep-links to the relevant tenant screen', () => {
    it('normalizes backend deep-links to the admin app routes', () => {
      const source = readSrc(...componentPath);
      expect(source).toContain('/tenant/connectors');
      expect(source).toContain('/tenant/watchlists');
      expect(source).toContain('/tenant/users');
      expect(source).toContain('/tenant/posts');
    });
  });

  describe('AC3: Completed steps reflect checkmarks and completion styling', () => {
    it('renders distinct completed vs pending icons and labels', () => {
      const source = readSrc(...componentPath);
      expect(source).toContain('step-status-icon');
      expect(source).toContain('Completed');
      expect(source).toMatch(/✓/);
      expect(source).toMatch(/○/);
    });

    it('re-fetches on focus to automatically capture milestones achieved in other tabs/screens', () => {
      const source = readSrc(...componentPath);
      expect(source).toContain('window.addEventListener(\'focus\'');
    });
  });

  describe('AC4: The checklist can be dismissed and reopened from the dashboard', () => {
    it('renders dismiss button for tenant_admin calling PATCH { dismissed: true }', () => {
      const source = readSrc(...componentPath);
      expect(source).toContain('btn-dismiss-checklist');
      expect(source).toContain('dismissed: true');
    });

    it('renders a reopen banner with Reopen button calling PATCH { dismissed: false }', () => {
      const source = readSrc(...componentPath);
      expect(source).toContain('onboarding-checklist-dismissed');
      expect(source).toContain('btn-reopen-checklist');
      expect(source).toContain('dismissed: false');
    });
  });

  describe('AC5: Empty and completed states are handled gracefully', () => {
    it('renders 100% celebration header when isComplete is true', () => {
      const source = readSrc(...componentPath);
      expect(source).toContain('onboarding-complete-badge');
      expect(source).toMatch(/Workspace Setup Complete!|All setup steps complete/i);
    });

    it('handles null/empty data gracefully without throwing', () => {
      const source = readSrc(...componentPath);
      expect(source).toMatch(/if \(!data.*\)\s*return null/);
    });
  });

  describe('AC6: Advanced steps display and can be shown/hidden without gating workflows', () => {
    it('renders collapsible advanced steps section for enable_enrichment and configure_alerts', () => {
      const source = readSrc(...componentPath);
      expect(source).toContain('btn-toggle-advanced-section');
      expect(source).toContain('enable_enrichment');
      expect(source).toContain('configure_alerts');
    });

    it('allows tenant_admin to toggle hiddenAdvancedSteps via PATCH without modifying core steps', () => {
      const source = readSrc(...componentPath);
      expect(source).toContain('hiddenAdvancedSteps');
      expect(source).toContain('btn-hide-show-advanced');
    });
  });

  describe('AC7: Route handler and role gating', () => {
    it('creates the BFF proxy route at app/api/onboarding-checklist/route.ts', () => {
      expect(fs.existsSync(path.join(ADMIN_ROOT, 'src', ...routePath))).toBe(true);
      const source = readSrc(...routePath);
      expect(source).toContain('export async function GET');
      expect(source).toContain('export async function PATCH');
      expect(source).toContain('resolveCallerTenantUser');
      expect(source).toContain('tenant_admin');
    });

    it('Workspace Overview dashboard (tenant/page.tsx) integrates OnboardingChecklist', () => {
      const source = readSrc(...dashboardPath);
      expect(source).toContain('getOnboardingChecklist');
      expect(source).toContain('OnboardingChecklist');
      expect(source).toMatch(/<OnboardingChecklist\s+initialData=\{onboardingChecklist\}/);
    });
  });

  describe('Unit test: core-client functions against mocked fetch', () => {
    beforeEach(() => {
      jest.resetModules();
      jest.dontMock('next/headers');
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('getOnboardingChecklist fetches the tenant endpoint', async () => {
      process.env.CORE_API_BASE_URL = 'http://localhost:4000';
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

      const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(
        new Response(JSON.stringify(mockChecklistResponse), { status: 200 })
      );

      const { getOnboardingChecklist: fetchFn } = await import('../../src/lib/core-client');
      const result = await fetchFn('tenant-123');
      expect(result).toEqual(mockChecklistResponse);
      expect(fetchSpy).toHaveBeenCalledWith(
        'http://localhost:4000/v1/tenants/tenant-123/onboarding-checklist',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer contract-test-access-token',
          }),
        })
      );
    });

    it('patchOnboardingChecklist sends PATCH with JSON body', async () => {
      process.env.CORE_API_BASE_URL = 'http://localhost:4000';
      const updatedResponse = { ...mockChecklistResponse, dismissed: true, dismissedAt: '2026-08-27T12:00:00.000Z' };

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

      const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(
        new Response(JSON.stringify(updatedResponse), { status: 200 })
      );

      const { patchOnboardingChecklist: patchFn } = await import('../../src/lib/core-client');
      const outcome = await patchFn('tenant-123', { dismissed: true });
      expect(outcome.status).toBe(200);
      expect(outcome.body).toEqual(updatedResponse);
      expect(fetchSpy).toHaveBeenCalledWith(
        'http://localhost:4000/v1/tenants/tenant-123/onboarding-checklist',
        expect.objectContaining({
          method: 'PATCH',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: 'Bearer contract-test-access-token',
          }),
          body: JSON.stringify({ dismissed: true }),
        })
      );
    });
  });
});
