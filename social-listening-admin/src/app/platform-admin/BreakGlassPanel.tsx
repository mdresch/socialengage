'use client';

import { useState, type FormEvent } from 'react';

interface TenantOption {
  id: string;
  name: string;
}

type BreakGlassState =
  | { phase: 'idle' }
  | { phase: 'requested'; tenantId: string; requestId: string }
  | { phase: 'executed'; temporaryAccessPass: string };

/**
 * Story 6.6 (reworked 2026-08-12) — a real two-phase flow, ADR-0030 §3's own
 * design exactly: a **request** step (recorded, no Entra action) separate
 * from an **execute** step this component only offers once a request
 * exists. `targetUserId` is typed in directly (the Tenant-Admin-lookup-by-
 * tenant-name gap is a real, already-named backend gap — see this
 * component's own SKILL.md), not looked up from any rendered tenant-content
 * list. The generated `temporaryAccessPass` is rendered from this
 * component's own local React state only, exactly once — never logged to
 * the console, never written to any browser storage API, and never kept in
 * any state that survives a re-render, and this component never calls
 * `window.location.reload()` after a successful execute (that would erase
 * the value before the operator could read/copy it — the opposite of what
 * "shown once" is protecting).
 */
export function BreakGlassPanel({ tenants }: { tenants: TenantOption[] }) {
  const [tenantId, setTenantId] = useState(tenants[0]?.id ?? '');
  const [targetUserId, setTargetUserId] = useState('');
  const [state, setState] = useState<BreakGlassState>({ phase: 'idle' });
  const [message, setMessage] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);

  async function handleRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    const response = await fetch(`/api/admin/tenants/${encodeURIComponent(tenantId)}/break-glass/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetUserId }),
    });
    const body = await response.json().catch(() => ({}));

    if (response.status === 201 && typeof body.id === 'string') {
      setState({ phase: 'requested', tenantId, requestId: body.id });
      return;
    }
    setMessage({ kind: 'error', text: body.error ?? 'Something went wrong while recording the break-glass request.' });
  }

  async function handleExecute() {
    if (state.phase !== 'requested') return;
    setMessage(null);

    const response = await fetch(
      `/api/admin/tenants/${encodeURIComponent(state.tenantId)}/break-glass/requests/${encodeURIComponent(state.requestId)}/execute`,
      { method: 'POST' }
    );
    const body = await response.json().catch(() => ({}));

    if (response.status === 200 && typeof body.temporaryAccessPass === 'string') {
      setState({ phase: 'executed', temporaryAccessPass: body.temporaryAccessPass });
      return;
    }
    setMessage({ kind: 'error', text: body.error ?? 'Something went wrong while executing the break-glass request.' });
  }

  if (state.phase === 'executed') {
    return (
      <div>
        <p>
          <strong>Temporary Access Pass — shown once, will not be shown again:</strong>
        </p>
        <p>
          <code>{state.temporaryAccessPass}</code>
        </p>
        <p>Copy this now and hand it to the affected Tenant-Admin through your own out-of-band channel.</p>
        <button type="button" onClick={() => setState({ phase: 'idle' })}>
          I&apos;ve copied this
        </button>
      </div>
    );
  }

  return (
    <div>
      <form onSubmit={handleRequest}>
        <label>
          Tenant
          <select value={tenantId} onChange={(event) => setTenantId(event.target.value)}>
            {tenants.map((tenant) => (
              <option key={tenant.id} value={tenant.id}>
                {tenant.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Target user ID
          <input required value={targetUserId} onChange={(event) => setTargetUserId(event.target.value)} />
        </label>
        <button type="submit" disabled={state.phase === 'requested'}>
          Request reset
        </button>
      </form>

      {state.phase === 'requested' && (
        <div>
          <p>Request {state.requestId} recorded — no Entra action taken yet.</p>
          <button type="button" onClick={handleExecute}>
            Execute request
          </button>
        </div>
      )}

      {message && <p role={message.kind === 'error' ? 'alert' : 'status'}>{message.text}</p>}
    </div>
  );
}
