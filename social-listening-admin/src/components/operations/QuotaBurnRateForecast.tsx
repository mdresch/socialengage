'use client';

import React from 'react';
import type { TenantQuotaBurnProjection } from '@/lib/core-client';

interface QuotaBurnRateForecastProps {
  projections: TenantQuotaBurnProjection[];
}

export function QuotaBurnRateForecast({ projections }: QuotaBurnRateForecastProps) {
  const criticalCount = projections.filter((p) => p.status === 'critical_7d').length;
  const warningCount = projections.filter((p) => p.status === 'warning_30d').length;
  const healthyCount = projections.filter((p) => p.status === 'healthy').length;

  return (
    <div
      className="card"
      data-testid="quota-burn-forecast"
      style={{
        padding: 'var(--space-4)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-4)',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
        <div>
          <h2 style={{ fontSize: '1.125rem', margin: 0, fontWeight: 700 }}>
            Tenant Quota Velocity & Burn-Rate Forecast
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
            Trailing 7-day ingestion velocity and linear exhaustion projections
          </p>
        </div>

        {/* Risk summary pill counters */}
        <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
          <span
            style={{
              padding: '3px 10px',
              borderRadius: '9999px',
              fontSize: '0.75rem',
              fontWeight: 600,
              background: '#fee2e2',
              color: '#b91c1c',
            }}
          >
            {criticalCount} Critical (≤7d)
          </span>
          <span
            style={{
              padding: '3px 10px',
              borderRadius: '9999px',
              fontSize: '0.75rem',
              fontWeight: 600,
              background: '#fef3c7',
              color: '#b45309',
            }}
          >
            {warningCount} Warning (8–30d)
          </span>
          <span
            style={{
              padding: '3px 10px',
              borderRadius: '9999px',
              fontSize: '0.75rem',
              fontWeight: 600,
              background: '#d1fae5',
              color: '#047857',
            }}
          >
            {healthyCount} Healthy
          </span>
        </div>
      </div>

      {/* Projections Table */}
      {projections.length === 0 ? (
        <div
          style={{
            padding: 'var(--space-6) 0',
            textAlign: 'center',
            color: 'var(--color-text-muted)',
            fontSize: '0.875rem',
          }}
        >
          No tenant quota burn data available.
        </div>
      ) : (
        <div className="table-container" style={{ overflowX: 'auto' }}>
          <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: 'var(--space-2) var(--space-3)', fontWeight: 700, fontSize: '0.8125rem', borderBottom: '2px solid var(--color-border)' }}>
                  Tenant
                </th>
                <th style={{ textAlign: 'right', padding: 'var(--space-2) var(--space-3)', fontWeight: 700, fontSize: '0.8125rem', borderBottom: '2px solid var(--color-border)' }}>
                  Monthly Quota
                </th>
                <th style={{ textAlign: 'right', padding: 'var(--space-2) var(--space-3)', fontWeight: 700, fontSize: '0.8125rem', borderBottom: '2px solid var(--color-border)' }}>
                  Consumed
                </th>
                <th style={{ textAlign: 'right', padding: 'var(--space-2) var(--space-3)', fontWeight: 700, fontSize: '0.8125rem', borderBottom: '2px solid var(--color-border)' }}>
                  7d Velocity
                </th>
                <th style={{ textAlign: 'right', padding: 'var(--space-2) var(--space-3)', fontWeight: 700, fontSize: '0.8125rem', borderBottom: '2px solid var(--color-border)' }}>
                  Days Remaining
                </th>
                <th style={{ textAlign: 'left', padding: 'var(--space-2) var(--space-3)', fontWeight: 700, fontSize: '0.8125rem', borderBottom: '2px solid var(--color-border)' }}>
                  Projected Exhaustion
                </th>
                <th style={{ textAlign: 'center', padding: 'var(--space-2) var(--space-3)', fontWeight: 700, fontSize: '0.8125rem', borderBottom: '2px solid var(--color-border)' }}>
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {projections.map((p) => {
                const badgeColor =
                  p.status === 'critical_7d'
                    ? { bg: '#fee2e2', text: '#dc2626', label: 'critical_7d' }
                    : p.status === 'warning_30d'
                    ? { bg: '#fef3c7', text: '#d97706', label: 'warning_30d' }
                    : { bg: '#d1fae5', text: '#059669', label: 'healthy' };

                return (
                  <tr key={p.tenantId} data-testid="forecast-row" style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td style={{ padding: 'var(--space-2) var(--space-3)', fontWeight: 600, fontSize: '0.875rem' }}>
                      <div>{p.tenantName}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{p.tenantId.slice(0, 8)}…</div>
                    </td>
                    <td style={{ padding: 'var(--space-2) var(--space-3)', textAlign: 'right', fontSize: '0.875rem' }}>
                      {p.monthlyQuota.toLocaleString()} tokens
                    </td>
                    <td style={{ padding: 'var(--space-2) var(--space-3)', textAlign: 'right', fontSize: '0.875rem' }}>
                      {p.consumedTokens.toLocaleString()} tokens
                    </td>
                    <td style={{ padding: 'var(--space-2) var(--space-3)', textAlign: 'right', fontSize: '0.875rem', fontWeight: 600 }}>
                      {p.dailyVelocity7d.toLocaleString()} / day
                    </td>
                    <td style={{ padding: 'var(--space-2) var(--space-3)', textAlign: 'right', fontSize: '0.875rem', fontWeight: 700, color: badgeColor.text }}>
                      {p.daysRemaining !== null ? `${p.daysRemaining} days` : '∞ (no usage)'}
                    </td>
                    <td style={{ padding: 'var(--space-2) var(--space-3)', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                      {p.projectedExhaustionDate ? new Date(p.projectedExhaustionDate).toLocaleDateString() : 'N/A'}
                    </td>
                    <td style={{ padding: 'var(--space-2) var(--space-3)', textAlign: 'center' }}>
                      <span
                        data-testid="risk-badge"
                        style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: '9999px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          background: badgeColor.bg,
                          color: badgeColor.text,
                        }}
                      >
                        {badgeColor.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
