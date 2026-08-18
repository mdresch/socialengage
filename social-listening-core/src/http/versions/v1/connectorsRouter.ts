import { Router } from 'express';
import { getCachedConnectorHealth } from '../../../connectors/connectorHealthCache';
import { storeCredential, deleteCredential, CredentialOwnerType } from '../../../credentials/credentialStore';
import { authMethodFor } from '../../../credentials/platformAuth';
import { requireTenantUser, requireTenantUserIdentity } from '../../auth/requireTenantUser';
import {
  setConnectorActivation,
  isConnectorActive,
  ConnectorActivationOwnerType,
} from '../../../connectors/connectorActivationStore';
import { getSocialConnector, getAIProviderConnector } from '../../../connectors/registry';

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
 *
 * Story 1.12 (ADR-0051 Open Question 5) — the response also carries
 * `isActive` (tenant-wide scope, the only scope any current caller means),
 * read fresh via `isConnectorActive()` on every call, deliberately never
 * folded into the 60-second health cache above (ADR-0022's own dated note
 * on this exact question). No change to `ConnectorHealth`'s own four
 * fields or the cache itself.
 */
connectorsRouter.get('/:platformId', async (req, res) => {
  const tenantId = requireTenantUser(req, res);
  if (!tenantId) return;

  const platformId = req.params.platformId;
  const [health, isActive] = await Promise.all([
    getCachedConnectorHealth(tenantId, platformId),
    isConnectorActive(tenantId, platformId, 'tenant'),
  ]);
  res.json({ ...health, isActive });
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

  // Story 2.15 (ADR-0059 Decision §4) — an authMode:'oauth' platform has
  // no valid client-supplied "credential" string this generic endpoint
  // could accept (its credential is assembled server-side from a real
  // OAuth token exchange, never handed to us directly) — and, for
  // Facebook specifically, this is also what actually prevents a Tier-2
  // bypass of its Tier-3-only rule, since this endpoint has no other
  // mechanism to enforce that. Rejected for both ownerType values, not
  // just 'tenant' — there is no generic-connect path for this auth mode
  // at all; use the platform's own dedicated OAuth router instead.
  if (getSocialConnector(platformId)?.authMode === 'oauth') {
    res.status(400).json({
      error: 'This platform uses OAuth and must be connected via its own dedicated OAuth flow, not this generic endpoint.',
    });
    return;
  }

  if (ownerType === 'user' && forbidsUserScope(platformId)) {
    res.status(400).json({
      error: "ownerType 'user' is not valid for this platform — no personal credential is possible (ADR-0028).",
    });
    return;
  }

  const authMethod = authMethodFor(platformId);

  // ADR-0014 mandates envelope encryption backed by a real Azure Key Vault
  // key — there is no valid placeholder for this. Fail clearly here rather
  // than let an unset KEY_VAULT_KEY_ID reach storeCredential()/wrapDek() as
  // an invalid key identifier, which CryptographyClient can only reject
  // with an opaque downstream error (Story 1.7 AC9, healing note 2026-08-17).
  const keyVaultKeyId = process.env.KEY_VAULT_KEY_ID;
  if (!keyVaultKeyId) {
    res.status(500).json({ error: 'Credential storage is not configured (KEY_VAULT_KEY_ID missing).' });
    return;
  }

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

/**
 * `ownerType: 'user'` is invalid in two distinct cases, both determined via
 * the shared registry, never a hardcoded providerId literal (this file is
 * one of Story 2.10/ADR-0048's own CORE_FILES, so a literal providerId
 * string here would fail that story's own CI guardrail):
 *
 * 1. `authMode: 'none'` — no credential of any kind exists to own
 *    personally (ADR-0051 Decision Section 1).
 * 2. Any `AIProviderConnector` — ADR-0028 Decision §1 settles Azure AI
 *    Language/Azure OpenAI as tenant-owned, Tier 2 credentials with no
 *    Tier 3/personal variant (Clarification, 2026-08-17): an AI provider's
 *    API key authenticates an Azure subscription/resource, an
 *    organizational asset by the same "operative test" the Decision
 *    already applies to Reddit's app-only grant — not an individual's
 *    personal account the way a Tier 3 credential requires. `enrichPost.ts`
 *    already only ever reads a tenant-wide credential/activation for any
 *    `AIProviderConnector` (`tryProvider()`'s own hardcoded `'tenant'`
 *    scope) — this closes the previously-unenforced gap at the surface
 *    (connect/activate) to match the behavior that already existed at the
 *    point of use, rather than silently accepting a personal credential or
 *    activation that enrichment would never read.
 */
function forbidsUserScope(platformId: string): boolean {
  if (getAIProviderConnector(platformId)) return true;
  const authMode = getSocialConnector(platformId)?.authMode;
  return authMode === 'none';
}

/**
 * POST /v1/connectors/:platformId/activate and .../deactivate (Story 1.11,
 * ADR-0051) -- a real, persisted, credential-independent "is this
 * connector turned on" signal, deliberately separate from connect/
 * disconnect's credential storage above. Discriminated by `ownerType` in
 * the body, the same way connect/disconnect already are. `activate`'s
 * `ownerType: 'user'` always uses the caller's own resolved identity
 * (mirrors connect's self-only shape); `deactivate`'s `ownerType: 'user'`
 * also accepts the owning user OR a tenant_admin of the same tenant
 * (mirrors disconnect's offboarding-override shape, Story 1.7 AC5) --
 * deactivating is strictly less destructive than disconnecting, so a
 * tenant_admin who may already disconnect a user's credential must not be
 * blocked from pausing it. See
 * .claude/skills/connector-activation/SKILL.md.
 */
connectorsRouter.post('/:platformId/activate', async (req, res) => {
  const identity = requireTenantUserIdentity(req, res);
  if (!identity) return;
  const { tenantId, userId, role } = identity;

  const ownerType = parseOwnerType(req.body.ownerType) as ConnectorActivationOwnerType | null;
  if (!ownerType) {
    res.status(400).json({ error: "ownerType must be 'tenant' or 'user'." });
    return;
  }

  const platformId = req.params.platformId;

  if (ownerType === 'user' && forbidsUserScope(platformId)) {
    res.status(400).json({
      error: "ownerType 'user' is not valid for a platform with authMode 'none' — no personal credential exists to scope activation to.",
    });
    return;
  }

  if (ownerType === 'tenant' && role !== 'tenant_admin') {
    res.status(403).json({ error: 'Only a tenant_admin may activate a tenant-wide connector.' });
    return;
  }

  // user_id is always the caller's own resolved identity -- never the
  // request body's, matching connect's own AC3 precedent.
  const resolvedUserId = ownerType === 'user' ? userId : undefined;

  const result = await setConnectorActivation(tenantId, platformId, ownerType, true, userId, resolvedUserId);
  res.status(200).json({
    platformId,
    ownerType,
    isActive: result.isActive,
    activatedAt: result.activatedAt,
    deactivatedAt: result.deactivatedAt,
  });
});

connectorsRouter.post('/:platformId/deactivate', async (req, res) => {
  const identity = requireTenantUserIdentity(req, res);
  if (!identity) return;
  const { tenantId, userId, role } = identity;

  const ownerType = parseOwnerType(req.body.ownerType) as ConnectorActivationOwnerType | null;
  if (!ownerType) {
    res.status(400).json({ error: "ownerType must be 'tenant' or 'user'." });
    return;
  }

  const platformId = req.params.platformId;

  if (ownerType === 'user' && forbidsUserScope(platformId)) {
    res.status(400).json({
      error: "ownerType 'user' is not valid for a platform with authMode 'none' — no personal credential exists to scope activation to.",
    });
    return;
  }

  if (ownerType === 'tenant') {
    if (role !== 'tenant_admin') {
      res.status(403).json({ error: 'Only a tenant_admin may deactivate a tenant-wide connector.' });
      return;
    }
    const result = await setConnectorActivation(tenantId, platformId, 'tenant', false, userId);
    res.status(200).json({
      platformId,
      ownerType,
      isActive: result.isActive,
      activatedAt: result.activatedAt,
      deactivatedAt: result.deactivatedAt,
    });
    return;
  }

  // Deactivate's offboarding override (Story 1.7 AC5's disconnect
  // precedent): the owning user, or a tenant_admin of the same tenant.
  const targetUserId = typeof req.body.userId === 'string' ? req.body.userId : userId;
  if (targetUserId !== userId && role !== 'tenant_admin') {
    res.status(403).json({ error: 'Only the owning user or a tenant_admin may deactivate a user-bound connector.' });
    return;
  }

  const result = await setConnectorActivation(tenantId, platformId, 'user', false, userId, targetUserId);
  res.status(200).json({
    platformId,
    ownerType,
    isActive: result.isActive,
    activatedAt: result.activatedAt,
    deactivatedAt: result.deactivatedAt,
  });
});
