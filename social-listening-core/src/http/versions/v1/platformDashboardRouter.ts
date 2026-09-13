import { Router } from 'express';
import { RequestWithIdentity } from '../../auth/requestIdentity';
import { getPlatformDashboardData } from '../../../platform/platformMetricsStore';
import {
  remediateConnector,
  RemediationAction,
} from '../../../platform/connectorRemediationService';

export const platformDashboardRouter = Router();

// GET /v1/admin/platform-dashboard (Story 10.6, ADR-0089, Story 16.4 ADR-0128)
platformDashboardRouter.get('/platform-dashboard', async (req, res) => {
  const reqWithIdentity = req as RequestWithIdentity;
  const identity = reqWithIdentity.identity;
  if (!identity) {
    res.status(403).json({ error: 'This route requires an authenticated identity.' });
    return;
  }

  try {
    const data = await getPlatformDashboardData();
    res.json(data);
  } catch (err: any) {
    console.error('Error in GET /v1/admin/platform-dashboard:', err);
    res.status(500).json({ error: err?.message || 'Failed to retrieve platform dashboard.' });
  }
});

// POST /v1/admin/connectors/:id/remediate (Story 16.4, ADR-0128)
platformDashboardRouter.post('/connectors/:id/remediate', async (req, res) => {
  const reqWithIdentity = req as RequestWithIdentity;
  const identity = reqWithIdentity.identity;

  const isPlatformAdmin =
    identity &&
    (identity.type === 'platform_admin' || (identity as any).role === 'platform_admin');

  if (!isPlatformAdmin) {
    res.status(403).json({ error: 'This route requires a platform_admin identity.' });
    return;
  }

  const connectorId = req.params.id;
  const { action, overrideMinutes } = req.body || {};

  const validActions: RemediationAction[] = [
    'retry_now',
    'override_backoff',
    'clear_error_state',
    'reprompt_credentials',
  ];

  if (!action || !validActions.includes(action)) {
    res.status(400).json({
      error: `Invalid remediation action. Must be one of: ${validActions.join(', ')}`,
    });
    return;
  }

  let actorIdentity = 'platform_admin';
  if (identity.type === 'platform_admin') {
    actorIdentity = `platform_admin:${identity.adminId}`;
  } else if ((identity as any).userId) {
    actorIdentity = `platform_admin:${(identity as any).userId}`;
  }

  try {
    const result = await remediateConnector(
      connectorId,
      action,
      actorIdentity,
      typeof overrideMinutes === 'number' ? overrideMinutes : undefined
    );
    res.json(result);
  } catch (err: any) {
    console.error('Error in POST /v1/admin/connectors/:id/remediate:', err);
    res.status(500).json({ error: err?.message || 'Failed to remediate connector.' });
  }
});
