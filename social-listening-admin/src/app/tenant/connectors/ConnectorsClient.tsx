'use client';

import { useState, useEffect } from 'react';
import { StatusBadge, type StatusBadgeVariant, ConfirmModal } from '@/components/ui';
import { IngestionAlertBanner } from '@/components/IngestionAlertBanner';
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

/** Story 6.21 — Wikipedia's own icon, distinct from GNews's globe so the two connectors are never visually identical on the same screen. */
function IconBookOpen() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 7v14" />
      <path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" />
    </svg>
  );
}

/** Story 6.23 — Facebook's own icon (the platform's own lowercase-f glyph shape), distinct from GNews's globe even though both share the "blue" colour family. */
function IconFacebookF() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.5 1.49-3.89 3.78-3.89 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.44 2.89h-2.34v6.99A10 10 0 0 0 22 12z" />
    </svg>
  );
}

/** Story 6.30 — Brave Search's own search icon glyph. */
function IconBraveSearch() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

/** Story 6.32 — Bing Search's own search/Azure discovery icon glyph. */
function IconBingSearch() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="10.5" cy="10.5" r="7.5" />
      <line x1="21" y1="21" x2="15.8" y2="15.8" />
      <path d="M7 10.5h7" />
    </svg>
  );
}

/** Story 6.34 — Instagram's own camera/outline glyph shape (pink/gradient family). */
function IconInstagram() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}

/** Story 6.35 — LinkedIn's own "in" icon glyph shape (blue family). */
function IconLinkedIn() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z" />
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
  /** Story 6.23 (ADR-0059) — 'oauth' added for Facebook, this project's first redirect-based connector. */
  authMode: 'api_key' | 'none' | 'oauth';
  color: 'blue' | 'indigo' | 'purple' | 'emerald' | 'amber' | 'pink';
  icon: 'globe' | 'radio' | 'sparkles-purple' | 'sparkles-emerald' | 'book-open' | 'facebook' | 'brave-search' | 'bing-search' | 'instagram' | 'linkedin';
  adNotice: 'billing' | 'public' | null;
  credentialFields: CredentialFieldDef[];
  /**
   * ADR-0028 Decision §1 (Clarification, 2026-08-17) — false for any
   * AIProviderConnector (Azure AI Language, Azure OpenAI): Tier 2 only, no
   * personal/Tier 3 credential or activation is possible. The backend
   * already rejects `ownerType: 'user'` for these (`connectorsRouter.ts`'s
   * `forbidsUserScope()`) — this flag keeps the UI from ever offering the
   * choice in the first place, closing the exact live gap that surfaced:
   * a personal "Activate" click silently succeeding but having no effect,
   * since enrichPost.ts only ever reads the tenant-wide scope.
   */
  personalScopeAllowed: boolean;
  /**
   * Story 6.23 (ADR-0059 Decision §4) — false suppresses every tenant-wide
   * connect/activate/disconnect control unconditionally, even for a
   * tenant_admin session. Optional, defaulting to true (unchanged
   * behavior) for every existing platform — only Facebook sets this
   * false, since the backend has no tenant-wide credential path for it
   * at all (Tier 3-only).
   */
  tenantScopeAllowed?: boolean;
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
  /** Story 6.23 — raw ConnectorStatus.status, so the UI can detect 'reconnect_required' distinctly from ordinary credentialStatus-derived states. */
  status: 'healthy' | 'degraded' | 'failing' | 'disconnected' | 'reconnect_required' | 'stalled' | null;
  /** Masked credential hint shown after connection (e.g. first 4 chars) */
  maskedHint: string | null;
}

/** Story 6.23 — one row of the Facebook OAuth exchange's own returned Page list (core-client.ts's FacebookOAuthExchangeOutcome). */
export interface FacebookPendingPage {
  id: string;
  name: string;
  category?: string;
}

