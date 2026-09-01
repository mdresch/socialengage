'use client';

import React, { useState } from 'react';
import type { WebhookSubscriptionItem, CreateWebhookSubscriptionInput } from '@/lib/core-client';
import { WebhookForm } from './WebhookForm';

export interface WebhooksViewProps {
  initialSubscriptions: WebhookSubscriptionItem[];
  onCreateSubscription?: (input: CreateWebhookSubscriptionInput) => Promise<WebhookSubscriptionItem>;
  onUpdateSubscription?: (id: string, input: Partial<CreateWebhookSubscriptionInput>) => Promise<WebhookSubscriptionItem>;
  onDeleteSubscription?: (id: string) => Promise<void>;
  onTestSubscription?: (id: string) => Promise<{ success: boolean }>;
}

export function WebhooksView({
  initialSubscriptions,
  onCreateSubscription,
  onUpdateSubscription,
  onDeleteSubscription,
  onTestSubscription,
}: WebhooksViewProps) {
  const [subscriptions, setSubscriptions] = useState<WebhookSubscriptionItem[]>(initialSubscriptions);
  const [isCreating, setIsCreating] = useState(false);
  const [editingSub, setEditingSub] = useState<WebhookSubscriptionItem | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleCreate = async (input: CreateWebhookSubscriptionInput) => {
    setIsLoading(true);
    setStatusMessage(null);
    try {
      if (onCreateSubscription) {
        const created = await onCreateSubscription(input);
        setSubscriptions((prev) => [created, ...prev]);
      } else {
        const res = await fetch('/api/webhooks/subscriptions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        });
        if (!res.ok) throw new Error('Failed to create subscription');
        const created = await res.json();
        setSubscriptions((prev) => [created, ...prev]);
      }
      setIsCreating(false);
      setStatusMessage({ type: 'success', text: 'Webhook subscription created successfully.' });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err?.message || 'Failed to create webhook subscription.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleTest = async (id: string) => {
    setTestingId(id);
    setStatusMessage(null);
    try {
      if (onTestSubscription) {
        await onTestSubscription(id);
      } else {
        const res = await fetch(`/api/webhooks/subscriptions/${id}/test`, { method: 'POST' });
        if (!res.ok) throw new Error('Test ping failed');
      }
      setStatusMessage({ type: 'success', text: '✓ Test ping dispatched successfully with HMAC signature.' });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: `✕ Failed to send test ping: ${err?.message || 'Error'}` });
    } finally {
      setTestingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this webhook subscription?')) return;
    try {
      if (onDeleteSubscription) {
        await onDeleteSubscription(id);
      } else {
        await fetch(`/api/webhooks/subscriptions/${id}`, { method: 'DELETE' });
      }
      setSubscriptions((prev) => prev.filter((s) => s.id !== id));
      setStatusMessage({ type: 'success', text: 'Webhook subscription removed.' });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: `Failed to delete subscription: ${err?.message}` });
    }
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'success':
        return (
          <span
            style={{
              padding: '2px 8px',
              borderRadius: 12,
              background: '#dcfce7',
              color: '#15803d',
              fontSize: '0.75rem',
              fontWeight: 600,
            }}
          >
            Delivery: Success
          </span>
        );
      case 'failed':
        return (
          <span
            style={{
              padding: '2px 8px',
              borderRadius: 12,
              background: '#fee2e2',
              color: '#b91c1c',
              fontSize: '0.75rem',
              fontWeight: 600,
            }}
          >
            Delivery: Failed
          </span>
        );
      default:
        return (
          <span
            style={{
              padding: '2px 8px',
              borderRadius: 12,
              background: '#f3f4f6',
              color: '#4b5563',
              fontSize: '0.75rem',
              fontWeight: 600,
            }}
          >
            Delivery: Pending
          </span>
        );
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>Webhook Subscriptions</h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', margin: '4px 0 0' }}>
            Configure real-time HTTP callbacks with HMAC-SHA256 signature verification and exponential backoff retry.
          </p>
        </div>
        {!isCreating && !editingSub && (
          <button
            id="btn-add-webhook"
            className="btn btn-primary"
            onClick={() => setIsCreating(true)}
            style={{ padding: '8px 16px' }}
          >
            + Add Webhook
          </button>
        )}
      </div>

      {statusMessage && (
        <div
          style={{
            padding: '10px 14px',
            borderRadius: 6,
            background: statusMessage.type === 'success' ? '#dcfce7' : '#fee2e2',
            color: statusMessage.type === 'success' ? '#166534' : '#991b1b',
            fontSize: '0.875rem',
            fontWeight: 600,
          }}
        >
          {statusMessage.text}
        </div>
      )}

      {isCreating && (
        <WebhookForm
          onSubmit={handleCreate}
          onCancel={() => setIsCreating(false)}
          isLoading={isLoading}
        />
      )}

      {subscriptions.length === 0 && !isCreating ? (
        <div
          style={{
            textAlign: 'center',
            padding: 'var(--space-12) var(--space-4)',
            color: 'var(--color-text-muted)',
            background: 'var(--color-bg-subtle, #f9fafb)',
            borderRadius: 8,
            border: '1px dashed var(--color-border)',
          }}
        >
          <p style={{ fontWeight: 600, margin: '0 0 4px' }}>No webhook subscriptions configured</p>
          <p style={{ fontSize: '0.875rem', margin: 0 }}>Add a subscription to start receiving real-time platform events.</p>
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
                  border: '1px solid var(--color-border)',
                  borderRadius: 8,
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minWidth: 0, paddingRight: 'var(--space-4)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.9375rem', wordBreak: 'break-all' }}>
                      {sub.url}
                    </span>
                    {getStatusBadge(sub.last_delivery_status)}
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: 12,
                        background: '#e0e7ff',
                        color: '#3730a3',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                      }}
                    >
                      Retries: {sub.retry_count}
                    </span>
                    {!sub.enabled && (
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: 12,
                          background: '#f3f4f6',
                          color: '#6b7280',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                        }}
                      >
                        Disabled
                      </span>
                    )}
                  </div>

                  <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                    <span>Events: </span>
                    <strong style={{ color: 'var(--color-text)' }}>{sub.events.join(', ')}</strong>
                    <span style={{ margin: '0 8px' }}>•</span>
                    <span>Secret: </span>
                    <code style={{ fontSize: '0.75rem', background: '#f3f4f6', padding: '2px 4px', borderRadius: 4 }}>
                      {sub.secret ? `${sub.secret.slice(0, 8)}…` : 'none'}
                    </code>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-2)', flexShrink: 0 }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleTest(sub.id)}
                    disabled={isTesting}
                    style={{ fontSize: '0.8125rem', padding: '6px 12px' }}
                  >
                    {isTesting ? 'Sending…' : '⚡ Test Ping'}
                  </button>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => handleDelete(sub.id)}
                    style={{ fontSize: '0.8125rem', padding: '6px 10px' }}
                    title="Delete webhook"
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
