import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  Building2,
  Plus,
  Search,
  Users,
  Globe,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Unlock,
  Edit2,
  ArrowRight,
  Shield,
  Layers,
} from 'lucide-react';
import { Tenant } from '../types';
import { StatusBadge } from '../components/StatusBadge';
import { Slideover } from '../components/Slideover';
import { ConfirmModal } from '../components/ConfirmModal';

export const AdminTenantsView: React.FC = () => {
  const {
    allTenants,
    provisionTenant,
    setTenantStatus,
    updateTenantSeats,
    switchTenant,
    navigateTo,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended'>('all');
  const [isProvisionOpen, setIsProvisionOpen] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');
  const [plan, setPlan] = useState<'Enterprise' | 'Scale' | 'Pro'>('Enterprise');
  const [licenseSeats, setLicenseSeats] = useState(15);
  const [adminEmail, setAdminEmail] = useState('');

  // Seat adjustment modal
  const [seatEditTarget, setSeatEditTarget] = useState<Tenant | null>(null);
  const [newSeatCount, setNewSeatCount] = useState(10);

  // Suspend/Reactivate target
  const [statusTarget, setStatusTarget] = useState<{ tenant: Tenant; nextStatus: 'active' | 'suspended' } | null>(null);

  const filteredTenants = allTenants.filter((t) => {
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return t.name.toLowerCase().includes(q) || t.domain.toLowerCase().includes(q);
    }
    return true;
  });

  const handleProvisionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !domain.trim()) return;

    provisionTenant({
      name: name.trim(),
      domain: domain.trim().toLowerCase(),
      plan,
      licenseSeats,
      adminEmail: adminEmail.trim() || `admin@${domain.trim().toLowerCase()}`,
    });

    setIsProvisionOpen(false);
    setName('');
    setDomain('');
    setAdminEmail('');
  };

  const handleSaveSeats = (e: React.FormEvent) => {
    e.preventDefault();
    if (!seatEditTarget) return;
    updateTenantSeats(seatEditTarget.id, newSeatCount);
    setSeatEditTarget(null);
  };

  return (
    <div className="space-y-6" id="admin-tenants-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Tenant Directory
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Provision, scale, and manage tenant organizations across the SocialEngage platform
          </p>
        </div>

        <button
          type="button"
          id="btn-provision-tenant"
          onClick={() => setIsProvisionOpen(true)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 active:bg-blue-800 transition-colors shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>Provision New Tenant</span>
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-lg border border-slate-200 shadow-xs">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search organizations or domains..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-md placeholder:text-slate-400 text-slate-900 focus-ring"
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-slate-500">Status:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="text-xs py-1.5 px-2.5 bg-slate-50 border border-slate-300 rounded-md text-slate-800 focus-ring"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active Only</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>
      </div>

      {/* Tenants Table */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Organization Name</th>
                <th className="py-3 px-4">Corporate Domain</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Service Plan</th>
                <th className="py-3 px-4">Seat Utilization</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredTenants.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-3.5 px-4 font-semibold text-slate-900">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-md bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-xs">
                        {t.name.charAt(0)}
                      </div>
                      <div>
                        <div>{t.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono font-normal">ID: {t.id}</div>
                      </div>
                    </div>
                  </td>

                  <td className="py-3.5 px-4 font-mono text-slate-600">
                    @{t.domain}
                  </td>

                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <StatusBadge variant={t.status} size="sm" />
                  </td>

                  <td className="py-3.5 px-4 whitespace-nowrap font-medium text-slate-800">
                    <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-700 text-[11px]">
                      {t.plan}
                    </span>
                  </td>

                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900">{t.activeSeats}</span>
                      <span className="text-slate-400">/</span>
                      <span className="text-slate-600">{t.licenseSeats} seats</span>
                      <button
                        type="button"
                        onClick={() => {
                          setSeatEditTarget(t);
                          setNewSeatCount(t.licenseSeats);
                        }}
                        className="text-blue-600 hover:text-blue-800 p-1"
                        title="Adjust License Seat Quota"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                    </div>
                  </td>

                  <td className="py-3.5 px-4 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-2">
                      {/* Enter Tenant context */}
                      <button
                        type="button"
                        onClick={() => {
                          switchTenant(t.id);
                          navigateTo('/tenant');
                        }}
                        className="px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 transition-colors"
                      >
                        Enter Workspace
                      </button>

                      {/* Suspend / Reactivate */}
                      {t.status === 'active' ? (
                        <button
                          type="button"
                          onClick={() => setStatusTarget({ tenant: t, nextStatus: 'suspended' })}
                          className="p-1 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors"
                          title="Suspend Tenant"
                        >
                          <Lock className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setStatusTarget({ tenant: t, nextStatus: 'active' })}
                          className="p-1 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                          title="Reactivate Tenant"
                        >
                          <Unlock className="w-3.5 h-3.5" />
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

      {/* Provision Tenant Modal */}
      {isProvisionOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-lg shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-semibold text-slate-900">
                  Provision Enterprise Tenant
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsProvisionOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleProvisionSubmit} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Organization Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Globex International Corp"
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded focus-ring"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Primary Corporate Domain (Entra Identity Domain)
                </label>
                <div className="relative">
                  <Globe className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    required
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    placeholder="globex.io"
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded font-mono focus-ring"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Service Plan
                  </label>
                  <select
                    value={plan}
                    onChange={(e) => setPlan(e.target.value as any)}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded focus-ring"
                  >
                    <option value="Enterprise">Enterprise</option>
                    <option value="Scale">Scale</option>
                    <option value="Pro">Pro</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Licensed Seat Quota
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={1000}
                    required
                    value={licenseSeats}
                    onChange={(e) => setLicenseSeats(Number(e.target.value))}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded focus-ring"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Initial Tenant Administrator Email
                </label>
                <input
                  type="email"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  placeholder={`admin@${domain || 'company.com'}`}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded font-mono focus-ring"
                />
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded text-[11px] text-blue-800 leading-relaxed">
                Provisioning will create isolated database schemas and dispatch an Entra onboarding welcome message.
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsProvisionOpen(false)}
                  className="px-4 py-2 text-slate-700 bg-white border border-slate-300 rounded font-medium hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded font-semibold shadow-xs"
                >
                  Provision Organization
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Adjust Seat Quota Modal */}
      {seatEditTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-lg shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">
                Adjust Seat Quota: {seatEditTarget.name}
              </h3>
              <button
                type="button"
                onClick={() => setSeatEditTarget(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveSeats} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Licensed Seats Limit
                </label>
                <input
                  type="number"
                  min={seatEditTarget.activeSeats}
                  required
                  value={newSeatCount}
                  onChange={(e) => setNewSeatCount(Number(e.target.value))}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded focus-ring font-mono text-sm"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Currently active seats: <strong className="text-slate-800">{seatEditTarget.activeSeats}</strong>. Quota cannot be lower than active seats.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSeatEditTarget(null)}
                  className="px-4 py-2 text-slate-700 bg-white border border-slate-300 rounded font-medium hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded font-semibold shadow-xs"
                >
                  Update Quota
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Suspend / Reactivate Confirmation Modal */}
      {statusTarget && (
        <ConfirmModal
          isOpen={!!statusTarget}
          title={`${statusTarget.nextStatus === 'suspended' ? 'Suspend' : 'Reactivate'} ${statusTarget.tenant.name}?`}
          body={
            <div className="space-y-2">
              <p>
                {statusTarget.nextStatus === 'suspended'
                  ? 'Suspending this tenant will temporarily pause background ingestion and block all members from accessing the dashboard.'
                  : 'Reactivating this tenant will resume stream ingestion pipelines and restore user access immediately.'}
              </p>
            </div>
          }
          confirmLabel={statusTarget.nextStatus === 'suspended' ? 'Suspend Tenant' : 'Reactivate Tenant'}
          confirmVariant={statusTarget.nextStatus === 'suspended' ? 'destructive' : 'primary'}
          onConfirm={() => {
            setTenantStatus(statusTarget.tenant.id, statusTarget.nextStatus);
            setStatusTarget(null);
          }}
          onCancel={() => setStatusTarget(null)}
        />
      )}
    </div>
  );
};
