import { Router } from 'express';
import { requireTenantUser } from '../../auth/requireTenantUser';
import { createActivation, getActivation, markVerified, expectedTxtRecordValue } from '../../../connectors/tenantOwnedFeed/tenantOwnedFeedStore';
import { checkTxtRecord } from '../../../connectors/tenantOwnedFeed/dnsVerification';

export const tenantOwnedFeedRouter = Router();

/**
 * POST /v1/connectors/tenant-owned-feed/connect (ADR-0050 Decision §3).
 * Accepts `{ domain, feedUrl }`, generates a unique verification token, and
 * returns TXT record instructions. Never begins polling — this route only
 * creates a `pending` activation row; see verify-domain below and
 * pollTenantOwnedFeed.ts's own doc comment for why polling can never reach
 * an unverified activation. `feedUrl` must be supplied explicitly — no
 * autodiscovery step (ADR-0050's own v1 scope decision).
 */
tenantOwnedFeedRouter.post('/connect', async (req, res) => {
  const tenantId = requireTenantUser(req, res);
  if (!tenantId) return;

  const { domain, feedUrl } = req.body ?? {};
  if (!domain || typeof domain !== 'string') {
    res.status(400).json({ error: 'domain is required.' });
    return;
  }
  if (!feedUrl || typeof feedUrl !== 'string') {
    res.status(400).json({ error: 'feedUrl is required.' });
    return;
  }

  const activation = await createActivation(tenantId, { domain, feedUrl });
  res.status(201).json({
    connectorActivationId: activation.id,
    txtRecordHost: activation.txt_record_host,
    txtRecordValue: expectedTxtRecordValue(activation),
    expiresAt: activation.token_expires_at.toISOString(),
    feedUrl: activation.feed_url,
  });
});

/**
 * POST /v1/connectors/tenant-owned-feed/verify-domain (ADR-0050 Decision
 * §3). Looks up the TXT record at the activation's own designated host and
 * marks it verified only when the token matches. A missing or mismatched
 * record is a `pending`/retryable response, never a hard failure — DNS
 * propagation can take up to 72 hours and is outside the tenant's control
 * once the record is published.
 */
tenantOwnedFeedRouter.post('/verify-domain', async (req, res) => {
  const tenantId = requireTenantUser(req, res);
  if (!tenantId) return;

  const { connectorActivationId } = req.body ?? {};
  if (!connectorActivationId || typeof connectorActivationId !== 'string') {
    res.status(400).json({ error: 'connectorActivationId is required.' });
    return;
  }

  const activation = await getActivation(tenantId, connectorActivationId);
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

  const verified = await markVerified(tenantId, activation.id);
  res.json({ status: 'verified', connectorActivationId: verified!.id });
});
