import { Router } from 'express';
import { requireTenantUserIdentity } from '../../auth/requireTenantUser';
import { RequestWithIdentity } from '../../auth/requestIdentity';
import {
  createInvitedUser,
  listUsers,
  setAccessEndsAt,
  listAccessHistory,
} from '../../../identity/identityResolution';
import {
  incrementActiveSeatCount,
  decrementActiveSeatCount,
} from '../../../tenants/tenantStore';
import { withTenant } from '../../../db/withTenant';

export const tenantUsersRouter = Router();

/**
 * GET /v1/tenants/users (Story 1.9, ADR-0032 §2) — list all users for the
 * caller's own tenant. Available to both tenant_admin and tenant_user
 * (read-only, no role gate on GET). RLS-scoped; includes 'invited' and
 * 'active' rows.
 */
tenantUsersRouter.get('/', async (req, res) => {
  const identity = requireTenantUserIdentity(req as RequestWithIdentity, res);
  if (!identity) return;

  const users = await listUsers(identity.tenantId);
  res.json({ users });
});

/**
 * POST /v1/tenants/users (Story 1.9, ADR-0032 §6) — invite a new user into
 * the caller's tenant. Restricted to tenant_admin. Creates a users row in
 * 'invited' status; does NOT increment active_seat_count (a seat is occupied
 * only when the invited user activates at first sign-in, per ADR-0032 §6).
 *
 * Returns 409 if the tenant is at its license_seat_count ceiling —
 * incrementActiveSeatCount() returns null when at capacity; we check current
 * seated count directly rather than pre-incrementing, since the seat is not
 * consumed at invite time.
 */
tenantUsersRouter.post('/', async (req, res) => {
  const identity = requireTenantUserIdentity(req as RequestWithIdentity, res);
  if (!identity) return;

  if (identity.role !== 'tenant_admin') {
    res.status(403).json({ error: 'Only tenant_admin may invite users.' });
    return;
  }

  const { email, role } = req.body as { email?: string; role?: string };
  if (!email) {
    res.status(400).json({ error: 'email is required.' });
    return;
  }
  if (role && role !== 'tenant_admin' && role !== 'tenant_user') {
    res.status(400).json({ error: "role must be 'tenant_admin' or 'tenant_user'." });
    return;
  }

  // AC2 — seat-ceiling check: POST /v1/tenants/users rejects with 409 once
  // active_seat_count >= license_seat_count (AC per Story 1.9). The seat is
  // not consumed at invite time; we check capacity via incrementActiveSeatCount
  // which returns null when at ceiling. Because a seat is only consumed at
  // activation, we must check current counts without side-effects here.
  // We query the tenants row directly to avoid incrementing a seat for
  // an invited (not yet active) user — the increment happens in
  // resolveIdentity() case (3) at activation time.
  //
  // Implementation note: we read the tenant's own row through
  // withTenant() / app_user. A seat is AT capacity when
  // active_seat_count >= license_seat_count.
  const seatCheck = await withTenant(identity.tenantId, async (client) => {
    const { rows } = await client.query<{ active_seat_count: number; license_seat_count: number }>(
      `SELECT active_seat_count, license_seat_count FROM tenants WHERE id = $1`,
      [identity.tenantId]
    );
    return rows[0] ?? null;
  });

  if (!seatCheck || seatCheck.active_seat_count >= seatCheck.license_seat_count) {
    res.status(409).json({ error: 'Tenant is at its license seat ceiling.' });
    return;
  }

  const user = await createInvitedUser(identity.tenantId, {
    email,
    role: (role as 'tenant_admin' | 'tenant_user') ?? 'tenant_user',
  });
  res.status(201).json(user);
});

/**
 * PATCH /v1/tenants/users/:id (Story 1.9, ADR-0032 §9) — set, clear, or
 * update access_ends_at. Restricted to tenant_admin. Decrements
 * active_seat_count when setting a now-or-past value (immediate offboarding);
 * does not decrement for a future-dated value. Clearing back to NULL
 * re-increments (reactivation), subject to the seat-ceiling check.
 * Every write is audited in user_access_audit_log.
 */
tenantUsersRouter.patch('/:id', async (req, res) => {
  const identity = requireTenantUserIdentity(req as RequestWithIdentity, res);
  if (!identity) return;

  if (identity.role !== 'tenant_admin') {
    res.status(403).json({ error: 'Only tenant_admin may modify access_ends_at.' });
    return;
  }

  const userId = req.params.id;
  const body = req.body as { accessEndsAt?: string | null };
  if (!Object.prototype.hasOwnProperty.call(body, 'accessEndsAt')) {
    res.status(400).json({ error: 'accessEndsAt is required in the request body.' });
    return;
  }

  const rawValue = body.accessEndsAt;
  const accessEndsAt = rawValue === null || rawValue === undefined ? null : rawValue;

  // Seat-count adjustment per ADR-0032 §9:
  // - Setting to now-or-past (immediate offboard): decrement
  // - Setting to future (scheduled expiry): no change
  // - Clearing to null (reactivation): increment, checking ceiling
  if (accessEndsAt === null) {
    // Reactivation — must check seat ceiling first
    const result = await incrementActiveSeatCount(identity.tenantId);
    if (result === null) {
      res.status(409).json({ error: 'Tenant is at its license seat ceiling; cannot reactivate.' });
      return;
    }
  } else {
    const endsAt = new Date(accessEndsAt);
    if (endsAt <= new Date()) {
      // Immediate offboard — decrement seat (safe even if already < 0 due to floor in store)
      await decrementActiveSeatCount(identity.tenantId);
    }
    // Future-dated: no seat change now; the seat will be reclaimed when
    // access_ends_at passes and the user's next login is rejected by resolveIdentity().
  }

  const updated = await setAccessEndsAt(identity.tenantId, userId, accessEndsAt, identity.userId);
  if (!updated) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }

  res.json(updated);
});

/**
 * GET /v1/tenants/users/:id/access-history (Story 5.17, ADR-0032 §9) —
 * the audit trail for one user's own access_ends_at writes. tenant_admin
 * only, RLS-scoped via listAccessHistory()'s own withTenant() call — a
 * cross-tenant id returns an empty array (RLS-filtered), never another
 * tenant's rows.
 */
tenantUsersRouter.get('/:id/access-history', async (req, res) => {
  const identity = requireTenantUserIdentity(req as RequestWithIdentity, res);
  if (!identity) return;

  if (identity.role !== 'tenant_admin') {
    res.status(403).json({ error: 'Only tenant_admin may view access history.' });
    return;
  }

  const entries = await listAccessHistory(identity.tenantId, req.params.id);
  res.json({ entries });
});
