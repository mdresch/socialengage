import { Router } from 'express';
import { requireTenantUserIdentity } from '../../auth/requireTenantUser';
import { RequestWithIdentity } from '../../auth/requestIdentity';
import {
  createActivation,
  getActivation,
  markVerified,
  expectedTxtRecordValue,
  hasVerifiedDomain,
  listActivations,
  updateFeedUrl,
  removeActivation,
} from '../../../connectors/tenantOwnedFeed/tenantOwnedFeedStore';
import { checkTxtRecord } from '../../../connectors/tenantOwnedFeed/dnsVerification';
import type { TenantOwnedFeedActivationRow } from '../../../connectors/tenantOwnedFeed/tenantOwnedFeedStore';

export const tenantOwnedFeedRouter = Router();

function serializeActivation(activation: TenantOwnedFeedActivationRow) {
  return {
    id: activation.id,
    domain: activation.domain,
    feedUrl: activation.feed_url,
    status: activation.status,
    txtRecordHost: activation.txt_record_host,
    txtRecordValue: expectedTxtRecordValue(activation),
    tokenExpiresAt: activation.token_expires_at.toISOString(),
    verifiedAt: activation.verified_at ? activation.verified_at.toISOString() : null,
    createdAt: activation.created_at.toISOString(),
  };
}

/**
 * POST /v1/connectors/tenant-owned-feed/connect (ADR-0050 Decision §3;
 * Story 6.20/ADR-0057 Decision §2 added the `tenant_admin` gate below,
 * Decision §1a added the domain-reuse auto-verify path). Accepts
 * `{ domain, feedUrl }`, generates a unique verification token, and
 * returns TXT record instructions. `feedUrl` must be supplied explicitly —
 * no autodiscovery step (ADR-0050's own v1 scope decision).
 *
 * When the caller's tenant already holds a `verified` activation for this
 * exact domain, the new row is created and immediately marked `verified`
 * server-side — domain ownership is a property of the domain, not of any
 * one feed URL beneath it, so a second feed on an already-proven domain
 * never needs a second DNS TXT cycle (ADR-0057 Decision §1a). Otherwise
 * this route only creates a `pending` row; see verify-domain below and
 * pollTenantOwnedFeed.ts's own doc comment for why polling can never reach
 * an unverified activation.
 */
tenantOwnedFeedRouter.post('/connect', async (req, res) => {
  const identity = requireTenantUserIdentity(req as RequestWithIdentity, res);
  if (!identity) return;

  if (identity.role !== 'tenant_admin') {
    res.status(403).json({ error: 'Only a tenant_admin may configure a tenant-owned feed.' });
    return;
  }

  const { domain, feedUrl } = req.body ?? {};
  if (!domain || typeof domain !== 'string') {
    res.status(400).json({ error: 'domain is required.' });
    return;
  }
  if (!feedUrl || typeof feedUrl !== 'string') {
    res.status(400).json({ error: 'feedUrl is required.' });
    return;
  }

  const alreadyVerifiedForDomain = await hasVerifiedDomain(identity.tenantId, domain);
  let activation = await createActivation(identity.tenantId, { domain, feedUrl });
  if (alreadyVerifiedForDomain) {
    activation = (await markVerified(identity.tenantId, activation.id))!;
  }

  res.status(201).json({
    connectorActivationId: activation.id,
    txtRecordHost: activation.txt_record_host,
    txtRecordValue: expectedTxtRecordValue(activation),
    expiresAt: activation.token_expires_at.toISOString(),
    feedUrl: activation.feed_url,
    status: activation.status,
  });
});

/**
 * POST /v1/connectors/tenant-owned-feed/verify-domain (ADR-0050 Decision
 * §3; Story 6.20/ADR-0057 Decision §2 added the `tenant_admin` gate below).
 * Looks up the TXT record at the activation's own designated host and
 * marks it verified only when the token matches. A missing or mismatched
 * record is a `pending`/retryable response, never a hard failure — DNS
 * propagation can take up to 72 hours and is outside the tenant's control
 * once the record is published.
 */
