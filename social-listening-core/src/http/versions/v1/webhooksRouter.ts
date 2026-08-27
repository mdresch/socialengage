import { Router } from 'express';
import { requireTenantUserIdentity } from '../../auth/requireTenantUser';
import { RequestWithIdentity } from '../../auth/requestIdentity';
import {
  createWebhookSubscription,
  listWebhookSubscriptions,
  getWebhookSubscription,
  deleteWebhookSubscription,
  dispatchWebhookEvent,
} from '../../../webhooks/webhookDispatcher';

export const webhooksRouter = Router();

// POST /v1/webhooks/subscriptions (Story 10.11, ADR-0092)
webhooksRouter.post('/subscriptions', async (req, res) => {
  const identity = requireTenantUserIdentity(req as RequestWithIdentity, res);
  if (!identity) return;

  const { url, events, secret } = req.body || {};
  if (!url || typeof url !== 'string' || !url.startsWith('http')) {
    res.status(400).json({ error: 'Valid URL is required.' });
    return;
  }

  try {
    const sub = await createWebhookSubscription(identity.tenantId, identity.userId, { url, events, secret });
    res.status(201).json(sub);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to create webhook subscription.' });
  }
});

// GET /v1/webhooks/subscriptions
webhooksRouter.get('/subscriptions', async (req, res) => {
  const identity = requireTenantUserIdentity(req as RequestWithIdentity, res);
  if (!identity) return;

  try {
    const subscriptions = await listWebhookSubscriptions(identity.tenantId, identity.userId);
    res.json({ subscriptions });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to list webhook subscriptions.' });
  }
});

// DELETE /v1/webhooks/subscriptions/:id
webhooksRouter.delete('/subscriptions/:id', async (req, res) => {
  const identity = requireTenantUserIdentity(req as RequestWithIdentity, res);
  if (!identity) return;

  try {
    const deleted = await deleteWebhookSubscription(identity.tenantId, identity.userId, req.params.id);
    if (!deleted) {
      res.status(404).json({ error: 'Webhook subscription not found.' });
      return;
    }
    res.status(204).end();
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to delete webhook subscription.' });
  }
});

// POST /v1/webhooks/subscriptions/:id/test
webhooksRouter.post('/subscriptions/:id/test', async (req, res) => {
  const identity = requireTenantUserIdentity(req as RequestWithIdentity, res);
  if (!identity) return;

  try {
    const sub = await getWebhookSubscription(identity.tenantId, identity.userId, req.params.id);
    if (!sub) {
      res.status(404).json({ error: 'Webhook subscription not found.' });
      return;
    }

    const testPayload = { test: true, message: 'Ping delivery verification from SocialEngage' };
    const results = await dispatchWebhookEvent(identity.tenantId, 'test.ping', testPayload);
    res.json({ success: true, results });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to test webhook delivery.' });
  }
});
