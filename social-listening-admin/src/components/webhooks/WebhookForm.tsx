'use client';

import React, { useState } from 'react';
import type { CreateWebhookSubscriptionInput } from '@/lib/core-client';

export interface WebhookFormProps {
  initialValues?: Partial<CreateWebhookSubscriptionInput>;
  onSubmit: (values: CreateWebhookSubscriptionInput) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

const AVAILABLE_EVENTS = [
  { id: 'post.ingested', label: 'post.ingested', desc: 'Fires when a new matching post is ingested' },
  { id: 'alert.triggered', label: 'alert.triggered', desc: 'Fires when an alert threshold is breached' },
  { id: 'connector.health.changed', label: 'connector.health.changed', desc: 'Fires when a connector health status changes' },
  { id: 'mention.threshold.crossed', label: 'mention.threshold.crossed', desc: 'Fires when velocity/spike thresholds are crossed' },
];

export function WebhookForm({ initialValues, onSubmit, onCancel, isLoading }: WebhookFormProps) {
  const [url, setUrl] = useState(initialValues?.url || '');
  const [secret, setSecret] = useState(initialValues?.secret || '');
  const [events, setEvents] = useState<string[]>(initialValues?.events || ['post.ingested', 'alert.triggered']);
  const [enabled, setEnabled] = useState(initialValues?.enabled ?? true);
  const [error, setError] = useState<string | null>(null);

  const handleEventToggle = (eventId: string) => {
    setEvents((prev) =>
      prev.includes(eventId) ? prev.filter((e) => e !== eventId) : [...prev, eventId]
    );
  };

  const handleGenerateSecret = () => {
    const arr = new Uint8Array(20);
    crypto.getRandomValues(arr);
    const generated = Array.from(arr, (byte) => byte.toString(16).padStart(2, '0')).join('');
    setSecret(generated);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) {
      setError('Endpoint URL is required');
      return;
    }
    if (events.length === 0) {
      setError('Please select at least one event subscription');
      return;
    }

    setError(null);
    onSubmit({
      url: url.trim(),
      secret: secret.trim() || undefined,
      events,
      enabled,
    });
  };

  return (
    <div className="card" style={{ padding: 'var(--space-5)', border: '1px solid var(--color-border)' }}>
      <h3 style={{ margin: '0 0 var(--space-4)', fontSize: '1.125rem', fontWeight: 600 }}>
        {initialValues ? 'Edit Webhook Subscription' : 'New Webhook Subscription'}
      </h3>

      <form onSubmit={handleSubmit}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div>
            <label htmlFor="webhook-url-input" style={{ display: 'block', fontWeight: 600, fontSize: '0.875rem', marginBottom: 4 }}>
              Endpoint URL *
            </label>
            <input
              id="webhook-url-input"
              type="url"
              className="input"
              style={{ width: '100%', padding: '8px 12px' }}
              placeholder="https://api.yourdomain.com/webhooks/socialengage"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
            />
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <label htmlFor="webhook-secret-input" style={{ fontWeight: 600, fontSize: '0.875rem' }}>
                Secret (HMAC-SHA256 signing)
              </label>
              <button
                type="button"
                onClick={handleGenerateSecret}
                style={{ fontSize: '0.75rem', color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
              >
                Generate Secret
              </button>
            </div>
            <input
              id="webhook-secret-input"
              type="text"
              className="input"
              style={{ width: '100%', padding: '8px 12px', fontFamily: 'monospace' }}
              placeholder="Enter or generate a signing secret"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 600, fontSize: '0.875rem', marginBottom: 8 }}>
              Subscribed Events *
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {AVAILABLE_EVENTS.map((ev) => (
                <label
                  key={ev.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                    padding: '4px 0',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={events.includes(ev.id)}
                    onChange={() => handleEventToggle(ev.id)}
                    aria-label={ev.label}
                  />
                  <span>
                    <strong>{ev.label}</strong>
                    <span style={{ color: 'var(--color-text-muted)', marginLeft: 6, fontSize: '0.8125rem' }}>
                      — {ev.desc}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.875rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
              />
              <span>Enabled (active event delivery)</span>
            </label>
          </div>

          {error && (
            <div style={{ color: 'var(--color-error, #dc2626)', fontSize: '0.875rem', fontWeight: 500 }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isLoading}
              style={{ padding: '8px 16px' }}
            >
              {isLoading ? 'Saving…' : 'Save Subscription'}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onCancel}
              style={{ padding: '8px 16px' }}
            >
              Cancel
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
