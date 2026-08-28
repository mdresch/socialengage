import { Router, Request, Response } from 'express';
import { requireTenantUserIdentity } from '../auth/requireTenantUser';
import { RequestWithIdentity } from '../auth/requestIdentity';
import {
  getUserDigestPreferences,
  upsertUserDigestPreferences,
} from '../../digest/digestPreferenceStore';
import { buildDailyDigest } from '../../digest/dailyDigestBuilder';
import { renderDailyDigest } from '../../digest/dailyDigestRenderer';

export function createDigestRoutes(): Router {
  const router = Router();

  // GET /v1/users/me/digest-preferences
  router.get('/users/me/digest-preferences', async (req: Request, res: Response) => {
    const identity = requireTenantUserIdentity(req as RequestWithIdentity, res);
    if (!identity) return;

    try {
      const prefs = await getUserDigestPreferences(identity.tenantId, identity.userId);
      res.status(200).json(prefs);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to get digest preferences' });
    }
  });

  // POST /v1/users/me/digest-preferences
  router.post('/users/me/digest-preferences', async (req: Request, res: Response) => {
    const identity = requireTenantUserIdentity(req as RequestWithIdentity, res);
    if (!identity) return;

    try {
      const updated = await upsertUserDigestPreferences(identity.tenantId, identity.userId, req.body || {});
      res.status(200).json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to update digest preferences' });
    }
  });

  // POST /v1/users/me/digest-previews
  router.post('/users/me/digest-previews', async (req: Request, res: Response) => {
    const identity = requireTenantUserIdentity(req as RequestWithIdentity, res);
    if (!identity) return;

    try {
      const customPreferences = req.body;
      const data = await buildDailyDigest(identity.tenantId, identity.userId, customPreferences);
      const rendered = renderDailyDigest(data);

      res.status(200).json({
        data,
        rendered,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to generate digest preview' });
    }
  });

  return router;
}

export function createPublicDigestRoutes(): Router {
  const router = Router();

  // GET /v1/digest/unsubscribe (One-click unsubscribe, public link from emails)
  router.get('/digest/unsubscribe', async (req: Request, res: Response) => {
    const { tenantId, userId } = req.query as { tenantId?: string; userId?: string };
    if (!tenantId || !userId) {
      res.status(400).send('Invalid unsubscribe link.');
      return;
    }

    try {
      await upsertUserDigestPreferences(tenantId, userId, { isEnabled: false });
      res.status(200).send('You have been successfully unsubscribed from the daily digest email.');
    } catch (err: any) {
      res.status(500).send('Failed to process unsubscribe request.');
    }
  });

  return router;
}
