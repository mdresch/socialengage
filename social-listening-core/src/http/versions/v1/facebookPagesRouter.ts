import { Router } from 'express';
import { requireTenantUserIdentity } from '../../auth/requireTenantUser';
import { listPagesForUser, removeConnectedPage } from '../../../connectors/facebook/facebookConnectedPagesStore';
import { deleteCredentialById } from '../../../credentials/credentialStore';
import { deriveConnectorHealth } from '../../../connectors/connectorHealth';
import { isConnectorActive } from '../../../connectors/connectorActivationStore';
import { FACEBOOK_PROVIDER_ID } from '../../../connectors/facebook/facebookConnector';

/**
 * Story 6.27 (ADR-0060 Decision §5) — the caller's own connected Facebook
 * Pages: list, and soft-remove one. Both endpoints resolve `userId` from
 * the caller's own resolved identity, exactly like `/select-page` already
 * does — never from a request-body or path value, and never gated on
 * `role === 'tenant_admin'`. This is the one place ADR-0057's tenant-wide
 * multi-feed precedent does NOT transfer (see ADR-0060's own Context,
 * "The ADR-0057 precedent — evaluated explicitly"): a connected Page is a
 * Tier-3, personally-authorized resource (ADR-0028 §3), so no
 * `tenant_admin`-gated endpoint may list, edit, or remove another user's
 * connected Pages — a `tenant_admin` calling either endpoint below sees
 * and can only affect their own connected Pages, same as any other
 * `tenant_user` would. See .claude/skills/facebook-connector/SKILL.md.
 */
export const facebookPagesRouter = Router();

/**
 * GET /v1/connectors/facebook/pages — every one of the caller's own
 * connected Pages, any status (`connected`/`removed`/`orphaned`) — the
 * per-Page list UI (Decision §6) renders `orphaned` distinctly, so it must
 * be present here, not filtered out. `connectorHealth` is computed via
 * `deriveConnectorHealth(tenantId, 'facebook', pageId)` (Decision §4), one
 * call per row — no pagination at v1 (a person's own Page count doesn't
 * need it yet). `parentConnectionActive` (added at review) is the same
 * value for every row a given user has connected — computed once via the
 * already-existing `isConnectorActive(tenantId, 'facebook', 'user', userId)`,
 * not duplicated per row.
 */
facebookPagesRouter.get('/', async (req, res) => {
  const identity = requireTenantUserIdentity(req, res);
  if (!identity) return;
  const { tenantId, userId } = identity;

  const [rows, parentConnectionActive] = await Promise.all([
    listPagesForUser(tenantId, userId),
    isConnectorActive(tenantId, FACEBOOK_PROVIDER_ID, 'user', userId),
  ]);

  const pages = await Promise.all(
    rows.map(async (row) => ({
      id: row.id,
      pageId: row.pageId,
      pageName: row.pageName,
      status: row.status,
      connectorHealth: await deriveConnectorHealth(tenantId, FACEBOOK_PROVIDER_ID, row.pageId),
    }))
  );

  res.status(200).json({ parentConnectionActive, pages });
});

/**
 * DELETE /v1/connectors/facebook/pages/:id — soft-removes (status =
 * 'removed') one of the caller's own connected Pages and destroys its
 * credential immediately via the new deleteCredentialById() (Decision §2).
 * Another user's row (or a nonexistent id) is 404, never 403 — matching
 * ADR-0044 §5c's own established "another user's private resource is 404,
 * never 403" convention for personal resources; removeConnectedPage()'s
 * own WHERE clause already scopes by the caller's userId, so this is
 * naturally correct rather than a separate ownership check.
 */
facebookPagesRouter.delete('/:id', async (req, res) => {
  const identity = requireTenantUserIdentity(req, res);
  if (!identity) return;
  const { tenantId, userId } = identity;

  const removed = await removeConnectedPage(tenantId, userId, req.params.id);
  if (!removed) {
    res.status(404).json({ error: 'Connected Page not found.' });
    return;
  }
  // credentialId is only ever null here if this row was already
  // soft-removed by an earlier call (its credential already destroyed) —
  // idempotent: a repeat DELETE on an already-removed row is a safe no-op
  // on the credential-destruction step.
  if (removed.credentialId) {
    await deleteCredentialById(tenantId, removed.credentialId);
  }
  res.status(200).json({ id: removed.id, pageId: removed.pageId, status: removed.status });
});
