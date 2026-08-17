'use client';

import { useState } from 'react';
import { StatusBadge, type StatusBadgeVariant, ConfirmModal } from '@/components/ui';
import { ActivateDeactivateButton } from './ActivateDeactivateButton';

// ---------------------------------------------------------------------------
// Inline SVG icons (lucide-react not installed)
// ---------------------------------------------------------------------------

function IconGlobe() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

function IconRadio() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="2" />
      <path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14" />
    </svg>
  );
}

function IconSparkles() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v1M12 20v1M4.22 4.22l.7.7M18.36 18.36l.7.7M1 12h1M21 12h1M4.22 19.78l.7-.7M18.36 5.64l.7-.7" />
      <path d="M12 8a4 4 0 1 0 4 4A4 4 0 0 0 12 8z" />
    </svg>
  );
}

function IconShieldCheck() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <polyline points="9 12 11 14 15 10" />
    </svg>
  );
}

function IconAlertTriangle() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function IconArrowRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

function IconKey() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Types (exported so page.tsx can use them)
// ---------------------------------------------------------------------------

export interface PlatformDef {
  id: string;
  name: string;
  subtitle: string;
  description: string;
  authMode: 'api_key' | 'none';
  color: 'blue' | 'indigo' | 'purple' | 'emerald';
  icon: 'globe' | 'radio' | 'sparkles-purple' | 'sparkles-emerald';
  adNotice: 'billing' | 'public' | null;
  credentialFields: CredentialFieldDef[];
}

export interface CredentialFieldDef {
  key: string;
  label: string;
  type: 'password' | 'text' | 'url' | 'select';
  placeholder?: string;
  hint?: string;
  options?: { value: string; label: string }[];
}

export interface ConnectorInitialState {
  platformId: string;
  connected: boolean;
  credentialStatus: 'valid' | 'expiring_soon' | 'expired' | 'revoked' | null;
  isActive: boolean;
  /** Masked credential hint shown after connection (e.g. first 4 chars) */
  maskedHint: string | null;
}

interface ConnectorsClientProps {
  platforms: PlatformDef[];
  initialStates: ConnectorInitialState[];
  isTenantAdmin: boolean;
}

// ---------------------------------------------------------------------------
// Icon renderer
// ---------------------------------------------------------------------------

function PlatformIcon({ icon }: { icon: PlatformDef['icon'] }) {
  switch (icon) {
    case 'globe':            return <IconGlobe />;
    case 'radio':            return <IconRadio />;
    case 'sparkles-purple':
    case 'sparkles-emerald': return <IconSparkles />;
  }
}

// ---------------------------------------------------------------------------
// Status badge variant
// ---------------------------------------------------------------------------

function platformVariant(state: ConnectorInitialState, platform: PlatformDef): StatusBadgeVariant {
  if (!state.connected && platform.authMode !== 'none') return 'inactive';
  if (!state.isActive) return 'inactive';
  switch (state.credentialStatus) {
    case 'expiring_soon': return 'degraded';
    case 'expired':
    case 'revoked':       return 'failing';
    default:              return 'active';
  }
}

// ---------------------------------------------------------------------------
// Connect modal
// ---------------------------------------------------------------------------