tenantOwnedFeedRouter.post('/verify-domain', async (req, res) => {
  const identity = requireTenantUserIdentity(req as RequestWithIdentity, res);
  if (!identity) return;

  if (identity.role !== 'tenant_admin') {
    res.status(403).json({ error: 'Only a tenant_admin may verify a tenant-owned feed domain.' });
    return;
  }

  const { connectorActivationId } = req.body ?? {};
  if (!connectorActivationId || typeof connectorActivationId !== 'string') {
    res.status(400).json({ error: 'connectorActivationId is required.' });
    return;
  }

  const activation = await getActivation(identity.tenantId, connectorActivationId);
  if (!activation) {
    res.status(404).json({ error: 'Activation not found.' });
    return;
  }

  if (activation.status === 'verified') {
    res.json({ status: 'verified', connectorActivationId: activation.id });
    return;
  }

  const matched = await checkTxtRecord(activation.txt_record_host, expectedTxtRecordValue(activation));
  if (!matched) {
    // ADR-0050 Decision §3's own re-check cadence (1-minute intervals for
    // the first 5 minutes, then every 15 minutes) is the Admin UI's own
    // polling schedule against this endpoint, not enforced server-side here.
    res.json({ status: 'pending', retryAfter: 60, connectorActivationId: activation.id });
    return;
  }

  const verified = await markVerified(identity.tenantId, activation.id);
  res.json({ status: 'verified', connectorActivationId: verified!.id });
});

/**
 * GET /v1/connectors/tenant-owned-feed/activations (Story 6.20/ADR-0057
 * Decision §1) — lists every activation for the caller's tenant, any
 * status ('pending'/'verified'/'expired'/'removed'), `tenant_admin` only.
 * A direct, useful side effect: this closes the pre-existing "TXT
 * instructions lost on reload" gap — today's connect response only ever
 * existed in ephemeral client state.
 */
tenantOwnedFeedRouter.get('/activations', async (req, res) => {
  const identity = requireTenantUserIdentity(req as RequestWithIdentity, res);
  if (!identity) return;

  if (identity.role !== 'tenant_admin') {
    res.status(403).json({ error: 'Only a tenant_admin may view tenant-owned feed activations.' });
    return;
  }

  const activations = await listActivations(identity.tenantId);
  res.json({ activations: activations.map(serializeActivation) });
});

/**
 * PATCH /v1/connectors/tenant-owned-feed/:id (Story 6.20/ADR-0057 Decision
 * §1) — updates `feedUrl` only, `tenant_admin` only. `domain` is never
 * accepted here — it is the exact claim DNS TXT verification proves, and
 * an in-place domain change would silently invalidate a completed
 * verification. Works regardless of the activation's current status.
 */
tenantOwnedFeedRouter.patch('/:id', async (req, res) => {
  const identity = requireTenantUserIdentity(req as RequestWithIdentity, res);
  if (!identity) return;

  if (identity.role !== 'tenant_admin') {
    res.status(403).json({ error: 'Only a tenant_admin may edit a tenant-owned feed.' });
    return;
  }

  const body = req.body ?? {};
  if (Object.prototype.hasOwnProperty.call(body, 'domain')) {
    res.status(400).json({ error: 'domain cannot be edited — remove this activation and connect the new domain instead.' });
    return;
  }
  if (!body.feedUrl || typeof body.feedUrl !== 'string') {
    res.status(400).json({ error: 'feedUrl is required.' });
    return;
  }

  const updated = await updateFeedUrl(identity.tenantId, req.params.id, body.feedUrl);
  if (!updated) {
    res.status(404).json({ error: 'Activation not found.' });
    return;
  }

  res.json(serializeActivation(updated));
});

/**
 * DELETE /v1/connectors/tenant-owned-feed/:id (Story 6.20/ADR-0057
 * Decision §1) — soft removal, `tenant_admin` only. Transitions `status`
 * to `'removed'`, never a hard SQL delete; already-ingested `SocialPost`/
 * `Author` rows for that domain are never touched.
 */
tenantOwnedFeedRouter.delete('/:id', async (req, res) => {
  const identity = requireTenantUserIdentity(req as RequestWithIdentity, res);
  if (!identity) return;

  if (identity.role !== 'tenant_admin') {
    res.status(403).json({ error: 'Only a tenant_admin may remove a tenant-owned feed.' });
    return;
  }

  const removed = await removeActivation(identity.tenantId, req.params.id);
  if (!removed) {
    res.status(404).json({ error: 'Activation not found.' });
    return;
  }

  res.json(serializeActivation(removed));
});
