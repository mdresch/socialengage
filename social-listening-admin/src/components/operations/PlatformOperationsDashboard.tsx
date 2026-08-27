'use client';

import React, { useState, useEffect } from 'react';
import type { PlatformDashboardData } from '@/lib/core-client';

interface PlatformOperationsDashboardProps {
  initialData: PlatformDashboardData | null;
}

export function PlatformOperationsDashboard({ initialData }: PlatformOperationsDashboardProps) {
  const [data, setData] = useState<PlatformDashboardData | null>(initialData);
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/platform-dashboard');
      if (res.ok) {
        const d = await res.json();
        setData(d);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setInterval(refresh, 30000); // 30s auto-refresh
    return () => clearInterval(timer);
  }, []);

  if (!data) {
    return (
      <div style={{ textAlign: 'center', padding: 'var(--space-8) 0', color: 'var(--color-text-muted)' }}>
        Loading platform telemetry…
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
      {/* Header */}
      <div
        className="page-header"
        style={{
          borderBottom: '1px solid var(--color-border)',
          paddingBottom: 'var(--space-4)',
          marginBottom: 0,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div>
          <h1 className="page-title">Platform Operations Telemetry</h1>
          <p className="page-subtitle">Real-time infrastructure health, ingestion rates, and AI token economics</p>
        </div>
        <button
          id="btn-refresh-telemetry"
          className="btn btn-secondary btn-sm"
          onClick={refresh}
          disabled={loading}
        >
          {loading ? 'Refreshing…' : '🔄 Refresh'}
        </button>
      </div>

      {/* Metric Tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4)' }}>
        <div className="card" style={{ padding: 'var(--space-4)' }}>
          <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>Throughput (24h)</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: 'var(--space-1)', color: '#6366f1' }}>
            {data.throughputPostsSec} <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--color-text-muted)' }}>posts/sec</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 4 }}>Live Ingestion Rate</div>
        </div>

        <div className="card" style={{ padding: 'var(--space-4)' }}>
          <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>Ingestion Lag</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: 'var(--space-1)', color: '#10b981' }}>
            {data.avgIngestionLagSec} <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--color-text-muted)' }}>sec</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 4 }}>End-to-end latency</div>
        </div>

        <div className="card" style={{ padding: 'var(--space-4)' }}>
          <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>Error Rate (24h)</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: 'var(--space-1)', color: '#f59e0b' }}>
            {data.errorRateLast24hPct}%
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 4 }}>All ingestion channels</div>
        </div>

        <div className="card" style={{ padding: 'var(--space-4)' }}>
          <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>Estimated AI Cost (30d)</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: 'var(--space-1)', color: '#2563eb' }}>
            ${data.estimatedCostLast30dUsd}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
            {data.totalTokensLast30d.toLocaleString()} tokens
          </div>
        </div>
      </div>

      {/* Connector Health Table */}
      <div className="card" style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        <h2 style={{ fontSize: '1.125rem', margin: 0 }}>Active Connector Health & Status</h2>
        <div className="table-container" style={{ overflowX: 'auto' }}>
          <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: 'var(--space-2) var(--space-3)', fontWeight: 700, fontSize: '0.8125rem', borderBottom: '2px solid var(--color-border)' }}>Platform</th>
                <th style={{ textAlign: 'left', padding: 'var(--space-2) var(--space-3)', fontWeight: 700, fontSize: '0.8125rem', borderBottom: '2px solid var(--color-border)' }}>Status</th>
                <th style={{ textAlign: 'right', padding: 'var(--space-2) var(--space-3)', fontWeight: 700, fontSize: '0.8125rem', borderBottom: '2px solid var(--color-border)' }}>24h Errors</th>
                <th style={{ textAlign: 'right', padding: 'var(--space-2) var(--space-3)', fontWeight: 700, fontSize: '0.8125rem', borderBottom: '2px solid var(--color-border)' }}>Last Success</th>
              </tr>
            </thead>
            <tbody>
              {data.connectors.map((c) => (
                <tr key={c.platformId} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ padding: 'var(--space-2) var(--space-3)', fontWeight: 600, fontSize: '0.875rem' }}>
                    {c.platformId}
                  </td>
                  <td style={{ padding: 'var(--space-2) var(--space-3)' }}>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: '9999px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        background: c.status === 'healthy' ? '#d1fae5' : c.status === 'degraded' ? '#fef3c7' : '#fee2e2',
                        color: c.status === 'healthy' ? '#059669' : c.status === 'degraded' ? '#d97706' : '#dc2626',
                      }}
                    >
                      {c.status}
                    </span>
                  </td>
                  <td style={{ padding: 'var(--space-2) var(--space-3)', textAlign: 'right', fontSize: '0.875rem' }}>
                    {c.errorCountLast24h}
                  </td>
                  <td style={{ padding: 'var(--space-2) var(--space-3)', textAlign: 'right', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                    {c.lastSuccessAt ? new Date(c.lastSuccessAt).toLocaleTimeString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
