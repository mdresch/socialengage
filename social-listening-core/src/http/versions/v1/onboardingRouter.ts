import { Router } from 'express';
import { requireTenantUserIdentity } from '../../auth/requireTenantUser';
import { RequestWithIdentity } from '../../auth/requestIdentity';
import { getRoleOnboardingChecklist } from '../../../onboarding/roleOnboardingService';

export const onboardingRouter = Router();

/**
 * Story 17.2 (ADR-0130, TDS-0130) — Role-tailored onboarding journeys with automated probe verification.
 * GET /v1/onboarding/checklist?role=<role>
 */
onboardingRouter.get('/checklist', async (req, res) => {
  const identity = requireTenantUserIdentity(req as RequestWithIdentity, res);
  if (!identity) return;

  const roleParam = typeof req.query.role === 'string' ? req.query.role : identity.role;
  const result = await getRoleOnboardingChecklist(identity.tenantId, identity.userId, roleParam);
  if (!result) {
    res.status(404).json({ error: 'Tenant onboarding state not found.' });
    return;
  }

  res.status(200).json(result);
});
