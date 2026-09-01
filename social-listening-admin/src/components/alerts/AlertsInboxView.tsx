'use client';

import React, { useState } from 'react';
import type { TenantAlertItem } from '@/lib/core-client';

const SEVERITY_BADGES: Record<string, { bg: string; text: string }> = {
  info: { bg: '#dbeafe', text: '#2563eb' },
  warning: { bg: '#fef3c7', text: '#d97706' },
  critical: { bg: '#fee2e2', text: '#dc2626' },
};

interface AlertsInboxViewProps {
  initialAlerts: TenantAlertItem[];
}

export function AlertsInboxView({ initialAlerts }: AlertsInboxViewProps) {
  const [alerts, setAlerts] = useState<TenantAlertItem[]>(initialAlerts);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const filtered = alerts.filter((a) => (statusFilter === 'all' ? true : a.status === statusFilter));

  const handleUpdateStatus = async (alertId: string, nextStatus: 'acknowledged' | 'resolved') => {
    setActionLoadingId(alertId);
    try {
      const res = await fetch(`/api/alerts/inbox/${alertId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (res.ok) {
        const updated: TenantAlertItem = await res.json();
        setAlerts((prev) => prev.map((a) => (a.id === alertId ? updated : a)));
      }
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
        {['all', 'active', 'acknowledged', 'resolved'].map((st) => (
          <button
            key={st}
            type="button"
            onClick={() => setStatusFilter(st)}
            style={{
              padding: '6px 12px',
              borderRadius: '9999px',
              fontSize: '0.8125rem',
              fontWeight: 600,
              cursor: 'pointer',
              textTransform: 'capitalize',
              border: statusFilter === st ? '1px solid var(--color-primary, #6366f1)' : '1px solid var(--color-border, #e5e7eb)',
              background: statusFilter === st ? 'var(--color-primary-subtle, #ede9fe)' : 'var(--color-surface, #fff)',
              color: statusFilter === st ? 'var(--color-primary, #6366f1)' : 'var(--color-text, #374151)',
            }}
          >
            {st} ({alerts.filter((a) => (st === 'all' ? true : a.status === st)).length})
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 'var(--space-8) 0', color: 'var(--color-text-muted)' }}>
          No alerts matching current filter.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {filtered.map((alert) => {
            const badge = SEVERITY_BADGES[alert.severity] || SEVERITY_BADGES.warning;
            const isLoading = actionLoadingId === alert.id;
            return (
              <div
                key={alert.id}
                className="card"
                style={{
                  padding: 'var(--space-4)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: 'var(--space-4)',
                }}
              >
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: '9999px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        background: badge.bg,
                        color: badge.text,
                      }}
                    >
                      {alert.severity}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                      {new Date(alert.triggered_at).toLocaleString()}
                    </span>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        padding: '2px 8px',
                        borderRadius: 4,
                        background: '#f3f4f6',
                        color: '#6b7280',
                        fontWeight: 600,
                        textTransform: 'capitalize',
                      }}
                    >
                      Status: {alert.status}
                    </span>
                  </div>
                  <div style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--color-text)' }}>
                    {alert.summary}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-2)', flexShrink: 0 }}>
                  {alert.status === 'active' && (
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '0.75rem' }}
                      onClick={() => handleUpdateStatus(alert.id, 'acknowledged')}
                      disabled={isLoading}
                    >
                      {isLoading ? '…' : 'Acknowledge'}
                    </button>
                  )}
                  {alert.status !== 'resolved' && (
                    <button
                      className="btn btn-primary btn-sm"
                      style={{ fontSize: '0.75rem' }}
                      onClick={() => handleUpdateStatus(alert.id, 'resolved')}
                      disabled={isLoading}
                    >
                      {isLoading ? '…' : 'Resolve'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
