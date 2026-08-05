/**
 * Contract: Story 6.2 (ADR-0035/ADR-0036) — Role-gated routing shell
 * Intent: Implement a server-side role-aware routing shell for social-listening-admin
 * so that tenant-facing routes are isolated from Platform-Admin routes and the UI
 * only renders actions allowed for the resolved identity.
 *
 * Scope: social-listening-admin/src/lib/role-routing.ts,
 * social-listening-admin/src/app/(tenant)/..., social-listening-admin/src/app/platform-admin/..., and
 * the supporting component SKILL.md.
 *
 * Explicitly out of scope: the real backend 403 behavior for tenant-admin-only actions;
 * those remain enforced server-side by social-listening-core.
 */

import fs from 'fs';
import path from 'path';
import { getRoleShell, getTenantShellActions } from '../../src/lib/role-routing';

describe('Story 6.2 — role-gated routing shell', () => {
  it('routes tenant_admin and tenant_user identities to the tenant-facing shell', () => {
    expect(getRoleShell({ role: 'tenant_admin' })).toBe('tenant');
    expect(getRoleShell({ role: 'tenant_user' })).toBe('tenant');
  });

  it('routes platform_admin identities to the platform-admin shell', () => {
    expect(getRoleShell({ role: 'platform_admin' })).toBe('platform-admin');
  });

  it('renders tenant-admin-only actions only for tenant_admin sessions', () => {
    expect(getTenantShellActions({ role: 'tenant_admin' })).toContain('Tenant-wide connect');
    expect(getTenantShellActions({ role: 'tenant_user' })).not.toContain('Tenant-wide connect');
  });

  it('creates the two separate route trees expected by the story', () => {
    const adminRoot = path.resolve(__dirname, '..', '..');
    expect(fs.existsSync(path.join(adminRoot, 'src', 'app', 'tenant'))).toBe(true);
    expect(fs.existsSync(path.join(adminRoot, 'src', 'app', 'platform-admin'))).toBe(true);
  });
});
