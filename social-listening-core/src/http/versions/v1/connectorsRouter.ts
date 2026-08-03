import { Router } from 'express';
import { getCachedConnectorHealth } from '../../../connectors/connectorHealthCache';
import { storeCredential, deleteCredential } from '../../../credentials/credentialStore';
import { authMethodFor } from '../../../credentials/platformAuth';
import { requireTenantUser } from '../../auth/requireTenantUser';

export const connectorsRouter = Router();

/**
 * GET /v1/connectors/:platformId (Story 4.4, ADR-0022) — ConnectorHealth
 * served from the in-process TTL cache, never a live recompute per request.
 * Tenant identity comes from the resolved, token-authenticated caller
 * (Story 5.10) via requireTenantUser(), the same as every other /v1 route.
 * See .claude/skills/derived-data-caching-and-refresh/SKILL.md.
 */
connectorsRouter.get('/:platformId', async (req, res) => {
  const tenantId = requireTenantUser(req, res);
  if (!tenantId) return;

  const health = await getCachedConnectorHealth(tenantId, req.params.platformId);
  res.json(health);
});

/**
 * POST /v1/connectors/:platformId/connect (Phase 1 "also build, not storied")
 * Stores an encrypted credential for the given platform and tenant.
 * Body: { credential: string } - the API key or OAuth token
 * Returns: { id: string } - the stored credential ID
 * See implementation-plan.md Phase 1.
 */
connectorsRouter.post('/:platformId/connect', async (req, res) => {
  const tenantId = requireTenantUser(req, res);
  if (!tenantId) return;

  const { credential } = req.body;
  if (!credential || typeof credential !== 'string') {
    res.status(400).json({ error: 'credential (string) is required in request body.' });
    return;
  }

  const platformId = req.params.platformId;
  const authMethod = authMethodFor(platformId);
  
  // For Phase 1, we use a placeholder Key Vault key ID
  // Production will use real Azure Key Vault (Phase 5)
  const keyVaultKeyId = process.env.KEY_VAULT_KEY_ID || 'placeholder-key-id';

  try {
    const stored = await storeCredential(tenantId, platformId, credential, keyVaultKeyId);
    res.status(201).json({ id: stored.id, platformId, authMethod });
  } catch (err) {
    res.status(500).json({ error: 'Failed to store credential.', details: err instanceof Error ? err.message : String(err) });
  }
});

/**
 * DELETE /v1/connectors/:platformId/disconnect (Phase 1 "also build, not storied")
 * Removes all credentials for the given platform and tenant.
 * See implementation-plan.md Phase 1.
 */
connectorsRouter.delete('/:platformId/disconnect', async (req, res) => {
  const tenantId = requireTenantUser(req, res);
  if (!tenantId) return;

  const platformId = req.params.platformId;

  try {
    await deleteCredential(tenantId, platformId);
    res.status(200).json({ status: 'disconnected', platformId });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete credential.', details: err instanceof Error ? err.message : String(err) });
  }
});
