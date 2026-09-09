'use client';

import React, { useState } from 'react';
import type { AdminTenant } from '@/lib/core-client';

export type WorkspaceTab = 'users' | 'roles' | 'sharing' | 'features';

export interface WorkspaceUser {
  id: string;
  email: string;
  role: 'tenant_admin' | 'tenant_user';
  status: 'active' | 'invited';
  access_ends_at: string | null;
}

export interface WatchlistShareItem {
  id: string;
  sharedWithUserId: string;
  sharedWithEmail?: string;
  permission: 'read' | 'edit';
}

export interface WorkspaceWatchlist {
  id: string;
  name: string;
  terms?: string[];
  matchType?: string;
  shares?: WatchlistShareItem[];
}

export interface WorkspaceSettingsViewProps {
  tenant: {
    id: string;
    name: string;
    status: 'active' | 'suspended' | 'deleting';
    licenseSeatCount: number;
    activeSeatCount: number;
    domain?: string | null;
    featureGates?: Record<string, boolean>;
    createdAt?: string;
    updatedAt?: string;
  };
  users: WorkspaceUser[];
  watchlists?: WorkspaceWatchlist[];
  currentUserRole?: 'tenant_admin' | 'tenant_user';
  activeTab?: WorkspaceTab;
  onInviteUser?: (email: string, role: 'tenant_admin' | 'tenant_user') => Promise<void>;
  onUpdateRole?: (userId: string, role: 'tenant_admin' | 'tenant_user') => Promise<void>;
  onDeactivateUser?: (userId: string) => Promise<void>;
  onShareWatchlist?: (watchlistId: string, sharedWithUserId: string, permission: 'read' | 'edit') => Promise<void>;
  onRevokeShare?: (watchlistId: string, sharedWithUserId: string) => Promise<void>;
  onToggleFeatureGate?: (featureKey: string, enabled: boolean) => Promise<void>;
}

const PERMISSION_MATRIX_DATA = [
  { resource: 'Users & Invites', admin: 'manage', user: 'none', analyst: 'none' },
  { resource: 'Connectors & Credentials', admin: 'manage', user: 'activate_own', analyst: 'none' },
  { resource: 'Watchlists & Curation', admin: 'manage_all', user: 'own', analyst: 'read_shared' },
  { resource: 'Alert Rules', admin: 'manage_all', user: 'own', analyst: 'none' },
  { resource: 'Social Posts', admin: 'read_all', user: 'read', analyst: 'read' },
  { resource: 'Analytics & Dashboards', admin: 'read_all', user: 'read', analyst: 'read' },
  { resource: 'Workspace Settings', admin: 'manage', user: 'read', analyst: 'read' },
  { resource: 'Data Exports', admin: 'manage', user: 'own', analyst: 'own' },
];

