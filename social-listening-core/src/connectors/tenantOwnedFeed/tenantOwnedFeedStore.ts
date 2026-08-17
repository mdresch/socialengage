import { withTenant } from '../../db/withTenant';
import { generateVerificationToken, buildTxtRecordHost, buildTxtRecordValue, TOKEN_TTL_MS } from './dnsVerification';

export interface TenantOwnedFeedActivationRow {
  id: string;
  tenant_id: string;
  domain: string;
  feed_url: string;
  verification_token: string;
  txt_record_host: string;
  /** Story 6.20 (ADR-0057) added 'removed' — a soft-removal state, never a deleted row. */
  status: 'pending' | 'verified' | 'expired' | 'removed';
  token_expires_at: Date;
  verified_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateActivationInput {
  domain: string;
  feedUrl: string;
}

/**
 * ADR-0050 Decision §3 — begins the connect flow: generates a unique
 * token, computes the TXT record instructions, and stores a `pending`
 * activation row. Never begins polling — that only happens once a
 * corresponding row reaches `status = 'verified'` (see
 * getVerifiedActivations() below).
 */
export async function createActivation(
  tenantId: string,
  input: CreateActivationInput
): Promise<TenantOwnedFeedActivationRow> {
  const token = generateVerificationToken();
  const txtRecordHost = buildTxtRecordHost(input.domain);
  const tokenExpiresAt = new Date(Date.now() + TOKEN_TTL_MS);

  return withTenant(tenantId, async (client) => {
    const { rows } = await client.query<TenantOwnedFeedActivationRow>(
      `INSERT INTO tenant_owned_feed_activations (
        tenant_id, domain, feed_url, verification_token, txt_record_host, token_expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [tenantId, input.domain, input.feedUrl, token, txtRecordHost, tokenExpiresAt]
    );
    return rows[0];
  });
}

export async function getActivation(tenantId: string, id: string): Promise<TenantOwnedFeedActivationRow | null> {
  return withTenant(tenantId, async (client) => {
    const { rows } = await client.query<TenantOwnedFeedActivationRow>(
      `SELECT * FROM tenant_owned_feed_activations WHERE id = $1`,
      [id]
    );
    return rows.length > 0 ? rows[0] : null;
  });
}

export async function markVerified(tenantId: string, id: string): Promise<TenantOwnedFeedActivationRow | null> {
  return withTenant(tenantId, async (client) => {
    const { rows } = await client.query<TenantOwnedFeedActivationRow>(
      `UPDATE tenant_owned_feed_activations SET status = 'verified', verified_at = now() WHERE id = $1 RETURNING *`,
      [id]
    );
    return rows.length > 0 ? rows[0] : null;
  });
}

/**
 * Every verified, still-active activation for a tenant — what
 * pollTenantOwnedFeed() actually polls. Story 6.20 (ADR-0057 Decision §5):
 * this is the ONLY function any poller/health/metrics consumer should ever
 * read from — listActivations() below is deliberately unfiltered (includes
 * 'removed'/'expired' rows for Admin UI history) and must never be used to
 * decide what's actually active.
 */
export async function getVerifiedActivations(tenantId: string): Promise<TenantOwnedFeedActivationRow[]> {
  return withTenant(tenantId, async (client) => {
    const { rows } = await client.query<TenantOwnedFeedActivationRow>(
      `SELECT * FROM tenant_owned_feed_activations WHERE status = 'verified'`
    );
    return rows;
  });
}

/**
 * Story 6.20 (ADR-0057 Decision §1a) — true when the tenant already holds a
 * verified activation for this exact domain. `connect()`'s own router
 * handler calls this before inserting a new row: domain ownership is a
 * property of the domain, not of any one feed URL beneath it, so a second
 * feed under an already-proven domain never needs a second DNS TXT cycle.
 */
export async function hasVerifiedDomain(tenantId: string, domain: string): Promise<boolean> {
  return withTenant(tenantId, async (client) => {
    const { rows } = await client.query(
      `SELECT 1 FROM tenant_owned_feed_activations WHERE status = 'verified' AND domain = $1 LIMIT 1`,
      [domain]
    );
    return rows.length > 0;
  });
}

/**
 * Story 6.20 (ADR-0057 Decision §5) — every activation for a tenant,
 * regardless of status ('pending'/'verified'/'expired'/'removed'). Backs
 * the Admin UI's list screen, which needs to show history too, not just
 * what's currently active. Never use this to decide what to poll or count
 * as active — that's getVerifiedActivations()'s job, always.
 */
export async function listActivations(tenantId: string): Promise<TenantOwnedFeedActivationRow[]> {
  return withTenant(tenantId, async (client) => {
    const { rows } = await client.query<TenantOwnedFeedActivationRow>(
      `SELECT * FROM tenant_owned_feed_activations ORDER BY created_at DESC`
    );
    return rows;
  });
}

/**
 * Story 6.20 (ADR-0057 Decision §1) — updates feedUrl only; domain is never
 * accepted here (the router rejects a request containing it before this is
 * ever called) since it's the exact claim DNS TXT verification proves.
 * Works regardless of the activation's current status.
 */
export async function updateFeedUrl(tenantId: string, id: string, feedUrl: string): Promise<TenantOwnedFeedActivationRow | null> {
  return withTenant(tenantId, async (client) => {
    const { rows } = await client.query<TenantOwnedFeedActivationRow>(
      `UPDATE tenant_owned_feed_activations SET feed_url = $1 WHERE id = $2 RETURNING *`,
      [feedUrl, id]
    );
    return rows.length > 0 ? rows[0] : null;
  });
}

/**
 * Story 6.20 (ADR-0057 Decision §1) — soft removal: transitions status to
 * 'removed', never a hard SQL DELETE (no DELETE grant exists on this
 * table, and a hard delete would erase the domain-verification audit
 * trail). getVerifiedActivations() already filters on status = 'verified',
 * so a removed row stops being polled with zero poller change.
 */
export async function removeActivation(tenantId: string, id: string): Promise<TenantOwnedFeedActivationRow | null> {
  return withTenant(tenantId, async (client) => {
    const { rows } = await client.query<TenantOwnedFeedActivationRow>(
      `UPDATE tenant_owned_feed_activations SET status = 'removed' WHERE id = $1 RETURNING *`,
      [id]
    );
    return rows.length > 0 ? rows[0] : null;
  });
}

export function expectedTxtRecordValue(activation: TenantOwnedFeedActivationRow): string {
  return buildTxtRecordValue(activation.verification_token);
}
