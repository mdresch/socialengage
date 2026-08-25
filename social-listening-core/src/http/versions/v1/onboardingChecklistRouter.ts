import { Router } from 'express';
import { requireTenantUserIdentity } from '../../auth/requireTenantUser';
import { RequestWithIdentity } from '../../auth/requestIdentity';
import {
  getOnboardingChecklist,
  patchOnboardingChecklist,
  validatePatchBody,
} from '../../../tenants/onboardingChecklist';

export const onboardingChecklistRouter = Router();

/**
 * Story 9.5 (ADR-0080) — tenant-scoped onboarding checklist state.
 * GET/PATCH /v1/tenants/:id/onboarding-checklist. Read is tenant_admin OR
 * tenant_user; PATCH is tenant_admin-only. Cross-tenant callers get 404
 * (RLS hides the row). Platform Admin gets 403 (zero-tenant-content
 * boundary, ADR-0030 §2) via requireTenantUserIdentity's own type check.
 * See .claude/skills/onboarding-checklist/SKILL.md.
 */
onboardingChecklistRouter.get('/:id/onboarding-checklist', async (req, res) => {
  const identity = requireTenantUserIdentity(req as RequestWithIdentity, res);
  if (!identity) return; // 403 already sent

  const tenantId = req.params.id;
  if (identity.tenantId !== tenantId) {
    // Cross-tenant read — RLS would hide it, but short-circuit to 404
    // before any DB round-trip, matching the contract's explicit AC2.
    res.status(404).json({ error: 'Tenant not found.' });
    return;
  }

  const checklist = await getOnboardingChecklist(tenantId, identity.userId);
  if (!checklist) {
    res.status(404).json({ error: 'Tenant not found.' });
    return;
  }

  res.json(checklist);
});

onboardingChecklistRouter.patch('/:id/onboarding-checklist', async (req, res) => {
  const identity = requireTenantUserIdentity(req as RequestWithIdentity, res);
  if (!identity) return; // 403 already sent

  const tenantId = req.params.id;
  if (identity.tenantId !== tenantId) {
    res.status(404).json({ error: 'Tenant not found.' });
    return;
  }

  // ADR-0080 Decision §4: PATCH is tenant_admin-only.
  if (identity.role !== 'tenant_admin') {
    res.status(403).json({ error: 'Only a Tenant-Admin may modify the onboarding checklist.' });
    return;
  }

  const validation = validatePatchBody(req.body);
  if (!validation.ok) {
    res.status(400).json({ error: validation.message });
    return;
  }

  const checklist = await patchOnboardingChecklist(tenantId, identity.userId, validation.value);
  if (!checklist) {
    res.status(404).json({ error: 'Tenant not found.' });
    return;
  }

  res.json(checklist);
});
