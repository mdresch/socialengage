'use client';

import { useState, type FormEvent } from 'react';

/**
 * Story 6.6 (reworked 2026-08-12) — a real per-tenant-row control calling
 * updateAdminTenant() -> PATCH /v1/admin/tenants/:id, scoped to exactly
 * `status` and `licenseSeatCount` — no other tenant field is ever sent
 * unless a future story explicitly extends this (tenants/SKILL.md's own
 * column-scoped grant, carried forward unchanged from the original AC).
 */
export function TenantAdminControls({
  tenantId,
  currentStatus,
  currentLicenseSeatCount,
}: {
  tenantId: string;
  currentStatus: 'active' | 'suspended';
  currentLicenseSeatCount: number;
}) {
  const [status, setStatus] = useState<'active' | 'suspended'>(currentStatus);
  const [licenseSeatCount, setLicenseSeatCount] = useState(currentLicenseSeatCount);
  const [message, setMessage] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    const response = await fetch(`/api/admin/tenants/${encodeURIComponent(tenantId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, licenseSeatCount }),
    });
    const body = await response.json().catch(() => ({}));

    if (response.status === 200) {
      window.location.reload();
      return;
    }
    setMessage({ kind: 'error', text: body.error ?? 'Something went wrong while updating this tenant.' });
  }

  return (
    <form onSubmit={handleSubmit}>
      <label>
        Status
        <select value={status} onChange={(event) => setStatus(event.target.value as 'active' | 'suspended')}>
          <option value="active">active</option>
          <option value="suspended">suspended</option>
        </select>
      </label>
      <label>
        License seats
        <input
          type="number"
          min={0}
          value={licenseSeatCount}
          onChange={(event) => setLicenseSeatCount(Number(event.target.value))}
        />
      </label>
      <button type="submit">Save</button>
      {message && <p role={message.kind === 'error' ? 'alert' : 'status'}>{message.text}</p>}
    </form>
  );
}
