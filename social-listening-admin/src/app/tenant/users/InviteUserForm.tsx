'use client';

import { useState, type FormEvent } from 'react';

/**
 * Story 6.8 AC2/AC3/AC5 — rendered only for a tenant_admin session (the
 * parent page's own gate). A 409 (seat ceiling) and a 403 (role gate, e.g. a
 * stale session) each get their own specific copy — never a single generic
 * failure message.
 */
export function InviteUserForm() {
  const [email, setEmail] = useState('');
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
    <form onSubmit={handleSubmit}>
      <label>
        Email
        <input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
      </label>
      <label>
        Role
        <select value={role} onChange={(event) => setRole(event.target.value as 'tenant_user' | 'tenant_admin')}>
          <option value="tenant_user">tenant_user</option>
          <option value="tenant_admin">tenant_admin</option>
        </select>
      </label>
      <button type="submit">Send invite</button>
      {message && <p role={message.kind === 'error' ? 'alert' : 'status'}>{message.text}</p>}
    </form>
  );
}
