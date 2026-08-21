import { Router } from 'express';
import { requireTenantUserIdentity } from '../../auth/requireTenantUser';
import { listAccountsForUser, removeConnectedAccount } from '../../../connectors/instagram/instagramConnectedAccountsStore';
import { deleteCredentialById } from '../../../credentials/credentialStore';
import { deriveConnectorHealth } from '../../../connectors/connectorHealth';
import { isConnectorActive } from '../../../connectors/connectorActivationStore';
import { INSTAGRAM_PROVIDER_ID } from '../../../connectors/instagram/instagramConnector';

export const instagramAccountsRouter = Router();

/**
 * GET /v1/connectors/instagram/accounts — every one of the caller's own
 * connected Instagram accounts, any status (connected/removed/orphaned/reconnect_required).
 */
instagramAccountsRouter.get('/', async (req, res) => {
  const identity = requireTenantUserIdentity(req, res);
  if (!identity) return;
  const { tenantId, userId } = identity;

  const [rows, parentConnectionActive] = await Promise.all([
    listAccountsForUser(tenantId, userId),
    isConnectorActive(tenantId, INSTAGRAM_PROVIDER_ID, 'user', userId),
  ]);

  const accounts = await Promise.all(
    rows.map(async (row) => ({
      id: row.id,
      igUserId: row.igUserId,
      username: row.username,
      pageId: row.pageId,
      pageName: row.pageName,
      status: row.status,
      connectorHealth: await deriveConnectorHealth(tenantId, INSTAGRAM_PROVIDER_ID, row.igUserId, userId),
    }))
  );

  res.status(200).json({ parentConnectionActive, accounts });
});

/**
 * DELETE /v1/connectors/instagram/accounts/:id — soft-removes (status = 'removed')
 * one of the caller's own connected Instagram accounts and destroys its credential.
 */
instagramAccountsRouter.delete('/:id', async (req, res) => {
  const identity = requireTenantUserIdentity(req, res);
  if (!identity) return;
  const { tenantId, userId } = identity;

  const removed = await removeConnectedAccount(tenantId, userId, req.params.id);
  if (!removed) {
    res.status(404).json({ error: 'Connected Instagram account not found.' });
    return;
  }

  if (removed.credentialId) {
    await deleteCredentialById(tenantId, removed.credentialId);
  }

  res.status(200).json({ id: removed.id, igUserId: removed.igUserId, status: removed.status });
});
