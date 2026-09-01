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
  getTenantSeatAndGateStatus,
  getTenantFeatureGates,
} from '../../../tenants/tenantStore';
import { isFeatureEnabled } from '../../../tenants/featureGates';
import { withTenant } from '../../../db/withTenant';

export const tenantUsersRouter = Router();

/**
 * GET /v1/tenants/users (Story 1.9, ADR-0032 §2) — list all users for the
 * caller's own tenant.
 */
tenantUsersRouter.get('/', async (req, res) => {
  const identity = requireTenantUserIdentity(req as RequestWithIdentity, res);
  if (!identity) return;

  const users = await listUsers(identity.tenantId);
  const seats = await withTenant(identity.tenantId, async (client) => {
    const { rows } = await client.query<{ license_seat_count: number; active_seat_count: number }>(
      `SELECT license_seat_count, active_seat_count FROM tenants WHERE id = $1`,
      [identity.tenantId]
    );
    return rows[0] ?? null;
  });

  res.json({
    users,
    seats: seats
      ? { licenseSeatCount: seats.license_seat_count, activeSeatCount: seats.active_seat_count }
      : { licenseSeatCount: 0, activeSeatCount: 0 },
  });
});

/**
 * POST /v1/tenants/users (Story 1.9, ADR-0032 §6; Story 13.5, ADR-0112) —
 * invite a new user. Restricted to tenant_admin. The `multi_user` feature
 * gate must be enabled and the tenant must be below its effective seat
 * ceiling (`feature_gates.max_seats` when explicitly set, otherwise
 * `license_seat_count`).
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

  // Story 13.5: feature-gate check. Missing key defaults to enabled.
  const featureGates = await getTenantFeatureGates(identity.tenantId);
  if (!isFeatureEnabled(featureGates, 'multi_user')) {
    res.status(403).json({
      error: "Feature 'multi_user' is not available on this tenant's plan.",
      code: 'FEATURE_NOT_AVAILABLE',
    });
    return;
  }

  // Story 13.5: seat-ceiling check. Prefer feature_gates.max_seats when
  // explicitly set; otherwise fall back to license_seat_count and keep the
  // legacy 409 response for existing contracts.
  const status = await getTenantSeatAndGateStatus(identity.tenantId);
  if (!status) {
    res.status(404).json({ error: 'Tenant not found.' });
    return;
  }

  if (status.activeSeatCount >= status.maxSeats) {
    if (status.hasExplicitMaxSeats) {
      res.status(403).json({
        error: 'Tenant is at its seat ceiling.',
        code: 'SEAT_LIMIT_EXCEEDED',
      });
    } else {
      res.status(409).json({ error: 'Tenant is at its license seat ceiling.' });
    }
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

  if (accessEndsAt === null) {
    // Story 13.5: reactivation must respect the effective seat ceiling.
    const status = await getTenantSeatAndGateStatus(identity.tenantId);
    if (status && status.activeSeatCount >= status.maxSeats) {
      if (status.hasExplicitMaxSeats) {
        res.status(403).json({
          error: 'Tenant is at its seat ceiling; cannot reactivate.',
          code: 'SEAT_LIMIT_EXCEEDED',
        });
      } else {
        res.status(409).json({ error: 'Tenant is at its license seat ceiling; cannot reactivate.' });
      }
      return;
    }

    const result = await incrementActiveSeatCount(identity.tenantId);
    if (result === null) {
      // Defensive fallback; the explicit check above normally prevents this.
      res.status(409).json({ error: 'Tenant is at its license seat ceiling; cannot reactivate.' });
      return;
    }
  } else {
    const endsAt = new Date(accessEndsAt);
    if (endsAt <= new Date()) {
      await decrementActiveSeatCount(identity.tenantId);
    }
  }

  const updated = await setAccessEndsAt(identity.tenantId, userId, accessEndsAt, identity.userId);
  if (!updated) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }

  res.json(updated);
});

/**
 * GET /v1/tenants/users/:id/access-history (Story 5.17, ADR-0032 §9)
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
