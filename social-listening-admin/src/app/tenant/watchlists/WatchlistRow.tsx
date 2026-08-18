'use client';

import { useState } from 'react';
import type { Watchlist } from '@/lib/core-client';
import { ConfirmModal, Slideover } from '@/components/ui';
import { WatchlistForm } from './WatchlistForm';

const MATCH_TYPE_LABELS: Record<string, string> = {
  keyword: 'Keyword',
  hashtag: 'Hashtag',
  account: 'Account',
  boolean: 'Boolean',
};

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

  const platformNames = watchlist.platformIds
    .map((id) => connectedPlatforms.find((p) => p.id === id)?.name ?? id)
    .join(', ');

  const querySummary =
    watchlist.matchType === 'boolean'
      ? watchlist.booleanQuery ?? ''
      : (watchlist.terms ?? []).join(', ');

  return (
    <>
      <tr>
        {/* Watchlist Name + hit count + platforms sub-line */}
        <td>
          <div className="watchlist-name-cell">
            <span>{watchlist.name}</span>
          </div>
          <div className="watchlist-name-sub">
            {platformNames || 'No platforms'}
          </div>
        </td>

        {/* Match Type badge */}
        <td>
          <span className="match-type-badge">
            {MATCH_TYPE_LABELS[watchlist.matchType] ?? watchlist.matchType}
          </span>
        </td>

        {/* Query / Terms Summary */}
        <td>
          {watchlist.matchType === 'boolean' ? (
            <code className="query-code">{querySummary}</code>
          ) : (
            <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
              {querySummary || '—'}
            </span>
          )}
        </td>

        {/* Status toggle */}
        <td style={{ textAlign: 'center' }}>
          <button
            type="button"
            className={`watchlist-status-btn ${watchlist.isActive ? 'is-active' : 'is-inactive'}`}
            onClick={toggleActive}
            title={watchlist.isActive ? 'Click to pause watchlist' : 'Click to activate watchlist'}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: watchlist.isActive ? '#16a34a' : 'var(--color-text-muted)',
                display: 'inline-block',
                flexShrink: 0,
              }}
            />
            {watchlist.isActive ? 'Active' : 'Inactive'}
          </button>
        </td>

        {/* Actions: edit + delete */}
        <td className="col-actions">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 'var(--space-1)' }}>
            <button
              type="button"
              className="watchlist-action-btn"
              title="Edit watchlist"
              onClick={() => setEditing(true)}
              aria-label={`Edit ${watchlist.name}`}
            >
              ✎
            </button>
            <button
              type="button"
              className="watchlist-action-btn is-delete"
              title="Delete watchlist"
              onClick={() => setDeletePending(true)}
              aria-label={`Delete ${watchlist.name}`}
            >
              🗑
            </button>
          </div>
          {message && (
            <p role={message.kind === 'error' ? 'alert' : 'status'} className="form-message form-message-error" style={{ marginTop: 'var(--space-2)', textAlign: 'left' }}>
              {message.text}
            </p>
          )}
        </td>
      </tr>

      {/* Edit Slideover */}
      <Slideover
        isOpen={editing}
        onClose={() => setEditing(false)}
        title="Edit Watchlist"
        subtitle="Update matching rules and platform sources"
        width="md"
        footer={
          <>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditing(false)}>
              Cancel
            </button>
            <button type="submit" form="watchlist-form" className="btn btn-primary btn-sm">
              Save changes
            </button>
          </>
        }
      >
        <WatchlistForm
          mode="edit"
          watchlist={watchlist}
          connectedPlatforms={connectedPlatforms}
          onCancel={() => setEditing(false)}
        />
      </Slideover>

      {/* Delete Confirmation Modal — There is no undo. */}
      <ConfirmModal
        isOpen={deletePending}
        title={`Delete "${watchlist.name}"?`}
        body={
          <div>
            <p>Deleting this watchlist permanently removes the match rule from all active ingestion pipelines.</p>
            <p style={{ marginTop: 'var(--space-2)', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
              <strong>Historical Data Guarantee:</strong> Ingested posts previously matched by this watchlist will be preserved in your database feed. There is no undo.
            </p>
          </div>
        }
        confirmLabel="Delete watchlist"
        confirmVariant="destructive"
        onConfirm={handleDelete}
        onCancel={() => setDeletePending(false)}
      />
    </>
  );
}
