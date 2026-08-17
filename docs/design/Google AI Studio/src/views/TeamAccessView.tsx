import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  Users,
  UserPlus,
  Clock,
  Shield,
  Trash2,
  Calendar,
  History,
  CheckCircle2,
  Mail,
  Lock,
  UserCheck,
} from 'lucide-react';
import { TenantUser } from '../types';
import { ConfirmModal } from '../components/ConfirmModal';
import { Slideover } from '../components/Slideover';
import { RelativeTime } from '../components/RelativeTime';

export const TeamAccessView: React.FC = () => {
  const {
    tenantUsers,
    inviteTenantUser,
    updateUserAccessPeriod,
    removeTenantUser,
    activeTenant,
  } = useApp();

  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'tenant_admin' | 'tenant_user'>('tenant_user');

  const [timeBoundUser, setTimeBoundUser] = useState<TenantUser | null>(null);
  const [accessEndDate, setAccessEndDate] = useState('');

  const [removeTarget, setRemoveTarget] = useState<TenantUser | null>(null);
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);

  const handleInviteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !inviteEmail.includes('@')) return;
    inviteTenantUser(inviteEmail.trim(), inviteRole);
    setInviteEmail('');
    setInviteModalOpen(false);
  };

  const handleSaveAccessTime = (e: React.FormEvent) => {
    e.preventDefault();
    if (!timeBoundUser) return;
    const formatted = accessEndDate ? new Date(accessEndDate).toISOString() : null;
    updateUserAccessPeriod(timeBoundUser.id, formatted);
    setTimeBoundUser(null);
  };

  const openTimeBoundModal = (u: TenantUser) => {
    setTimeBoundUser(u);
    setAccessEndDate(u.accessEndsAt ? u.accessEndsAt.slice(0, 16) : '');
  };

  return (
    <div className="space-y-6" id="team-access-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Team & Access Control
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Manage workspace members, role allocations, and time-bounded access policies (ADR-0032)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowHistoryDrawer(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors shadow-xs"
          >
            <History className="w-3.5 h-3.5 text-slate-500" />
            <span>Access History Log</span>
          </button>
          <button
            type="button"
            id="btn-invite-team-member"
            onClick={() => setInviteModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 active:bg-blue-800 transition-colors shadow-xs"
          >
            <UserPlus className="w-4 h-4" />
            <span>Invite Team Member</span>
          </button>
        </div>
      </div>

      {/* Seat Meter Banner */}
      <div className="p-4 bg-white border border-slate-200 rounded-lg shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            License Seat Allocation
          </span>
          <div className="text-lg font-bold text-slate-900 mt-0.5">
            {activeTenant?.activeSeats || tenantUsers.length} active of {activeTenant?.licenseSeats || 10} licensed seats
          </div>
        </div>

        <div className="w-full sm:w-64 space-y-1.5">
          <div className="flex justify-between text-xs font-semibold text-slate-700">
            <span>Utilization</span>
            <span>
              {Math.round(
                ((activeTenant?.activeSeats || tenantUsers.length) / (activeTenant?.licenseSeats || 10)) * 100
              )}
              %
            </span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all"
              style={{
                width: `${Math.min(
                  100,
                  ((activeTenant?.activeSeats || tenantUsers.length) / (activeTenant?.licenseSeats || 10)) * 100
                )}%`,
              }}
            />
          </div>
        </div>
      </div>

      {/* Team Users Table */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-4">Assigned Role</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Access Expiry (ADR-0032)</th>
                <th className="py-3 px-4">Last Active</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {tenantUsers.map((user) => (
                <tr key={user.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-700 text-xs">
                        {user.name.charAt(0)}
                      </div>
                      <div>
                        <div className="font-semibold text-slate-900">{user.name}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{user.email}</div>
                      </div>
                    </div>
                  </td>

                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-semibold ${
                        user.role === 'tenant_admin'
                          ? 'bg-blue-50 text-blue-800 border border-blue-200'
                          : 'bg-slate-100 text-slate-700 border border-slate-200'
                      }`}
                    >
                      {user.role === 'tenant_admin' ? (
                        <>
                          <UserCheck className="w-3 h-3 text-blue-600" />
                          <span>Tenant Admin</span>
                        </>
                      ) : (
                        <span>Tenant User</span>
                      )}
                    </span>
                  </td>

                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span>{user.status}</span>
                    </span>
                  </td>

                  <td className="py-3.5 px-4 whitespace-nowrap">
                    {user.accessEndsAt ? (
                      <div className="inline-flex items-center gap-1 text-xs text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 font-medium">
                        <Clock className="w-3 h-3 text-amber-600" />
                        <span>Expires {new Date(user.accessEndsAt).toLocaleDateString()}</span>
                      </div>
                    ) : (
                      <span className="text-slate-400">Indefinite access</span>
                    )}
                  </td>

                  <td className="py-3.5 px-4 whitespace-nowrap text-slate-500">
                    <RelativeTime dateString={user.lastActiveAt} />
                  </td>

                  <td className="py-3.5 px-4 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => openTimeBoundModal(user)}
                        className="px-2 py-1 text-xs text-slate-600 hover:text-blue-600 hover:bg-slate-100 rounded transition-colors font-medium"
                        title="Configure time-bounded access window"
                      >
                        Set Expiry
                      </button>
                      {tenantUsers.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setRemoveTarget(user)}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                          title="Revoke User Access"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invite Member Modal */}
      {inviteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-lg shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-semibold text-slate-900">
                  Invite New Team Member
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setInviteModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleInviteSubmit} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Corporate Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="email"
                    required
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="colleague@acme-global.com"
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded focus-ring"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Workspace Role
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label
                    onClick={() => setInviteRole('tenant_user')}
                    className={`p-3 rounded-md border cursor-pointer text-center transition-all ${
                      inviteRole === 'tenant_user'
                        ? 'bg-blue-50 border-blue-500 text-blue-700 font-semibold'
                        : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    <div className="text-xs">Tenant User</div>
                    <div className="text-[10px] text-slate-500 font-normal mt-0.5">Posts & Watchlists</div>
                  </label>

                  <label
                    onClick={() => setInviteRole('tenant_admin')}
                    className={`p-3 rounded-md border cursor-pointer text-center transition-all ${
                      inviteRole === 'tenant_admin'
                        ? 'bg-blue-50 border-blue-500 text-blue-700 font-semibold'
                        : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    <div className="text-xs">Tenant Admin</div>
                    <div className="text-[10px] text-slate-500 font-normal mt-0.5">Connectors & Access</div>
                  </label>
                </div>
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded text-[11px] text-blue-800 leading-relaxed">
                An invitation email with an Entra External ID authentication link will be dispatched to the recipient.
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setInviteModalOpen(false)}
                  className="px-4 py-2 text-slate-700 bg-white border border-slate-300 rounded font-medium hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded font-semibold shadow-xs"
                >
                  Send Invitation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Time-Bounded Access Window Modal (ADR-0032 §9) */}
      {timeBoundUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-lg shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-semibold text-slate-900">
                  Time-Bounded Access Window
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setTimeBoundUser(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveAccessTime} className="p-5 space-y-4 text-xs">
              <p className="text-slate-600">
                Configure an automated expiration date for <strong>{timeBoundUser.name}</strong> ({timeBoundUser.email}).
              </p>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Access Termination Timestamp (UTC)
                </label>
                <input
                  type="datetime-local"
                  value={accessEndDate}
                  onChange={(e) => setAccessEndDate(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded font-mono focus-ring"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Leave blank to grant indefinite, permanent workspace access.
                </p>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                {timeBoundUser.accessEndsAt && (
                  <button
                    type="button"
                    onClick={() => {
                      updateUserAccessPeriod(timeBoundUser.id, null);
                      setTimeBoundUser(null);
                    }}
                    className="text-xs text-rose-600 hover:underline font-medium"
                  >
                    Clear Expiration
                  </button>
                )}
                <div className="flex items-center gap-2 ml-auto">
                  <button
                    type="button"
                    onClick={() => setTimeBoundUser(null)}
                    className="px-3 py-1.5 text-slate-700 bg-white border border-slate-300 rounded font-medium hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-3 py-1.5 text-white bg-blue-600 hover:bg-blue-700 rounded font-semibold shadow-xs"
                  >
                    Save Expiry Policy
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Access History Log Slideover (Story 6.14) */}
      <Slideover
        isOpen={showHistoryDrawer}
        onClose={() => setShowHistoryDrawer(false)}
        title="Team Access Audit History"
        subtitle="Chronological record of invitations, role modifications, and session authorisations"
        width="md"
      >
        <div className="space-y-3 text-xs">
          {[
            {
              time: '2026-08-14T08:15:00Z',
              actor: 'sarah.chen@acme-global.com',
              event: 'Role assigned: tenant_admin to Thomas Mueller',
            },
            {
              time: '2026-08-12T14:30:00Z',
              actor: 'sarah.chen@acme-global.com',
              event: 'Time-bounded expiry updated for Elena Rostova (Ends 2026-12-31)',
            },
            {
              time: '2026-08-01T10:00:00Z',
              actor: 'sarah.chen@acme-global.com',
              event: 'Invited David Kim with role tenant_user',
            },
            {
              time: '2026-07-15T09:00:00Z',
              actor: 'system',
              event: 'Initial tenant admin session established for Sarah Chen',
            },
          ].map((item, i) => (
            <div key={i} className="p-3 bg-slate-50 border border-slate-200 rounded-md space-y-1">
              <div className="flex items-center justify-between text-slate-500 font-mono text-[11px]">
                <RelativeTime dateString={item.time} />
                <span>{item.actor}</span>
              </div>
              <div className="font-medium text-slate-800">{item.event}</div>
            </div>
          ))}
        </div>
      </Slideover>

      {/* Revoke Member Confirmation Modal */}
      {removeTarget && (
        <ConfirmModal
          isOpen={!!removeTarget}
          title={`Revoke access for ${removeTarget.name}?`}
          body={
            <div className="space-y-2">
              <p>
                Removing <strong>{removeTarget.email}</strong> will immediately terminate their active session tokens and free up 1 license seat in your workspace.
              </p>
            </div>
          }
          confirmLabel="Revoke Access"
          confirmVariant="destructive"
          onConfirm={() => {
            removeTenantUser(removeTarget.id);
            setRemoveTarget(null);
          }}
          onCancel={() => setRemoveTarget(null)}
        />
      )}
    </div>
  );
};
