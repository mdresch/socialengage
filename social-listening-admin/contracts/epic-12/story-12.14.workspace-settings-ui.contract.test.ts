/**
 * Contract: Story 12.14 (ADR-0107, BRD-0107, FDD-0107) — RBAC and workspace settings UI (frontend).
 * See docs/user-stories/epic-12-adr-0101-to-0108.md#story-1214--rbac-and-workspace-settings-ui-frontend
 * and docs/adr/0107-multi-user-workspaces-and-rbac-permissions.md
 */

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { WorkspaceSettingsView } from '../../src/components/settings/WorkspaceSettingsView';

describe('Story 12.14 — RBAC and workspace settings UI (frontend)', () => {
  const mockTenant = {
    id: 'tenant-123',
    name: 'Acme Global Workspace',
    status: 'active' as const,
    licenseSeatCount: 10,
    activeSeatCount: 4,
    domain: 'acme.com',
    featureGates: {
      aiClustering: true,
      advancedAnalytics: true,
      customWebhooks: false,
    },
    createdAt: '2026-08-01T00:00:00Z',
    updatedAt: '2026-08-29T10:00:00Z',
  };

  const mockUsers = [
    {
      id: 'u-1',
      email: 'admin@acme.com',
      role: 'tenant_admin' as const,
      status: 'active' as const,
      access_ends_at: null,
    },
    {
      id: 'u-2',
      email: 'analyst@acme.com',
      role: 'tenant_user' as const,
      status: 'active' as const,
      access_ends_at: null,
    },
    {
      id: 'u-3',
      email: 'guest@acme.com',
      role: 'tenant_user' as const,
      status: 'invited' as const,
      access_ends_at: null,
    },
  ];

  const mockWatchlists = [
    {
      id: 'w-1',
      name: 'Brand Reputation',
      terms: ['acme', 'product'],
      matchType: 'keyword' as const,
      shares: [
        {
          id: 'share-1',
          sharedWithUserId: 'u-2',
          sharedWithEmail: 'analyst@acme.com',
          permission: 'read' as const,
        },
      ],
    },
    {
      id: 'w-2',
      name: 'Competitor Intel',
      terms: ['competitor-x'],
      matchType: 'keyword' as const,
      shares: [],
    },
  ];

  describe('AC1: WorkspaceSettingsView renders navigation tabs', () => {
    it('renders Users, Roles, Sharing, and Features tabs', () => {
      const html = renderToStaticMarkup(
        React.createElement(WorkspaceSettingsView, {
          tenant: mockTenant,
          users: mockUsers,
          watchlists: mockWatchlists,
          currentUserRole: 'tenant_admin',
          activeTab: 'users',
        })
      );

      expect(html).toContain('Users');
      expect(html).toContain('Roles &amp; Permissions');
      expect(html).toContain('Watchlist Sharing');
      expect(html).toContain('Feature Gates');
    });
  });

  describe('AC2: Users tab shows seat limits, user list, and invite action', () => {
    it('displays seat usage and user list with roles', () => {
      const html = renderToStaticMarkup(
        React.createElement(WorkspaceSettingsView, {
          tenant: mockTenant,
          users: mockUsers,
          watchlists: mockWatchlists,
          currentUserRole: 'tenant_admin',
          activeTab: 'users',
        })
      );

      expect(html).toContain('4 of 10 seats active');
      expect(html).toContain('admin@acme.com');
      expect(html).toContain('analyst@acme.com');
      expect(html).toContain('tenant_admin');
      expect(html).toContain('tenant_user');
      expect(html).toContain('Invite User');
    });
  });

  describe('AC3: Roles tab displays the RBAC permission matrix', () => {
    it('renders the role capability matrix for tenant_admin, tenant_user, and analyst', () => {
      const html = renderToStaticMarkup(
        React.createElement(WorkspaceSettingsView, {
          tenant: mockTenant,
          users: mockUsers,
          watchlists: mockWatchlists,
          currentUserRole: 'tenant_admin',
          activeTab: 'roles',
        })
      );

      expect(html).toContain('Permission Matrix');
      expect(html).toContain('tenant_admin');
      expect(html).toContain('tenant_user');
      expect(html).toContain('manage_all');
      expect(html).toContain('activate_own');
    });
  });

  describe('AC4: Sharing tab manages watchlist shares', () => {
    it('displays watchlists with existing shares and share actions', () => {
      const html = renderToStaticMarkup(
        React.createElement(WorkspaceSettingsView, {
          tenant: mockTenant,
          users: mockUsers,
          watchlists: mockWatchlists,
          currentUserRole: 'tenant_admin',
          activeTab: 'sharing',
        })
      );

      expect(html).toContain('Brand Reputation');
      expect(html).toContain('analyst@acme.com');
      expect(html).toContain('Permission: read');
      expect(html).toContain('Share Watchlist');
    });
  });

  describe('AC5: Features tab shows per-tenant feature gates', () => {
    it('displays feature toggles with enabled/disabled states', () => {
      const html = renderToStaticMarkup(
        React.createElement(WorkspaceSettingsView, {
          tenant: mockTenant,
          users: mockUsers,
          watchlists: mockWatchlists,
          currentUserRole: 'tenant_admin',
          activeTab: 'features',
        })
      );

      expect(html).toContain('aiClustering');
      expect(html).toContain('advancedAnalytics');
      expect(html).toContain('customWebhooks');
      expect(html).toContain('Enabled');
      expect(html).toContain('Disabled');
    });
  });
});
