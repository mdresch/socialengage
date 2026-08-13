'use client';

import { useState } from 'react';

interface DeletionRequestState {
  deletionRequestedAt: string | null;
  graceEndsAt: string | null;
}

/**
 * Story 6.13 (ADR-0043) — the real request/export/cancel/confirm flow
 * against Story 3.8's REST surface. There is no `GET` endpoint for current
 * deletion-request state (see this component's own SKILL.md "Load-bearing
 * constraints") — this panel starts with no known request, and a `409`
 * from `POST /request` is itself how it learns a request is already
 * active, without a `graceEndsAt` value to show. Cancel and confirm each
 * get their own separate two-click pending-confirm sub-state
 * (`cancelPending` / `confirmPending`), mirroring
 * `ActivateDeactivateButton`/`DisconnectButton`'s own established
 * convention, never a native `window.confirm()`.
 */
export function TenantDeletionPanel() {
  const [request, setRequest] = useState<DeletionRequestState | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [cancelPending, setCancelPending] = useState(false);
  const [cancelMessage, setCancelMessage] = useState<string | null>(null);
  const [confirmPending, setConfirmPending] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function handleRequest() {
    setRequestError(null);
    const response = await fetch('/api/tenants/self-service-deletion/request', { method: 'POST' });
    const body = await response.json().catch(() => ({}));

    if (response.status === 202) {
      setRequest({ deletionRequestedAt: body.deletionRequestedAt ?? null, graceEndsAt: body.graceEndsAt ?? null });
      return;
    }
    if (response.status === 409) {
      // A request is already active for this tenant — the real current
      // state, not a generic error. The 409 body carries no graceEndsAt.
      setRequest({ deletionRequestedAt: null, graceEndsAt: null });
      return;
    }
    setRequestError(body.error ?? 'Something went wrong while requesting deletion.');
  }

  async function handleExport(format: 'json' | 'csv') {
    setExportMessage(null);
    const response = await fetch('/api/tenants/self-service-deletion/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ format }),
    });

    if (response.status !== 200) {
      const body = await response.json().catch(() => ({}));
      setExportMessage(body.error ?? 'Export is only available after requesting deletion.');
      return;
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `tenant-export.${format}`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }

  async function handleCancel() {
    setCancelMessage(null);
    const response = await fetch('/api/tenants/self-service-deletion', { method: 'DELETE' });
    const body = await response.json().catch(() => ({}));

    if (response.status === 200) {
      setRequest(null);
      setCancelPending(false);
      return;
    }
    setCancelPending(false);
    setCancelMessage(body.error ?? 'Something went wrong while cancelling this deletion request.');
  }

  async function handleConfirm() {
    setConfirmMessage(null);
    const response = await fetch('/api/tenants/self-service-deletion/confirm', { method: 'POST' });
    const body = await response.json().catch(() => ({}));

    if (response.status === 202) {
      setDeleting(true);
      setConfirmPending(false);
      return;
    }
    if (response.status === 409) {
      // Real backend rejection — clock skew or a stale render, not just
      // trusting this panel's own client-side timing check.
      if (body.graceEndsAt && request) {
        setRequest({ ...request, graceEndsAt: body.graceEndsAt });
      }
      setConfirmPending(false);
      setConfirmMessage(body.error ?? 'The grace period has not yet elapsed.');
      return;
    }
    setConfirmPending(false);
    setConfirmMessage(body.error ?? 'Something went wrong while confirming deletion.');
  }

  if (deleting) {
    return (
      <p role="status">
        Deletion has been confirmed and is now in progress. This runs in the background — this screen will not update
        further, and your session will simply stop working once deletion actually completes.
      </p>
    );
  }

  if (!request) {
    return (
      <section>
        <button type="button" onClick={handleRequest}>
          Request deletion
        </button>
        {requestError && <p role="alert">{requestError}</p>}
      </section>
    );
  }

  const graceEndsAt = request.graceEndsAt;
  const gracePeriodNotElapsed = graceEndsAt ? new Date() < new Date(graceEndsAt) : true;
  const gracePeriodElapsed = graceEndsAt ? !gracePeriodNotElapsed : false;

  return (
    <section>
      {graceEndsAt ? (
        <p>
          Your tenant will be deleted on or after <strong>{graceEndsAt}</strong> unless you cancel before then.
        </p>
      ) : (
        <p>A deletion request is already active for this tenant.</p>
      )}

      <section>
        <h2>Export your data</h2>
        <p>You can export as many times as you like before confirming deletion.</p>
        <button type="button" onClick={() => handleExport('json')}>
          Export as JSON
        </button>
        <button type="button" onClick={() => handleExport('csv')}>
          Export as CSV
        </button>
        {exportMessage && <p role="alert">{exportMessage}</p>}
      </section>

      <section>
        <h2>Cancel deletion</h2>
        {cancelPending ? (
          <>
            <p>Are you sure you want to cancel this deletion request? Ingestion will resume immediately.</p>
            <button type="button" onClick={handleCancel}>
              Confirm: cancel deletion
            </button>
            <button type="button" onClick={() => setCancelPending(false)}>
              Never mind
            </button>
          </>
        ) : (
          <button type="button" onClick={() => setCancelPending(true)}>
            Cancel deletion request
          </button>
        )}
        {cancelMessage && <p role="alert">{cancelMessage}</p>}
      </section>

      <section>
        <h2>Confirm deletion</h2>
        {confirmPending ? (
          <>
            <p role="alert">
              This is final and cannot be undone. All tenant data — including posts, watchlists, and credentials —
              will be permanently deleted.
            </p>
            <button type="button" onClick={handleConfirm}>
              Confirm: permanently delete this tenant
            </button>
            <button type="button" onClick={() => setConfirmPending(false)}>
              Never mind
            </button>
          </>
        ) : (
          <button type="button" disabled={!gracePeriodElapsed} onClick={() => setConfirmPending(true)}>
            Confirm deletion
          </button>
        )}
        {!gracePeriodElapsed && graceEndsAt && <p>The grace period has not yet elapsed — confirmation is not available until then.</p>}
        {confirmMessage && <p role="alert">{confirmMessage}</p>}
      </section>
    </section>
  );
}
