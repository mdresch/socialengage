'use client';

import React, { useState } from 'react';
import { CRMCredentialSummary } from '@/lib/core-client';
import { CRMConnectorUI, MASKED_PLACEHOLDER } from './connectorConfig';

interface CRMSettingsViewProps {
  initialCredential: CRMCredentialSummary;
  connector: CRMConnectorUI;
}

export function CRMSettingsView({ initialCredential, connector }: CRMSettingsViewProps) {
  const initialConfig = initialCredential.config ?? {};
  const defaultValues: Record<string, string> = {};
  for (const field of connector.fields) {
    const value = initialConfig[field.name] ?? '';
    defaultValues[field.name] = value === MASKED_PLACEHOLDER ? '' : value;
  }

  const [config, setConfig] = useState<Record<string, string>>(defaultValues);
  const [configured, setConfigured] = useState(initialCredential.configured);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      const payload: Record<string, string> = { crmConnectorId: connector.id };
      for (const field of connector.fields) {
        payload[field.name] = (config[field.name] ?? '').trim();
      }

      const res = await fetch('/api/crm/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to save CRM credentials.');
      }

      setConfigured(true);
      setMessage('CRM credentials saved successfully.');
    } catch (err: any) {
      setError(err.message || 'Failed to save CRM credentials.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm('Remove the configured CRM credentials?')) return;
    setDeleting(true);
    setMessage(null);
    setError(null);

    try {
      const res = await fetch(`/api/crm/credentials/${connector.id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to remove CRM credentials.');
      }

      const cleared: Record<string, string> = {};
      for (const field of connector.fields) {
        cleared[field.name] = '';
      }
      setConfigured(false);
      setConfig(cleared);
      setMessage('CRM credentials removed.');
    } catch (err: any) {
      setError(err.message || 'Failed to remove CRM credentials.');
    } finally {
      setDeleting(false);
    }
  }

  async function handleVerify() {
    setVerifying(true);
    setMessage(null);
    setError(null);

    try {
      const res = await fetch(`/api/crm/credentials/${connector.id}/health`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Connection check failed: ${res.status}`);
      }

      const data = await res.json();
      if (data.status?.isActive) {
        setMessage('Connection successful — the provided credentials can access the CRM environment.');
      } else {
        setError(data.status?.error || 'Connection check did not succeed.');
      }
    } catch (err: any) {
      setError(err.message || 'Connection check failed.');
    } finally {
      setVerifying(false);
    }
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.75rem', marginBottom: '1.5rem' }}>CRM Connector Settings</h1>

      {message && (
        <div
          style={{
            padding: '0.75rem 1rem',
            borderRadius: 6,
            background: '#ecfdf5',
            color: '#065f46',
            marginBottom: '1rem',
            border: '1px solid #a7f3d0',
          }}
        >
          {message}
        </div>
      )}

      {error && (
        <div
          style={{
            padding: '0.75rem 1rem',
            borderRadius: 6,
            background: '#fef2f2',
            color: '#991b1b',
            marginBottom: '1rem',
            border: '1px solid #fecaca',
          }}
        >
          {error}
        </div>
      )}

      <section
        style={{
          border: '1px solid #e5e7eb',
          borderRadius: 8,
          padding: '1.5rem',
          background: '#fff',
        }}
      >
        <h2 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>{connector.title}</h2>
        <p style={{ color: '#6b7280', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
          {connector.description}
        </p>

        {connector.setupGuide && (
          <p style={{ marginBottom: '1.25rem', fontSize: '0.875rem' }}>
            <a
              href={connector.setupGuide.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#2563eb', textDecoration: 'underline' }}
            >
              {connector.setupGuide.label}
            </a>
          </p>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {connector.fields.map((field) => (
            <div key={field.name}>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  marginBottom: '0.25rem',
                }}
              >
                {field.label}
              </label>
              <input
                type={field.type}
                required={field.required}
                value={config[field.name] ?? ''}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, [field.name]: e.target.value }))
                }
                placeholder={field.placeholder}
                style={{
                  width: '100%',
                  padding: '0.5rem 0.75rem',
                  border: '1px solid #d1d5db',
                  borderRadius: 6,
                  fontSize: '0.875rem',
                }}
              />
            </div>
          ))}

          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
            <button
              type="submit"
              disabled={saving}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: 6,
                border: 'none',
                background: '#2563eb',
                color: '#fff',
                fontSize: '0.875rem',
                fontWeight: 500,
                cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.6 : 1,
              }}
            >
              {saving ? 'Saving...' : 'Save Credentials'}
            </button>

            <button
              type="button"
              onClick={handleVerify}
              disabled={verifying}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: 6,
                border: '1px solid #2563eb',
                background: '#eff6ff',
                color: '#2563eb',
                fontSize: '0.875rem',
                fontWeight: 500,
                cursor: verifying ? 'not-allowed' : 'pointer',
                opacity: verifying ? 0.6 : 1,
              }}
            >
              {verifying ? 'Checking...' : 'Test Connection'}
            </button>

            {configured && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: 6,
                  border: '1px solid #dc2626',
                  background: '#fff',
                  color: '#dc2626',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  cursor: deleting ? 'not-allowed' : 'pointer',
                  opacity: deleting ? 0.6 : 1,
                }}
              >
                {deleting ? 'Removing...' : 'Remove Credentials'}
              </button>
            )}
          </div>
        </form>
      </section>
    </div>
  );
}
