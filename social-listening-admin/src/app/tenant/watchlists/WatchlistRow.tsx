'use client';

import { useState } from 'react';
import type { Watchlist } from '@/lib/core-client';
import { WatchlistForm } from './WatchlistForm';

/**
 * Story 6.4 (reworked 2026-08-12, ADR-0044) — per-row actions. Editing
 * reuses WatchlistForm in 'edit' mode (RFC 7396 merge-patch); the
 * Active/Inactive toggle is a small, dedicated PATCH sending only
 * {isActive}, never routed through WatchlistForm's own diffing, per the
 * revised AC's own "toggling isActive alone still sends only that field."
 * Delete is a two-click confirm (never a native browser confirm dialog),
 * matching DisconnectButton.tsx/AccessControl.tsx.
 */
export function WatchlistRow({
  watchlist,
  connectedPlatforms,
}: {
  watchlist: Watchlist;
  connectedPlatforms: { id: string; name: string }[];
}) {
  const [editing, setEditing] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  const [message, setMessage] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);

  async function toggleActive() {
    setMessage(null);
    const response = await fetch(`/api/watchlists/${encodeURIComponent(watchlist.id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patch: { isActive: !watchlist.isActive }, version: watchlist.version }),
    });
    const body = await response.json().catch(() => ({}));

    if (response.status === 200) {
      window.location.reload();
      return;
    }
    if (response.status === 409) {
      setMessage({
        kind: 'error',
        text: `This watchlist changed elsewhere (now at version ${body.current_version ?? '?'}) — reload the page before retrying.`,
      });
      return;
    }
    setMessage({ kind: 'error', text: 'Something went wrong while updating this watchlist.' });
  }

  async function handleDelete() {
    setMessage(null);
    const response = await fetch(`/api/watchlists/${encodeURIComponent(watchlist.id)}`, { method: 'DELETE' });
    if (response.status === 204) {
      window.location.reload();
      return;
    }
    setDeletePending(false);
    setMessage({ kind: 'error', text: 'Something went wrong while deleting this watchlist.' });
  }

  return (
    <li>
      <strong>{watchlist.name}</strong> — {watchlist.matchType} ({watchlist.isActive ? 'active' : 'inactive'})
      <div>Platforms: {watchlist.platformIds.length > 0 ? watchlist.platformIds.join(', ') : 'none'}</div>

      <button type="button" onClick={() => setEditing((prev) => !prev)}>
        {editing ? 'Close' : 'Edit'}
      </button>
      <button type="button" onClick={toggleActive}>
        {watchlist.isActive ? 'Deactivate' : 'Activate'}
      </button>

      {deletePending ? (
        <span>
          <p>This will delete &quot;{watchlist.name}&quot; permanently. There is no undo.</p>
          <button type="button" onClick={handleDelete}>
            Confirm delete
          </button>
          <button type="button" onClick={() => setDeletePending(false)}>
            Cancel
          </button>
        </span>
      ) : (
        <button type="button" onClick={() => setDeletePending(true)}>
          Delete
        </button>
      )}

      {editing && (
        <WatchlistForm
          mode="edit"
          watchlist={watchlist}
          connectedPlatforms={connectedPlatforms}
          onCancel={() => setEditing(false)}
        />
      )}

      {message && <p role={message.kind === 'error' ? 'alert' : 'status'}>{message.text}</p>}
    </li>
  );
}
