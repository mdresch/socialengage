'use client';

import { useState } from 'react';
import { Slideover, EmptyState, RelativeTime } from '@/components/ui';
import type { AccessHistoryEntry } from '@/lib/core-client';

interface AccessHistoryButtonProps {
  userId: string;
  userEmail: string;
  /** userId -> email, built once from the already-fetched tenant user list (page.tsx) — no new endpoint just to resolve a name. */
  actorLookup: Record<string, string>;
  /**
   * Test/rendering-proof seam only — real usage never passes this and
   * fetches lazily on open instead. When provided, the component treats
   * itself as already-loaded and skips the fetch entirely.
   */
  initialEntries?: AccessHistoryEntry[];
}

function formatValue(value: string | null): string {
  return value === null ? 'active indefinitely' : new Date(value).toLocaleString();
}

/**
 * Story 6.14 (ADR-0032 §9) — a per-row action on /tenant/users
 * (tenant_admin-only, gated by the caller in page.tsx) showing one user's
 * real access_ends_at change history. Fetches lazily on first open, not on
 * page load — a tenant with many users would otherwise trigger one
 * access-history fetch per row for data almost never viewed.
 */
export function AccessHistoryButton({ userId, userEmail, actorLookup, initialEntries }: AccessHistoryButtonProps) {
  const [open, setOpen] = useState(initialEntries !== undefined);
  const [entries, setEntries] = useState<AccessHistoryEntry[] | null>(initialEntries ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function resolveActor(actorUserId: string): string {
    return actorLookup[actorUserId] ?? actorUserId;
  }

  async function openHistory() {
    setOpen(true);
    if (entries !== null) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/tenant-users/${userId}/access-history`);
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(body.error ?? 'Could not load access history.');
        return;
      }
      setEntries(Array.isArray(body.entries) ? body.entries : []);
    } catch {
      setError('Could not load access history.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button type="button" className="btn btn-secondary btn-sm" onClick={openHistory}>
        View access history
      </button>
      <Slideover title={`Access history — ${userEmail}`} isOpen={open} onClose={() => setOpen(false)}>
        {loading && <p>Loading…</p>}
        {error && <p role="alert">{error}</p>}
        {entries !== null && entries.length === 0 && (
          <EmptyState heading="No access changes recorded" body="This user's access has never been modified." />
        )}
        {entries !== null && entries.length > 0 && (
          <ul className="tu-history-list">
            {entries.map((entry) => (
              <li key={entry.id} className="tu-history-entry">
                <div className="tu-history-entry-meta">
                  <span className="tu-history-entry-actor">{resolveActor(entry.actorUserId)}</span>
                  <RelativeTime timestamp={entry.occurredAt} />
                </div>
                <div className="tu-history-entry-detail">
                  <span className="tu-history-entry-op">{entry.operation}</span>
                  <span>{formatValue(entry.oldValue)} → {formatValue(entry.newValue)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Slideover>
    </>
  );
}
