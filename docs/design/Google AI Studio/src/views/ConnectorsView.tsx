import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  Plug,
  Sparkles,
  Key,
  Globe,
  Radio,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Lock,
  ArrowRight,
  Linkedin,
  Twitter,
  Facebook,
  Instagram,
  Youtube,
} from 'lucide-react';
import { StatusBadge } from '../components/StatusBadge';
import { ActivateDeactivateButton } from '../components/ActivateDeactivateButton';
import { ConfirmModal } from '../components/ConfirmModal';
import { Connector, PlatformConnectorId } from '../types';

export const ConnectorsView: React.FC = () => {
  const { connectors, toggleConnectorActive, connectPlatform, disconnectPlatform, navigateTo } = useApp();

  const [connectingPlatform, setConnectingPlatform] = useState<PlatformConnectorId | null>(null);
  const [disconnectTarget, setDisconnectTarget] = useState<Connector | null>(null);

  // Form states for connection modals
  const [apiKey, setApiKey] = useState('');
  const [endpoint, setEndpoint] = useState('');
  const [deploymentName, setDeploymentName] = useState('');
  const [region, setRegion] = useState('westeurope');

  const openConnectModal = (platformId: PlatformConnectorId) => {
    setConnectingPlatform(platformId);
    setApiKey('');
    setEndpoint('');
    setDeploymentName('');
    if (platformId === 'azure_ai_language') {
      setEndpoint('https://my-company-lang.cognitiveservices.azure.com/');
    } else if (platformId === 'azure_openai') {
      setEndpoint('https://my-company-openai.openai.azure.com/');
      setDeploymentName('gpt-4o');
    }
  };

  const handleSaveConnection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!connectingPlatform) return;

    const maskedKey = apiKey ? `${apiKey.slice(0, 4)}••••••••••••${apiKey.slice(-4)}` : 'key_masked_prod';

    connectPlatform(connectingPlatform, {
      apiKeyMasked: maskedKey,
      endpoint: endpoint || undefined,
      deploymentName: deploymentName || undefined,
      region: region || undefined,
    });

    setConnectingPlatform(null);
  };

  return (
    <div className="space-y-6" id="connectors-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Connect a Platform
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Configure external data ingestion sources and Azure AI cognitive enrichment pipelines
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigateTo('/tenant/connectors/status')}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors shadow-xs"
        >
          <span>View Connector Status & Latency</span>
          <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
        </button>
      </div>

      {/* Platform Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 1. GNews API Card */}
        {(() => {
          const conn = connectors.find((c) => c.platformId === 'gnews');
          const isConnected = !!conn?.config?.apiKeyMasked;
          return (
            <div className="bg-white border border-slate-200 rounded-lg shadow-xs p-5 flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 font-bold">
                      <Globe className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-base font-semibold text-slate-900">GNews API</h2>
                      <span className="text-[11px] text-slate-500 font-mono">Ingestion Provider (REST)</span>
                    </div>
                  </div>
                  <StatusBadge variant={conn?.status || 'inactive'} />
                </div>

                <p className="mt-3 text-xs text-slate-600 leading-relaxed">
                  Real-time global news monitoring with keyword, headline, and topic filtering across 60,000+ publishers.
                </p>

                {/* ADR-0027 Intermediary Notice */}
                <div className="mt-3 p-2.5 bg-amber-50/80 border border-amber-200 rounded text-[11px] text-amber-800 flex items-start gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    You connect using your own account and API key directly with GNews. SocialEngage is not a billing intermediary.
                  </span>
                </div>

                {isConnected && conn?.config?.apiKeyMasked && (
                  <div className="mt-3 p-2 bg-slate-50 border border-slate-200 rounded text-xs text-slate-600 flex items-center justify-between font-mono">
                    <span className="text-slate-500">API Key:</span>
                    <span>{conn.config.apiKeyMasked}</span>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                {isConnected ? (
                  <>
                    <ActivateDeactivateButton
                      isActive={!!conn?.isActive}
                      onToggle={(active) => conn && toggleConnectorActive(conn.id, active)}
                    />
                    <button
                      type="button"
                      onClick={() => conn && setDisconnectTarget(conn)}
                      className="text-xs text-rose-600 hover:text-rose-800 font-medium"
                    >
                      Disconnect
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => openConnectModal('gnews')}
                    className="w-full py-2 px-3 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors shadow-xs"
                  >
                    Connect GNews API
                  </button>
                )}
              </div>
            </div>
          );
        })()}

        {/* 2. Global Newswire Card (Public) */}
        {(() => {
          const conn = connectors.find((c) => c.platformId === 'newswire');
          const isConnected = !!conn;
          return (
            <div className="bg-white border border-slate-200 rounded-lg shadow-xs p-5 flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 font-bold">
                      <Radio className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-base font-semibold text-slate-900">Global Newswire Feeds</h2>
                      <span className="text-[11px] text-slate-500 font-mono">Public Ingestion Source</span>
                    </div>
                  </div>
                  <StatusBadge variant={conn?.status || 'inactive'} />
                </div>

                <p className="mt-3 text-xs text-slate-600 leading-relaxed">
                  Syndicated public corporate press releases and regulatory disclosures (Zero credential required).
                </p>

                <div className="mt-3 p-2.5 bg-slate-50 border border-slate-200 rounded text-[11px] text-slate-600 flex items-start gap-2">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    Direct public feed integration provided under standard open syndication terms.
                  </span>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <ActivateDeactivateButton
                  isActive={!!conn?.isActive}
                  onToggle={(active) => conn && toggleConnectorActive(conn.id, active)}
                />
                <span className="text-xs text-slate-400 font-medium">Public Channel</span>
              </div>
            </div>
          );
        })()}

        {/* 3. Azure AI Language Service */}
        {(() => {
          const conn = connectors.find((c) => c.platformId === 'azure_ai_language');
          const isConnected = !!conn?.config?.endpoint;
          return (
            <div className="bg-white border border-slate-200 rounded-lg shadow-xs p-5 flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-600 font-bold">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-base font-semibold text-slate-900">Azure AI Language</h2>
                      <span className="text-[11px] text-purple-600 font-mono">Cognitive Enrichment (NER / Sentiment)</span>
                    </div>
                  </div>
                  <StatusBadge variant={conn?.status || 'inactive'} />
                </div>

                <p className="mt-3 text-xs text-slate-600 leading-relaxed">
                  Azure Cognitive Services for Named Entity Recognition, fine-grained multi-class sentiment analysis, and key phrase extraction.
                </p>

                {/* ADR-0027 Intermediary Notice */}
                <div className="mt-3 p-2.5 bg-amber-50/80 border border-amber-200 rounded text-[11px] text-amber-800 flex items-start gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    You connect using your own Azure Subscription and Endpoint. SocialEngage is not a billing intermediary.
                  </span>
                </div>

                {isConnected && conn?.config?.endpoint && (
                  <div className="mt-3 p-2 bg-slate-50 border border-slate-200 rounded text-xs text-slate-600 space-y-1 font-mono">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Endpoint:</span>
                      <span className="truncate max-w-[200px]">{conn.config.endpoint}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Key:</span>
                      <span>{conn.config.apiKeyMasked || '••••••••••••'}</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                {isConnected ? (
                  <>
                    <ActivateDeactivateButton
                      isActive={!!conn?.isActive}
                      onToggle={(active) => conn && toggleConnectorActive(conn.id, active)}
                    />
                    <button
                      type="button"
                      onClick={() => conn && setDisconnectTarget(conn)}
                      className="text-xs text-rose-600 hover:text-rose-800 font-medium"
                    >
                      Disconnect
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => openConnectModal('azure_ai_language')}
                    className="w-full py-2 px-3 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors shadow-xs"
                  >
                    Connect Azure AI Language
                  </button>
                )}
              </div>
            </div>
          );
        })()}

        {/* 4. Azure OpenAI Service */}
        {(() => {
          const conn = connectors.find((c) => c.platformId === 'azure_openai');
          const isConnected = !!conn?.config?.endpoint;
          return (
            <div className="bg-white border border-slate-200 rounded-lg shadow-xs p-5 flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 font-bold">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-base font-semibold text-slate-900">Azure OpenAI Service</h2>
                      <span className="text-[11px] text-emerald-600 font-mono">Cognitive Reasoning (GPT-4o)</span>
                    </div>
                  </div>
                  <StatusBadge variant={conn?.status || 'inactive'} />
                </div>

                <p className="mt-3 text-xs text-slate-600 leading-relaxed">
                  Contextual brand reputation synthesis, executive summaries, and intent classification via private Azure OpenAI deployments.
                </p>

                {/* ADR-0027 Intermediary Notice */}
                <div className="mt-3 p-2.5 bg-amber-50/80 border border-amber-200 rounded text-[11px] text-amber-800 flex items-start gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    Direct Azure OpenAI billing via your enterprise agreement. SocialEngage is not a billing intermediary.
                  </span>
                </div>

                {isConnected && conn?.config?.endpoint && (
                  <div className="mt-3 p-2 bg-slate-50 border border-slate-200 rounded text-xs text-slate-600 space-y-1 font-mono">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Deployment:</span>
                      <span className="font-semibold text-slate-800">{conn.config.deploymentName}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Key:</span>
                      <span>{conn.config.apiKeyMasked || '••••••••••••'}</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                {isConnected ? (
                  <>
                    <ActivateDeactivateButton
                      isActive={!!conn?.isActive}
                      onToggle={(active) => conn && toggleConnectorActive(conn.id, active)}
                    />
                    <button
                      type="button"
                      onClick={() => conn && setDisconnectTarget(conn)}
                      className="text-xs text-rose-600 hover:text-rose-800 font-medium"
                    >
                      Disconnect
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => openConnectModal('azure_openai')}
                    className="w-full py-2 px-3 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors shadow-xs"
                  >
                    Connect Azure OpenAI
                  </button>
                )}
              </div>
            </div>
          );
        })()}
      </div>

      {/* Social Media Stream Ingestion */}
      <div className="pt-6 border-t border-slate-200">
        <h2 className="text-lg font-bold text-slate-900">Social Media Stream Ingestion</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Connect your brand profiles to ingest streaming posts, mentions, reviews, and comment threads.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-4">
          {[
            {
              id: 'linkedin',
              name: 'LinkedIn Business',
              icon: Linkedin,
              iconBg: 'bg-blue-50 border-blue-200 text-blue-600',
              desc: 'Ingest corporate company updates, comment sections, and direct enterprise mentions.',
            },
            {
              id: 'x',
              name: 'X (Twitter)',
              icon: Twitter,
              iconBg: 'bg-sky-50 border-sky-200 text-sky-500',
              desc: 'Monitor high-throughput search queries, hashtag lists, and handle mentions in real-time.',
            },
            {
              id: 'facebook',
              name: 'Facebook Pages',
              icon: Facebook,
              iconBg: 'bg-indigo-50 border-indigo-200 text-indigo-600',
              desc: 'Monitor user page posts, rating reviews, and comments on official business accounts.',
            },
            {
              id: 'instagram',
              name: 'Instagram Business',
              icon: Instagram,
              iconBg: 'bg-rose-50 border-rose-200 text-rose-600',
              desc: 'Track and ingest business profile tags, reels comments, and media feed mentions.',
            },
            {
              id: 'youtube',
              name: 'YouTube Ingestion',
              icon: Youtube,
              iconBg: 'bg-red-50 border-red-200 text-red-600',
              desc: 'Ingest video comments, description mentions, and metadata updates from channels.',
            },
          ].map((platform) => {
            const conn = connectors.find((c) => c.platformId === platform.id);
            const isConnected = !!conn?.config?.apiKeyMasked || !!conn?.isActive;
            const Icon = platform.icon;

            return (
              <div key={platform.id} className="bg-white border border-slate-200 rounded-lg shadow-xs p-5 flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg ${platform.iconBg} flex items-center justify-center font-bold`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900">{platform.name}</h3>
                        <span className="text-[10px] text-slate-500 font-mono">Stream Connector</span>
                      </div>
                    </div>
                    <StatusBadge variant={conn?.status || 'inactive'} />
                  </div>

                  <p className="mt-3 text-xs text-slate-600 leading-relaxed min-h-[48px]">
                    {platform.desc}
                  </p>

                  {isConnected && (
                    <div className="mt-3 p-2 bg-slate-50 border border-slate-200 rounded text-[11px] text-slate-600 space-y-1 font-mono">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Handle/Page:</span>
                        <span className="font-semibold text-slate-800 truncate max-w-[140px]">{conn.config?.customDomain || 'Authorized'}</span>
                      </div>
                      {conn.config?.apiKeyMasked && (
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Key:</span>
                          <span>{conn.config.apiKeyMasked}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  {isConnected ? (
                    <>
                      <button
                        type="button"
                        onClick={() => navigateTo(`/tenant/connectors/${platform.id}`)}
                        className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded hover:bg-slate-100"
                      >
                        Details & Logs
                      </button>
                      <button
                        type="button"
                        onClick={() => conn && setDisconnectTarget(conn)}
                        className="text-xs text-rose-600 hover:text-rose-800 font-semibold"
                      >
                        Disconnect
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => navigateTo(`/tenant/connectors/${platform.id}`)}
                      className="w-full py-1.5 px-3 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors shadow-xs"
                    >
                      Configure & Connect
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. Tenant-Owned Feed Special Setup Card (ADR-0050) */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-lg p-6 shadow-md border border-slate-700 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div className="space-y-2 max-w-xl">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 text-[10px] font-bold uppercase bg-blue-500/20 text-blue-300 border border-blue-400/30 rounded">
              DNS TXT Verified
            </span>
            <h2 className="text-lg font-bold">Tenant-Owned RSS / Atom Feed</h2>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Connect first-party company blogs, executive announcement feeds, and sovereign press portals with cryptographic DNS TXT domain verification (ADR-0050).
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigateTo('/tenant/connectors/tenant-owned-feed')}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-md transition-all shadow-sm shrink-0 whitespace-nowrap"
        >
          <span>Configure Custom Domain Feed</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Connect Modal */}
      {connectingPlatform && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-lg shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">
                Connect {connectingPlatform === 'gnews' ? 'GNews API' : connectingPlatform === 'azure_ai_language' ? 'Azure AI Language' : 'Azure OpenAI Service'}
              </h3>
              <button
                type="button"
                onClick={() => setConnectingPlatform(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveConnection} className="p-5 space-y-4 text-xs">
              {connectingPlatform === 'gnews' && (
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    GNews API Key
                  </label>
                  <input
                    type="password"
                    required
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="gn_live_xxxxxxxxxxxxxxxx"
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded font-mono focus-ring"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Obtained from your GNews.io account dashboard.
                  </p>
                </div>
              )}

              {connectingPlatform === 'azure_ai_language' && (
                <>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      Azure Cognitive Services Endpoint URL
                    </label>
                    <input
                      type="url"
                      required
                      value={endpoint}
                      onChange={(e) => setEndpoint(e.target.value)}
                      placeholder="https://<resource-name>.cognitiveservices.azure.com/"
                      className="w-full p-2 bg-slate-50 border border-slate-300 rounded font-mono focus-ring"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      Azure Language API Key
                    </label>
                    <input
                      type="password"
                      required
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="32-character hexadecimal key"
                      className="w-full p-2 bg-slate-50 border border-slate-300 rounded font-mono focus-ring"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      Azure Region
                    </label>
                    <select
                      value={region}
                      onChange={(e) => setRegion(e.target.value)}
                      className="w-full p-2 bg-slate-50 border border-slate-300 rounded focus-ring"
                    >
                      <option value="westeurope">West Europe</option>
                      <option value="eastus">East US</option>
                      <option value="northeurope">North Europe</option>
                      <option value="southeastasia">Southeast Asia</option>
                    </select>
                  </div>
                </>
              )}

              {connectingPlatform === 'azure_openai' && (
                <>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      Azure OpenAI Resource Endpoint
                    </label>
                    <input
                      type="url"
                      required
                      value={endpoint}
                      onChange={(e) => setEndpoint(e.target.value)}
                      placeholder="https://<resource-name>.openai.azure.com/"
                      className="w-full p-2 bg-slate-50 border border-slate-300 rounded font-mono focus-ring"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      Model Deployment Name
                    </label>
                    <input
                      type="text"
                      required
                      value={deploymentName}
                      onChange={(e) => setDeploymentName(e.target.value)}
                      placeholder="e.g. gpt-4o or gpt-4o-mini"
                      className="w-full p-2 bg-slate-50 border border-slate-300 rounded font-mono focus-ring"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      Azure OpenAI API Key
                    </label>
                    <input
                      type="password"
                      required
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="32-character hexadecimal key"
                      className="w-full p-2 bg-slate-50 border border-slate-300 rounded font-mono focus-ring"
                    />
                  </div>
                </>
              )}

              <div className="p-3 bg-amber-50 border border-amber-200 rounded text-[11px] text-amber-800 leading-relaxed">
                By clicking Connect, you confirm that your organization holds valid subscription agreements directly with this provider.
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setConnectingPlatform(null)}
                  className="px-4 py-2 text-slate-700 bg-white border border-slate-300 rounded font-medium hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded font-semibold shadow-xs"
                >
                  Save & Validate Connection
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Disconnect ConfirmModal */}
      {disconnectTarget && (
        <ConfirmModal
          isOpen={!!disconnectTarget}
          title={`Disconnect ${disconnectTarget.name}?`}
          body={
            <div className="space-y-2">
              <p>
                Disconnecting this platform will stop ingestion and purge stored API credentials from your tenant configuration.
              </p>
              <p className="text-xs text-slate-500 font-medium">
                Previously ingested posts will remain stored safely in your historical feed.
              </p>
            </div>
          }
          confirmLabel="Disconnect Platform"
          confirmVariant="destructive"
          onConfirm={() => {
            disconnectPlatform(disconnectTarget.id);
            setDisconnectTarget(null);
          }}
          onCancel={() => setDisconnectTarget(null)}
        />
      )}
    </div>
  );
};
