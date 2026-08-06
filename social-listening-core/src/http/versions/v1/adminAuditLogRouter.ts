import { Router } from 'express';
import { requirePlatformAdmin } from '../../auth/requireTenantUser';
import { RequestWithIdentity } from '../../auth/requestIdentity';
import { queryPlatformAdminAuditLog } from '../../../admin/platformAdminAuditLog';

export const adminAuditLogRouter = Router();

/**
 * GET /v1/admin/audit-log (Story 5.14) — read-only, cursor-paginated
 * (ADR-0011 convention) query over platform_admin_audit_log, Platform Admin
 * only. Filters (tenantId/actorIdentity/from/to) are all optional; omitting
 * all of them returns the full, paginated log. See
 * .claude/skills/platform-admin-audit-log/SKILL.md.
 */
adminAuditLogRouter.get('/', async (req, res) => {
  const identity = requirePlatformAdmin(req as RequestWithIdentity, res);
  if (!identity) return;

  const tenantId = typeof req.query.tenantId === 'string' ? req.query.tenantId : undefined;
  const actorIdentity = typeof req.query.actorIdentity === 'string' ? req.query.actorIdentity : undefined;
  const from = typeof req.query.from === 'string' ? req.query.from : undefined;
  const to = typeof req.query.to === 'string' ? req.query.to : undefined;
  const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
  const limit = typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined;

  if ((from && Number.isNaN(Date.parse(from))) || (to && Number.isNaN(Date.parse(to)))) {
    res.status(400).json({ error: 'Invalid from/to date.' });
    return;
  }

  try {
    const page = await queryPlatformAdminAuditLog({ tenantId, actorIdentity, from, to, cursor, limit });
    res.json(page);
  } catch {
    res.status(400).json({ error: 'Invalid cursor.' });
  }
});
