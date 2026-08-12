'use client';

import { useState } from 'react';

/**
 * Story 6.15 (Story 1.11, ADR-0051) — turns a connector on/off,
 * independent of ConnectForm/DisconnectButton's credential management.
 * Activate is a single click (non-destructive — ADR-0051 Decision §2,
 * activation asserts nothing and never invokes ingestion). Deactivate uses
 * the same two-click pending-confirm sub-state DisconnectButton already
 * established (never a native `window.confirm()`) — deactivating a
 * tenant-wide connector, or any connector at all, deserves the same "are
 * you sure" step disconnect already gets, even though it's non-destructive
 * to the credential itself.
 */
export function ActivateDeactivateButton({
  platformId,
  ownerType,
  isActive,
}: {
  platformId: string;
  ownerType: 'tenant' | 'user';
  isActive: boolean;
}) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);

  async function callActivation(action: 'activate' | 'deactivate') {
    setMessage(null);
    const response = await fetch(`/api/connectors/${encodeURIComponent(platformId)}/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ownerType }),
    });
    const body = await response.json().catch(() => ({}));

    if (response.status === 200) {
      setMessage({ kind: 'success', text: `${platformId} ${action}d.` });
      window.location.reload();
      return;
    }
    setPending(false);
    setMessage({ kind: 'error', text: body.error ?? `Something went wrong while trying to ${action} this connector.` });
  }

  if (!isActive) {
    return (
      <span>
        <button type="button" onClick={() => callActivation('activate')}>
          Activate
        </button>
        {message && <p role={message.kind === 'error' ? 'alert' : 'status'}>{message.text}</p>}
      </span>
    );
  }

  if (pending) {
    return (
      <span>
        <p>This will deactivate {platformId} — the stored credential is kept, you can reactivate at any time.</p>
        <button type="button" onClick={() => callActivation('deactivate')}>
          Confirm: deactivate
        </button>
        <button type="button" onClick={() => setPending(false)}>
          Cancel
        </button>
      </span>
    );
  }

  return (
    <span>
      <button type="button" onClick={() => setPending(true)}>
        Deactivate
      </button>
      {message && <p role={message.kind === 'error' ? 'alert' : 'status'}>{message.text}</p>}
    </span>
  );
}