/** Story 6.27 (ADR-0060 Decision §5) — one row of the caller's own connected Facebook Pages list (core-client.ts's FacebookConnectedPageRow). */
export interface FacebookConnectedPageRow {
  id: string;
  pageId: string;
  pageName: string;
  status: 'connected' | 'removed' | 'orphaned';
  connectorHealth: {
    status: 'healthy' | 'degraded' | 'failing' | 'disconnected' | 'reconnect_required' | 'stalled';
    lastSuccessfulFetchAt: string | null;
    lastAttemptAt: string | null;
    consecutiveFailures: number;
    credentialStatus: string | null;
  };
}

export interface FacebookPagesResponse {
  parentConnectionActive: boolean;
  pages: FacebookConnectedPageRow[];
}

export interface InstagramPendingAccount {
  igUserId: string;
  username: string;
  name?: string;
  profilePictureUrl?: string;
  followersCount?: number;
  pageId: string;
  pageName: string;
}

export interface InstagramConnectedAccountRow {
  id: string;
  igUserId: string;
  username: string;
  pageId: string;
  pageName: string;
  status: 'connected' | 'removed' | 'orphaned' | 'reconnect_required';
  connectorHealth: {
    status: 'healthy' | 'degraded' | 'failing' | 'disconnected' | 'reconnect_required' | 'stalled';
    lastSuccessfulFetchAt: string | null;
    lastAttemptAt: string | null;
    consecutiveFailures: number;
    credentialStatus: string | null;
  };
}

export interface InstagramAccountsResponse {
  parentConnectionActive: boolean;
  accounts: InstagramConnectedAccountRow[];
}

interface ConnectorsClientProps {
  platforms: PlatformDef[];
  initialStates: ConnectorInitialState[];
  isTenantAdmin: boolean;
  /**
   * Story 6.23 — seeds the Facebook picker state directly for a static render.
   */
  initialFacebookPending?: { sessionToken: string; pages: FacebookPendingPage[] } | null;
  /**
   * Story 6.27 — seeds the connected Facebook Pages list directly for a static render.
   */
  initialFacebookPages?: FacebookPagesResponse | null;
  /**
   * Story 6.34 — seeds the Instagram account picker state directly for a static render.
   */
  initialInstagramPending?: { sessionToken: string; accounts: InstagramPendingAccount[] } | null;
  /**
   * Story 6.34 — seeds the connected Instagram accounts list directly for a static render.
   */
  initialInstagramAccounts?: InstagramAccountsResponse | null;
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
    case 'book-open':        return <IconBookOpen />;
    case 'facebook':         return <IconFacebookF />;
    case 'brave-search':     return <IconBraveSearch />;
    case 'bing-search':      return <IconBingSearch />;
    case 'instagram':        return <IconInstagram />;
    case 'linkedin':         return <IconLinkedIn />;
  }
}

// ---------------------------------------------------------------------------
// Status badge variant
// ---------------------------------------------------------------------------

/**
 * Story 6.23 (Story 2.15 AC7) — 'reconnect_required' takes priority over
 * every other derivation: a credential-invalidation failure is a distinct
 * problem from ordinary expiring_soon/expired/revoked credentialStatus
 * states, and must render its own distinct badge, never fall through to
 * 'failing'/'inactive'.
 */