export function WorkspaceSettingsView({
  tenant,
  users,
  watchlists = [],
  currentUserRole = 'tenant_admin',
  activeTab: initialTab = 'users',
  onInviteUser,
  onUpdateRole,
  onDeactivateUser,
  onShareWatchlist,
  onRevokeShare,
  onToggleFeatureGate,
}: WorkspaceSettingsViewProps) {
  const [currentTab, setCurrentTab] = useState<WorkspaceTab>(initialTab);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'tenant_admin' | 'tenant_user'>('tenant_user');
  const [isInviting, setIsInviting] = useState(false);
  const [selectedWatchlistId, setSelectedWatchlistId] = useState(watchlists[0]?.id || '');
  const [shareUserId, setShareUserId] = useState('');
  const [sharePermission, setSharePermission] = useState<'read' | 'edit'>('read');
  const [featureGates, setFeatureGates] = useState<Record<string, boolean>>(
    tenant.featureGates || {
      aiClustering: true,
      advancedAnalytics: true,
      customWebhooks: false,
    }
  );

  const isAdmin = currentUserRole === 'tenant_admin';

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !onInviteUser) return;
    await onInviteUser(inviteEmail.trim(), inviteRole);
    setInviteEmail('');
    setIsInviting(false);
  };

  const handleShareSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWatchlistId || !shareUserId || !onShareWatchlist) return;
    await onShareWatchlist(selectedWatchlistId, shareUserId, sharePermission);
    setShareUserId('');
  };

  const handleFeatureToggle = async (key: string, enabled: boolean) => {
    const next = { ...featureGates, [key]: enabled };
    setFeatureGates(next);
    if (onToggleFeatureGate) {
      await onToggleFeatureGate(key, enabled);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', maxWidth: 1000, margin: '0 auto' }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0 0 4px' }}>Workspace Settings</h1>
        <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', margin: 0 }}>
          Manage workspace members, role permissions, watchlist sharing, and feature gates.
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 'var(--space-2)', borderBottom: '1px solid var(--color-border)', paddingBottom: 2 }}>
        <button
          className={`btn btn-sm ${currentTab === 'users' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setCurrentTab('users')}
          style={{ borderRadius: '6px 6px 0 0' }}
        >
          Users
        </button>
        <button
          className={`btn btn-sm ${currentTab === 'roles' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setCurrentTab('roles')}
          style={{ borderRadius: '6px 6px 0 0' }}
        >
          Roles &amp; Permissions
        </button>
        <button
          className={`btn btn-sm ${currentTab === 'sharing' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setCurrentTab('sharing')}
          style={{ borderRadius: '6px 6px 0 0' }}
        >
          Watchlist Sharing
        </button>
        <button
          className={`btn btn-sm ${currentTab === 'features' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setCurrentTab('features')}
          style={{ borderRadius: '6px 6px 0 0' }}
        >
          Feature Gates
        </button>
      </div>

      {/* ─── TAB 1: USERS ─────────────────────────────────────────────────── */}
      {currentTab === 'users' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {/* Seat Meter */}
          <div className="card" style={{ padding: 'var(--space-4)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>Seat Usage</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, marginTop: 2 }}>
                {tenant.activeSeatCount} of {tenant.licenseSeatCount} seats active
              </div>
            </div>
            {isAdmin && (
              <button
                className="btn btn-primary btn-sm"
                onClick={() => setIsInviting(true)}
              >
                + Invite User
              </button>
            )}
          </div>

          {/* Invite Form */}
          {isInviting && (
            <div className="card" style={{ padding: 'var(--space-4)' }}>
              <h3 style={{ margin: '0 0 var(--space-3)', fontSize: '1rem', fontWeight: 600 }}>Invite New Member</h3>
              <form onSubmit={handleInviteSubmit} style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: 4 }}>
                    Email Address *
                  </label>
                  <input
                    type="email"
                    className="input"
                    placeholder="teammate@company.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    required
                    style={{ width: '100%' }}
                  />
                </div>
                <div style={{ width: 160 }}>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: 4 }}>
                    Role
                  </label>
                  <select
                    className="input"
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as any)}
                    style={{ width: '100%' }}
                  >
                    <option value="tenant_user">tenant_user</option>
                    <option value="tenant_admin">tenant_admin</option>
                  </select>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                  <button type="submit" className="btn btn-primary btn-sm">Send Invite</button>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setIsInviting(false)}>Cancel</button>
                </div>
              </form>
            </div>
          )}

          {/* User List */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ background: 'var(--color-bg-subtle, #f9fafb)', borderBottom: '1px solid var(--color-border)' }}>
                  <th style={{ padding: '10px 16px', fontWeight: 600 }}>Email</th>
                  <th style={{ padding: '10px 16px', fontWeight: 600 }}>Role</th>
                  <th style={{ padding: '10px 16px', fontWeight: 600 }}>Status</th>
                  <th style={{ padding: '10px 16px', fontWeight: 600 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 500 }}>{u.email}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ fontFamily: 'monospace', fontSize: '0.8125rem', background: '#f3f4f6', padding: '2px 6px', borderRadius: 4 }}>
                        {u.role}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: 10,
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          background: u.status === 'active' ? '#dcfce7' : '#fef3c7',
                          color: u.status === 'active' ? '#15803d' : '#b45309',
                        }}
                      >
                        {u.status}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {isAdmin && (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                            onClick={() => onUpdateRole?.(u.id, u.role === 'tenant_admin' ? 'tenant_user' : 'tenant_admin')}
                          >
                            Toggle Role
                          </button>
                          <button
                            className="btn btn-danger btn-sm"
                            style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                            onClick={() => onDeactivateUser?.(u.id)}
                          >
                            Deactivate
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── TAB 2: ROLES & PERMISSIONS ──────────────────────────────────── */}
      {currentTab === 'roles' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div>
            <h3 style={{ margin: '0 0 4px', fontSize: '1.125rem', fontWeight: 700 }}>Permission Matrix</h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', margin: 0 }}>
              RBAC capabilities per role across all platform resource domains.
            </p>
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ background: 'var(--color-bg-subtle, #f9fafb)', borderBottom: '1px solid var(--color-border)' }}>
                  <th style={{ padding: '10px 16px', fontWeight: 600 }}>Resource Domain</th>
                  <th style={{ padding: '10px 16px', fontWeight: 600 }}>tenant_admin</th>
                  <th style={{ padding: '10px 16px', fontWeight: 600 }}>tenant_user</th>
                  <th style={{ padding: '10px 16px', fontWeight: 600 }}>analyst (v2)</th>
                </tr>
              </thead>
              <tbody>
                {PERMISSION_MATRIX_DATA.map((row, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 600 }}>{row.resource}</td>
                    <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: '#166534', fontWeight: 600 }}>
                      {row.admin}
                    </td>
                    <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: '#1e40af' }}>
                      {row.user}
                    </td>
                    <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: '#6b7280' }}>
                      {row.analyst}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── TAB 3: WATCHLIST SHARING ────────────────────────────────────── */}
      {currentTab === 'sharing' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {/* Share form */}
          <div className="card" style={{ padding: 'var(--space-4)' }}>
            <h3 style={{ margin: '0 0 var(--space-3)', fontSize: '1rem', fontWeight: 600 }}>Share Watchlist</h3>
            <form onSubmit={handleShareSubmit} style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 180 }}>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: 4 }}>
                  Select Watchlist
                </label>
                <select
                  className="input"
                  value={selectedWatchlistId}
                  onChange={(e) => setSelectedWatchlistId(e.target.value)}
                  style={{ width: '100%' }}
                >
                  {watchlists.map((w) => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>
              <div style={{ flex: 1, minWidth: 180 }}>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: 4 }}>
                  Share with Member
                </label>
                <select
                  className="input"
                  value={shareUserId}
                  onChange={(e) => setShareUserId(e.target.value)}
                  style={{ width: '100%' }}
                  required
                >
                  <option value="">Select teammate…</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>{u.email}</option>
                  ))}
                </select>
              </div>
              <div style={{ width: 130 }}>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: 4 }}>
                  Permission
                </label>
                <select
                  className="input"
                  value={sharePermission}
                  onChange={(e) => setSharePermission(e.target.value as any)}
                  style={{ width: '100%' }}
                >
                  <option value="read">read</option>
                  <option value="edit">edit</option>
                </select>
              </div>
              <button type="submit" className="btn btn-primary btn-sm">Share Watchlist</button>
            </form>
          </div>

          {/* Active shares list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {watchlists.map((w) => (
              <div key={w.id} className="card" style={{ padding: 'var(--space-4)' }}>
                <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 8 }}>{w.name}</div>
                {w.shares && w.shares.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {w.shares.map((s) => (
                      <div
                        key={s.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '6px 12px',
                          background: 'var(--color-bg-subtle, #f9fafb)',
                          borderRadius: 6,
                          fontSize: '0.875rem',
                        }}
                      >
                        <div>
                          <span>{s.sharedWithEmail || s.sharedWithUserId}</span>
                          <span style={{ marginLeft: 12, fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                            Permission: {s.permission}
                          </span>
                        </div>
                        <button
                          className="btn btn-danger btn-sm"
                          style={{ fontSize: '0.75rem', padding: '2px 8px' }}
                          onClick={() => onRevokeShare?.(w.id, s.sharedWithUserId)}
                        >
                          Revoke
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                    No member shares configured. Private to owner.
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── TAB 4: FEATURE GATES ────────────────────────────────────────── */}
      {currentTab === 'features' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div>
            <h3 style={{ margin: '0 0 4px', fontSize: '1.125rem', fontWeight: 700 }}>Tenant Feature Gates</h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', margin: 0 }}>
              Enable or disable capability modules and preview features for this tenant workspace.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {Object.entries(featureGates).map(([key, enabled]) => (
              <div
                key={key}
                className="card"
                style={{
                  padding: 'var(--space-4)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.9375rem', fontFamily: 'monospace' }}>{key}</div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                    Status: {enabled ? 'Enabled' : 'Disabled'}
                  </div>
                </div>

                <div>
                  {isAdmin ? (
                    <button
                      className={`btn btn-sm ${enabled ? 'btn-danger' : 'btn-primary'}`}
                      onClick={() => handleFeatureToggle(key, !enabled)}
                      style={{ fontSize: '0.8125rem', padding: '4px 12px' }}
                    >
                      {enabled ? 'Disable' : 'Enable'}
                    </button>
                  ) : (
                    <span
                      style={{
                        padding: '3px 10px',
                        borderRadius: 12,
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        background: enabled ? '#dcfce7' : '#f3f4f6',
                        color: enabled ? '#15803d' : '#6b7280',
                      }}
                    >
                      {enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
