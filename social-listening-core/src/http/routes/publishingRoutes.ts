import { Router, RequestHandler } from 'express';
import { requireTenantUserIdentity } from '../auth/requireTenantUser';
import {
  createOutboundPost,
  cancelOutboundActivity,
  rescheduleOutboundActivity,
  listOutboundActivities,
  PublishingError,
} from '../../publishing/outboundPublishingService';

export function createPublishingRoutes(authMiddleware: RequestHandler): Router {
  const router = Router();

  /**
   * Story 11.7 (ADR-0098) — POST /v1/outbound/posts: creates immediate or scheduled outbound post.
   */
  router.post('/outbound/posts', authMiddleware, async (req, res) => {
    const identity = requireTenantUserIdentity(req, res);
    if (!identity) return;
    const { tenantId, userId } = identity;

    const text = typeof req.body?.text === 'string' ? req.body.text : '';
    const targetPlatforms = Array.isArray(req.body?.targetPlatforms) ? req.body.targetPlatforms : undefined;
    const targets = Array.isArray(req.body?.targets) ? req.body.targets : undefined;
    const scheduledFor = req.body?.scheduledFor;
    const assetTargets = req.body?.assetTargets;
    const perPlatformOverrides = req.body?.perPlatformOverrides;
    const assets = req.body?.assets;

    try {
      const result = await createOutboundPost(tenantId, userId, {
        text,
        targetPlatforms,
        targets,
        scheduledFor,
        assetTargets,
        perPlatformOverrides,
        assets,
      });

      res.status(202).json(result);
    } catch (err: any) {
      if (err instanceof PublishingError) {
        res.status(err.status).json({ error: err.message, code: err.code });
        return;
      }
      res.status(500).json({ error: err.message || 'Failed to create outbound post' });
    }
  });

  /**
   * Story 11.7 (ADR-0098) — GET /v1/outbound/posts: lists outbound post activities.
   */
  router.get('/outbound/posts', authMiddleware, async (req, res) => {
    const identity = requireTenantUserIdentity(req, res);
    if (!identity) return;
    const { tenantId } = identity;

    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const providerId = typeof req.query.providerId === 'string' ? req.query.providerId : undefined;
    const limit = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : undefined;

    try {
      const posts = await listOutboundActivities(tenantId, { status, providerId, limit });
      res.json({ posts, count: posts.length });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to list outbound posts' });
    }
  });

  /**
   * Story 11.7 (ADR-0098) — PATCH /v1/outbound/activities/:id/cancel
   */
  router.patch('/outbound/activities/:id/cancel', authMiddleware, async (req, res) => {
    const identity = requireTenantUserIdentity(req, res);
    if (!identity) return;
    const { tenantId } = identity;
    const { id } = req.params as { id: string };

    try {
      const cancelled = await cancelOutboundActivity(tenantId, id);
      res.json(cancelled);
    } catch (err: any) {
      if (err instanceof PublishingError) {
        res.status(err.status).json({ error: err.message, code: err.code });
        return;
      }
      res.status(500).json({ error: err.message || 'Failed to cancel activity' });
    }
  });

  /**
   * Story 11.7 (ADR-0098) — PATCH /v1/outbound/activities/:id/reschedule
   */
  router.patch('/outbound/activities/:id/reschedule', authMiddleware, async (req, res) => {
    const identity = requireTenantUserIdentity(req, res);
    if (!identity) return;
    const { tenantId } = identity;
    const { id } = req.params as { id: string };
    const scheduledFor = req.body?.scheduledFor;

    if (!scheduledFor) {
      res.status(422).json({ error: 'scheduledFor timestamp is required.', code: 'INVALID_SCHEDULED_FOR' });
      return;
    }

    try {
      const rescheduled = await rescheduleOutboundActivity(tenantId, id, scheduledFor);
      res.json(rescheduled);
    } catch (err: any) {
      if (err instanceof PublishingError) {
        res.status(err.status).json({ error: err.message, code: err.code });
        return;
      }
      res.status(500).json({ error: err.message || 'Failed to reschedule activity' });
    }
  });

  return router;
}
