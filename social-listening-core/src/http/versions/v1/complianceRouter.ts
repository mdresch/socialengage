import { Router } from 'express';
import { requireTenantUserIdentity } from '../../auth/requireTenantUser';
import { RequestWithIdentity } from '../../auth/requestIdentity';
import { verifyAuditLogChain } from '../../../compliance/auditHashChaining';
import {
  createAuditPack,
  getAuditPackDownload,
} from '../../../compliance/auditPackService';

export const complianceRouter = Router();

function isAuthorizedComplianceRole(role?: string): boolean {
  return (
    role === 'tenant_admin' ||
    role === 'compliance_officer' ||
    role === 'legal_advisor' ||
    role === 'platform_admin'
  );
}

/**
 * GET /v1/compliance/audit-log/verify
 * Sequentially traverses and cryptographically verifies the hash chain for the caller's tenant.
 */
complianceRouter.get('/audit-log/verify', async (req, res) => {
  const identity = requireTenantUserIdentity(req as RequestWithIdentity, res);
  if (!identity) return;

  if (!isAuthorizedComplianceRole(identity.role)) {
    res.status(403).json({
      code: 'FORBIDDEN',
      error: 'Audit log verification requires tenant_admin or compliance_officer role.',
    });
    return;
  }

  const startDate = (req.query.startDate || req.query.from) as string | undefined;
  const endDate = (req.query.endDate || req.query.to) as string | undefined;

  try {
    const result = await verifyAuditLogChain({
      tenantId: identity.tenantId,
      startDate,
      endDate,
    });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to verify audit log chain.' });
  }
});

/**
 * POST /v1/compliance/audit-packs
 * Generates an exportable compliance evidence archive with signed root manifest.json.
 */
complianceRouter.post('/audit-packs', async (req, res) => {
  const identity = requireTenantUserIdentity(req as RequestWithIdentity, res);
  if (!identity) return;

  if (!isAuthorizedComplianceRole(identity.role)) {
    res.status(403).json({
      code: 'FORBIDDEN',
      error: 'Audit pack generation requires tenant_admin or compliance_officer role.',
    });
    return;
  }

  const { packType, startDate, endDate } = req.body || {};
  if (!startDate || !endDate) {
    res.status(400).json({
      code: 'INVALID_PARAMETERS',
      error: 'startDate and endDate are required.',
    });
    return;
  }

  try {
    const result = await createAuditPack(
      identity.tenantId,
      { packType, startDate, endDate },
      identity.userId
    );
    res.status(201).json(result);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to generate compliance audit pack.' });
  }
});

/**
 * GET /v1/compliance/audit-packs/:id/download
 * Returns presigned download URL (24-hr expiry) or streams the direct ZIP archive.
 */
complianceRouter.get('/audit-packs/:id/download', async (req, res) => {
  const identity = requireTenantUserIdentity(req as RequestWithIdentity, res);
  if (!identity) return;

  if (!isAuthorizedComplianceRole(identity.role)) {
    res.status(403).json({
      code: 'FORBIDDEN',
      error: 'Audit pack download requires tenant_admin or compliance_officer role.',
    });
    return;
  }

  const rawId = req.params.id;
  const packId = Array.isArray(rawId) ? rawId[0] : rawId;

  try {
    const downloadResult = await getAuditPackDownload(identity.tenantId, packId);

    if (downloadResult.expired) {
      res.status(410).json({
        code: 'EXPIRED_AUDIT_PACK',
        error: 'The requested compliance audit pack has exceeded its 90-day retention window.',
      });
      return;
    }

    if (!downloadResult.pack) {
      res.status(404).json({
        code: 'PACK_NOT_FOUND',
        error: 'Compliance audit pack not found.',
      });
      return;
    }

    const { pack } = downloadResult;

    if (req.query.direct === 'true' || req.headers.accept === 'application/zip') {
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="audit-pack-${packId}.zip"`);
      res.send(pack.zipData);
      return;
    }

    res.json({
      packId: pack.id,
      downloadUrl: pack.downloadUrl,
      expiresAt: pack.expiresAt,
      manifest: pack.manifest,
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to retrieve audit pack download.' });
  }
});
