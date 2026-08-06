import { Router } from 'express';
import { AuthenticatedRequest } from '../../auth/entraAuthMiddleware';
import { resolveIdentity } from '../../../identity/identityResolution';
import { provisionTenantViaSignup, DomainMatchRejectionError } from '../../../tenants/selfServiceSignup';

export const selfServiceSignupRouter = Router();

/**
 * POST /v1/tenants/self-service-signup (Story 5.15, ADR-0037) — mounted
 * behind claimsAuthMiddleware (router.ts), NOT the ordinary authMiddleware:
 * this route must accept a caller resolveIdentity() finds no match for,
 * the one exception to ADR-0029 §4's "reject an unmatched caller" rule.
 * See .claude/skills/self-service-tenant-signup/SKILL.md.
 */
selfServiceSignupRouter.post('/', async (req, res) => {
  const auth = (req as AuthenticatedRequest).auth;
  if (!auth) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' });
    return;
  }
  if (!auth.email) {
    res.status(400).json({ error: 'A verified email is required to sign up.' });
    return;
  }

  const { name } = req.body;
  if (!name || typeof name !== 'string') {
    res.status(400).json({ error: 'name (string) is required.' });
    return;
  }

  // ADR-0037 §6's must-check-first invited-row lookup is this same call —
  // resolveIdentity()'s own case-3 already links an unlinked invited row
  // for this email and returns a real identity, which this treats
  // identically to any other already-resolved caller: reject, never reach
  // tenant creation for someone who was already invited into an existing
  // tenant.
  const identity = await resolveIdentity({ sub: auth.sub, email: auth.email });
  if (identity) {
    res.status(409).json({ error: 'You already belong to a tenant.' });
    return;
  }

  try {
    const { tenant, userId } = await provisionTenantViaSignup({ sub: auth.sub, email: auth.email }, { name });
    res.status(201).json({ ...tenant, userId });
  } catch (err) {
    if (err instanceof DomainMatchRejectionError) {
      // ADR-0037 §3 (never name the matched organization) + §8d (reassure
      // without confirming that organization's identity).
      res.status(409).json({
        error:
          "An account for this email domain already exists. Ask your organization's admin for an invite — your request has been shared with them.",
      });
      return;
    }
    // ADR-0037's own explicit deferral: a genuine partial failure (tenant
    // created, first-user insert failed) is not rolled back or retried
    // here — this surfaces a real, actionable error rather than a silent
    // success or an untraceable failure.
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'Sign-up could not be completed.', details: message });
  }
});
