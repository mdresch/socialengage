'use client';

import React, { useState } from 'react';
import type { AlertRuleItem } from '@/lib/core-client';

const RULE_TYPES = [
  { id: 'volume_spike', label: 'Volume Spike' },
  { id: 'negative_sentiment_spike', label: 'Negative Sentiment Outcry' },
  { id: 'influential_post', label: 'Influential / VIP Author Post' },
  { id: 'connector_error', label: 'Connector Error / Ingestion Failure' },
  { id: 'keyword_burst', label: 'Keyword Burst' },
];

interface AlertRulesViewProps {
  initialRules: AlertRuleItem[];
}

export function AlertRulesView({ initialRules }: AlertRulesViewProps) {
  const [rules, setRules] = useState<AlertRuleItem[]>(initialRules);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState<string>('negative_sentiment_spike');
  const [cooldown, setCooldown] = useState(60);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/alerts/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          type,
          cooldown_minutes: cooldown,
          channels: ['in_app'],
          enabled: true,
        }),
      });

      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        setError(b.error || 'Failed to create rule');
        return;
      }

      const created: AlertRuleItem = await res.json();
      setRules((prev) => [created, ...prev]);
      setCreating(false);
      setName('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (ruleId: string, enabled: boolean) => {
    try {
      const res = await fetch(`/api/alerts/rules/${ruleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !enabled }),
      });
      if (res.ok) {
        const updated: AlertRuleItem = await res.json();
        setRules((prev) => prev.map((r) => (r.id === ruleId ? updated : r)));
      }
    } catch {}
  };

  const handleDelete = async (ruleId: string) => {
    if (!confirm('Delete this alert rule?')) return;
    try {
      await fetch(`/api/alerts/rules/${ruleId}`, { method: 'DELETE' });
      setRules((prev) => prev.filter((r) => r.id !== ruleId));
    } catch {}
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          id="btn-create-alert-rule"
          className="btn btn-primary btn-sm"
          onClick={() => setCreating(true)}
        >
          + New Alert Rule
        </button>
      </div>

      {creating && (
        <div className="card" style={{ padding: 'var(--space-4)' }}>
          <h3 style={{ margin: '0 0 var(--space-3)' }}>Create Alert Rule</h3>
          <form onSubmit={handleCreate}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.875rem', marginBottom: 4 }}>
                  Rule Name *
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. Critical Outcry Spike"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.875rem', marginBottom: 4 }}>
                  Trigger Condition Type *
                </label>
                <select
                  className="input"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                >
                  {RULE_TYPES.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.875rem', marginBottom: 4 }}>
                  Cooldown Suppression (Minutes)
                </label>
                <input
                  type="number"
                  className="input"
                  value={cooldown}
                  onChange={(e) => setCooldown(parseInt(e.target.value, 10) || 1)}
                  min={1}
                />
              </div>

              {error && <div style={{ color: 'var(--color-error)', fontSize: '0.875rem' }}>{error}</div>}

              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <button type="submit" className="btn btn-primary btn-sm" disabled={loading}>
                  {loading ? 'Creating…' : 'Save Rule'}
                </button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setCreating(false)}>
                  Cancel
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {rules.length === 0 && !creating ? (
        <div style={{ textAlign: 'center', padding: 'var(--space-8) 0', color: 'var(--color-text-muted)' }}>
          No alert rules configured.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {rules.map((r) => (
            <div
              key={r.id}
              className="card"
              style={{
                padding: 'var(--space-4)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <span style={{ fontWeight: 700, fontSize: '1rem' }}>{r.name}</span>
                  <span
                    style={{
                      padding: '2px 8px',
                      borderRadius: '9999px',
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      background: r.enabled ? '#d1fae5' : '#f3f4f6',
                      color: r.enabled ? '#059669' : '#6b7280',
                    }}
                  >
                    {r.enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                  Type: {r.type.replace(/_/g, ' ')} • Cooldown: {r.cooldown_minutes}m
                </div>
              </div>

              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <button
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '0.75rem' }}
                  onClick={() => handleToggle(r.id, r.enabled)}
                >
                  {r.enabled ? 'Disable' : 'Enable'}
                </button>
                <button
                  className="btn btn-danger btn-sm"
                  style={{ fontSize: '0.75rem' }}
                  onClick={() => handleDelete(r.id)}
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
