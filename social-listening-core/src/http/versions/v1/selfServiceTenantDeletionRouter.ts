import { Router } from 'express';
import { requireTenantUserIdentity } from '../../auth/requireTenantUser';
import { RequestWithIdentity } from '../../auth/requestIdentity';
import { withTenant } from '../../../db/withTenant';
import { logPlatformAdminAction } from '../../../admin/platformAdminAuditLog';
import { exportTenantData, executeTenantDeletion, GRACE_PERIOD_DAYS } from '../../../tenants/tenantDeletion';
import { tenantExportToCsv } from '../../../tenants/tenantExportCsv';

/**
 * Story 3.8 (ADR-0043, superseding ADR-0039 Decision §1 in full) —
 * self-service, tenant_admin-initiated tenant offboarding: request, export,
 * 30-day grace period, cancel, confirm. Fully self-service — no Platform
 * Admin approval step anywhere in this path (Platform Admin only sees the
 * resulting platform_admin_audit_log entries). See
 * .claude/skills/self-service-tenant-deletion/SKILL.md.
 */
export const selfServiceTenantDeletionRouter = Router();

interface TenantDeletionState {
  deletion_requested_at: Date | null;
  deletion_confirmed_at: Date | null;
  status: string;
}

function requireTenantAdmin(req: RequestWithIdentity, res: import('express').Response) {
  const identity = requireTenantUserIdentity(req, res);
  if (!identity) return null;
  if (identity.role !== 'tenant_admin') {
    res.status(403).json({ error: 'This route requires a tenant_admin identity.' });
    return null;
  }
  return identity;
}

/**
 * POST /v1/tenants/self-service-deletion/request (ADR-0043 §2/§3) — the
 * soft-delete step: sets deletion_requested_at, which
 * runIngestionAttempt()'s own guard (ADR-0043 §3) reads on every subsequent
 * ingestion attempt, halting new data immediately. Rejected if a request is
 * already active — cancel first (DELETE below) to start over.
 */
selfServiceTenantDeletionRouter.post('/request', async (req, res) => {
  const identity = requireTenantAdmin(req as RequestWithIdentity, res);
  if (!identity) return;

  await withTenant(identity.tenantId, async (client) => {
    const { rows } = await client.query<TenantDeletionState>(
      `SELECT deletion_requested_at, deletion_confirmed_at, status FROM tenants WHERE id = $1`,
      [identity.tenantId]
    );
    if (rows.length === 0) {
      res.status(404).json({ error: 'Tenant not found.' });
      return;
    }
    if (rows[0].deletion_requested_at !== null) {
      res.status(409).json({ error: 'A deletion request is already active for this tenant.' });
      return;
    }

    const { rows: updated } = await client.query<{ deletion_requested_at: Date }>(
      `UPDATE tenants SET deletion_requested_at = now() WHERE id = $1 RETURNING deletion_requested_at`,
      [identity.tenantId]
    );
    const deletionRequestedAt = updated[0].deletion_requested_at;
    const graceEndsAt = new Date(deletionRequestedAt.getTime() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);

    await logPlatformAdminAction(
      {
        actorIdentity: identity.userId,
        operation: 'tenant_deletion_requested',
        targetTenantId: identity.tenantId,
      },
      client
    );

    res.status(202).json({
      tenantId: identity.tenantId,
      deletionRequestedAt: deletionRequestedAt.toISOString(),
      graceEndsAt: graceEndsAt.toISOString(),
    });
  });
});

/**
 * POST /v1/tenants/self-service-deletion/export (ADR-0043 §4) — reuses
 * Story 3.7's own export logic. Requires an active deletion request (this
 * export is scoped to offboarding, not a general-purpose bulk-export
 * feature) — rejected otherwise. Re-triggerable any number of times before
 * confirmation. `{ "format": "csv" }` in the body selects CSV; anything
 * else (including omitted) returns JSON.
 */
selfServiceTenantDeletionRouter.post('/export', async (req, res) => {
  const identity = requireTenantAdmin(req as RequestWithIdentity, res);
  if (!identity) return;

  const requested = await withTenant(identity.tenantId, async (client) => {
    const { rows } = await client.query<TenantDeletionState>(
      `SELECT deletion_requested_at, deletion_confirmed_at, status FROM tenants WHERE id = $1`,
      [identity.tenantId]
    );
    return rows.length > 0 ? rows[0].deletion_requested_at !== null : null;
  });
  if (requested === null) {
    res.status(404).json({ error: 'Tenant not found.' });
    return;
  }
  if (!requested) {
    res.status(409).json({ error: 'Export is only available after requesting deletion.' });
    return;
  }

  const tenantExport = await exportTenantData(identity.tenantId);
  await withTenant(identity.tenantId, (client) =>
    logPlatformAdminAction(
      { actorIdentity: identity.userId, operation: 'tenant_export', targetTenantId: identity.tenantId },
      client
    )
  );

  if (req.body?.format === 'csv') {
    const csv = tenantExportToCsv({
      socialPosts: tenantExport.socialPosts,
      authors: tenantExport.authors,
      watchlists: tenantExport.watchlists,
      ingestionRuns: tenantExport.ingestionRuns,
    });
    res.type('text/csv').send(csv);
    return;
  }
  res.json(tenantExport);
});

