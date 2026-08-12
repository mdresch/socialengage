'use client';

import { useState, type FormEvent } from 'react';

/**
 * Story 6.6 (reworked 2026-08-12) — a real form calling createAdminTenant()
 * -> POST /v1/admin/tenants. On success, the new tenant appears in the
 * tenant registry table without a full page reload being required to
 * notice it — a refetch/revalidate (here, a real reload, the same pattern
 * every other Epic 6/7 mutation form uses) is sufficient; no optimistic-UI
 * requirement.
 *
 * `domain` (enhancement, 2026-08-12, optional) is only included in the
 * POST body when non-empty — an empty string is not the same as "not
 * provided" at the backend (createTenant()'s own `input.domain ?? null`).
 */
export function ProvisionTenantForm() {
  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');
  const [licenseSeatCount, setLicenseSeatCount] = useState(1);
  const [message, setMessage] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    const response = await fetch('/api/admin/tenants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(domain.trim() ? { name, licenseSeatCount, domain: domain.trim() } : { name, licenseSeatCount }),
    });
    const body = await response.json().catch(() => ({}));

    if (response.status === 201) {
      window.location.reload();
      return;
    }
    setMessage({ kind: 'error', text: body.error ?? 'Something went wrong while provisioning this tenant.' });
  }

  return (
    <form onSubmit={handleSubmit}>
      <label>
        Tenant name
        <input required value={name} onChange={(event) => setName(event.target.value)} />
      </label>
      <label>
        Domain (optional)
        <input value={domain} onChange={(event) => setDomain(event.target.value)} placeholder="example.com" />
      </label>
      <label>
        License seat count
        <input
          type="number"
          min={1}
          required
          value={licenseSeatCount}
          onChange={(event) => setLicenseSeatCount(Number(event.target.value))}
        />
      </label>
      <button type="submit">Provision tenant</button>
      {message && <p role={message.kind === 'error' ? 'alert' : 'status'}>{message.text}</p>}
    </form>
  );
}
