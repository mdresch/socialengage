import { Router, Request, Response } from 'express';
import { requireTenantUserIdentity } from '../../auth/requireTenantUser';
import { RequestWithIdentity } from '../../auth/requestIdentity';
import {
  listTakedowns,
  getTakedownById,
  executeRedactionCascade,
  updateTakedownStatus,
} from '../../../governance/takedownStore';

export const takedownsRouter = Router();

// GET /v1/takedowns (Review queue for Tenant-Admin / Legal-Advisor)
takedownsRouter.get('/', async (req: Request, res: Response) => {
  const identity = requireTenantUserIdentity(req as RequestWithIdentity, res);
  if (!identity) return;

  const { status, riskFlag } = req.query as { status?: string; riskFlag?: string };
  const parsedRiskFlag = riskFlag !== undefined ? riskFlag === 'true' : undefined;

  try {
    const items = await listTakedowns(identity.tenantId, {
      status,
      riskFlag: parsedRiskFlag,
    });
    return res.status(200).json(items);
  } catch (err: any) {
    return res.status(500).json({ error: 'FETCH_FAILED', message: err.message });
  }
});

// GET /v1/takedowns/:id
takedownsRouter.get('/:id', async (req: Request, res: Response) => {
  const identity = requireTenantUserIdentity(req as RequestWithIdentity, res);
  if (!identity) return;

  const takedownId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  try {
    const item = await getTakedownById(identity.tenantId, takedownId);
    if (!item) {
      return res.status(404).json({ error: 'TAKEDOWN_NOT_FOUND' });
    }
    return res.status(200).json(item);
  } catch (err: any) {
    return res.status(500).json({ error: 'FETCH_FAILED', message: err.message });
  }
});

// POST /v1/takedowns/:id/grant (Human reviewer action executing redaction cascade)
takedownsRouter.post('/:id/grant', async (req: Request, res: Response) => {
  const identity = requireTenantUserIdentity(req as RequestWithIdentity, res);
  if (!identity) return;

  const takedownId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  // Strict invariant: auto-decisions forbidden
  if (req.body?.automated === true) {
    return res.status(403).json({
      error: 'AUTO_DECISION_FORBIDDEN',
      message: 'Automated resolution is forbidden under ICO/CCPA case-by-case evaluation mandates.',
    });
  }

  const { decisionReason } = req.body || {};

  try {
    const updated = await executeRedactionCascade(
      identity.tenantId,
      takedownId,
      identity.userId,
      decisionReason || 'Granted by reviewer'
    );
    return res.status(200).json(updated);
  } catch (err: any) {
    return res.status(500).json({ error: 'GRANT_FAILED', message: err.message });
  }
});

// POST /v1/takedowns/:id/deny
takedownsRouter.post('/:id/deny', async (req: Request, res: Response) => {
  const identity = requireTenantUserIdentity(req as RequestWithIdentity, res);
  if (!identity) return;

  const takedownId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  if (req.body?.automated === true) {
    return res.status(403).json({
      error: 'AUTO_DECISION_FORBIDDEN',
      message: 'Automated denial is forbidden.',
    });
  }

  const { decisionReason } = req.body || {};
  if (!decisionReason) {
    return res.status(400).json({
      error: 'REASON_REQUIRED',
      message: 'A statutory or factual justification is required to deny a takedown request.',
    });
  }

  try {
    const updated = await updateTakedownStatus(
      identity.tenantId,
      takedownId,
      'denied',
      identity.userId,
      decisionReason
    );
    return res.status(200).json(updated);
  } catch (err: any) {
    return res.status(500).json({ error: 'DENY_FAILED', message: err.message });
  }
});

// POST /v1/takedowns/:id/escalate
takedownsRouter.post('/:id/escalate', async (req: Request, res: Response) => {
  const identity = requireTenantUserIdentity(req as RequestWithIdentity, res);
  if (!identity) return;

  const takedownId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  const { decisionReason } = req.body || {};
  try {
    const updated = await updateTakedownStatus(
      identity.tenantId,
      takedownId,
      'escalated',
      identity.userId,
      decisionReason || 'Escalated for legal review'
    );
    return res.status(200).json(updated);
  } catch (err: any) {
    return res.status(500).json({ error: 'ESCALATE_FAILED', message: err.message });
  }
});
