'use client';

import { useState, type FormEvent } from 'react';

export interface CredentialField {
  key: string;
  label: string;
}

/**
 * Story 6.3 (healed 2026-08-10) — rendered per not-yet-connected platform.
 * A single-field platform (e.g. GNews's bare API key) submits `credential`
 * as that one raw value; a multi-field platform (Azure AI Language's
 * `{endpoint,key}`, Azure OpenAI's `{endpoint,key,deployment}`) submits it
 * JSON-encoded — the backend's own credential storage (ADR-0014) always
 * treats it as one opaque string either way, so this is the one place that
 * distinction is made, not core-client.ts.
 *
 * `allowTenantWide` mirrors AC2/Story 6.2's role gate: the parent page
 * computes it from the resolved session's own role, never trusted from a
 * client-side value alone (the real gate is still the backend's own 403).
 */
export function ConnectForm({
  platformId,
  fields,
  allowTenantWide,
}: {
  platformId: string;
  fields: CredentialField[];
  allowTenantWide: boolean;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [ownerType, setOwnerType] = useState<'tenant' | 'user'>(allowTenantWide ? 'tenant' : 'user');
  const [message, setMessage] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    const credential = fields.length === 1 ? (values[fields[0].key] ?? '') : JSON.stringify(values);

    const response = await fetch(`/api/connectors/${encodeURIComponent(platformId)}/connect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential, ownerType }),
    });
    const body = await response.json().catch(() => ({}));

    if (response.status === 201) {
      setMessage({ kind: 'success', text: `${platformId} connected.` });
      window.location.reload();
      return;
    }
    setMessage({ kind: 'error', text: body.error ?? 'Something went wrong while connecting this platform.' });
  }

  return (
    <form onSubmit={handleSubmit}>
      {fields.map((field) => (
        <label key={field.key}>
          {field.label}
          <input
            type="text"
            required
            value={values[field.key] ?? ''}
            onChange={(event) => setValues((prev) => ({ ...prev, [field.key]: event.target.value }))}
          />
        </label>
      ))}
      {allowTenantWide && (
        <label>
          Scope
          <select value={ownerType} onChange={(event) => setOwnerType(event.target.value as 'tenant' | 'user')}>
            <option value="tenant">Tenant-wide</option>
            <option value="user">Just for me</option>
          </select>
        </label>
      )}
      <button type="submit">Connect</button>
      {message && <p role={message.kind === 'error' ? 'alert' : 'status'}>{message.text}</p>}
    </form>
  );
}
