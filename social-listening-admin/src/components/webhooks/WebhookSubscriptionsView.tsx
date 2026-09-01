'use client';

import React, { useState } from 'react';
import type { WebhookSubscriptionItem } from '@/lib/core-client';

interface WebhookSubscriptionsViewProps {
  initialSubscriptions: WebhookSubscriptionItem[];
}

export function WebhookSubscriptionsView({ initialSubscriptions }: WebhookSubscriptionsViewProps) {
  const [subscriptions, setSubscriptions] = useState<WebhookSubscriptionItem[]>(initialSubscriptions);
  const [creating, setCreating] = useState(false);
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/webhooks/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: url.trim(),
          events: ['alert.triggered', 'crisis.threshold.exceeded'],
        }),
      });

      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        setError(b.error || 'Failed to create webhook');
        return;
      }

      const created: WebhookSubscriptionItem = await res.json();
      setSubscriptions((prev) => [created, ...prev]);
      setCreating(false);
      setUrl('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTestPing = async (id: string) => {
    setTestingId(id);
    setTestResult(null);
    try {
      const res = await fetch(`/api/webhooks/subscriptions/${id}/test`, { method: 'POST' });
      if (res.ok) {
        setTestResult(`✓ Test ping dispatched with HMAC-SHA256 signature!`);
      } else {
        setTestResult(`✕ Failed to send test ping.`);
      }
    } finally {
      setTestingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this webhook endpoint?')) return;
    try {
      await fetch(`/api/webhooks/subscriptions/${id}`, { method: 'DELETE' });
      setSubscriptions((prev) => prev.filter((s) => s.id !== id));
    } catch {}
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.125rem', margin: 0 }}>Webhook Subscriptions</h2>
          <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', margin: '4px 0 0' }}>
            Receive real-time HTTP POST notifications with HMAC-SHA256 signature verification
          </p>
        </div>
        <button
          id="btn-add-webhook"
          className="btn btn-primary btn-sm"
          onClick={() => setCreating(true)}
        >
          + Add Webhook
        </button>
      </div>

      {testResult && (
        <div
          style={{
            padding: 'var(--space-3)',
            borderRadius: 6,
            background: testResult.startsWith('✓') ? '#d1fae5' : '#fee2e2',
            color: testResult.startsWith('✓') ? '#059669' : '#dc2626',
            fontSize: '0.875rem',
            fontWeight: 600,
          }}
        >
          {testResult}
        </div>
      )}

      {creating && (
        <div className="card" style={{ padding: 'var(--space-4)' }}>
          <h3 style={{ margin: '0 0 var(--space-3)' }}>New Webhook Subscription</h3>
          <form onSubmit={handleCreate}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.875rem', marginBottom: 4 }}>
                  Endpoint URL *
                </label>
                <input
                  type="url"
                  className="input"
                  placeholder="https://api.yourdomain.com/socialengage-webhook"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  required
                />
              </div>

              {error && <div style={{ color: 'var(--color-error)', fontSize: '0.875rem' }}>{error}</div>}

              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <button type="submit" className="btn btn-primary btn-sm" disabled={loading}>
                  {loading ? 'Creating…' : 'Save Endpoint'}
                </button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setCreating(false)}>
                  Cancel
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {subscriptions.length === 0 && !creating ? (
        <div style={{ textAlign: 'center', padding: 'var(--space-8) 0', color: 'var(--color-text-muted)' }}>
          No webhook endpoints configured. Add one to start receiving event notifications.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {subscriptions.map((sub) => {
            const isTesting = testingId === sub.id;
            return (
              <div
                key={sub.id}
                className="card"
                style={{
                  padding: 'var(--space-4)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.9375rem', wordBreak: 'break-all' }}>{sub.url}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                    Events: {sub.events.join(', ')} • Secret: <code>{sub.secret.slice(0, 8)}…</code>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-2)', flexShrink: 0 }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '0.75rem' }}
                    onClick={() => handleTestPing(sub.id)}
                    disabled={isTesting}
                  >
                    {isTesting ? 'Sending…' : '⚡ Test Ping'}
                  </button>
                  <button
                    className="btn btn-danger btn-sm"
                    style={{ fontSize: '0.75rem' }}
                    onClick={() => handleDelete(sub.id)}
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
