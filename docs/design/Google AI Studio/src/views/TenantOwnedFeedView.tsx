import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  Globe,
  Rss,
  Copy,
  Check,
  RefreshCw,
  ArrowLeft,
  ShieldCheck,
  AlertCircle,
  Clock,
  ExternalLink,
} from 'lucide-react';
import { StatusBadge } from '../components/StatusBadge';
import { ActivateDeactivateButton } from '../components/ActivateDeactivateButton';

export const TenantOwnedFeedView: React.FC = () => {
  const { connectors, verifyTenantOwnedDns, toggleConnectorActive, navigateTo } = useApp();

  const tenantFeedConn = connectors.find((c) => c.platformId === 'tenant_owned_feed');

  const [domain, setDomain] = useState(tenantFeedConn?.config?.customDomain || 'news.acme-global.com');
  const [feedUrl, setFeedUrl] = useState(tenantFeedConn?.config?.feedUrl || 'https://news.acme-global.com/rss/all-updates.xml');
  const [copiedHost, setCopiedHost] = useState(false);
  const [copiedValue, setCopiedValue] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<'verified' | 'pending' | null>(
    tenantFeedConn?.config?.dnsVerified ? 'verified' : null
  );

  const dnsHost = `_socialengage-challenge.${domain || 'news.example.com'}`;
  const dnsValue = tenantFeedConn?.config?.dnsTxtValue || 'se-verify-8f92a10b4c2e';

  const copyToClipboard = (text: string, type: 'host' | 'value') => {
    navigator.clipboard.writeText(text);
    if (type === 'host') {
      setCopiedHost(true);
      setTimeout(() => setCopiedHost(false), 2000);
    } else {
      setCopiedValue(true);
      setTimeout(() => setCopiedValue(false), 2000);
    }
  };

  const handleVerifyNow = async () => {
    if (!tenantFeedConn) return;
    setVerifying(true);
    setVerificationResult(null);
    try {
      const res = await verifyTenantOwnedDns(tenantFeedConn.id);
      setVerificationResult(res);
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="space-y-6" id="tenant-owned-feed-page">
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
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Tenant-Owned Feed Setup
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Two-step DNS TXT verification and custom RSS/Atom ingestion (ADR-0050)
            </p>
          </div>

          {tenantFeedConn && (
            <div className="flex items-center gap-3">
              <StatusBadge
                variant={
                  verificationResult === 'verified'
                    ? 'verified'
                    : verificationResult === 'pending'
                    ? 'pending'
                    : 'inactive'
                }
              />
              <ActivateDeactivateButton
                isActive={tenantFeedConn.isActive}
                onToggle={(active) => toggleConnectorActive(tenantFeedConn.id, active)}
              />
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Step 1: Connect Feed */}
        <div className="bg-white border border-slate-200 rounded-lg shadow-xs p-6 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">
              1
            </span>
            <h2 className="text-base font-semibold text-slate-900">Connect Custom Feed</h2>
          </div>

          <div className="space-y-4 text-xs">
            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Domain Name
              </label>
              <div className="relative">
                <Globe className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded font-mono focus-ring"
                  placeholder="news.example.com"
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                The sub-domain or apex domain where your RSS/Atom stream is published.
              </p>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Full RSS / Atom Feed URL
              </label>
              <div className="relative">
                <Rss className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="url"
                  value={feedUrl}
                  onChange={(e) => setFeedUrl(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded font-mono focus-ring"
                  placeholder="https://news.example.com/rss.xml"
                />
              </div>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded text-[11px] text-slate-600 space-y-1">
              <span className="font-semibold text-slate-800">Connector Activation ID:</span>
              <div className="font-mono text-slate-700">
                {tenantFeedConn?.config?.activationId || 'act-acme-domain-8812'}
              </div>
            </div>
          </div>
        </div>

        {/* Step 2: DNS TXT Verification Challenge */}
        <div className="bg-white border border-slate-200 rounded-lg shadow-xs p-6 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">
              2
            </span>
            <h2 className="text-base font-semibold text-slate-900">DNS TXT Verification</h2>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            To prove domain ownership, add the following cryptographic TXT record to your DNS zone before activating ingestion:
          </p>

          {/* DNS Records Box */}
          <div className="bg-slate-900 text-slate-100 p-4 rounded-lg space-y-3 font-mono text-xs">
            <div>
              <div className="flex items-center justify-between text-slate-400 text-[11px] uppercase mb-1">
                <span>Host / Name</span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(dnsHost, 'host')}
                  className="text-blue-400 hover:text-blue-300 flex items-center gap-1 text-[11px]"
                >
                  {copiedHost ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedHost ? 'Copied!' : 'Copy Host'}</span>
                </button>
              </div>
              <div className="bg-slate-800 p-2 rounded text-emerald-400 break-all select-all">
                {dnsHost}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-slate-400 text-[11px] uppercase mb-1">
                <span>Record Type / Value</span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(dnsValue, 'value')}
                  className="text-blue-400 hover:text-blue-300 flex items-center gap-1 text-[11px]"
                >
                  {copiedValue ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedValue ? 'Copied!' : 'Copy Value'}</span>
                </button>
              </div>
              <div className="bg-slate-800 p-2 rounded text-amber-300 break-all select-all">
                TXT "{dnsValue}"
              </div>
            </div>
          </div>

          <div className="p-3 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800 flex items-start gap-2">
            <Clock className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <span>
              DNS propagation can take between a few minutes and 72 hours depending on your TTL settings.
            </span>
          </div>

          {/* Verify Action & Status Feedback */}
          <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              {verificationResult === 'verified' && (
                <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
                  <Check className="w-4 h-4" />
                  <span>Domain verified & active</span>
                </div>
              )}
              {verificationResult === 'pending' && (
                <div className="flex items-center gap-1.5 text-xs font-medium text-amber-700">
                  <Clock className="w-4 h-4 animate-pulse" />
                  <span>DNS lookup pending (Record not yet propagated)</span>
                </div>
              )}
            </div>

            <button
              type="button"
              id="btn-verify-dns-now"
              disabled={verifying}
              onClick={handleVerifyNow}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors shadow-xs disabled:opacity-50"
            >
              {verifying ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Querying DNS resolvers...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Verify DNS now</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
