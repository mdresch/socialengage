'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui';

type PendingAction = { kind: 'now' } | { kind: 'schedule'; date: string } | { kind: 'reactivate' } | null;

/**
 * Story 6.8 AC4/AC5 — every action here is two clicks: the first only moves
 * to a confirm sub-state (no fetch), the second (inside that sub-state)
 * actually calls apply(). The confirm copy itself is what distinguishes an
 * immediate offboard from a scheduled future expiration — never the same
 * sentence with a substituted date.
 *
 * Visual redesign, 2026-08-17 — the whole flow now opens in a `Modal`
 * (Design Spec §6.8), styled to match the "Time-Bounded Access Window"
 * design reference. The two-click state machine (`pending`) and its exact
 * confirm copy are unchanged — only the container moved from an always-
 * rendered inline `<span>` to a modal opened by a trigger button.
 */
export function AccessControl({ userId, currentValue }: { userId: string; currentValue: string | null }) {
  const [isOpen, setIsOpen] = useState(false);
  const [scheduledDate, setScheduledDate] = useState('');
  const [pending, setPending] = useState<PendingAction>(null);
  const [error, setError] = useState<string | null>(null);

  function closeModal() {
    setIsOpen(false);
    setPending(null);
    setError(null);
  }

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

  return (
    <>
      <button type="button" className="btn btn-secondary btn-sm" onClick={() => setIsOpen(true)}>
        Set expiry
      </button>
      <Modal isOpen={isOpen} onClose={closeModal} title="Time-bounded access window">
        <div className="tu-modal-form">
          {error && (
            <p role="alert" className="tu-form-message tu-form-message-error">
              {error}
            </p>
          )}

          {pending?.kind === 'now' && (
            <>
              <p>This will end this user&apos;s access immediately.</p>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setPending(null)}>
                  Cancel
                </button>
                <button type="button" className="btn btn-destructive" onClick={() => apply(new Date().toISOString())}>
                  Confirm: end access now
                </button>
              </div>
            </>
          )}

          {pending?.kind === 'schedule' && (
            <>
              <p>This will schedule this user&apos;s access to end on {pending.date}, not immediately.</p>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setPending(null)}>
                  Cancel
                </button>
                <button type="button" className="btn btn-primary" onClick={() => apply(new Date(pending.date).toISOString())}>
                  Confirm: schedule end date
                </button>
              </div>
            </>
          )}

          {pending?.kind === 'reactivate' && (
            <>
              <p>This will restore this user&apos;s access.</p>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setPending(null)}>
                  Cancel
                </button>
                <button type="button" className="btn btn-primary" onClick={() => apply(null)}>
                  Confirm: reactivate
                </button>
              </div>
            </>
          )}

          {pending === null && (
            <>
              <div className="tu-field">
                <button type="button" className="btn btn-destructive btn-sm" onClick={() => setPending({ kind: 'now' })}>
                  End access now
                </button>
              </div>
              <label className="tu-field">
                <span className="tu-field-label">Access termination date</span>
                <input
                  type="date"
                  value={scheduledDate}
                  onChange={(event) => setScheduledDate(event.target.value)}
                  className="tu-input"
                />
              </label>
              <div className="tu-field">
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={!scheduledDate}
                  onClick={() => setPending({ kind: 'schedule', date: scheduledDate })}
                >
                  Schedule end date
                </button>
              </div>
              {currentValue !== null && (
                <div className="tu-field">
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPending({ kind: 'reactivate' })}>
                    Reactivate
                  </button>
                </div>
              )}
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={closeModal}>
                  Close
                </button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </>
  );
}
