import { Router } from 'express';
import { requireTenantUserIdentity } from '../../auth/requireTenantUser';
import { RequestWithIdentity } from '../../auth/requestIdentity';
import {
  getYouTubeConnectorStatus,
  connectYouTubeChannel,
  YOUTUBE_PROVIDER_ID,
} from '../../../connectors/youtube/youtubeConnector';
import { storeCredential, CredentialOwnerType } from '../../../credentials/credentialStore';
import { getKeyVaultKeyId } from '../../../credentials/keyVaultProvider';
import { setConnectorActivation } from '../../../connectors/connectorActivationStore';

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

  const body = req.body || {};
  let apiKey: string | undefined = body.apiKey;
  let channelId: string | undefined = body.channelId;
  let channelTitle: string | undefined = body.channelTitle;
  const ownerType: CredentialOwnerType = body.ownerType === 'user' ? 'user' : 'tenant';

  // Standard ConnectModal sends { credential, ownerType }
  if (body.credential && typeof body.credential === 'string') {
    try {
      const parsed = JSON.parse(body.credential);
      if (typeof parsed === 'object' && parsed !== null) {
        apiKey = parsed.apiKey || apiKey;
        channelId = parsed.channelId || channelId;
        channelTitle = parsed.channelTitle || channelTitle;
      } else {
        apiKey = body.credential;
      }
    } catch {
      apiKey = body.credential;
    }
  }

  // If apiKey is provided, envelope-encrypt under Key Vault and activate
  if (apiKey) {
    const keyVaultKeyId = getKeyVaultKeyId();
    if (!keyVaultKeyId) {
      res.status(500).json({ error: 'Credential storage is not configured (KEY_VAULT_KEY_ID missing).' });
      return;
    }
    try {
      await storeCredential(identity.tenantId, YOUTUBE_PROVIDER_ID, apiKey, keyVaultKeyId, ownerType);
      await setConnectorActivation(identity.tenantId, YOUTUBE_PROVIDER_ID, ownerType, true);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to store YouTube credential.', details: err?.message || String(err) });
      return;
    }
  }

  // If channelId is provided, register the channel subscription
  if (channelId) {
    try {
      const result = await connectYouTubeChannel(identity.tenantId, identity.userId, { channelId, channelTitle });
      res.status(201).json(result);
      return;
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to connect YouTube channel.' });
      return;
    }
  }

  // If apiKey alone was provided, return successful connection outcome
  if (apiKey) {
    res.status(201).json({
      platformId: YOUTUBE_PROVIDER_ID,
      authMethod: 'api_key',
      ownerType,
      status: 'connected',
    });
    return;
  }

  res.status(400).json({ error: 'apiKey or channelId is required.' });
});
