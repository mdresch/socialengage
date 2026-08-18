'use client';

import { useState, type FormEvent } from 'react';
import { Modal } from '@/components/ui';

/**
 * Story 6.8 AC2/AC3/AC5 — rendered only for a tenant_admin session (the
 * parent page's own gate). A 409 (seat ceiling) and a 403 (role gate, e.g. a
 * stale session) each get their own specific copy — never a single generic
 * failure message.
 *
 * Story 6.10 — `initialEmail` seeds the email field only; it never
 * auto-submits the form. The Tenant-Admin's own click of "Send invite"
 * remains the only thing that actually creates an invite (ADR-0037 §8b).
 *
 * Visual redesign, 2026-08-17 — the form now opens in a `Modal` (Design
 * Spec §6.8) rather than rendering inline; the fetch/error/success logic
 * below is completely unchanged, only its container and styling moved.
 * Opens automatically when `initialEmail` is seeded (Story 6.10's own
 * "invite this person" hand-off), so that flow doesn't leave a Tenant-Admin
 * looking at a closed modal with no visible next step.
 */
export function InviteUserForm({ initialEmail = '' }: { initialEmail?: string }) {
  const [isOpen, setIsOpen] = useState(initialEmail !== '');
  const [email, setEmail] = useState(initialEmail);
  const [role, setRole] = useState<'tenant_user' | 'tenant_admin'>('tenant_user');
  const [message, setMessage] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    const response = await fetch('/api/tenant-users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, role }),
    });
    const body = await response.json().catch(() => ({}));

    if (response.status === 201) {
      setMessage({ kind: 'success', text: `Invite sent to ${email}.` });
      setEmail('');
      return;
    }
    if (response.status === 409) {
      setMessage({
        kind: 'error',
        text: "This tenant is at its license seat ceiling — free up a seat, or ask your Platform Admin to raise it, before inviting anyone else.",
      });
      return;
    }
    setMessage({ kind: 'error', text: body.error ?? 'Something went wrong while sending the invite.' });
  }

  return (
    <>
      <button type="button" className="btn btn-primary" onClick={() => setIsOpen(true)}>
        Invite team member
      </button>
      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Invite a team member">
        <form onSubmit={handleSubmit} className="tu-modal-form">
          <label className="tu-field">
            <span className="tu-field-label">Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="tu-input"
              placeholder="colleague@example.com"
            />
          </label>
          <label className="tu-field">
            <span className="tu-field-label">Role</span>
            <select
              value={role}
              onChange={(event) => setRole(event.target.value as 'tenant_user' | 'tenant_admin')}
              className="tu-input"
            >
              <option value="tenant_user">tenant_user</option>
              <option value="tenant_admin">tenant_admin</option>
            </select>
          </label>
          {message && (
            <p role={message.kind === 'error' ? 'alert' : 'status'} className={`tu-form-message tu-form-message-${message.kind}`}>
              {message.text}
            </p>
          )}
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={() => setIsOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Send invite
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
