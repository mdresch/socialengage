/**
 * Contract: Story 6.6 (ADR-0030, ADR-0031, ADR-0035) — Platform Admin console
 *
 * Intent: Story 6.6 — Platform Admin console UI in social-listening-admin.
 *
 * Scope: social-listening-admin/contracts/epic-6/story-6.6.platform-admin-console.contract.test.ts,
 * social-listening-admin/.claude/skills/platform-admin-console/SKILL.md,
 * social-listening-admin/src/lib/core-client.ts,
 * social-listening-admin/src/app/platform-admin/page.tsx.
 *
 * Contract to encode:
 * - The platform-admin route exists and renders a dedicated Platform Admin console surface.
 * - The screen includes tenant list/provision/update, break-glass request/execute, and audit-log sections,
 *   mapped to the Story 5.12/5.13/5.14 REST surfaces.
 * - The core API client exposes dedicated helpers for these platform-admin endpoints.
 * - The screen states the zero tenant-content boundary and keeps scope to administrative metadata.
 * - The component SKILL.md exists for future-safe extension and maintenance.
 *
 * Explicitly out of scope:
 * - Re-proving social-listening-core endpoint authorization/behavior (covered by Stories 5.12/5.13/5.14 contracts).
 * - Infrastructure/operations dashboards, explicitly deferred by story scope.
 */

import fs from 'fs';
import path from 'path';

describe('Story 6.6 — Platform Admin console', () => {
  const adminRoot = path.resolve(__dirname, '..', '..');
  const pagePath = path.join(adminRoot, 'src', 'app', 'platform-admin', 'page.tsx');
  const coreClientPath = path.join(adminRoot, 'src', 'lib', 'core-client.ts');
  const skillPath = path.join(adminRoot, '.claude', 'skills', 'platform-admin-console', 'SKILL.md');

  it('creates a platform-admin console route', () => {
    expect(fs.existsSync(pagePath)).toBe(true);
  });

  it('documents the platform-admin console in a component skill note', () => {
    expect(fs.existsSync(skillPath)).toBe(true);
  });

  it('adds dedicated core-client helpers for platform-admin tenant, break-glass, and audit endpoints', () => {
    const source = fs.readFileSync(coreClientPath, 'utf8');

    expect(source).toContain('listAdminTenants');
    expect(source).toContain('createAdminTenant');
    expect(source).toContain('updateAdminTenant');
    expect(source).toContain('requestBreakGlassReset');
    expect(source).toContain('executeBreakGlassRequest');
    expect(source).toContain('queryAdminAuditLog');

    expect(source).toContain('/v1/admin/tenants');
    expect(source).toContain('/break-glass/request');
    expect(source).toContain('/break-glass/requests/');
    expect(source).toContain('/v1/admin/audit-log');
  });

  it('renders tenant list/provision/update, break-glass request/execute, and audit-log sections', () => {
    const source = fs.readFileSync(pagePath, 'utf8');

    expect(source).toContain('Platform Admin console');
    expect(source).toContain('Tenant registry');
    expect(source).toContain('Provision tenant');
    expect(source).toContain('Update tenant');
    expect(source).toContain('Break-glass');
    expect(source).toContain('Request reset');
    expect(source).toContain('Execute request');
    expect(source).toContain('Audit log');
  });

  it('renders the zero tenant-content boundary and keeps this screen admin-metadata-only', () => {
    const source = fs.readFileSync(pagePath, 'utf8');
    expect(source).toContain('No tenant-content data');
    expect(source).toContain('users, watchlists, social posts, or credentials');
  });

  it('keeps infrastructure metrics explicitly out of this story scope', () => {
    const source = fs.readFileSync(pagePath, 'utf8');
    expect(source).toContain('infrastructure metrics are out of scope');
  });
});
