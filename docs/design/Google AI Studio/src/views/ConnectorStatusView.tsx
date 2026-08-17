import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Clock,
  Zap,
  ArrowRight,
  ShieldCheck,
  Linkedin,
  Twitter,
  Facebook,
  Instagram,
  Youtube,
} from 'lucide-react';
import { StatusBadge } from '../components/StatusBadge';
import { RelativeTime } from '../components/RelativeTime';
import { ActivateDeactivateButton } from '../components/ActivateDeactivateButton';

export const ConnectorStatusView: React.FC = () => {
  const { connectors, toggleConnectorActive, session, navigateTo } = useApp();
  const [pingingId, setPingingId] = useState<string | null>(null);

  const isTenantAdmin = session.role === 'tenant_admin';

  const handleTestPing = async (id: string) => {
    setPingingId(id);
    await new Promise((r) => setTimeout(r, 700));
    setPingingId(null);
  };

  const healthyCount = connectors.filter((c) => c.status === 'healthy').length;
  const degradedCount = connectors.filter((c) => c.status === 'degraded' || c.status === 'failing').length;

  return (
    <div className="space-y-6" id="connector-status-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Connector Health & Telemetry
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Live ingestion heartbeat, polling intervals, consecutive failure metrics, and cognitive response times
          </p>
        </div>

        {isTenantAdmin && (
          <button
            type="button"
            onClick={() => navigateTo('/tenant/connectors')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors shadow-xs"
          >
            <span>Manage Platform Connections</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase">Healthy Ingestion</span>
            <div className="text-2xl font-bold text-emerald-600 mt-1">{healthyCount}</div>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase">Attention / Degraded</span>
            <div className={`text-2xl font-bold mt-1 ${degradedCount > 0 ? 'text-amber-600' : 'text-slate-900'}`}>
              {degradedCount}
            </div>
          </div>
          <div className={`p-3 rounded-lg ${degradedCount > 0 ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-400'}`}>
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase">Total Feeds</span>
            <div className="text-2xl font-bold text-slate-900 mt-1">{connectors.length}</div>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
            <Activity className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Connector Status Cards */}
      <div className="space-y-4">
        {connectors.map((connector) => (
          <div
            key={connector.id}
            className={`p-5 bg-white rounded-lg border shadow-xs transition-all ${
              connector.status === 'failing'
                ? 'border-rose-300 ring-1 ring-rose-200'
                : connector.status === 'degraded'
                ? 'border-amber-300 ring-1 ring-amber-200'
                : 'border-slate-200'
            }`}
          >
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              {/* Left Info */}
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  {(() => {
                    const iconBgMap: Record<string, string> = {
                      linkedin: 'text-blue-600',
                      x: 'text-sky-500',
                      facebook: 'text-indigo-600',
                      instagram: 'text-rose-600',
                      youtube: 'text-red-600',
                    };
                    const iconMap: Record<string, any> = {
                      linkedin: Linkedin,
                      x: Twitter,
                      facebook: Facebook,
                      instagram: Instagram,
                      youtube: Youtube,
                    };
                    const PlatformIcon = iconMap[connector.platformId];
                    if (PlatformIcon) {
                      return (
                        <span className={`p-1 flex items-center justify-center rounded bg-slate-50 border border-slate-150 shrink-0 ${iconBgMap[connector.platformId] || 'text-slate-500'}`}>
                          <PlatformIcon className="w-4 h-4" />
                        </span>
                      );
                    }
                    return null;
                  })()}
                  <h2 className="text-base font-semibold text-slate-900">{connector.name}</h2>
                  <StatusBadge variant={connector.status} />
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                    {connector.category}
                  </span>
                </div>
                <p className="text-xs text-slate-600">{connector.description}</p>
              </div>

              {/* Action Controls */}
              <div className="flex items-center gap-3 shrink-0">
                <button
                  type="button"
                  disabled={pingingId === connector.id || !connector.isActive}
                  onClick={() => handleTestPing(connector.id)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors disabled:opacity-50"
                  title="Send synthetic health ping"
                >
                  <RefreshCw className={`w-3 h-3 ${pingingId === connector.id ? 'animate-spin text-blue-600' : 'text-slate-500'}`} />
                  <span>{pingingId === connector.id ? 'Pinging...' : 'Test Ping'}</span>
                </button>

                {isTenantAdmin && (
                  <ActivateDeactivateButton
                    isActive={connector.isActive}
                    onToggle={(active) => toggleConnectorActive(connector.id, active)}
                  />
                )}
              </div>
            </div>

            {/* Metrics Breakdown Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 pt-4 border-t border-slate-100 text-xs font-mono">
              <div className="p-3 bg-slate-50 rounded border border-slate-100">
                <div className="text-[10px] uppercase text-slate-500 font-sans font-semibold flex items-center gap-1">
                  <Clock className="w-3 h-3 text-slate-400" />
                  <span>Last Successful Ingestion</span>
                </div>
                <div className="mt-1 font-semibold text-slate-800 font-sans">
                  <RelativeTime dateString={connector.lastSuccessfulFetch} />
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                  {new Date(connector.lastSuccessfulFetch).toLocaleTimeString()}
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded border border-slate-100">
                <div className="text-[10px] uppercase text-slate-500 font-sans font-semibold flex items-center gap-1">
                  <Zap className="w-3 h-3 text-slate-400" />
                  <span>Last Polling Attempt</span>
                </div>
                <div className="mt-1 font-semibold text-slate-800 font-sans">
                  <RelativeTime dateString={connector.lastAttempt} />
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                  Interval: every 2 minutes
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded border border-slate-100">
                <div className="text-[10px] uppercase text-slate-500 font-sans font-semibold flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 text-slate-400" />
                  <span>Consecutive Retry Count</span>
                </div>
                <div className={`mt-1 font-semibold ${connector.consecutiveFailures > 0 ? 'text-amber-600' : 'text-slate-800'}`}>
                  {connector.consecutiveFailures} {connector.consecutiveFailures === 1 ? 'failure' : 'failures'}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  Threshold: 5 retries before alert
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
