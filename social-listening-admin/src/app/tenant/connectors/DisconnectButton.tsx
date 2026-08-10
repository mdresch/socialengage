'use client';

import { useState } from 'react';

/**
 * Story 6.3 AC4 (healed 2026-08-10) — every disconnect is two clicks: the
 * first only moves to a confirm sub-state (no fetch), the second (inside
 * that sub-state) actually calls the backend. The same pattern
 * `AccessControl.tsx` (Story 6.8) already established — never a native
 * browser confirmation dialog, which this project's own contracts elsewhere
 * treat as an untestable, unstyleable escape hatch.
 */
export function DisconnectButton({ platformId, ownerType }: { platformId: string; ownerType: 'tenant' | 'user' }) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);

  async function handleDisconnect() {
    setMessage(null);
    const response = await fetch(
      `/api/connectors/${encodeURIComponent(platformId)}/disconnect?ownerType=${encodeURIComponent(ownerType)}`,
      { method: 'DELETE' }
    );
    const body = await response.json().catch(() => ({}));

    if (response.status === 200) {
      setMessage({ kind: 'success', text: `${platformId} disconnected.` });
      window.location.reload();
      return;
    }
    setPending(false);
    setMessage({ kind: 'error', text: body.error ?? 'Something went wrong while disconnecting this platform.' });
  }

  if (pending) {
    return (
      <span>
        <p>This will disconnect {platformId} immediately.</p>
        <button type="button" onClick={handleDisconnect}>
          Confirm: disconnect
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
        Disconnect
      </button>
      {message && <p role={message.kind === 'error' ? 'alert' : 'status'}>{message.text}</p>}
    </span>
  );
}
