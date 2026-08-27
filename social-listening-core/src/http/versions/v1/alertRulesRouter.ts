import { Router } from 'express';
import { requireTenantUserIdentity } from '../../auth/requireTenantUser';
import { RequestWithIdentity } from '../../auth/requestIdentity';
import {
  createAlertRule,
  listAlertRules,
  getAlertRule,
  updateAlertRule,
  deleteAlertRule,
  listTenantAlerts,
  updateTenantAlertStatus,
} from '../../../alerts/alertRulesStore';

export const alertRulesRouter = Router();

const VALID_TYPES = ['volume_spike', 'negative_sentiment_spike', 'influential_post', 'connector_error', 'keyword_burst'];

// POST /v1/alerts/rules
alertRulesRouter.post('/rules', async (req, res) => {
  const identity = requireTenantUserIdentity(req as RequestWithIdentity, res);
  if (!identity) return;

  const { name, type, thresholds, watchlist_id, platform_id, cooldown_minutes, channels, enabled } = req.body || {};

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    res.status(400).json({ error: 'Name is required.' });
    return;
  }

  if (!type || !VALID_TYPES.includes(type)) {
    res.status(400).json({ error: `Invalid rule type. Must be one of: ${VALID_TYPES.join(', ')}` });
    return;
  }

  try {
    const rule = await createAlertRule(identity.tenantId, identity.userId, {
      name,
      type,
      thresholds,
      watchlist_id,
      platform_id,
      cooldown_minutes,
      channels,
      enabled,
    });
    res.status(201).json(rule);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to create alert rule.' });
  }
});

// GET /v1/alerts/rules
alertRulesRouter.get('/rules', async (req, res) => {
  const identity = requireTenantUserIdentity(req as RequestWithIdentity, res);
  if (!identity) return;

  try {
    const rules = await listAlertRules(identity.tenantId, identity.userId);
    res.json({ rules });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to retrieve alert rules.' });
  }
});

// GET /v1/alerts/rules/:id
alertRulesRouter.get('/rules/:id', async (req, res) => {
  const identity = requireTenantUserIdentity(req as RequestWithIdentity, res);
  if (!identity) return;

  try {
    const rule = await getAlertRule(identity.tenantId, identity.userId, req.params.id);
    if (!rule) {
      res.status(404).json({ error: 'Alert rule not found.' });
      return;
    }
    res.json(rule);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to retrieve alert rule.' });
  }
});

// PATCH /v1/alerts/rules/:id
alertRulesRouter.patch('/rules/:id', async (req, res) => {
  const identity = requireTenantUserIdentity(req as RequestWithIdentity, res);
  if (!identity) return;

  const { name, type, thresholds, watchlist_id, platform_id, cooldown_minutes, channels, enabled } = req.body || {};

  if (type && !VALID_TYPES.includes(type)) {
    res.status(400).json({ error: `Invalid rule type. Must be one of: ${VALID_TYPES.join(', ')}` });
    return;
  }

  try {
    const rule = await updateAlertRule(identity.tenantId, identity.userId, req.params.id, {
      name,
      type,
      thresholds,
      watchlist_id,
      platform_id,
      cooldown_minutes,
      channels,
      enabled,
    });
    if (!rule) {
      res.status(404).json({ error: 'Alert rule not found.' });
      return;
    }
    res.json(rule);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to update alert rule.' });
  }
});

// DELETE /v1/alerts/rules/:id
alertRulesRouter.delete('/rules/:id', async (req, res) => {
  const identity = requireTenantUserIdentity(req as RequestWithIdentity, res);
  if (!identity) return;

  try {
    const deleted = await deleteAlertRule(identity.tenantId, identity.userId, req.params.id);
    if (!deleted) {
      res.status(404).json({ error: 'Alert rule not found.' });
      return;
    }
    res.status(204).end();
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to delete alert rule.' });
  }
});

// GET /v1/alerts/inbox
alertRulesRouter.get('/inbox', async (req, res) => {
  const identity = requireTenantUserIdentity(req as RequestWithIdentity, res);
  if (!identity) return;

  const status = req.query.status ? String(req.query.status) : undefined;
  const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 50;

  try {
    const alerts = await listTenantAlerts(identity.tenantId, identity.userId, { status, limit });
    res.json({ alerts });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to retrieve alerts inbox.' });
  }
});

// PATCH /v1/alerts/inbox/:alertId
alertRulesRouter.patch('/inbox/:alertId', async (req, res) => {
  const identity = requireTenantUserIdentity(req as RequestWithIdentity, res);
  if (!identity) return;

  const { status } = req.body || {};
  if (!status || !['acknowledged', 'resolved', 'snoozed'].includes(status)) {
    res.status(400).json({ error: 'Status must be one of: acknowledged, resolved, snoozed' });
    return;
  }

  try {
    const updated = await updateTenantAlertStatus(identity.tenantId, identity.userId, req.params.alertId, status);
    if (!updated) {
      res.status(404).json({ error: 'Alert not found.' });
      return;
    }
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to update alert status.' });
  }
});
