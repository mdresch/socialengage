'use client';

import { useState, type ReactElement } from 'react';
import type { ConnectorStatus } from '@/lib/core-client';
import { StatusBadge, type StatusBadgeVariant, PlatformIcon } from '@/components/ui';
import { RelativeTime } from '@/components/ui';
import { ActivateDeactivateButton } from '../ActivateDeactivateButton';

// ---------------------------------------------------------------------------
// Inline SVG icons
// ---------------------------------------------------------------------------

function IconCheckCircle() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function IconAlertTriangle() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function IconActivity() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}

function IconClock() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function IconZap() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

function IconWarning() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function IconRefresh({ spinning }: { spinning: boolean }) {
  return (
    <svg
      width="12" height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={spinning ? { animation: 'cs-spin 0.7s linear infinite' } : undefined}
    >
      <polyline points="1 4 1 10 7 10" />
      <path d="M3.51 15a9 9 0 1 0 .49-4" />
    </svg>
  );
}

function IconArrowRight() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ConnectorStatusRow {
  platform: {
    id: string;
    name: string;
    authMode: 'api_key' | 'none' | 'oauth';
    category: string;
    description: string;
    /** ADR-0028 Decision §1 (Clarification, 2026-08-17) — false for any AIProviderConnector. */
    personalScopeAllowed: boolean;
    /** Story 6.23 (ADR-0059 Decision §4) — false suppresses the tenant-wide ActivateDeactivateButton unconditionally. Optional, defaults true. */
    tenantScopeAllowed?: boolean;
  };
  isActive: boolean;
  health: ConnectorStatus | null;
}

