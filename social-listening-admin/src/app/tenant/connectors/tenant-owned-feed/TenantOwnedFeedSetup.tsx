'use client';

import { useState, type FormEvent } from 'react';
import { Modal, ConfirmModal, EmptyState, StatusBadge } from '@/components/ui';
import { ActivateDeactivateButton } from '../ActivateDeactivateButton';
import type { TenantOwnedFeedActivationDetail } from '@/lib/core-client';

/**
 * Story 6.20 (ADR-0057) — replaces the previous single-activation state
 * machine with a real per-tenant feed list. `activations` is fetched
 * server-side by page.tsx (`listTenantOwnedFeedActivations()`, the same
 * "Server Component fetches, Client Component only mutates" pattern
 * `/tenant/users` already established) — no client-side list fetch, no
 * `?activationId=` URL-persistence trick needed anymore: every page load
 * already carries full data for every activation, pending or verified,
 * closing the "TXT instructions lost on reload" gap this story's own
 * ADR named as a direct side effect of the new list endpoint.
 *
 * Every mutating action (connect, verify, edit, remove) reloads the page
 * on success — the same `window.location.reload()` pattern `AccessControl`
 * already established on the Team & Access screen, rather than inventing
 * client-side state sync for a screen with a handful of rows.
 */
export function TenantOwnedFeedSetup({
  activations,
  isActive,
  isTenantAdmin,
}: {
  activations: TenantOwnedFeedActivationDetail[];
  isActive: boolean;
  isTenantAdmin: boolean;
}) {
  const [connectOpen, setConnectOpen] = useState(false);
  const [domain, setDomain] = useState('');
  const [feedUrl, setFeedUrl] = useState('');
  const [connectError, setConnectError] = useState<string | null>(null);

  const [editTarget, setEditTarget] = useState<TenantOwnedFeedActivationDetail | null>(null);
  const [editFeedUrl, setEditFeedUrl] = useState('');
  const [editError, setEditError] = useState<string | null>(null);

  const [removeTarget, setRemoveTarget] = useState<TenantOwnedFeedActivationDetail | null>(null);

  const [verifyMessageId, setVerifyMessageId] = useState<string | null>(null);
  const [verifyMessage, setVerifyMessage] = useState<string | null>(null);

  async function handleConnect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setConnectError(null);
    const response = await fetch('/api/connectors/tenant-owned-feed/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain, feedUrl }),
    });
    const body = await response.json().catch(() => ({}));
    if (response.status === 201) {
      window.location.reload();
      return;
    }
    setConnectError(body.error ?? 'Something went wrong while connecting this feed. Please check the domain and feed URL and try again.');
  }

  async function handleVerify(activationId: string) {
    setVerifyMessageId(null);
    setVerifyMessage(null);
    const response = await fetch('/api/connectors/tenant-owned-feed/verify-domain', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ connectorActivationId: activationId }),
    });
    const body = await response.json().catch(() => ({}));
    if (body.status === 'verified') {
      window.location.reload();
      return;
    }
    setVerifyMessageId(activationId);
    setVerifyMessage('Not yet verified — DNS propagation can take a while, try again shortly.');
  }

  async function handleEditSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editTarget) return;
    setEditError(null);
    const response = await fetch(`/api/connectors/tenant-owned-feed/${editTarget.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feedUrl: editFeedUrl }),
    });
    const body = await response.json().catch(() => ({}));
    if (response.ok) {
      window.location.reload();
      return;
    }
    setEditError(body.error ?? 'Could not update this feed.');
  }

  async function handleRemoveConfirm() {
    if (!removeTarget) return;
    await fetch(`/api/connectors/tenant-owned-feed/${removeTarget.id}`, { method: 'DELETE' });
    window.location.reload();
  }

  return (
    <div className="tof-page">
      {activations.length > 0 && !isActive && (
        <p role="status" className="tof-banner-inactive">
          {activations.length} feed{activations.length === 1 ? '' : 's'} configured, but this connector is currently
          deactivated — none of them are being polled.
        </p>
      )}

      {activations.length === 0 ? (
        <EmptyState heading="No feeds configured yet" body="Connect your first domain to start monitoring its RSS/Atom feed." />
      ) : (
        <ul className="tof-list">
          {activations.map((activation) => (
            <li key={activation.id} className="tof-item">
              <div className="tof-item-header">
                <span className="tof-item-domain">{activation.domain}</span>
                <StatusBadge variant={activation.status === 'verified' ? 'verified' : activation.status === 'pending' ? 'pending' : 'inactive'} />
              </div>
              <div className="tof-item-feed-url">{activation.feedUrl}</div>

              {activation.status === 'pending' && (
                <div className="tof-txt-instructions">
                  <p>Publish this TXT record at your DNS registrar, then return here to verify:</p>
                  <dl>
                    <dt>Host</dt>
                    <dd>{activation.txtRecordHost}</dd>
                    <dt>Value</dt>
                    <dd>{activation.txtRecordValue}</dd>
                    <dt>Expires</dt>
                    <dd>{activation.tokenExpiresAt}</dd>
                  </dl>
                  <p>
                    DNS propagation can take anywhere from a few minutes to 72 hours — this is normal, not an error or a
                    stuck state.
                  </p>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleVerify(activation.id)}>
                    Verify now
                  </button>
                  {verifyMessageId === activation.id && verifyMessage && <p role="status">{verifyMessage}</p>}
                </div>
              )}

              {isTenantAdmin && (
                <div className="tof-item-actions">
                  {activation.status === 'verified' && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        setEditTarget(activation);
                        setEditFeedUrl(activation.feedUrl);
                        setEditError(null);
                      }}
                    >
                      Edit feed URL
                    </button>
                  )}
                  <button type="button" className="btn btn-destructive btn-sm" onClick={() => setRemoveTarget(activation)}>
                    Remove
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {isTenantAdmin && (
        <>
          <button type="button" className="btn btn-primary" onClick={() => setConnectOpen(true)}>
            Connect another feed
          </button>
          <ActivateDeactivateButton platformId="tenant-owned-feed" ownerType="tenant" isActive={isActive} />
        </>
      )}

      <Modal isOpen={connectOpen} onClose={() => setConnectOpen(false)} title="Connect a tenant-owned feed">
        <form onSubmit={handleConnect} className="tof-modal-form">
          <label className="tof-field">
            <span className="tof-field-label">Domain</span>
            <input type="text" required value={domain} onChange={(event) => setDomain(event.target.value)} className="tof-input" />
          </label>
          <label className="tof-field">
            <span className="tof-field-label">Feed URL</span>
            <input type="text" required value={feedUrl} onChange={(event) => setFeedUrl(event.target.value)} className="tof-input" />
          </label>
          {connectError && (
            <p role="alert" className="tof-form-message-error">
              {connectError}
            </p>
          )}
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={() => setConnectOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Connect
            </button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={editTarget !== null} onClose={() => setEditTarget(null)} title="Edit feed URL">
        <form onSubmit={handleEditSubmit} className="tof-modal-form">
          <p>
            Domain: <strong>{editTarget?.domain}</strong>
          </p>
          <label className="tof-field">
            <span className="tof-field-label">Feed URL</span>
            <input type="text" required value={editFeedUrl} onChange={(event) => setEditFeedUrl(event.target.value)} className="tof-input" />
          </label>
          {editError && (
            <p role="alert" className="tof-form-message-error">
              {editError}
            </p>
          )}
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={() => setEditTarget(null)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Save
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        isOpen={removeTarget !== null}
        title={`Remove ${removeTarget?.domain ?? 'this feed'}?`}
        body="This feed will stop being polled. Already-ingested posts are kept."
        confirmLabel="Remove"
        confirmVariant="destructive"
        onConfirm={handleRemoveConfirm}
        onCancel={() => setRemoveTarget(null)}
      />
    </div>
  );
}
