import { Router } from 'express';
import { requireTenantUserIdentity } from '../../auth/requireTenantUser';
import { RequestWithIdentity } from '../../auth/requestIdentity';
import { buildTenantWorkspaceExport } from '../../../tenants/tenantExportStore';

export const tenantExportRouter = Router();

const DEFAULT_MAX_BYTES = 104857600; // 100 MB

/**
 * GET /v1/tenants/me/export/workspace (Story 3.16, ADR-0074) — returns a full,
 * safe-metadata JSON archive of the caller's own tenant. Restricted to
 * `tenant_admin`; `tenant_user` receives 403. `platform_admin` is already
 * blocked at the `requireTenantUserIdentity` layer (ADR-0030 §2).
 *
 * The archive is size-capped via `WORKSPACE_EXPORT_MAX_BYTES` (default 1 MB)
 * and returns `413 Payload Too Large` with code `EXPORT_TOO_LARGE` if the
 * serialized JSON would exceed the cap.
 */
tenantExportRouter.get('/workspace', async (req, res) => {
  const identity = requireTenantUserIdentity(req as RequestWithIdentity, res);
  if (!identity) return;

  if (identity.role !== 'tenant_admin') {
    res.status(403).json({ error: 'This route requires a tenant_admin identity.' });
    return;
  }

  try {
    const workspace = await buildTenantWorkspaceExport(identity.tenantId);
    const payload = JSON.stringify(workspace);
    const maxBytes = Number(process.env.WORKSPACE_EXPORT_MAX_BYTES ?? DEFAULT_MAX_BYTES);

    if (Buffer.byteLength(payload, 'utf8') > maxBytes) {
      res.status(413).json({ code: 'EXPORT_TOO_LARGE' });
      return;
    }

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.send(payload);
  } catch (err: any) {
    if (err?.message === 'TENANT_NOT_FOUND') {
      res.status(404).json({ error: 'Tenant not found.' });
      return;
    }
    res.status(500).json({ error: 'Internal error.' });
  }
});
