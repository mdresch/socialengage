'use client';

import React from 'react';
import type {
  WatchlistVolumePreview,
  ConnectorVolumeItem,
  VolumeConfidence,
  VolumeWarning,
} from '@/lib/core-client';

interface VolumePreviewPanelProps {
  preview: WatchlistVolumePreview;
  onClose?: () => void;
}

/**
 * Formats the post count according to the explicit confidence contract (ADR-0134 Decision §3):
 * - exact: clean number with thousand separators, e.g. "12,340"
 * - estimate: prefix ~ and suffix (estimated), e.g. "~45,000 (estimated)"
 * - unavailable: "Unavailable"
 */
export function formatEstimatedPosts(item: ConnectorVolumeItem): string {
  if (item.confidence === 'unavailable') {
    return 'Unavailable';
  }
  const formattedNumber = item.estimatedPosts.toLocaleString();
  if (item.confidence === 'estimate') {
    return `~${formattedNumber} (estimated)`;
  }
  return formattedNumber;
}

function renderConfidenceBadge(confidence: VolumeConfidence) {
  switch (confidence) {
    case 'exact':
      return <span className="badge badge-success">Exact Count</span>;
    case 'estimate':
      return <span className="badge badge-info">Sample Estimate</span>;
    case 'unavailable':
      return <span className="badge badge-error">Unavailable</span>;
    default:
      return null;
  }
}

function renderWarningBadge(warning: VolumeWarning) {
  switch (warning) {
    case 'high_volume':
      return (
        <span className="badge badge-warning" title="High volume: >100,000 posts">
          ⚠ High Volume (&gt;100k)
        </span>
      );
    case 'quota_risk':
      return (
        <span className="badge badge-warning" title="Quota risk: consumes >80% of remaining budget">
          ⚠ Quota Risk (&gt;80%)
        </span>
      );
    case 'unsupported_query':
      return (
        <span className="badge badge-warning" title="Unsupported query: connector cannot natively evaluate AST">
          ⚠ Unsupported Query
        </span>
      );
    default:
      return null;
  }
}

export function VolumePreviewPanel({ preview, onClose }: VolumePreviewPanelProps) {
  const { totalEstimatedPosts, breakdown, estimatedCost } = preview;

  return (
    <div
      className="volume-preview-panel"
      style={{
        border: '1px solid var(--color-border-subtle, #e2e8f0)',
        borderRadius: 'var(--radius-md, 8px)',
        padding: 'var(--space-4, 1rem)',
        backgroundColor: 'var(--color-bg-subtle, #f8fafc)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-4, 1rem)',
        marginTop: 'var(--space-3, 0.75rem)',
      }}
      data-testid="volume-preview-panel"
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Volume &amp; Cost Forecast</h4>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: 'var(--color-text-muted, #64748b)' }}>
            Total Projected Volume: <strong>{totalEstimatedPosts.toLocaleString()} posts</strong> (lookback period)
          </p>
        </div>
        {onClose && (
          <button
            type="button"
            className="btn btn-secondary btn-xs"
            onClick={onClose}
            aria-label="Dismiss preview"
            style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
          >
            ✕ Dismiss
          </button>
        )}
      </div>

      {/* Per-connector breakdown table */}
      <div className="connector-volume-table-wrapper" style={{ overflowX: 'auto' }}>
        <table
          className="data-table"
          style={{ width: '100%', fontSize: '0.875rem', borderCollapse: 'collapse' }}
        >
          <thead>
            <tr style={{ borderBottom: '1px solid var(--color-border-subtle, #cbd5e1)', textAlign: 'left' }}>
              <th style={{ padding: '0.5rem' }}>Platform</th>
              <th style={{ padding: '0.5rem' }}>Estimated Volume</th>
              <th style={{ padding: '0.5rem' }}>Confidence</th>
              <th style={{ padding: '0.5rem' }}>Warnings</th>
            </tr>
          </thead>
          <tbody>
            {breakdown.map((item) => (
              <tr
                key={item.connectorId}
                className="connector-volume-row"
                style={{ borderBottom: '1px solid var(--color-border-subtle, #f1f5f9)' }}
                data-testid={`connector-volume-row-${item.connectorId}`}
              >
                <td style={{ padding: '0.5rem', fontWeight: 500 }}>
                  {item.platformId.toUpperCase()}
                </td>
                <td style={{ padding: '0.5rem' }}>
                  {item.confidence === 'unavailable' ? (
                    <span style={{ color: 'var(--color-danger, #ef4444)' }}>
                      {item.errorMessage || 'Unavailable'} ({item.errorCode || 'error'})
                    </span>
                  ) : (
                    formatEstimatedPosts(item)
                  )}
                </td>
                <td style={{ padding: '0.5rem' }}>
                  {renderConfidenceBadge(item.confidence)}
                </td>
                <td style={{ padding: '0.5rem' }}>
                  {renderWarningBadge(item.warning)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Cost projection card (ADR-0134 §4) */}
      {estimatedCost && (
        <div
          id="watchlist-cost-projection"
          className="card"
          style={{
            border: '1px solid var(--color-border-subtle, #cbd5e1)',
            borderRadius: 'var(--radius-sm, 6px)',
            padding: 'var(--space-3, 0.75rem)',
            backgroundColor: 'var(--color-bg-surface, #ffffff)',
          }}
          data-testid="watchlist-cost-projection"
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Monthly Downstream Cost Estimate ({estimatedCost.currency || 'USD'})
            </span>
            <div>
              {renderConfidenceBadge(estimatedCost.confidence)}
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 'var(--space-3, 0.75rem)',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted, #64748b)' }}>
                Projected Storage Growth
              </span>
              <strong style={{ fontSize: '1.1rem' }}>
                {estimatedCost.storageGbPerMonth.toFixed(4)} GB / month
              </strong>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted, #64748b)' }}>
                AI Enrichment Consumption
              </span>
              <strong style={{ fontSize: '1.1rem' }}>
                {estimatedCost.aiEnrichmentCallsPerMonth.toLocaleString()} calls / month
              </strong>
            </div>
          </div>

          <p style={{ margin: '0.5rem 0 0', fontSize: '0.75rem', color: 'var(--color-text-muted, #94a3b8)' }}>
            Forecast based on standard 30-day projection from recent platform publishing cadences.
          </p>
        </div>
      )}
    </div>
  );
}
