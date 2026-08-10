'use client';

import { useState } from 'react';

type PendingAction = { kind: 'now' } | { kind: 'schedule'; date: string } | { kind: 'reactivate' } | null;

/**
 * Story 6.8 AC4/AC5 — every action here is two clicks: the first only moves
 * to a confirm sub-state (no fetch), the second (inside that sub-state)
 * actually calls apply(). The confirm copy itself is what distinguishes an
 * immediate offboard from a scheduled future expiration — never the same
 * sentence with a substituted date.
 */
export function AccessControl({ userId, currentValue }: { userId: string; currentValue: string | null }) {
  const [scheduledDate, setScheduledDate] = useState('');
  const [pending, setPending] = useState<PendingAction>(null);
  const [error, setError] = useState<string | null>(null);

  async function apply(accessEndsAt: string | null) {
    setError(null);
    const response = await fetch(`/api/tenant-users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessEndsAt }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(body.error ?? "Could not update this user's access.");
      return;
    }
    setPending(null);
    window.location.reload();
  }

  if (pending?.kind === 'now') {
    return (
      <span>
        <p>This will end this user&apos;s access immediately.</p>
        <button type="button" onClick={() => apply(new Date().toISOString())}>
          Confirm: end access now
        </button>
        <button type="button" onClick={() => setPending(null)}>
          Cancel
        </button>
      </span>
    );
  }

  if (pending?.kind === 'schedule') {
    return (
      <span>
        <p>This will schedule this user&apos;s access to end on {pending.date}, not immediately.</p>
        <button type="button" onClick={() => apply(new Date(pending.date).toISOString())}>
          Confirm: schedule end date
        </button>
        <button type="button" onClick={() => setPending(null)}>
          Cancel
        </button>
      </span>
    );
  }

  if (pending?.kind === 'reactivate') {
    return (
      <span>
        <p>This will restore this user&apos;s access.</p>
        <button type="button" onClick={() => apply(null)}>
          Confirm: reactivate
        </button>
        <button type="button" onClick={() => setPending(null)}>
          Cancel
        </button>
      </span>
    );
  }

  return (
    <span>
      {error && <p role="alert">{error}</p>}
      <button type="button" onClick={() => setPending({ kind: 'now' })}>
        End access now
      </button>
      <input type="date" value={scheduledDate} onChange={(event) => setScheduledDate(event.target.value)} />
      <button type="button" disabled={!scheduledDate} onClick={() => setPending({ kind: 'schedule', date: scheduledDate })}>
        Schedule end date
      </button>
      {currentValue !== null && (
        <button type="button" onClick={() => setPending({ kind: 'reactivate' })}>
          Reactivate
        </button>
      )}
    </span>
  );
}