function platformVariant(state: ConnectorInitialState, platform: PlatformDef): StatusBadgeVariant {
  if (state.status === 'reconnect_required') return 'reconnect_required';
  if (state.status === 'stalled') return 'stalled';
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
  const [ownerType, setOwnerType] = useState<'tenant' | 'user'>(
    platform.personalScopeAllowed && !isTenantAdmin ? 'user' : 'tenant'
  );
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

          {isTenantAdmin && platform.personalScopeAllowed && (
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
          {!platform.personalScopeAllowed && (
            <p className="form-hint">
              {platform.name} is always connected tenant-wide — no personal, per-user connection is possible.
            </p>
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
// Facebook Page picker (Story 6.23/6.27, ADR-0059 Decision §3/§4, ADR-0060 Decision §5/§6)
// ---------------------------------------------------------------------------

/**
 * Renders the Page picker once the OAuth exchange has returned a real
 * {sessionToken, pages} pending result (see the mount effect in the main
 * component below). A real, named edge case (AC6): zero returned Pages
 * shows a specific message, never a blank list or a generic error.
 *
 * Story 6.27 (ADR-0060 Decision §5/§6) — multi-select: checkboxes replace
 * the original radiogroup, submitting the plural `pageIds` array
 * `selectFacebookPages()`/the revised select-page proxy now expect. A
 * successful (or partially successful) submission shows a confirmation
 * step rendering both the `connected` and `errors` arrays from the
 * backend's own structured partial-failure response — never collapsed
 * into one opaque pass/fail state.
 */
function FacebookPagePickerModal({
  platformName,
  pending,
  onClose,
  onDone,
}: {
  platformName: string;
  pending: { sessionToken: string; pages: FacebookPendingPage[] };
  onClose: () => void;
  onDone: () => void;
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ connected: { pageId: string; pageName: string }[]; errors: { pageId: string; reason: string }[] } | null>(null);

  function toggle(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function handleConfirm() {
    if (selectedIds.length === 0) return;
    setError(null);
    setSubmitting(true);
    try {
      const response = await fetch('/api/connectors/facebook/oauth/select-page', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionToken: pending.sessionToken, pageIds: selectedIds }),
      });
      const body = await response.json().catch(() => ({}));
      if (response.status === 201) {
        setResult({ connected: body.connected ?? [], errors: body.errors ?? [] });
        return;
      }
      setError(body.error ?? 'Something went wrong while connecting these Pages.');
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return (
      <div className="modal-backdrop" role="presentation">
        <div className="modal-dialog cv-connect-modal" role="dialog" aria-modal="true" aria-labelledby="cv-fb-result-title">
          <div className="cv-modal-header">
            <h3 id="cv-fb-result-title">
              Connected {result.connected.length} of {result.connected.length + result.errors.length} Page{result.connected.length + result.errors.length === 1 ? '' : 's'}
            </h3>
          </div>
          {result.connected.length > 0 && (
            <ul className="cv-fb-result-list cv-fb-result-connected">
              {result.connected.map((c) => (
                <li key={c.pageId}>{c.pageName}</li>
              ))}
            </ul>
          )}
          {result.errors.length > 0 && (
            <ul className="cv-fb-result-list cv-fb-result-errors">
              {result.errors.map((e) => (
                <li key={e.pageId}>{e.reason}</li>
              ))}
            </ul>
          )}
          <div className="form-actions cv-modal-actions">
            <button type="button" className="btn btn-primary" onClick={onDone}>
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-dialog cv-connect-modal" role="dialog" aria-modal="true" aria-labelledby="cv-fb-picker-title">
        <div className="cv-modal-header">
          <h3 id="cv-fb-picker-title">
            {pending.pages.length === 0 ? `Connect ${platformName}` : 'Choose Facebook Pages'}
          </h3>
          <button type="button" className="slideover-close-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {pending.pages.length === 0 ? (
          <p className="cv-modal-empty-state">
            No Facebook Pages found for this account — you need to be an admin of a Page to connect it.
          </p>
        ) : (
          <>
            <div className="cv-page-picker-list" role="group" aria-label="Facebook Pages">
              {pending.pages.map((page) => (
                <label key={page.id} className="cv-page-picker-row">
                  <input
                    type="checkbox"
                    value={page.id}
                    checked={selectedIds.includes(page.id)}
                    onChange={() => toggle(page.id)}
                  />
                  <span className="cv-page-picker-name">{page.name}</span>
                  {page.category && <span className="cv-page-picker-category">{page.category}</span>}
                </label>
              ))}
            </div>

            {error && <p role="alert" className="cv-modal-error">{error}</p>}

            <div className="form-actions cv-modal-actions">
              <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={handleConfirm} disabled={submitting || selectedIds.length === 0}>
                {submitting ? 'Connecting…' : `Connect ${selectedIds.length || ''} selected Page${selectedIds.length === 1 ? '' : 's'}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Facebook connected-Pages list (Story 6.27, ADR-0060 Decision §4/§6)
// ---------------------------------------------------------------------------

/** Mirrors connector-status-view's own deriveVariant() precedent — 'disconnected' reads as 'active' for connected assets with no poller runs yet, 'inactive' otherwise. */
function derivePageVariant(health: FacebookConnectedPageRow['connectorHealth'], itemStatus?: string): StatusBadgeVariant {
  if (health.status === 'reconnect_required') return 'reconnect_required';
  switch (health.status) {
    case 'healthy':      return 'healthy';
    case 'degraded':     return 'degraded';
    case 'failing':      return 'failing';
    case 'stalled':      return 'stalled';
    case 'disconnected': return itemStatus === 'connected' ? 'active' : 'inactive';
    default:              return itemStatus === 'connected' ? 'active' : 'inactive';
  }
}

/**
 * One connected/orphaned Page's own row — name, health (or, for an
 * orphaned row, its own distinct honestly-labeled state, never the
 * ordinary health badge), and per-row actions. `orphaned` and a
 * `reconnect_required` health both get a real "Reconnect" action here —
 * the row-level remediation ADR-0060 Decision §6's own last bullet calls
 * for, replacing the card-level "Reconnect Facebook" link that used to
 * restart the whole multi-Page flow (see the card footer below).
 */
function FacebookPageRow({ page, onDisconnect }: { page: FacebookConnectedPageRow; onDisconnect: (id: string) => void }) {
  const isOrphaned = page.status === 'orphaned';
  const needsReconnect = isOrphaned || page.connectorHealth.status === 'reconnect_required';

  return (
    <div className="cv-fb-page-row">
      <span className="cv-fb-page-name">{page.pageName}</span>
      {isOrphaned ? (
        <span className="cv-fb-page-orphaned">Access lost — reconnect to restore this Page</span>
      ) : (
        <StatusBadge variant={derivePageVariant(page.connectorHealth, page.status)} />
      )}
      {needsReconnect && (
        <a href="/api/connectors/facebook/oauth/start" className="cv-fb-page-reconnect">
          Reconnect
        </a>
      )}
      <button type="button" className="cv-fb-page-disconnect" onClick={() => onDisconnect(page.id)}>
        Disconnect this Page
      </button>
    </div>
  );
}

/**
 * The real per-Page list replacing Story 6.23's single cached
 * `facebookConnectedPage` name + one `ActivateDeactivateButton` footer
 * (ADR-0060 Decision §6). `removed` rows are never shown here (the list is
 * "one row per connected or orphaned Page," per that decision's own text)
 * — a soft-removed Page survives as backend history only.
 * `parentConnectionActive === false` renders an explicit banner rather
 * than showing every row as if it were actively polling.
 */
function FacebookConnectedPagesList({ initialPages }: { initialPages?: FacebookPagesResponse | null }) {
  const [data, setData] = useState<FacebookPagesResponse | null>(initialPages ?? null);

  async function refresh() {
    const res = await fetch('/api/connectors/facebook/pages');
    const body = await res.json().catch(() => null);
    if (body) setData(body);
  }

  useEffect(() => {
    if (typeof window === 'undefined') return;
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleDisconnect(id: string) {
    await fetch(`/api/connectors/facebook/pages/${encodeURIComponent(id)}`, { method: 'DELETE' });
    await refresh();
  }

  if (!data) return null;
  const visiblePages = data.pages.filter((p) => p.status !== 'removed');
  if (visiblePages.length === 0) return null;

  return (
    <div className="cv-fb-pages-list">
      {!data.parentConnectionActive && (
        <p className="cv-fb-deactivated-banner">
          {visiblePages.length} Page{visiblePages.length === 1 ? '' : 's'} connected, but your personal Facebook connection is currently deactivated — none of them are being polled.
        </p>
      )}
      {visiblePages.map((page) => (
        <FacebookPageRow key={page.id} page={page} onDisconnect={handleDisconnect} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Instagram account picker modal (Story 6.34, ADR-0068)
// ---------------------------------------------------------------------------

function InstagramAccountPickerModal({
  platformName,
  pending,
  onClose,
  onDone,
}: {
  platformName: string;
  pending: { sessionToken: string; accounts: InstagramPendingAccount[] };
  onClose: () => void;
  onDone: () => void;
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    connected: { igUserId: string; username: string; pageName: string }[];
    errors: { igUserId: string; reason: string }[];
  } | null>(null);

  function toggle(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function handleConfirm() {
    if (selectedIds.length === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch('/api/connectors/instagram/oauth/select-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionToken: pending.sessionToken, igUserIds: selectedIds }),
      });
      const body = await response.json().catch(() => ({}));
      if (response.status === 201) {
        setResult({ connected: body.connected ?? [], errors: body.errors ?? [] });
        return;
      }
      setError(body.error ?? 'Something went wrong while connecting these Instagram accounts.');
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return (
      <div className="modal-backdrop" role="presentation">
        <div className="modal-dialog cv-connect-modal" role="dialog" aria-modal="true" aria-labelledby="cv-ig-result-title">
          <div className="cv-modal-header">
            <h3 id="cv-ig-result-title">
              Connected {result.connected.length} of {result.connected.length + result.errors.length} Account{result.connected.length + result.errors.length === 1 ? '' : 's'}
            </h3>
          </div>
          {result.connected.length > 0 && (
            <ul className="cv-fb-result-list cv-fb-result-connected">
              {result.connected.map((c) => (
                <li key={c.igUserId}>@{c.username} ({c.pageName})</li>
              ))}
            </ul>
          )}
          {result.errors.length > 0 && (
            <ul className="cv-fb-result-list cv-fb-result-errors">
              {result.errors.map((e) => (
                <li key={e.igUserId}>{e.reason}</li>
              ))}
            </ul>
          )}
          <div className="form-actions cv-modal-actions">
            <button type="button" className="btn btn-primary" onClick={onDone}>
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-dialog cv-connect-modal" role="dialog" aria-modal="true" aria-labelledby="cv-ig-picker-title">
        <div className="cv-modal-header">
          <h3 id="cv-ig-picker-title">
            {pending.accounts.length === 0 ? `Connect ${platformName}` : 'Choose Instagram Accounts'}
          </h3>
          <button type="button" className="slideover-close-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {pending.accounts.length === 0 ? (
          <p className="cv-modal-empty-state">
            No linked Instagram Business or Creator accounts found for your Facebook Pages. Make sure your Instagram account is switched to Professional/Business and linked to a Facebook Page.
          </p>
        ) : (
          <>
            <div className="cv-page-picker-list" role="group" aria-label="Instagram Accounts">
              {pending.accounts.map((account) => (
                <label key={account.igUserId} className="cv-page-picker-row">
                  <input
                    type="checkbox"
                    value={account.igUserId}
                    checked={selectedIds.includes(account.igUserId)}
                    onChange={() => toggle(account.igUserId)}
                  />
                  <span className="cv-page-picker-name">@{account.username}</span>
                  <span className="cv-page-picker-category">Page: {account.pageName}</span>
                </label>
              ))}
            </div>

            {error && <p role="alert" className="cv-modal-error">{error}</p>}

            <div className="form-actions cv-modal-actions">
              <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={handleConfirm} disabled={submitting || selectedIds.length === 0}>
                {submitting ? 'Connecting…' : `Connect ${selectedIds.length || ''} selected Account${selectedIds.length === 1 ? '' : 's'}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Instagram connected-Accounts list (Story 6.34, ADR-0068)
// ---------------------------------------------------------------------------

function InstagramAccountRow({ account, onDisconnect }: { account: InstagramConnectedAccountRow; onDisconnect: (id: string) => void }) {
  const isOrphaned = account.status === 'orphaned';
  const needsReconnect = isOrphaned || account.status === 'reconnect_required' || account.connectorHealth.status === 'reconnect_required';

  return (
    <div className="cv-fb-page-row">
      <span className="cv-fb-page-name">@{account.username} <small style={{ opacity: 0.7, fontSize: '0.75rem' }}>({account.pageName})</small></span>
      {isOrphaned ? (
        <span className="cv-fb-page-orphaned">Access lost — reconnect to restore this account</span>
      ) : (
        <StatusBadge variant={derivePageVariant(account.connectorHealth, account.status)} />
      )}
      {needsReconnect && (
        <a href="/api/connectors/instagram/oauth/start" className="cv-fb-page-reconnect">
          Reconnect
        </a>
      )}
      <button type="button" className="cv-fb-page-disconnect" onClick={() => onDisconnect(account.id)}>
        Disconnect this Account
      </button>
    </div>
  );
}

function InstagramConnectedAccountsList({ initialAccounts }: { initialAccounts?: InstagramAccountsResponse | null }) {
  const [data, setData] = useState<InstagramAccountsResponse | null>(initialAccounts ?? null);

  async function refresh() {
    const res = await fetch('/api/connectors/instagram/accounts');
    const body = await res.json().catch(() => null);
    if (body) setData(body);
  }

  useEffect(() => {
    if (typeof window === 'undefined') return;
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleDisconnect(id: string) {
    await fetch(`/api/connectors/instagram/accounts/${encodeURIComponent(id)}`, { method: 'DELETE' });
    await refresh();
  }

  if (!data) return null;
  const visibleAccounts = (data.accounts || []).filter((a) => a.status !== 'removed');
  if (visibleAccounts.length === 0) return null;

  return (
    <div className="cv-fb-pages-list">
      {!data.parentConnectionActive && (
        <p className="cv-fb-deactivated-banner">
          {visibleAccounts.length} Instagram account{visibleAccounts.length === 1 ? '' : 's'} connected, but your personal Instagram connection is currently deactivated — none of them are being polled.
        </p>
      )}
      {visibleAccounts.map((account) => (
        <InstagramAccountRow key={account.id} account={account} onDisconnect={handleDisconnect} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ConnectorsClient({
  platforms,
  initialStates,
  isTenantAdmin,
  initialFacebookPending = null,
  initialFacebookPages = null,
  initialInstagramPending = null,
  initialInstagramAccounts = null,
}: ConnectorsClientProps) {
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const [facebookPending, setFacebookPending] = useState<{ sessionToken: string; pages: FacebookPendingPage[] } | null>(
    initialFacebookPending
  );
  const [instagramPending, setInstagramPending] = useState<{ sessionToken: string; accounts: InstagramPendingAccount[] } | null>(
    initialInstagramPending
  );

  const stateMap = new Map(initialStates.map((s) => [s.platformId, s]));

  const connectingPlatform = connectingId ? platforms.find((p) => p.id === connectingId) ?? null : null;
  const disconnectingPlatform = disconnectingId ? platforms.find((p) => p.id === disconnectingId) ?? null : null;
  const disconnectingState = disconnectingId ? stateMap.get(disconnectingId) ?? null : null;

  // Story 6.23 / 6.34 — real production path for the pickers
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('fbConnect') === '1') {
      fetch('/api/connectors/facebook/oauth/pending')
        .then((r) => r.json())
        .then((data) => {
          if (data) setFacebookPending(data);
        })
        .catch(() => undefined);
    }
    if (params.get('igConnect') === '1') {
      fetch('/api/connectors/instagram/oauth/pending')
        .then((r) => r.json())
        .then((data) => {
          if (data) setInstagramPending(data);
        })
        .catch(() => undefined);
    }
  }, []);

  async function handleDisconnectConfirm() {
    if (!disconnectingId) return;
    setDisconnecting(true);
    // Story 6.23 — a tenantScopeAllowed:false platform (Facebook) has no
    // tenant-wide credential to disconnect at all; defensive even though
    // no UI path currently offers a Disconnect control for it (see
    // connector-connect-disconnect/SKILL.md's Known gaps).
    const ownerType = isTenantAdmin && disconnectingPlatform?.tenantScopeAllowed !== false ? 'tenant' : 'user';
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

  const activeIssues = initialStates
    .filter(
      (s) =>
        s.isActive &&
        (s.status === 'stalled' || s.status === 'failing' || s.status === 'reconnect_required')
    )
    .map((s) => {
      const p = platforms.find((pl) => pl.id === s.platformId);
      return {
        platformId: s.platformId,
        platformName: p?.name ?? s.platformId,
        status: s.status as 'stalled' | 'failing' | 'reconnect_required',
      };
    });

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

      {/* Global Ingestion Alert Banner (Story 6.29 / ADR-0070) */}
      <IngestionAlertBanner issues={activeIssues} isTenantAdmin={isTenantAdmin} />

      {/* Billing disclaimer (ADR-0027) */}
      <div className="cv-disclaimer">
        Before submitting a credential, confirm that you are creating your own account or API key directly
        with the provider under that provider&apos;s own terms. SocialEngage is not a billing intermediary.
      </div>

      {/* Platform cards grid */}
      <div className="cv-grid">
        {gridPlatforms.map((platform) => {
          const state = stateMap.get(platform.id) ?? {
            platformId: platform.id, connected: false, credentialStatus: null, isActive: false, status: null, maskedHint: null,
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
                {platform.id === 'facebook' ? (
                  /* Story 6.23/6.27 (ADR-0059 Decision §3/§4, ADR-0060
                     Decision §6) — Facebook: a real browser redirect, never
                     a ConnectModal credential-field submission. The
                     card-level badge stays a pure rollup signal once
                     connected — reconnect_required no longer renders a
                     single "Reconnect Facebook" link that would restart the
                     whole multi-Page flow (ADR-0060 Decision §6's own last
                     bullet); the real per-Page remediation lives in the
                     connected-Pages list's own row-level actions below. */
                  isConnected ? (
                    <div className="cv-card-footer-left cv-fb-footer">
                      {variant === 'reconnect_required' && (
                        <span className="cv-fb-rollup-note">One or more Pages need attention — see your Page list below.</span>
                      )}
                      <FacebookConnectedPagesList initialPages={initialFacebookPages} />
                      <a href="/api/connectors/facebook/oauth/start" className="btn btn-secondary btn-sm">
                        Connect another Page
                      </a>
                      <ActivateDeactivateButton
                        platformId={platform.id}
                        ownerType="user"
                        isActive={state.isActive}
                      />
                    </div>
                  ) : (
                    <a href="/api/connectors/facebook/oauth/start" className="btn btn-primary cv-connect-btn">
                      Connect {platform.name}
                    </a>
                  )
                ) : platform.id === 'instagram' ? (
                  /* Story 6.34 (ADR-0068) — Instagram Business multi-account connector */
                  isConnected ? (
                    <div className="cv-card-footer-left cv-fb-footer">
                      {variant === 'reconnect_required' && (
                        <span className="cv-fb-rollup-note">One or more Instagram accounts need attention — see your account list below.</span>
                      )}
                      <InstagramConnectedAccountsList initialAccounts={initialInstagramAccounts} />
                      <a href="/api/connectors/instagram/oauth/start" className="btn btn-secondary btn-sm">
                        Connect another Account
                      </a>
                      <ActivateDeactivateButton
                        platformId={platform.id}
                        ownerType="user"
                        isActive={state.isActive}
                      />
                    </div>
                  ) : (
                    <a href="/api/connectors/instagram/oauth/start" className="btn btn-primary cv-connect-btn">
                      Connect {platform.name}
                    </a>
                  )
                ) : platform.id === 'linkedin' ? (
                  /* Story 6.35 (ADR-0069) — LinkedIn OAuth connect */
                  isConnected ? (
                    <>
                      <div className="cv-card-footer-left">
                        {isTenantAdmin && platform.tenantScopeAllowed !== false && (
                          <ActivateDeactivateButton
                            platformId={platform.id}
                            ownerType="tenant"
                            isActive={state.isActive}
                          />
                        )}
                        {platform.personalScopeAllowed && (
                          <ActivateDeactivateButton
                            platformId={platform.id}
                            ownerType="user"
                            isActive={state.isActive}
                          />
                        )}
                      </div>
                      <button
                        type="button"
                        className="cv-disconnect-btn"
                        onClick={() => setDisconnectingId(platform.id)}
                      >
                        Disconnect
                      </button>
                    </>
                  ) : (
                    <a
                      href="/api/connectors/linkedin/oauth/start"
                      className="btn btn-primary cv-connect-btn"
                    >
                      Connect {platform.name}
                    </a>
                  )
                ) : platform.authMode === 'oauth' ? (
                  /* Other OAuth connectors (e.g. LinkedIn) */
                  isConnected ? (
                    <>
                      <div className="cv-card-footer-left">
                        {isTenantAdmin && platform.tenantScopeAllowed !== false && (
                          <ActivateDeactivateButton
                            platformId={platform.id}
                            ownerType="tenant"
                            isActive={state.isActive}
                          />
                        )}
                        {platform.personalScopeAllowed && (
                          <ActivateDeactivateButton
                            platformId={platform.id}
                            ownerType="user"
                            isActive={state.isActive}
                          />
                        )}
                      </div>
                      <button
                        type="button"
                        className="cv-disconnect-btn"
                        onClick={() => setDisconnectingId(platform.id)}
                      >
                        Disconnect
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-primary cv-connect-btn"
                      onClick={() => setConnectingId(platform.id)}
                    >
                      Connect {platform.name}
                    </button>
                  )
                ) : platform.authMode === 'none' ? (
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
                      {isTenantAdmin && platform.tenantScopeAllowed !== false && (
                        <ActivateDeactivateButton
                          platformId={platform.id}
                          ownerType="tenant"
                          isActive={state.isActive}
                        />
                      )}
                      {platform.personalScopeAllowed && (
                        <ActivateDeactivateButton
                          platformId={platform.id}
                          ownerType="user"
                          isActive={state.isActive}
                        />
                      )}
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
                ) : !platform.personalScopeAllowed && !isTenantAdmin ? (
                  /* Tenant-only platform, non-admin caller: no working
                     connect action exists for them (ADR-0028 Tier 2 only) —
                     an honest note, not a button that would just 403. */
                  <span className="cv-public-label">Ask your Tenant-Admin to connect this platform</span>
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

      {/* Facebook Page Picker (Story 6.23/6.27) */}
      {facebookPending && (
        <FacebookPagePickerModal
          platformName={platforms.find((p) => p.id === 'facebook')?.name ?? 'Facebook Page'}
          pending={facebookPending}
          onClose={() => setFacebookPending(null)}
          onDone={() => window.location.reload()}
        />
      )}

      {/* Instagram Account Picker (Story 6.34) */}
      {instagramPending && (
        <InstagramAccountPickerModal
          platformName={platforms.find((p) => p.id === 'instagram')?.name ?? 'Instagram Business'}
          pending={instagramPending}
          onClose={() => setInstagramPending(null)}
          onDone={() => window.location.reload()}
        />
      )}
    </div>
  );
}
