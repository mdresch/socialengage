import { Router } from 'express';
import { requireTenantUserIdentity } from '../../auth/requireTenantUser';
import { RequestWithIdentity } from '../../auth/requestIdentity';
import {
  getYouTubeConnectorStatus,
  connectYouTubeChannel,
} from '../../../connectors/youtube/youtubeConnector';

export const youtubeConnectorRouter = Router();

// GET /v1/connectors/youtube/status (Story 10.13, ADR-0093)
youtubeConnectorRouter.get('/status', async (req, res) => {
  const identity = requireTenantUserIdentity(req as RequestWithIdentity, res);
  if (!identity) return;

  try {
    const status = await getYouTubeConnectorStatus(identity.tenantId, identity.userId);
    res.json(status);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to get YouTube connector status.' });
  }
});

// POST /v1/connectors/youtube/connect (Story 10.13, ADR-0093)
youtubeConnectorRouter.post('/connect', async (req, res) => {
  const identity = requireTenantUserIdentity(req as RequestWithIdentity, res);
  if (!identity) return;

  const { channelId, channelTitle } = req.body || {};
  if (!channelId || typeof channelId !== 'string') {
    res.status(400).json({ error: 'channelId is required.' });
    return;
  }

  try {
    const result = await connectYouTubeChannel(identity.tenantId, identity.userId, { channelId, channelTitle });
    res.status(201).json(result);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to connect YouTube channel.' });
  }
});
