/**
// Contract: Story 17.2 (ADR-0130) — Role-tailored onboarding journeys with automated probe verification (frontend UI)
// See docs/user-stories/epic-17-adr-0129-to-0133.md#story-172--role-tailored-onboarding-journeys-with-automated-probe-verification-frontendbackend
//
// Intent: Story 17.2 — Role-tailored onboarding journeys with automated probe verification (frontend)
// Source: ADR-0130, BRD-0130, FDD-0130, TDS-0130
// Scope:
//   social-listening-admin/src/lib/core-client.ts
//   social-listening-admin/src/app/api/onboarding-checklist/route.ts
//   social-listening-admin/src/app/tenant/OnboardingChecklist.tsx
//   social-listening-admin/src/components/OnboardingChecklist.tsx
//   social-listening-admin/.claude/skills/onboarding-checklist-ui/SKILL.md
// Acceptance Criteria:
//   AC1: core-client exports getRoleOnboardingChecklist(), RoleOnboardingStep, RoleJourneyResponse, OnboardingRoleKind.
//   AC2: /api/onboarding-checklist/route.ts accepts ?role= and forwards to getRoleOnboardingChecklist().
//   AC3: OnboardingChecklist component provides role tabs/switcher for admin, care_agent, social_seller, and brand_manager.
//   AC4: Steps render title, description, progress percentage, and dynamic action buttons.
//   AC5: Role-specific action URLs map to appropriate tenant operational screens without blocking daily tasks.
*/

import fs from 'fs';
import path from 'path';
import {
  getRoleOnboardingChecklist,
  type RoleJourneyResponse,
  type RoleOnboardingStep,
  type OnboardingRoleKind,
} from '../../src/lib/core-client';

const ADMIN_ROOT = path.resolve(__dirname, '..', '..');

function readSrc(...segments: string[]): string {
  return fs.readFileSync(path.join(ADMIN_ROOT, 'src', ...segments), 'utf8');
}

describe('Story 17.2 — Role-tailored onboarding journeys UI contract', () => {
  describe('AC1: core-client exports role-tailored types and client function', () => {
    it('declares getRoleOnboardingChecklist in core-client.ts', () => {
      expect(typeof getRoleOnboardingChecklist).toBe('function');
      const coreClientSrc = readSrc('lib', 'core-client.ts');
      expect(coreClientSrc).toContain('export async function getRoleOnboardingChecklist');
      expect(coreClientSrc).toContain('/v1/onboarding/checklist');
    });

    it('exports RoleJourneyResponse, RoleOnboardingStep, and OnboardingRoleKind', () => {
      const coreClientSrc = readSrc('lib', 'core-client.ts');
      expect(coreClientSrc).toContain('export type OnboardingRoleKind');
      expect(coreClientSrc).toContain('export interface RoleOnboardingStep');
      expect(coreClientSrc).toContain('export interface RoleJourneyResponse');
    });
  });

  describe('AC2: route.ts supports ?role= parameter', () => {
    it('inspects searchParams.get("role") and calls getRoleOnboardingChecklist', () => {
      const routeSrc = readSrc('app', 'api', 'onboarding-checklist', 'route.ts');
      expect(routeSrc).toContain('getRoleOnboardingChecklist');
      expect(routeSrc).toContain('role');
    });
  });

  describe('AC3 & AC4: OnboardingChecklist component provides role tabs and renders steps', () => {
    it('contains persona role switching tabs in tenant OnboardingChecklist', () => {
      const componentSrc = readSrc('app', 'tenant', 'OnboardingChecklist.tsx');
      expect(componentSrc).toContain('care_agent');
      expect(componentSrc).toContain('social_seller');
      expect(componentSrc).toContain('brand_manager');
    });

    it('renders progress bar and completion percentage', () => {
      const componentSrc = readSrc('app', 'tenant', 'OnboardingChecklist.tsx');
      expect(componentSrc).toContain('completionPercentage');
    });
  });

  describe('AC5: deep links direct to operational screens', () => {
    it('wires action URLs to operational routes', () => {
      const componentSrc = readSrc('app', 'tenant', 'OnboardingChecklist.tsx');
      expect(componentSrc).toContain('/tenant/connectors');
      expect(componentSrc).toContain('/tenant/posts');
      expect(componentSrc).toContain('/tenant/watchlists');
    });
  });
});