/**
 * DELETE /v1/tenants/self-service-deletion (ADR-0043 §5) — cancel. Available
 * any time from request until confirmation (nulls both columns, which —
 * via runIngestionAttempt()'s own guard — immediately resumes ingestion).
 * Once confirmed, the deletion is treated as irreversibly in flight —
 * cancellation is rejected from that point on, the same "confirm is the
 * commit point" shape Story 3.7's own original design already proved.
 */
selfServiceTenantDeletionRouter.delete('/', async (req, res) => {
  const identity = requireTenantAdmin(req as RequestWithIdentity, res);
  if (!identity) return;

  await withTenant(identity.tenantId, async (client) => {
    const { rows } = await client.query<TenantDeletionState>(
      `SELECT deletion_requested_at, deletion_confirmed_at, status FROM tenants WHERE id = $1`,
      [identity.tenantId]
    );
    if (rows.length === 0) {
      res.status(404).json({ error: 'Tenant not found.' });
      return;
    }
    if (rows[0].deletion_requested_at === null) {
      res.status(409).json({ error: 'No active deletion request to cancel.' });
      return;
    }
    if (rows[0].deletion_confirmed_at !== null) {
      res.status(409).json({ error: 'Deletion has already been confirmed and cannot be cancelled.' });
      return;
    }

    await client.query(
      `UPDATE tenants SET deletion_requested_at = NULL, deletion_confirmed_at = NULL WHERE id = $1`,
      [identity.tenantId]
    );
    await logPlatformAdminAction(
      { actorIdentity: identity.userId, operation: 'tenant_deletion_cancelled', targetTenantId: identity.tenantId },
      client
    );

    res.json({ tenantId: identity.tenantId, cancelled: true });
  });
});

/**
 * POST /v1/tenants/self-service-deletion/confirm (ADR-0043 §6) — rejected
 * outright (409, naming the remaining wait) until the grace period has
 * genuinely elapsed. Once eligible, sets deletion_confirmed_at and
 * tenants.status = 'deleting', audit-logs the confirmation, and kicks off
 * the same bounded, asynchronous, partition-aware deletion job Story 3.7
 * already built — executeTenantDeletion() is deliberately not awaited here,
 * matching that already-proven "response returns before deletion completes"
 * shape.
 */
selfServiceTenantDeletionRouter.post('/confirm', async (req, res) => {
  const identity = requireTenantAdmin(req as RequestWithIdentity, res);
  if (!identity) return;

  const outcome = await withTenant(identity.tenantId, async (client) => {
    const { rows } = await client.query<TenantDeletionState>(
      `SELECT deletion_requested_at, deletion_confirmed_at, status FROM tenants WHERE id = $1`,
      [identity.tenantId]
    );
    if (rows.length === 0) return { kind: 'not_found' as const };
    const { deletion_requested_at, deletion_confirmed_at, status } = rows[0];

    if (deletion_requested_at === null) return { kind: 'no_request' as const };
    if (deletion_confirmed_at !== null || status === 'deleting') return { kind: 'already_confirmed' as const };

    const graceEndsAt = new Date(deletion_requested_at.getTime() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);
    if (new Date() < graceEndsAt) return { kind: 'grace_period_not_elapsed' as const, graceEndsAt };

    await client.query(`UPDATE tenants SET deletion_confirmed_at = now() WHERE id = $1`, [identity.tenantId]);
    await logPlatformAdminAction(
      { actorIdentity: identity.userId, operation: 'tenant_deletion_confirmed', targetTenantId: identity.tenantId },
      client
    );
    return { kind: 'confirmed' as const };
  });

  switch (outcome.kind) {
    case 'not_found':
      res.status(404).json({ error: 'Tenant not found.' });
      return;
    case 'no_request':
      res.status(409).json({ error: 'No active deletion request to confirm.' });
      return;
    case 'already_confirmed':
      res.status(409).json({ error: 'Deletion is already confirmed and in progress.' });
      return;
    case 'grace_period_not_elapsed':
      res.status(409).json({
        error: 'The grace period has not yet elapsed.',
        graceEndsAt: outcome.graceEndsAt.toISOString(),
      });
      return;
    case 'confirmed':
      res.status(202).json({ tenantId: identity.tenantId, status: 'deleting' });
      executeTenantDeletion(identity.tenantId, identity.userId).catch((err) => {
        // eslint-disable-next-line no-console
        console.error(`Tenant deletion failed for ${identity.tenantId}:`, err);
      });
      return;
  }
});