function ConnectModal({
  platform,
  isTenantAdmin,
  onClose,
}: {
  platform: PlatformDef;
  isTenantAdmin: boolean;
  onClose: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const f of platform.credentialFields) {
      init[f.key] = '';
    }
    return init;
  });
  const [ownerType, setOwnerType] = useState<'tenant' | 'user'>(isTenantAdmin ? 'tenant' : 'user');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const singleField = platform.credentialFields.length === 1;
    const credential = singleField
      ? (values[platform.credentialFields[0].key] ?? '')
      : JSON.stringify(values);

    try {
      const response = await fetch(`/api/connectors/${encodeURIComponent(platform.id)}/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential, ownerType }),
      });
      const body = await response.json().catch(() => ({}));
      if (response.status === 201) {
        window.location.reload();
        return;
      }
      setError(body.error ?? 'Something went wrong while connecting this platform.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-dialog cv-connect-modal" role="dialog" aria-modal="true" aria-labelledby="cv-connect-title">
        {/* Header */}
        <div className="cv-modal-header">
          <h3 id="cv-connect-title">Connect {platform.name}</h3>
          <button type="button" className="slideover-close-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="cv-modal-form">
          {platform.credentialFields.map((field) => (
            <div key={field.key} className="form-group">
              <label className="form-label" htmlFor={`cv-field-${platform.id}-${field.key}`}>
                {field.label}
              </label>
              {field.type === 'select' ? (
                <select
                  id={`cv-field-${platform.id}-${field.key}`}
                  className="form-select"
                  value={values[field.key] ?? ''}
                  onChange={(e) => setValues((p) => ({ ...p, [field.key]: e.target.value }))}
                >
                  {field.options?.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              ) : (
                <input
                  id={`cv-field-${platform.id}-${field.key}`}
                  type={field.type}
                  required
                  className="form-input cv-mono-input"
                  placeholder={field.placeholder}
                  value={values[field.key] ?? ''}
                  onChange={(e) => setValues((p) => ({ ...p, [field.key]: e.target.value }))}
                />
              )}
              {field.hint && <p className="form-hint">{field.hint}</p>}
            </div>
          ))}

          {isTenantAdmin && (
            <div className="form-group">
              <label className="form-label" htmlFor={`cv-scope-${platform.id}`}>Scope</label>
              <select
                id={`cv-scope-${platform.id}`}
                className="form-select"
                value={ownerType}
                onChange={(e) => setOwnerType(e.target.value as 'tenant' | 'user')}
              >
                <option value="tenant">Tenant-wide (all users)</option>
                <option value="user">Just for me</option>
              </select>
            </div>
          )}

          <div className="cv-billing-notice cv-billing-notice-amber">
            <IconAlertTriangle />
            <span>
              By clicking Connect, you confirm your organisation holds valid subscription agreements directly with this provider.
            </span>
          </div>

          {error && <p role="alert" className="cv-modal-error">{error}</p>}

          <div className="form-actions cv-modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Connecting…' : 'Save & Validate Connection'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ConnectorsClient({ platforms, initialStates, isTenantAdmin }: ConnectorsClientProps) {
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  const stateMap = new Map(initialStates.map((s) => [s.platformId, s]));

  const connectingPlatform = connectingId ? platforms.find((p) => p.id === connectingId) ?? null : null;
  const disconnectingPlatform = disconnectingId ? platforms.find((p) => p.id === disconnectingId) ?? null : null;
  const disconnectingState = disconnectingId ? stateMap.get(disconnectingId) ?? null : null;

  async function handleDisconnectConfirm() {
    if (!disconnectingId) return;
    setDisconnecting(true);
    const ownerType = isTenantAdmin ? 'tenant' : 'user';
    await fetch(
      `/api/connectors/${encodeURIComponent(disconnectingId)}/disconnect?ownerType=${encodeURIComponent(ownerType)}`,
      { method: 'DELETE' }
    );
    setDisconnecting(false);
    setDisconnectingId(null);
    window.location.reload();
  }

  // Split platforms: standard grid cards (first 4) vs the special tenant-owned-feed banner handled separately
  const gridPlatforms = platforms;

  return (
    <div className="cv-root">
      {/* Page Header */}
      <div className="cv-header">
        <div>
          <h1 className="page-title">Connect a Platform</h1>
          <p className="page-subtitle">
            Configure external data ingestion sources and Azure AI cognitive enrichment pipelines
          </p>
        </div>
        <a href="/tenant/connectors/status" className="btn btn-secondary btn-sm cv-status-link">
          View Connector Status &amp; Latency <IconArrowRight />
        </a>
      </div>

      {/* Billing disclaimer (ADR-0027) */}
      <div className="cv-disclaimer">
        Before submitting a credential, confirm that you are creating your own account or API key directly
        with the provider under that provider&apos;s own terms. SocialEngage is not a billing intermediary.
      </div>

      {/* Platform cards grid */}
      <div className="cv-grid">
        {gridPlatforms.map((platform) => {
          const state = stateMap.get(platform.id) ?? {
            platformId: platform.id, connected: false, credentialStatus: null, isActive: false, maskedHint: null,
          };
          const variant = platformVariant(state, platform);
          const isConnected = platform.authMode === 'none' || state.connected;

          return (
            <div key={platform.id} className={`cv-card cv-card-${platform.color}`}>
              {/* Card top: icon + title + badge */}
              <div className="cv-card-header">
                <div className="cv-card-title-group">
                  <div className={`cv-platform-icon cv-platform-icon-${platform.color}`}>
                    <PlatformIcon icon={platform.icon} />
                  </div>
                  <div>
                    <h2 className="cv-card-name">{platform.name}</h2>
                    <span className={`cv-card-subtitle cv-card-subtitle-${platform.color}`}>{platform.subtitle}</span>
                  </div>
                </div>
                <StatusBadge variant={variant} />
              </div>

              {/* Description */}
              <p className="cv-card-description">{platform.description}</p>

              {/* Notice */}
              {platform.adNotice === 'billing' && (
                <div className="cv-billing-notice cv-billing-notice-amber">
                  <IconAlertTriangle />
                  <span>
                    You connect using your own account and API key directly with {platform.name}. SocialEngage is not a billing intermediary.
                  </span>
                </div>
              )}
              {platform.adNotice === 'public' && (
                <div className="cv-billing-notice cv-billing-notice-slate">
                  <IconShieldCheck />
                  <span>
                    Direct public feed integration provided under standard open syndication terms.
                  </span>
                </div>
              )}

              {/* Masked credential hint when connected */}
              {isConnected && state.maskedHint && (
                <div className="cv-credential-row">
                  <span className="cv-credential-label">
                    <IconKey /> Credential
                  </span>
                  <span className="cv-credential-value">{state.maskedHint}</span>
                </div>
              )}

              {/* Expiry warning */}
              {state.credentialStatus === 'expiring_soon' && (
                <div className="cv-billing-notice cv-billing-notice-amber cv-expiry-notice">
                  <IconAlertTriangle />
                  <span>Credential is expiring soon — reconnect to avoid interruption.</span>
                </div>
              )}
              {(state.credentialStatus === 'expired' || state.credentialStatus === 'revoked') && (
                <div className="cv-billing-notice cv-billing-notice-red">
                  <IconAlertTriangle />
                  <span>Credential {state.credentialStatus} — reconnect to restore ingestion.</span>
                </div>
              )}

              {/* Footer actions */}
              <div className="cv-card-footer">
                {platform.authMode === 'none' ? (
                  /* Newswire: no credential, just activation */
                  <>
                    <ActivateDeactivateButton
                      platformId={platform.id}
                      ownerType="tenant"
                      isActive={state.isActive}
                    />
                    <span className="cv-public-label">Public Channel</span>
                  </>
                ) : isConnected ? (
                  /* Connected: activate/deactivate + disconnect */
                  <>
                    <div className="cv-card-footer-left">
                      {isTenantAdmin && (
                        <ActivateDeactivateButton
                          platformId={platform.id}
                          ownerType="tenant"
                          isActive={state.isActive}
                        />
                      )}
                      <ActivateDeactivateButton
                        platformId={platform.id}
                        ownerType="user"
                        isActive={false}
                      />
                    </div>
                    {isTenantAdmin && (
                      <button
                        type="button"
                        className="cv-disconnect-btn"
                        onClick={() => setDisconnectingId(platform.id)}
                      >
                        Disconnect
                      </button>
                    )}
                  </>
                ) : (
                  /* Not connected: full-width connect button */
                  <button
                    type="button"
                    className="btn btn-primary cv-connect-btn"
                    onClick={() => setConnectingId(platform.id)}
                  >
                    Connect {platform.name}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Tenant-Owned Feed Banner (ADR-0050) */}
      <div className="cv-tof-banner">
        <div className="cv-tof-banner-body">
          <div className="cv-tof-banner-title-row">
            <span className="cv-tof-badge">DNS TXT Verified</span>
            <h2 className="cv-tof-title">Tenant-Owned RSS / Atom Feed</h2>
          </div>
          <p className="cv-tof-description">
            Connect first-party company blogs, executive announcement feeds, and sovereign press portals
            with cryptographic DNS TXT domain verification (ADR-0050).
          </p>
        </div>
        <a href="/tenant/connectors/tenant-owned-feed" className="btn btn-primary cv-tof-btn">
          Configure Custom Domain Feed <IconArrowRight />
        </a>
      </div>

      {/* Connect Modal */}
      {connectingPlatform && (
        <ConnectModal
          platform={connectingPlatform}
          isTenantAdmin={isTenantAdmin}
          onClose={() => setConnectingId(null)}
        />
      )}

      {/* Disconnect Confirm Modal */}
      {disconnectingPlatform && (
        <ConfirmModal
          isOpen={!!disconnectingPlatform}
          title={`Disconnect ${disconnectingPlatform.name}?`}
          body={
            <div>
              <p>
                Disconnecting this platform will stop ingestion and purge stored API credentials from
                your tenant configuration.
              </p>
              <p style={{ fontSize: '0.8125rem', marginTop: '0.5rem', color: 'var(--color-text-secondary)' }}>
                Previously ingested posts will remain stored safely in your historical feed.
              </p>
            </div>
          }
          confirmLabel="Disconnect Platform"
          confirmVariant="destructive"
          onConfirm={handleDisconnectConfirm}
          onCancel={() => setDisconnectingId(null)}
        />
      )}
    </div>
  );
}
