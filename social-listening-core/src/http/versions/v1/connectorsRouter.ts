import { Router } from 'express';
import { getCachedConnectorHealth } from '../../../connectors/connectorHealthCache';
import { storeCredential, deleteCredential, CredentialOwnerType } from '../../../credentials/credentialStore';
import { authMethodFor } from '../../../credentials/platformAuth';
import { requireTenantUser, requireTenantUserIdentity } from '../../auth/requireTenantUser';

function parseOwnerType(value: unknown): CredentialOwnerType | null {
  if (value === undefined || value === 'tenant') return 'tenant';
  if (value === 'user') return 'user';
  return null;
}

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
 * POST /v1/connectors/:platformId/connect (Story 1.7, ADR-0034 — supersedes
 * Story 1.6's placeholder-auth shape). Stores an encrypted credential for
 * the given platform, discriminated by `ownerType` in the body
 * (`'tenant'` default, or `'user'`). `ownerType: 'tenant'` requires the
 * caller's resolved role to be `tenant_admin` (ADR-0028 Tier 2).
 * `ownerType: 'user'` always uses the caller's own resolved identity as
 * `userId` — a client-supplied `userId` in the body is ignored, never
 * trusted (ADR-0028 Tier 3). See
 * .claude/skills/connector-connect-disconnect/SKILL.md.
 */
connectorsRouter.post('/:platformId/connect', async (req, res) => {
  const identity = requireTenantUserIdentity(req, res);
  if (!identity) return;
  const { tenantId, userId, role } = identity;

  const { credential } = req.body;
  if (!credential || typeof credential !== 'string') {
    res.status(400).json({ error: 'credential (string) is required in request body.' });
    return;
  }

  const ownerType = parseOwnerType(req.body.ownerType);
  if (!ownerType) {
    res.status(400).json({ error: "ownerType must be 'tenant' or 'user'." });
    return;
  }

  if (ownerType === 'tenant' && role !== 'tenant_admin') {
    res.status(403).json({ error: 'Only a tenant_admin may create a tenant-wide credential.' });
    return;
  }

  const platformId = req.params.platformId;
  const authMethod = authMethodFor(platformId);

  // For Phase 1, we use a placeholder Key Vault key ID
  // Production will use real Azure Key Vault (Phase 5)
  const keyVaultKeyId = process.env.KEY_VAULT_KEY_ID || 'placeholder-key-id';

  // user_id is always the caller's own resolved identity — never the
  // request body's, which is never read for this purpose (AC3).
  const resolvedUserId = ownerType === 'user' ? userId : undefined;

  try {
    const stored = await storeCredential(tenantId, platformId, credential, keyVaultKeyId, ownerType, resolvedUserId);
    res.status(201).json({ id: stored.id, platformId, authMethod, ownerType });
  } catch (err) {
    res.status(500).json({ error: 'Failed to store credential.', details: err instanceof Error ? err.message : String(err) });
  }
});

/**
 * DELETE /v1/connectors/:platformId/disconnect (Story 1.7, ADR-0034).
 * Discriminated by an `ownerType` query parameter (`'tenant'` default, or
 * `'user'`) — no request body on a DELETE, matching every other route here.
 * Tenant-wide requires `tenant_admin`. User-bound (`?ownerType=user`,
 * optional `?userId=` for the offboarding case) succeeds for the owning
 * user or a `tenant_admin` of the same tenant, no one else — confirmed at
 * ADR-0034's own acceptance, see
 * .claude/skills/connector-connect-disconnect/SKILL.md.
 */
connectorsRouter.delete('/:platformId/disconnect', async (req, res) => {
  const identity = requireTenantUserIdentity(req, res);
  if (!identity) return;
  const { tenantId, userId, role } = identity;

  const ownerType = parseOwnerType(req.query.ownerType);
  if (!ownerType) {
    res.status(400).json({ error: "ownerType must be 'tenant' or 'user'." });
    return;
  }

  const platformId = req.params.platformId;

  if (ownerType === 'tenant') {
    if (role !== 'tenant_admin') {
      res.status(403).json({ error: 'Only a tenant_admin may disconnect a tenant-wide credential.' });
      return;
    }
    try {
      await deleteCredential(tenantId, platformId, 'tenant');
      res.status(200).json({ status: 'disconnected', platformId, ownerType });
    } catch (err) {
      res.status(500).json({ error: 'Failed to delete credential.', details: err instanceof Error ? err.message : String(err) });
    }
    return;
  }

  const targetUserId = typeof req.query.userId === 'string' ? req.query.userId : userId;
  if (targetUserId !== userId && role !== 'tenant_admin') {
    res.status(403).json({ error: 'Only the owning user or a tenant_admin may disconnect a user-bound credential.' });
    return;
  }

  try {
    await deleteCredential(tenantId, platformId, 'user', targetUserId);
    res.status(200).json({ status: 'disconnected', platformId, ownerType });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete credential.', details: err instanceof Error ? err.message : String(err) });
  }
});
