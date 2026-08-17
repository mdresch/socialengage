import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  ArrowLeft,
  Linkedin,
  Twitter,
  Facebook,
  Instagram,
  Youtube,
  Key,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Settings,
  ShieldCheck,
  Activity,
  FileText,
  SlidersHorizontal,
  CloudLightning,
  Check,
  Play,
  Users,
} from 'lucide-react';
import { StatusBadge } from '../components/StatusBadge';
import { ActivateDeactivateButton } from '../components/ActivateDeactivateButton';

interface SocialConnectorDetailsViewProps {
  platformId: 'linkedin' | 'x' | 'facebook' | 'instagram' | 'youtube';
}

export const SocialConnectorDetailsView: React.FC<SocialConnectorDetailsViewProps> = ({ platformId }) => {
  const { connectors, toggleConnectorActive, connectPlatform, disconnectPlatform, navigateTo } = useApp();

  const conn = connectors.find((c) => c.platformId === platformId);
  const isConnected = !!conn?.config?.apiKeyMasked || !!conn?.isActive;

  // Active Tab
  const [activeTab, setActiveTab] = useState<'auth' | 'filters' | 'sync' | 'advanced'>('auth');

  // Interactive Form States
  const [accountHandle, setAccountHandle] = useState(conn?.config?.customDomain || (
    platformId === 'linkedin' ? 'Acme Global Operations' :
    platformId === 'x' ? '@acmeglobal' :
    platformId === 'facebook' ? 'Acme Global Official' :
    platformId === 'instagram' ? '@acme_global_hq' :
    'Acme Global Media Hub'
  ));
  const [apiKey, setApiKey] = useState('');
  const [ingestionKeywords, setIngestionKeywords] = useState('Acme Global, Acme Cloud, Sarah Chen');
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  const [selectedFrequency, setSelectedFrequency] = useState('15');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [oauthStep, setOauthStep] = useState<'idle' | 'authorizing' | 'success'>('idle');

  // Simulated Sync Logs
  const [syncLogs, setSyncLogs] = useState([
    { id: 'log-1', timestamp: new Date(Date.now() - 4 * 60 * 1000).toISOString(), status: '200 OK', count: 14, latency: '420ms', type: 'Scheduled' },
    { id: 'log-2', timestamp: new Date(Date.now() - 19 * 60 * 1000).toISOString(), status: '200 OK', count: 8, latency: '380ms', type: 'Scheduled' },
    { id: 'log-3', timestamp: new Date(Date.now() - 34 * 60 * 1000).toISOString(), status: '200 OK', count: 21, latency: '510ms', type: 'Manual' },
    { id: 'log-4', timestamp: new Date(Date.now() - 49 * 60 * 1000).toISOString(), status: '200 OK', count: 5, latency: '390ms', type: 'Scheduled' },
    { id: 'log-5', timestamp: new Date(Date.now() - 64 * 60 * 1000).toISOString(), status: '200 OK', count: 0, latency: '290ms', type: 'Scheduled' },
  ]);

  // Platform Details Meta
  const platformMeta = {
    linkedin: {
      name: 'LinkedIn Enterprise Ingestion',
      icon: Linkedin,
      iconBg: 'bg-blue-50 border-blue-200 text-blue-600',
      description: 'Ingest company page updates, comment threads, and direct enterprise mentions from official organization profiles.',
      defaultScopes: ['r_organization_social', 'w_organization_social', 'r_member_social'],
      helpText: 'Requires an approved LinkedIn Developer Portal Application with LinkedIn Share & Community Management API permissions enabled.',
    },
    x: {
      name: 'X (Twitter) Firehose Stream',
      icon: Twitter,
      iconBg: 'bg-sky-50 border-sky-200 text-sky-500',
      description: 'Real-time high-throughput streaming matching targeted brand terms, mentions, and hashtag listeners across the X global firehose.',
      defaultScopes: ['tweet.read', 'users.read', 'offline.access'],
      helpText: 'Utilizes X API v2 Enterprise endpoints. Supports filtered streams, historical timeline synchronization, and secure direct message routing.',
    },
    facebook: {
      name: 'Facebook Page Listener',
      icon: Facebook,
      iconBg: 'bg-indigo-50 border-indigo-200 text-indigo-600',
      description: 'Monitor direct customer posts, rating reviews, visitor feedback comments, and aggregate page engagement metrics.',
      defaultScopes: ['pages_show_list', 'pages_read_engagement', 'pages_manage_posts', 'pages_manage_metadata'],
      helpText: 'Requires Business Manager Verification. Connects official business pages via safe Graph API webhook channels.',
    },
    instagram: {
      name: 'Instagram Graph API Listener',
      icon: Instagram,
      iconBg: 'bg-rose-50 border-rose-200 text-rose-600',
      description: 'Ingest Instagram business profile mentions, tag stories, and aggregate media comments for brand sentiment listening.',
      defaultScopes: ['instagram_basic', 'instagram_manage_comments', 'instagram_manage_insights'],
      helpText: 'Requires a Meta Professional account linked with verified Facebook brand page settings.',
    },
    youtube: {
      name: 'YouTube Channel Ingestion',
      icon: Youtube,
      iconBg: 'bg-red-50 border-red-200 text-red-600',
      description: 'Track and ingest public comments, community posts, description mentions, and video metadata from target video feeds.',
      defaultScopes: ['youtube.readonly', 'youtube.force-ssl'],
      helpText: 'Queries the official YouTube Data API v3. Handles large payload bursts with dynamic buffer pacing.',
    },
  }[platformId];

  const IconComponent = platformMeta.icon;

  const handleSimulateSync = () => {
    setIsSyncing(true);
    setSyncSuccess(false);
    setTimeout(() => {
      setIsSyncing(false);
      setSyncSuccess(true);
      const newLog = {
        id: `log-${Date.now()}`,
        timestamp: new Date().toISOString(),
        status: '200 OK',
        count: Math.floor(Math.random() * 10) + 3,
        latency: `${Math.floor(Math.random() * 200) + 200}ms`,
        type: 'Manual',
      };
      setSyncLogs([newLog, ...syncLogs]);
      if (conn) {
        connectPlatform(platformId, {
          customDomain: accountHandle,
          apiKeyMasked: conn.config?.apiKeyMasked || 'oauth_live_••••••••••••e092',
        });
      }
      setTimeout(() => setSyncSuccess(false), 3000);
    }, 1500);
  };

  const handleSimulateOauth = () => {
    setOauthStep('authorizing');
    setTimeout(() => {
      setOauthStep('success');
      connectPlatform(platformId, {
        customDomain: accountHandle,
        apiKeyMasked: `oauth_${platformId}_••••••••••••${Math.floor(Math.random() * 9000) + 1000}`,
      });
      setTimeout(() => {
        setOauthStep('idle');
      }, 2000);
    }, 1800);
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    setSaveSuccess(true);
    connectPlatform(platformId, {
      customDomain: accountHandle,
      apiKeyMasked: conn?.config?.apiKeyMasked || 'oauth_unverified_key_mask',
    });
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  return (
    <div className="space-y-6" id={`social-connector-details-${platformId}`}>
      {/* Back link & Header */}
      <div className="pb-4 border-b border-slate-200">
        <button
          type="button"
          onClick={() => navigateTo('/tenant/connectors')}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors mb-3"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Connect Platforms</span>
        </button>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-lg ${platformMeta.iconBg} flex items-center justify-center`}>
              <IconComponent className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900">{platformMeta.name}</h1>
                <StatusBadge variant={conn?.isActive ? 'healthy' : 'inactive'} />
              </div>
              <p className="text-xs text-slate-500 mt-0.5 max-w-xl">
                {platformMeta.description}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {conn && (
              <>
                <span className="text-xs text-slate-500 font-medium font-mono hidden md:inline">
                  ID: {conn.id}
                </span>
                <ActivateDeactivateButton
                  isActive={!!conn.isActive}
                  onToggle={(active) => toggleConnectorActive(conn.id, active)}
                />
              </>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Navigation Sidebar */}
        <div className="lg:col-span-1 space-y-1 bg-white p-3 border border-slate-200 rounded-lg shadow-xs h-fit">
          <button
            type="button"
            onClick={() => setActiveTab('auth')}
            className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-md transition-all ${
              activeTab === 'auth'
                ? 'bg-blue-50 text-blue-700 font-semibold'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Key className="w-4 h-4 shrink-0" />
            <span>Connection & OAuth</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('filters')}
            className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-md transition-all ${
              activeTab === 'filters'
                ? 'bg-blue-50 text-blue-700 font-semibold'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4 shrink-0" />
            <span>Ingestion & Rules</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('sync')}
            className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-md transition-all ${
              activeTab === 'sync'
                ? 'bg-blue-50 text-blue-700 font-semibold'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Activity className="w-4 h-4 shrink-0" />
            <span>Sync & Execution Logs</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('advanced')}
            className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-md transition-all ${
              activeTab === 'advanced'
                ? 'bg-blue-50 text-blue-700 font-semibold'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Settings className="w-4 h-4 shrink-0" />
            <span>Advanced Settings</span>
          </button>

          <div className="mt-6 pt-4 border-t border-slate-100 px-3 text-[11px] text-slate-500">
            <span className="font-semibold block text-slate-700 mb-1">Tenant Authority</span>
            <p className="leading-normal">
              OAuth token isolation is cryptographic. Single Tenant row-level partitioning strictly separates social profile configurations.
            </p>
          </div>
        </div>

        {/* Workspace Panels */}
        <div className="lg:col-span-3 bg-white border border-slate-200 rounded-lg shadow-xs p-6 min-h-[400px]">
          {/* TAB 1: AUTHENTICATION */}
          {activeTab === 'auth' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-base font-semibold text-slate-900">OAuth Connection & Telemetry</h2>
                <p className="text-xs text-slate-500">
                  Connect your business page and authorize SocialEngage using standard secure access frameworks.
                </p>
              </div>

              {isConnected ? (
                <div className="bg-emerald-50/50 border border-emerald-200 rounded-lg p-4 text-xs text-emerald-800 space-y-3">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold block">Integration is Authenticated & Live</span>
                      <p className="text-emerald-700 mt-0.5">
                        SocialEngage is actively monitoring the registered profile handle. Ingestion queries are running on the server schedule.
                      </p>
                    </div>
                  </div>

                  <div className="border-t border-emerald-200/50 pt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-emerald-900 font-mono text-[11px]">
                    <div>
                      <span className="text-emerald-600 block uppercase font-sans text-[10px] tracking-wider">Authorized Handle</span>
                      <span className="font-semibold">{accountHandle || 'Unspecified'}</span>
                    </div>
                    <div>
                      <span className="text-emerald-600 block uppercase font-sans text-[10px] tracking-wider">Access Token Mask</span>
                      <span>{conn?.config?.apiKeyMasked || 'oauth_live_••••••••••••942a'}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-xs text-amber-800 flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">Connection Required</span>
                    <p className="text-amber-700 mt-0.5">
                      Ingestion from this network is currently disabled. Authorize this app to read your social updates and telemetry statistics.
                    </p>
                  </div>
                </div>
              )}

              {/* Scope permissions block */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-slate-800 uppercase tracking-wider">Authorized Scopes & Security</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {platformMeta.defaultScopes.map((scope) => (
                    <div key={scope} className="flex items-center gap-2 p-2 bg-slate-50 border border-slate-200 rounded font-mono text-[11px] text-slate-600">
                      <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />
                      <span>{scope}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Intermediary notice */}
              <div className="p-3 bg-amber-50/50 border border-amber-200/80 rounded text-[11px] text-amber-800">
                <span className="font-bold">ADR-0027 Compliance Note:</span> This connector connects directly to the social network API from your own organization credentials. SocialEngage does not aggregate, store, or sell third-party social telemetry feeds.
              </div>

              {/* Actions */}
              <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <span className="text-[11px] text-slate-400">
                  Last authorization verified: {conn?.lastSuccessfulFetch ? new Date(conn.lastSuccessfulFetch).toLocaleDateString() : 'Never'}
                </span>

                <div className="flex items-center gap-2.5">
                  {isConnected && (
                    <button
                      type="button"
                      onClick={() => {
                        disconnectPlatform(conn?.id || '');
                      }}
                      className="px-3 py-1.5 text-xs font-semibold text-rose-600 hover:text-rose-800 bg-white border border-rose-200 hover:border-rose-300 rounded transition-colors"
                    >
                      Revoke Authorization
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={oauthStep === 'authorizing'}
                    onClick={handleSimulateOauth}
                    className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-all shadow-xs disabled:opacity-50"
                  >
                    {oauthStep === 'authorizing' ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Connecting to Provider Securely...</span>
                      </>
                    ) : oauthStep === 'success' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-300" />
                        <span>OAuth Authorized!</span>
                      </>
                    ) : (
                      <>
                        <CloudLightning className="w-3.5 h-3.5" />
                        <span>{isConnected ? 'Re-authorize Account' : 'Connect Account Now'}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: INGESTION FILTERS */}
          {activeTab === 'filters' && (
            <form onSubmit={handleSaveSettings} className="space-y-6">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Ingestion Rules & Filter Scopes</h2>
                <p className="text-xs text-slate-500">
                  Target search constraints, handles, or keyword queries that should route to your brand inbox.
                </p>
              </div>

              <div className="space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Target Account Handle / Company Profile Name
                  </label>
                  <input
                    type="text"
                    required
                    value={accountHandle}
                    onChange={(e) => setAccountHandle(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded font-mono focus-ring"
                    placeholder="e.g. @mycompany"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    The identifier of your official page, used to authenticate webhooks and query page analytics.
                  </p>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Keyword Listening Terms (Comma separated)
                  </label>
                  <textarea
                    value={ingestionKeywords}
                    onChange={(e) => setIngestionKeywords(e.target.value)}
                    rows={3}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded font-mono focus-ring"
                    placeholder="Keywords, hashtags, product names..."
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Direct brand mentions, key terms, or tracking hashtags to filter from the stream.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Primary Language
                    </label>
                    <select
                      value={selectedLanguage}
                      onChange={(e) => setSelectedLanguage(e.target.value)}
                      className="w-full p-2 bg-slate-50 border border-slate-300 rounded focus-ring"
                    >
                      <option value="en">English (en)</option>
                      <option value="de">German (de)</option>
                      <option value="fr">French (fr)</option>
                      <option value="it">Italian (it)</option>
                      <option value="es">Spanish (es)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Sync Frequency
                    </label>
                    <select
                      value={selectedFrequency}
                      onChange={(e) => setSelectedFrequency(e.target.value)}
                      className="w-full p-2 bg-slate-50 border border-slate-300 rounded focus-ring"
                    >
                      <option value="5">Every 5 minutes (Real-time)</option>
                      <option value="15">Every 15 minutes (Standard)</option>
                      <option value="60">Every 1 hour (Batch)</option>
                      <option value="720">Every 12 hours (Delayed)</option>
                    </select>
                  </div>
                </div>
              </div>

              {saveSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-800 flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>Ingestion and query parameters saved successfully.</span>
                </div>
              )}

              <div className="pt-4 border-t border-slate-100 flex justify-end">
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded shadow-xs"
                >
                  Save Listening Parameters
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: SYNC LOGS */}
          {activeTab === 'sync' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">Ingestion Runs & Diagnostics</h2>
                  <p className="text-xs text-slate-500">
                    Review execution trace logs and connection performance metrics.
                  </p>
                </div>

                <button
                  type="button"
                  disabled={isSyncing}
                  onClick={handleSimulateSync}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 transition-colors shadow-xs disabled:opacity-50"
                >
                  {isSyncing ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Syncing Stream...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 text-slate-500" />
                      <span>Trigger Sync Now</span>
                    </>
                  )}
                </button>
              </div>

              {syncSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-800 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Sync run succeeded. Ingested posts updated.</span>
                </div>
              )}

              {/* Ingestion Table */}
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-xs text-left text-slate-500">
                  <thead className="bg-slate-50 text-slate-700 font-semibold uppercase tracking-wider text-[10px] border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3">Timestamp</th>
                      <th className="px-4 py-3">Inbound Status</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3 text-right">Ingested Count</th>
                      <th className="px-4 py-3 text-right">Latency</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white font-mono text-[11px]">
                    {syncLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3 text-slate-900 whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {log.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600 font-sans">{log.type}</td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-900">
                          {log.count} posts
                        </td>
                        <td className="px-4 py-3 text-right text-slate-500">{log.latency}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: ADVANCED SETTINGS */}
          {activeTab === 'advanced' && (
            <div className="space-y-6 text-xs">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Advanced Developer Controls</h2>
                <p className="text-xs text-slate-500">
                  Clear buffers, modify request endpoints, or perform full connector uninstalls.
                </p>
              </div>

              <div className="space-y-4">
                <div className="p-4 border border-slate-200 rounded-lg bg-slate-50/50 space-y-3">
                  <h3 className="font-semibold text-slate-900 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-blue-600" />
                    <span>Connection Health Assurance</span>
                  </h3>
                  <p className="text-slate-600 leading-normal">
                    This listener utilizes standard multi-tenant row isolation. It registers client webhooks safely so that callback routes only trigger the local tenant's ingestion dispatcher logic.
                  </p>
                </div>

                <div className="p-4 border border-rose-200 bg-rose-50/20 rounded-lg space-y-3">
                  <span className="font-bold text-rose-800 block uppercase tracking-wider text-[10px]">
                    Danger Zone
                  </span>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <span className="font-semibold text-rose-900 block">Purge Connection & Configuration</span>
                      <p className="text-rose-700 mt-0.5">
                        This will remove all OAuth access tokens, query filters, and handle settings from the database. Ingested posts will remain stored historically.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        disconnectPlatform(conn?.id || '');
                        navigateTo('/tenant/connectors');
                      }}
                      className="px-4 py-2 font-bold text-white bg-rose-600 hover:bg-rose-700 rounded transition-all shadow-xs shrink-0"
                    >
                      Disconnect Platform
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
