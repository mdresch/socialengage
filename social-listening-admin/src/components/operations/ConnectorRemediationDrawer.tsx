'use client';

import React, { useState } from 'react';
import type { RemediationAction } from '@/lib/core-client';

interface ConnectorInfo {
  platformId: string;
  status: string;
  errorCountLast24h: number;
  lastSuccessAt: string | null;
}

interface ConnectorRemediationDrawerProps {
  connector: ConnectorInfo | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function ConnectorRemediationDrawer({
  connector,
  isOpen,
  onClose,
  onSuccess,
}: ConnectorRemediationDrawerProps) {
  const [overrideMinutes, setOverrideMinutes] = useState<number>(15);
  const [submitting, setSubmitting] = useState<RemediationAction | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  if (!isOpen || !connector) {
    return null;
  }

  const handleExecutePlaybook = async (action: RemediationAction) => {
    setSubmitting(action);
    setFeedback(null);

    try {
      const res = await fetch(`/api/admin/connectors/${encodeURIComponent(connector.platformId)}/remediate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          overrideMinutes: action === 'override_backoff' ? Number(overrideMinutes) : undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || `Remediation failed with status ${res.status}`);
      }

      setFeedback({
        type: 'success',
        message: `Playbook "${action}" executed successfully! Status updated to "${json.status}".`,
      });

      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.message || 'Failed to execute playbook.',
      });
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <div
      id="connector-remediation-drawer"
      data-testid="remediation-drawer"
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: '420px',
        maxWidth: '100vw',
        background: 'var(--color-bg, #ffffff)',
        boxShadow: '-4px 0 24px rgba(0, 0, 0, 0.15)',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        borderLeft: '1px solid var(--color-border)',
      }}
    >
      {/* Drawer Header */}
      <div
        style={{
          padding: 'var(--space-4)',
          borderBottom: '1px solid var(--color-border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700 }}>
            Remediate Connector
          </h3>
          <p style={{ margin: '2px 0 0', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
            Platform: <strong style={{ color: 'var(--color-text)' }}>{connector.platformId}</strong>
          </p>
        </div>
        <button
          id="btn-close-remediation-drawer"
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            fontSize: '1.25rem',
            cursor: 'pointer',
            padding: '4px 8px',
            color: 'var(--color-text-muted)',
          }}
          aria-label="Close remediation drawer"
        >
          ✕
        </button>
      </div>

      {/* Body & Playbooks */}
      <div style={{ padding: 'var(--space-4)', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        {/* Connector Telemetry Card */}
        <div className="card" style={{ padding: 'var(--space-3)', background: 'var(--color-bg-subtle, #f9fafb)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>Current Status</span>
            <span
              style={{
                padding: '2px 8px',
                borderRadius: '9999px',
                fontSize: '0.75rem',
                fontWeight: 600,
                background: connector.status === 'healthy' ? '#d1fae5' : connector.status === 'degraded' ? '#fef3c7' : '#fee2e2',
                color: connector.status === 'healthy' ? '#059669' : connector.status === 'degraded' ? '#d97706' : '#dc2626',
              }}
            >
              {connector.status}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: '0.8125rem' }}>
            <span style={{ color: 'var(--color-text-muted)' }}>24h Errors:</span>
            <strong>{connector.errorCountLast24h}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: '0.8125rem' }}>
            <span style={{ color: 'var(--color-text-muted)' }}>Last Success:</span>
            <span>{connector.lastSuccessAt ? new Date(connector.lastSuccessAt).toLocaleTimeString() : 'Never'}</span>
          </div>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div
            style={{
              padding: 'var(--space-3)',
              borderRadius: '6px',
              fontSize: '0.8125rem',
              background: feedback.type === 'success' ? '#d1fae5' : '#fee2e2',
              color: feedback.type === 'success' ? '#065f46' : '#991b1b',
              border: `1px solid ${feedback.type === 'success' ? '#a7f3d0' : '#fecaca'}`,
            }}
          >
            {feedback.message}
          </div>
        )}

        {/* Guided Playbooks */}
        <div>
          <h4 style={{ margin: '0 0 var(--space-3)', fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)' }}>
            Available Remediation Playbooks
          </h4>

          {/* Playbook 1: Immediate Retry */}
          <div className="card" style={{ padding: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
            <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>1. Immediate Sync Retry</div>
            <p style={{ margin: '4px 0 var(--space-2)', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
              Triggers an immediate ingestion poll, bypassing normal scheduled cadence.
            </p>
            <button
              id="btn-remediate-retry"
              className="btn btn-primary btn-sm"
              style={{ width: '100%' }}
              disabled={submitting !== null}
              onClick={() => handleExecutePlaybook('retry_now')}
            >
              {submitting === 'retry_now' ? 'Retrying…' : 'Execute Immediate Retry'}
            </button>
          </div>

          {/* Playbook 2: Override Backoff */}
          <div className="card" style={{ padding: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
            <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>2. Override Backoff Window</div>
            <p style={{ margin: '4px 0 var(--space-2)', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
              Lifts exponential backoff penalties and forces the connector active for a timed window.
            </p>
            <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', alignSelf: 'center' }}>
                Minutes:
              </label>
              <input
                id="input-override-minutes"
                type="number"
                min="1"
                max="120"
                value={overrideMinutes}
                onChange={(e) => setOverrideMinutes(Number(e.target.value) || 15)}
                style={{
                  width: '80px',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  border: '1px solid var(--color-border)',
                  fontSize: '0.8125rem',
                }}
              />
            </div>
            <button
              id="btn-remediate-override"
              className="btn btn-secondary btn-sm"
              style={{ width: '100%' }}
              disabled={submitting !== null}
              onClick={() => handleExecutePlaybook('override_backoff')}
            >
              {submitting === 'override_backoff' ? 'Applying Override…' : 'Override Backoff'}
            </button>
          </div>

          {/* Playbook 3: Clear Error State */}
          <div className="card" style={{ padding: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
            <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>3. Clear Error State</div>
            <p style={{ margin: '4px 0 var(--space-2)', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
              Resets consecutive failure counters and marks the connector health as healthy.
            </p>
            <button
              id="btn-remediate-clear"
              className="btn btn-secondary btn-sm"
              style={{ width: '100%' }}
              disabled={submitting !== null}
              onClick={() => handleExecutePlaybook('clear_error_state')}
            >
              {submitting === 'clear_error_state' ? 'Clearing…' : 'Clear Error State'}
            </button>
          </div>

          {/* Playbook 4: Reprompt Credentials */}
          <div className="card" style={{ padding: 'var(--space-3)' }}>
            <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>4. Reprompt Credentials</div>
            <p style={{ margin: '4px 0 var(--space-2)', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
              Marks connector state requiring operator credential re-authentication.
            </p>
            <button
              id="btn-remediate-reprompt"
              className="btn btn-danger btn-sm"
              style={{ width: '100%' }}
              disabled={submitting !== null}
              onClick={() => handleExecutePlaybook('reprompt_credentials')}
            >
              {submitting === 'reprompt_credentials' ? 'Flagging…' : 'Flag for Re-Authentication'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