interface ConnectorStatusClientProps {
  rows: ConnectorStatusRow[];
  isTenantAdmin: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Story 6.24 — a small, explicitly-commented client-side constant, not a
 * claim that this is dynamically sourced. No endpoint exposes per-platform
 * poll cadence over HTTP today; must be kept in sync by hand with
 * `bootstrapConnectors.ts`'s real `pollCadenceMs` constants
 * (`social-listening-core`) whenever a connector's cadence changes or a new
 * poll-mode connector is added.
 */
const POLL_INTERVAL_MINUTES: Record<string, number> = {
  gnews: 15,
  newswire: 15,
  wikipedia: 30,
  'tenant-owned-feed': 30,
  facebook: 30,
  instagram: 30,
  linkedin: 60,
  youtube: 15,
  'brave-search': 60,
  'bing-search': 60,
};

/** Story 6.24 — mirrors `CONSECUTIVE_FAILURE_CEILING` (`social-listening-core/src/connectors/connectorHealth.ts`), the real, single global ceiling. Not importable across the repo boundary; restated here, kept in sync by hand. */
const CONSECUTIVE_FAILURE_CEILING = 20;

/** Story 6.24 — 'Ingestion' platforms render in the Connectors section; everything else (today, only 'Enrichment') renders in the AI Providers section. */
function isAIProvider(row: ConnectorStatusRow): boolean {
  return row.platform.category === 'Enrichment';
}

/**
 * Story 6.23 (Story 2.15 AC7, ADR-0059 Decision §4) — 'reconnect_required'
 * takes priority over the isActive check: a credential-invalidation
 * failure is real signal worth surfacing distinctly even while the
 * connector is still nominally "active," never silently swallowed into
 * 'inactive' the way an unhandled default case would.
 */
function deriveVariant(row: ConnectorStatusRow): StatusBadgeVariant {
  if (row.health?.status === 'reconnect_required') return 'reconnect_required';
  if (!row.isActive) return 'inactive';
  switch (row.health?.status) {
    case 'healthy':      return 'healthy';
    case 'degraded':     return 'degraded';
    case 'failing':      return 'failing';
    case 'stalled':      return 'stalled';
    case 'disconnected': return 'inactive';
    default:             return 'inactive';
  }
}

function cardBorderClass(row: ConnectorStatusRow): string {
  if (!row.health) return 'cs-card';
  if (row.health.status === 'reconnect_required') return 'cs-card cs-card-failing';
  if (row.health.status === 'failing')  return 'cs-card cs-card-failing';
  if (row.health.status === 'degraded') return 'cs-card cs-card-degraded';
  if (row.health.status === 'stalled')  return 'cs-card cs-card-stalled';
  return 'cs-card';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ConnectorStatusClient({ rows, isTenantAdmin }: ConnectorStatusClientProps) {
  const [pingingId, setPingingId] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [retryFeedback, setRetryFeedback] = useState<{ id: string; type: 'success' | 'error' | 'info'; message: string } | null>(null);

  // Story 6.24 — split by real category rather than one flat list. AI
  // providers are not pollable feeds, so KPIs below are Connectors-only.
  const connectorRows  = rows.filter((r) => !isAIProvider(r));
  const aiProviderRows = rows.filter(isAIProvider);

  const healthyCount  = connectorRows.filter((r) => r.health?.status === 'healthy').length;
  const degradedCount = connectorRows.filter((r) => r.health?.status === 'failing' || r.health?.status === 'degraded' || r.health?.status === 'stalled').length;
  const totalCount    = connectorRows.length;

  async function handleTestPing(id: string) {
    setPingingId(id);
    await new Promise((r) => setTimeout(r, 700));
    setPingingId(null);
  }

  async function handleRetry(platformId: string) {
    setRetryingId(platformId);
    setRetryFeedback(null);
    try {
      const res = await fetch(`/api/connectors/${encodeURIComponent(platformId)}/retry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 200) {
        setRetryFeedback({ id: platformId, type: 'success', message: 'Ingestion run triggered. Refreshing...' });
        setTimeout(() => {
          window.location.reload();
        }, 1200);
      } else if (res.status === 409) {
        setRetryFeedback({ id: platformId, type: 'info', message: data.message || 'Run already in progress.' });
      } else {
        setRetryFeedback({ id: platformId, type: 'error', message: data.error || 'Failed to trigger retry.' });
      }
    } catch {
      setRetryFeedback({ id: platformId, type: 'error', message: 'Network error triggering retry.' });
    } finally {
      setRetryingId(null);
    }
  }

  // Story 6.24 — one pass over the real, unfiltered `rows` prop (matching
  // Story 6.5 AC6's own "every platform is always listed, not filtered
  // down" requirement) that buckets each row's card into the right
  // section. Card markup stays inline in this callback, not delegated to a
  // helper defined above it, so that `ActivateDeactivateButton` (Story
  // 6.15 AC3) and `cs-metrics-grid` (this story's AC3) keep the same
  // "unconditional, before the metrics grid" source-order relationship
  // those already-shipped, still-binding contracts assert.
  const connectorCards: ReactElement[] = [];
  const aiProviderCards: ReactElement[] = [];

  rows.map((row) => {
    const { platform, isActive, health } = row;
    const isAI = isAIProvider(row);
    const variant: StatusBadgeVariant = isAI ? (isActive ? 'active' : 'inactive') : deriveVariant(row);
    const isPinging = pingingId === platform.id;

    const actions = (
      <div className="cs-card-actions">
        {/* Story 6.23 (Story 2.15 AC7) — reconnect_required's own
           action targets the same real OAuth entry point as the
           connect screen's own Reconnect control, re-entering
           the flow from the top rather than a dead end. */}
        {variant === 'reconnect_required' && (
          <a href="/api/connectors/facebook/oauth/start" className="btn btn-primary btn-sm cs-reconnect-btn">
            Reconnect
          </a>
        )}

        {/* Story 6.29 (ADR-0070 §4) — on-demand force retry / re-sync for active ingestion connectors */}
        {!isAI && isActive && isTenantAdmin && (
          <button
            type="button"
            className="btn btn-secondary btn-sm cs-retry-btn"
            onClick={() => handleRetry(platform.id)}
            disabled={retryingId === platform.id}
          >
            <IconRefresh spinning={retryingId === platform.id} />
            {retryingId === platform.id ? 'Re-syncing…' : 'Re-sync now'}
          </button>
        )}

        <button
          type="button"
          disabled={isPinging || !isActive}
          onClick={() => handleTestPing(platform.id)}
          className="cs-ping-btn"
          title="Send synthetic health ping"
        >
          <IconRefresh spinning={isPinging} />
          {isPinging ? 'Pinging…' : 'Test Ping'}
        </button>

        {isTenantAdmin && platform.tenantScopeAllowed !== false && (
          <ActivateDeactivateButton
            platformId={platform.id}
            ownerType="tenant"
            isActive={isActive}
          />
        )}
        {platform.personalScopeAllowed && (
          <ActivateDeactivateButton
            platformId={platform.id}
            ownerType="user"
            isActive={false}
          />
        )}
      </div>
    );

    const badge = isAI
      ? <StatusBadge variant={isActive ? 'active' : 'inactive'} label={isActive ? 'Active' : 'Inactive'} />
      : <StatusBadge variant={variant} />;

    const header = (
      <div className="cs-card-top">
        <div className="cs-card-info">
          <div className="cs-card-title-row">
            <h2 className="cs-card-name">
              <PlatformIcon platformId={platform.id} size={18} />
              <span>{platform.name}</span>
            </h2>
            {badge}
            <span className="cs-category-pill">{platform.category}</span>
          </div>
          <p className="cs-card-description">{platform.description}</p>
        </div>
        {actions}
      </div>
    );

    if (isAI) {
      /**
       * Story 6.24 — an AIProviderConnector is invoked inline by
       * `enrichPost()` and never accumulates an `ingestion_runs` row, so
       * `health.status` is permanently 'disconnected' regardless of real
       * usage (connector-status-view/SKILL.md's own named gap). The
       * ingestion-shaped metrics grid is never rendered for this card —
       * replaced by a one-line explanatory note.
       */
      aiProviderCards.push(
        <div key={platform.id} className="cs-card">
          {header}
          <div className="cs-ai-note">
            Invoked on demand during content enrichment — not independently polled.
          </div>
        </div>
      );
    } else {
      connectorCards.push(
        <div key={platform.id} className={cardBorderClass(row)}>
          {header}

          {platform.id === 'linkedin' && (
            <div className="cs-scope-degraded-notice" style={{ margin: '0.75rem 1.25rem 0', padding: '0.5rem 0.75rem', borderRadius: '4px', background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.2)', fontSize: '0.8125rem', color: '#1d4ed8', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <IconAlertTriangle />
              <span>Organization features unavailable — partner scope approval pending.</span>
            </div>
          )}

          <div className="cs-metrics-grid">
            <div className="cs-metric">
              <div className="cs-metric-label">
                <IconClock /> Last Successful Ingestion
              </div>
              <div className="cs-metric-value">
                {health?.lastSuccessfulFetchAt ? (
                  <RelativeTime timestamp={health.lastSuccessfulFetchAt} />
                ) : (
                  <span>never</span>
                )}
              </div>
              {health?.lastSuccessfulFetchAt && (
                <div className="cs-metric-sub">
                  {typeof health.lastSuccessfulPostsIngested === 'number'
                    ? `${health.lastSuccessfulPostsIngested} post${health.lastSuccessfulPostsIngested === 1 ? '' : 's'} ingested · ${new Date(health.lastSuccessfulFetchAt).toLocaleTimeString()}`
                    : new Date(health.lastSuccessfulFetchAt).toLocaleTimeString()}
                </div>
              )}
            </div>

            <div className="cs-metric">
              <div className="cs-metric-label">
                <IconZap /> Last Polling Attempt
              </div>
              <div className="cs-metric-value">
                {health?.lastAttemptAt ? (
                  <RelativeTime timestamp={health.lastAttemptAt} />
                ) : (
                  <span>never</span>
                )}
              </div>
              <div className="cs-metric-sub">Interval: every {POLL_INTERVAL_MINUTES[platform.id] ?? '?'} minutes</div>
            </div>

            <div className="cs-metric">
              <div className="cs-metric-label">
                <IconWarning /> Consecutive Retry Count
              </div>
              <div className={`cs-metric-value ${(health?.consecutiveFailures ?? 0) > 0 ? 'cs-metric-value-warn' : ''}`}>
                {health?.consecutiveFailures ?? 0}{' '}
                {(health?.consecutiveFailures ?? 0) === 1 ? 'failure' : 'failures'}
              </div>
              <div className="cs-metric-sub">Threshold: {CONSECUTIVE_FAILURE_CEILING} retries before alert</div>
            </div>
          </div>
        </div>
      );
    }

    return null;
  });

  return (
    <div className="cs-root">
      {/* Page Header */}
      <div className="cs-header">
        <div>
          <h1 className="page-title">Connector Health &amp; Telemetry</h1>
          <p className="page-subtitle">
            Live ingestion heartbeat, polling intervals, consecutive failure metrics, and cognitive response times
          </p>
        </div>
        {isTenantAdmin && (
          <a href="/tenant/connectors" className="btn btn-primary btn-sm cs-manage-link">
            Manage Platform Connections <IconArrowRight />
          </a>
        )}
      </div>

      {/* KPI Strip */}
      <div className="cs-kpi-grid">
        <div className="cs-kpi-card">
          <div>
            <span className="cs-kpi-label">Healthy Ingestion</span>
            <div className="cs-kpi-value cs-kpi-value-healthy">{healthyCount}</div>
          </div>
          <div className="cs-kpi-icon cs-kpi-icon-healthy">
            <IconCheckCircle />
          </div>
        </div>

        <div className="cs-kpi-card">
          <div>
            <span className="cs-kpi-label">Attention / Degraded</span>
            <div className={`cs-kpi-value ${degradedCount > 0 ? 'cs-kpi-value-degraded' : 'cs-kpi-value-neutral'}`}>
              {degradedCount}
            </div>
          </div>
          <div className={`cs-kpi-icon ${degradedCount > 0 ? 'cs-kpi-icon-degraded' : 'cs-kpi-icon-neutral'}`}>
            <IconAlertTriangle />
          </div>
        </div>

        <div className="cs-kpi-card">
          <div>
            <span className="cs-kpi-label">Total Feeds</span>
            <div className="cs-kpi-value cs-kpi-value-neutral">{totalCount}</div>
          </div>
          <div className="cs-kpi-icon cs-kpi-icon-blue">
            <IconActivity />
          </div>
        </div>
      </div>

      {/* Connectors section — Story 6.24 */}
      <div>
        <h2 className="cs-section-heading">Connectors</h2>
        <div className="cs-cards">
          {connectorCards}
        </div>
      </div>

      {/* AI Providers section — Story 6.24 */}
      <div>
        <h2 className="cs-section-heading">AI Providers</h2>
        <div className="cs-cards">
          {aiProviderCards}
        </div>
      </div>

      {/* Watchlist compatibility note */}
      <div className="cs-gap-note">
        <h3 className="cs-gap-note-title">Watchlist compatibility warnings</h3>
        <p>
          Not shown here yet — surfacing which of your watchlists&apos; boolean-query features aren&apos;t natively
          supported by a given connector requires a new core endpoint that doesn&apos;t exist yet.
          Deferred as a named, real gap, not silently dropped.
        </p>
      </div>
    </div>
  );
}
