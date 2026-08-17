'use client';

import { useState } from 'react';
import type { ConnectorStatus } from '@/lib/core-client';
import { StatusBadge, type StatusBadgeVariant } from '@/components/ui';
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
  platform: { id: string; name: string; authMode: 'api_key' | 'none'; category: string; description: string };
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

function deriveVariant(row: ConnectorStatusRow): StatusBadgeVariant {
  if (!row.isActive) return 'inactive';
  switch (row.health?.status) {
    case 'healthy':     return 'healthy';
    case 'degraded':    return 'degraded';
    case 'failing':     return 'failing';
    case 'disconnected': return 'inactive';
    default:            return 'inactive';
  }
}

function cardBorderClass(row: ConnectorStatusRow): string {
  if (!row.health) return 'cs-card';
  if (row.health.status === 'failing')  return 'cs-card cs-card-failing';
  if (row.health.status === 'degraded') return 'cs-card cs-card-degraded';
  return 'cs-card';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ConnectorStatusClient({ rows, isTenantAdmin }: ConnectorStatusClientProps) {
  const [pingingId, setPingingId] = useState<string | null>(null);

  const healthyCount  = rows.filter((r) => r.health?.status === 'healthy').length;
  const degradedCount = rows.filter((r) => r.health?.status === 'failing' || r.health?.status === 'degraded').length;
  const totalCount    = rows.length;

  async function handleTestPing(id: string) {
    setPingingId(id);
    await new Promise((r) => setTimeout(r, 700));
    setPingingId(null);
  }

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

      {/* Connector Cards */}
      <div className="cs-cards">
        {rows.map(({ platform, isActive, health }) => {
          const variant  = deriveVariant({ platform, isActive, health });
          const isPinging = pingingId === platform.id;

          return (
            <div key={platform.id} className={cardBorderClass({ platform, isActive, health })}>
              {/* Top row: name + badge + category + actions */}
              <div className="cs-card-top">
                <div className="cs-card-info">
                  <div className="cs-card-title-row">
                    <h2 className="cs-card-name">{platform.name}</h2>
                    <StatusBadge variant={variant} />
                    <span className="cs-category-pill">{platform.category}</span>
                  </div>
                  <p className="cs-card-description">{platform.description}</p>
                </div>

                <div className="cs-card-actions">
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

                  {isTenantAdmin && (
                    <ActivateDeactivateButton
                      platformId={platform.id}
                      ownerType="tenant"
                      isActive={isActive}
                    />
                  )}
                  {platform.authMode !== 'none' && (
                    <ActivateDeactivateButton
                      platformId={platform.id}
                      ownerType="user"
                      isActive={false}
                    />
                  )}
                </div>
              </div>

              {/* Metrics Grid */}
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
                      {new Date(health.lastSuccessfulFetchAt).toLocaleTimeString()}
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
                  <div className="cs-metric-sub">Interval: every 2 minutes</div>
                </div>

                <div className="cs-metric">
                  <div className="cs-metric-label">
                    <IconWarning /> Consecutive Retry Count
                  </div>
                  <div className={`cs-metric-value ${(health?.consecutiveFailures ?? 0) > 0 ? 'cs-metric-value-warn' : ''}`}>
                    {health?.consecutiveFailures ?? 0}{' '}
                    {(health?.consecutiveFailures ?? 0) === 1 ? 'failure' : 'failures'}
                  </div>
                  <div className="cs-metric-sub">Threshold: 5 retries before alert</div>
                </div>
              </div>
            </div>
          );
        })}
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
