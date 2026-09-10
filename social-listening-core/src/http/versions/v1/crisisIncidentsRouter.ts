// Story 17.3 (ADR-0131 §8/§9, BRD-0131, FDD-0131 §5.4/§5.5) — crisis
// incident lifecycle API: acknowledge and resolve.

import { Router } from 'express';
import { requireTenantUserIdentity } from '../../auth/requireTenantUser';
import { RequestWithIdentity } from '../../auth/requestIdentity';
import { acknowledgeIncident, resolveIncident } from '../../../crisis/crisisIncidentStore';

export const crisisIncidentsRouter = Router();

/**
 * ADR-0131 §9: acknowledge/resolve are gated to Tenant-Admin or
 * Tenant-Brand-Reputation-Manager — an application-layer check, not RLS
 * (any tenant user may view an incident; only these two roles may change
 * its lifecycle state).
 */
function isCrisisResponder(role?: string): boolean {
  return role === 'tenant_admin' || role === 'tenant_brand_reputation_manager';
}

/**
 * POST /v1/crisis/incidents/:id/acknowledge
 */
crisisIncidentsRouter.post('/:id/acknowledge', async (req, res) => {
  const identity = requireTenantUserIdentity(req as RequestWithIdentity, res);
  if (!identity) return;

  if (!isCrisisResponder(identity.role)) {
    res.status(403).json({ code: 'forbidden', required_role: 'tenant_admin_or_tenant_brand_reputation_manager' });
    return;
  }

  try {
    const result = await acknowledgeIncident(identity.tenantId, identity.userId, req.params.id);
    switch (result.outcome) {
      case 'not_found':
        res.status(404).json({ code: 'not_found' });
        return;
      case 'invalid_state_transition':
        res.status(409).json({ code: 'invalid_state_transition', current_status: result.currentStatus });
        return;
      case 'acknowledged':
        res.status(200).json({
          incidentId: result.incident.id,
          status: 'acknowledged',
          acknowledgedByUserId: result.incident.acknowledged_by_user_id,
          acknowledgedAt: result.incident.acknowledged_at,
        });
        return;
    }
  } catch (err: any) {
    res.status(500).json({ code: 'internal_error', error: err?.message });
  }
});

/**
 * POST /v1/crisis/incidents/:id/resolve
 */
crisisIncidentsRouter.post('/:id/resolve', async (req, res) => {
  const identity = requireTenantUserIdentity(req as RequestWithIdentity, res);
  if (!identity) return;

  if (!isCrisisResponder(identity.role)) {
    res.status(403).json({ code: 'forbidden', required_role: 'tenant_admin_or_tenant_brand_reputation_manager' });
    return;
  }

  const rootCauseNotes = req.body?.rootCauseNotes;
  if (typeof rootCauseNotes !== 'string' || rootCauseNotes.trim().length === 0) {
    res.status(422).json({ code: 'validation_failed', details: { field: 'rootCauseNotes' } });
    return;
  }

  try {
    const result = await resolveIncident(identity.tenantId, identity.userId, req.params.id, rootCauseNotes);
    switch (result.outcome) {
      case 'not_found':
        res.status(404).json({ code: 'not_found' });
        return;
      case 'invalid_state_transition':
        res.status(409).json({ code: 'invalid_state_transition', current_status: result.currentStatus });
        return;
      case 'resolved':
        res.status(200).json({
          incidentId: result.incident.id,
          status: 'resolved',
          resolvedByUserId: result.incident.resolved_by_user_id,
          resolvedAt: result.incident.resolved_at,
          rootCauseNotes: result.incident.root_cause_notes,
        });
        return;
    }
  } catch (err: any) {
    res.status(500).json({ code: 'internal_error', error: err?.message });
  }
});
