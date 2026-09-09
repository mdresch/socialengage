import { Router } from 'express';
import { requireTenantUserIdentity } from '../../auth/requireTenantUser';
import { RequestWithIdentity } from '../../auth/requestIdentity';
import {
  quarantineDSRRequest,
  unquarantineDSRRequest,
} from '../../../governance/dsrQuarantineStore';

export const dsrRouter = Router();

function isAuthorizedReviewer(role?: string): boolean {
  return role === 'tenant_admin' || role === 'legal_advisor' || role === 'platform_admin';
}

/**
 * POST /v1/dsr/requests/:id/quarantine
 * Enforces GDPR Article 18 processing restriction on targeted post.
 */
dsrRouter.post('/requests/:id/quarantine', async (req, res) => {
  const identity = requireTenantUserIdentity(req as RequestWithIdentity, res);
  if (!identity) return;

  if (!isAuthorizedReviewer(identity.role)) {
    res.status(403).json({
      code: 'FORBIDDEN',
      error: 'Article 18 quarantine actions require tenant_admin or legal_advisor role.',
    });
    return;
  }

  const rawId = req.params.id;
  const requestId = Array.isArray(rawId) ? rawId[0] : rawId;

  try {
    const result = await quarantineDSRRequest(identity.tenantId, requestId, identity.userId);
    res.json(result);
  } catch (err: any) {
    if (err?.message === 'DSR_REQUEST_NOT_FOUND') {
      res.status(404).json({ code: 'DSR_REQUEST_NOT_FOUND', error: 'DSR request not found.' });
      return;
    }
    if (err?.message === 'TARGET_POST_NOT_FOUND') {
      res.status(404).json({ code: 'TARGET_POST_NOT_FOUND', error: 'Target post not found in tenant repository.' });
      return;
    }
    res.status(500).json({ error: err?.message || 'Failed to quarantine request.' });
  }
});

/**
 * POST /v1/dsr/requests/:id/unquarantine
 * Reverses Article 18 processing restriction upon resolution or settlement.
 */
dsrRouter.post('/requests/:id/unquarantine', async (req, res) => {
  const identity = requireTenantUserIdentity(req as RequestWithIdentity, res);
  if (!identity) return;

  if (!isAuthorizedReviewer(identity.role)) {
    res.status(403).json({
      code: 'FORBIDDEN',
      error: 'Article 18 remediation actions require tenant_admin or legal_advisor role.',
    });
    return;
  }

  const rawId = req.params.id;
  const requestId = Array.isArray(rawId) ? rawId[0] : rawId;

  try {
    const result = await unquarantineDSRRequest(identity.tenantId, requestId, identity.userId);
    res.json(result);
  } catch (err: any) {
    if (err?.message === 'DSR_REQUEST_NOT_FOUND') {
      res.status(404).json({ code: 'DSR_REQUEST_NOT_FOUND', error: 'DSR request not found.' });
      return;
    }
    if (err?.message === 'TARGET_POST_NOT_FOUND') {
      res.status(404).json({ code: 'TARGET_POST_NOT_FOUND', error: 'Target post not found in tenant repository.' });
      return;
    }
    res.status(500).json({ error: err?.message || 'Failed to unquarantine request.' });
  }
});
