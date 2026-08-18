import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  UserPlus,
  Mail,
  Clock,
  CheckCircle2,
  XCircle,
  Building2,
  Sparkles,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import { InviteAssistCandidate } from '../types';
import { RelativeTime } from '../components/RelativeTime';
import { EmptyState } from '../components/EmptyState';

export const InviteAssistView: React.FC = () => {
  const { inviteCandidates, inviteCandidate, dismissCandidate, activeTenant } = useApp();
  const [selectedRole, setSelectedRole] = useState<Record<string, 'tenant_user' | 'tenant_admin'>>({});

  const pendingCandidates = inviteCandidates.filter((c) => c.status === 'pending');
  const pastCandidates = inviteCandidates.filter((c) => c.status !== 'pending');

  const getRole = (id: string) => selectedRole[id] || 'tenant_user';

  const handleSetRole = (id: string, role: 'tenant_user' | 'tenant_admin') => {
    setSelectedRole((prev) => ({ ...prev, [id]: role }));
  };

  return (
    <div className="space-y-6" id="invite-assist-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Same-Domain Invite Assist
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Colleagues with verified matching corporate domain (<span className="font-mono font-semibold text-slate-700">@{activeTenant?.domain}</span>) who attempted sign-in (ADR-0031 §5)
          </p>
        </div>
      </div>

      {/* Explanatory Banner */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900 flex items-start gap-3">
        <Sparkles className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h3 className="font-semibold text-blue-950">
            Automated Organizational Discovery
          </h3>
          <p className="text-blue-800 leading-relaxed">
            When employees authenticate with their corporate Microsoft accounts without prior invitations, their requests are captured here. You can approve and assign workspace seats with a single click.
          </p>
        </div>
      </div>

      {/* Pending Requests Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">
            Pending Discovery Requests ({pendingCandidates.length})
          </h2>
        </div>

        {pendingCandidates.length === 0 ? (
          <EmptyState
            title="No pending colleague requests"
            description={`All recent sign-in attempts from @${activeTenant?.domain || 'acme-global.com'} have been resolved.`}
          />
        ) : (
          <div className="space-y-3">
            {pendingCandidates.map((candidate) => (
              <div
                key={candidate.id}
                className="p-5 bg-white border border-slate-200 rounded-lg shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm">
                    {candidate.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">{candidate.name}</h3>
                    <div className="text-xs text-slate-500 font-mono flex items-center gap-1.5 mt-0.5">
                      <Mail className="w-3 h-3 text-slate-400" />
                      <span>{candidate.email}</span>
                      <span>• Attempted</span>
                      <RelativeTime dateString={candidate.attemptAt} />
                    </div>
                  </div>
                </div>

                {/* Role selection & Action buttons */}
                <div className="flex items-center gap-3 shrink-0">
                  <select
                    value={getRole(candidate.id)}
                    onChange={(e) => handleSetRole(candidate.id, e.target.value as any)}
                    className="text-xs py-1.5 px-2.5 bg-slate-50 border border-slate-300 rounded-md text-slate-800 focus-ring font-medium"
                  >
                    <option value="tenant_user">Tenant User (Analyst)</option>
                    <option value="tenant_admin">Tenant Admin</option>
                  </select>

                  <button
                    type="button"
                    onClick={() => inviteCandidate(candidate.id, getRole(candidate.id))}
                    className="inline-flex items-center gap-1 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors shadow-xs"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Approve & Invite</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => dismissCandidate(candidate.id)}
                    className="px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Resolved History */}
      {pastCandidates.length > 0 && (
        <div className="space-y-3 pt-6 border-t border-slate-200">
          <h3 className="text-sm font-semibold text-slate-700">
            Resolved Sign-in History
          </h3>
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden divide-y divide-slate-100 text-xs">
            {pastCandidates.map((c) => (
              <div key={c.id} className="p-3 px-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-800">{c.name}</span>
                  <span className="font-mono text-slate-400">({c.email})</span>
                </div>
                <span
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold uppercase font-mono ${
                    c.status === 'invited'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {c.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
