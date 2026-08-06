import { Router } from 'express';
import { requirePlatformAdmin } from '../../auth/requireTenantUser';
import { RequestWithIdentity } from '../../auth/requestIdentity';
import {
  requestBreakGlassCredentialReset,
  executeBreakGlassRequest,
  breakGlassConfigFromEnv,
} from '../../../admin/breakGlassCredentialReset';

/**
 * mergeParams: true so :tenantId from this router's own mount point in
 * router.ts (/admin/tenants/:tenantId/break-glass) is visible here — Express
 * routers don't inherit parent params by default.
 */
export const adminBreakGlassRouter = Router({ mergeParams: true });

/**
 * POST /v1/admin/tenants/:tenantId/break-glass/request (Story 5.13) —
 * records a request, no Entra action. targetUserId is caller-supplied; the
 * Tenant-Admin-lookup-by-tenant-name gap is not built here, see
 * .claude/skills/platform-admin-break-glass-rest/SKILL.md.
 */
adminBreakGlassRouter.post<{ tenantId: string }>('/request', async (req, res) => {
  const identity = requirePlatformAdmin(req as RequestWithIdentity, res);
  if (!identity) return;

  const { targetUserId } = req.body;
  if (!targetUserId || typeof targetUserId !== 'string') {
    res.status(400).json({ error: 'targetUserId (string) is required.' });
    return;
  }

  const created = await requestBreakGlassCredentialReset(
    identity.adminId,
    req.params.tenantId,
    targetUserId
  );
  res.status(201).json(created);
});

/**
 * POST /v1/admin/tenants/:tenantId/break-glass/requests/:requestId/execute
 * (Story 5.13) — a genuinely separate route from /request. The only step
 * that touches Entra; performs Story 5.7's already-shipped, real two-
 * identity JIT sequence. A request already executed is rejected 409 — a
 * fast, DB-only check inside executeBreakGlassRequest() itself, before any
 * Graph call.
 */
adminBreakGlassRouter.post('/requests/:requestId/execute', async (req, res) => {
  const identity = requirePlatformAdmin(req as RequestWithIdentity, res);
  if (!identity) return;

  try {
    const result = await executeBreakGlassRequest(
      breakGlassConfigFromEnv(),
      req.params.requestId,
      identity.adminId
    );
    res.status(200).json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('not found')) {
      res.status(404).json({ error: message });
      return;
    }
    if (message.includes('is not pending')) {
      res.status(409).json({ error: message });
      return;
    }
    res.status(500).json({ error: 'Failed to execute break-glass request.', details: message });
  }
});
