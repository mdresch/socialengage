import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Search,
  Filter,
  Zap,
  Building2,
  Clock,
} from 'lucide-react';
import { StatusBadge } from '../components/StatusBadge';
import { RelativeTime } from '../components/RelativeTime';

export const AdminConnectorsView: React.FC = () => {
  const { connectors, allTenants, activeTenant } = useApp();
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = connectors.filter((c) => {
    if (filterStatus !== 'ALL' && c.status !== filterStatus) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return c.name.toLowerCase().includes(q) || c.category.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="space-y-6" id="admin-connectors-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            System-Wide Connector Matrix
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Cross-tenant pipeline heartbeat, API response metrics, and error rates across all external providers
          </p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-lg border border-slate-200 shadow-xs">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search connector name or category..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-md placeholder:text-slate-400 text-slate-900 focus-ring"
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-slate-500">Filter Health:</label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="text-xs py-1.5 px-2.5 bg-slate-50 border border-slate-300 rounded-md text-slate-800 focus-ring"
          >
            <option value="ALL">All Statuses</option>
            <option value="healthy">Healthy Only</option>
            <option value="degraded">Degraded</option>
            <option value="failing">Failing</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      {/* Matrix Table */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Connector Service</th>
                <th className="py-3 px-4">Tenant Scope</th>
                <th className="py-3 px-4">Pipeline Status</th>
                <th className="py-3 px-4">Last Ingestion Event</th>
                <th className="py-3 px-4">Consecutive Retries</th>
                <th className="py-3 px-4">Endpoint / Config</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filtered.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-3.5 px-4 font-semibold text-slate-900">
                    <div>{c.name}</div>
                    <div className="text-[10px] text-slate-400 font-mono font-normal">
                      {c.category} • ID: {c.id}
                    </div>
                  </td>

                  <td className="py-3.5 px-4 font-medium text-slate-800">
                    <div className="flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-slate-400" />
                      <span>{activeTenant?.name || 'All Workspaces'}</span>
                    </div>
                  </td>

                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <StatusBadge variant={c.status} size="sm" />
                  </td>

                  <td className="py-3.5 px-4 whitespace-nowrap text-slate-600">
                    <RelativeTime dateString={c.lastSuccessfulFetch} />
                  </td>

                  <td className="py-3.5 px-4 whitespace-nowrap font-mono">
                    <span className={c.consecutiveFailures > 0 ? 'text-amber-600 font-semibold' : 'text-slate-500'}>
                      {c.consecutiveFailures}
                    </span>
                  </td>

                  <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500 max-w-xs truncate">
                    {c.config?.endpoint || c.config?.customDomain || (c.config?.apiKeyMasked ? `Key: ${c.config.apiKeyMasked}` : 'Public stream')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
