import { withTenant } from '../../db/withTenant';
import { generateVerificationToken, buildTxtRecordHost, buildTxtRecordValue, TOKEN_TTL_MS } from './dnsVerification';

export interface TenantOwnedFeedActivationRow {
  id: string;
  tenant_id: string;
  domain: string;
  feed_url: string;
  verification_token: string;
  txt_record_host: string;
  status: 'pending' | 'verified' | 'expired';
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

/** Every verified, still-active activation for a tenant — what pollTenantOwnedFeed() actually polls. */
export async function getVerifiedActivations(tenantId: string): Promise<TenantOwnedFeedActivationRow[]> {
  return withTenant(tenantId, async (client) => {
    const { rows } = await client.query<TenantOwnedFeedActivationRow>(
      `SELECT * FROM tenant_owned_feed_activations WHERE status = 'verified'`
    );
    return rows;
  });
}

export function expectedTxtRecordValue(activation: TenantOwnedFeedActivationRow): string {
  return buildTxtRecordValue(activation.verification_token);
}
