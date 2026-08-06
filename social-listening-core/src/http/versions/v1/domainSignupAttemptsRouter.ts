import { Router } from 'express';
import { requireTenantUserIdentity } from '../../auth/requireTenantUser';
import { RequestWithIdentity } from '../../auth/requestIdentity';
import { listDomainSignupAttempts } from '../../../tenants/domainSignupAttempts';

export const domainSignupAttemptsRouter = Router();

/**
 * GET /v1/tenants/domain-signup-attempts (Story 5.16, ADR-0037 §8b) —
 * tenant_admin only, RLS-scoped to the caller's own tenant. Read-only, no
 * write verb registered — the escalation write (§8c) happens elsewhere, at
 * the point a new attempt is recorded (selfServiceSignup.ts), never here.
 * See .claude/skills/same-domain-invite-assist/SKILL.md.
 */
domainSignupAttemptsRouter.get('/', async (req, res) => {
  const identity = requireTenantUserIdentity(req as RequestWithIdentity, res);
  if (!identity) return;

  if (identity.role !== 'tenant_admin') {
    res.status(403).json({ error: 'This route requires a tenant_admin identity.' });
    return;
  }

  const domains = await listDomainSignupAttempts(identity.tenantId);
  res.json({ domains });
});
