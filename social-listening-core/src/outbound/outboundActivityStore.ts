import { withTenant } from '../db/withTenant';

export interface OutboundActivityInput {
  tenantId: string;
  postId: string;
  userId: string;
  providerId: string;
  credentialId: string;
  activityType: 'reply';
  body: string;
}

export interface OutboundActivityRow {
  id: string;
  tenantId: string;
  postId: string;
  userId: string;
  providerId: string;
  credentialId: string;
  activityType: 'reply';
  body: string;
  status: 'pending' | 'sent' | 'failed';
  externalId: string | null;
  externalUrl: string | null;
  errorCode: string | null;
  createdAt: string;
  sentAt: string | null;
  failedAt: string | null;
}

interface RawOutboundActivityRow {
  id: string;
  tenant_id: string;
  post_id: string;
  user_id: string;
  provider_id: string;
  credential_id: string;
  activity_type: 'reply';
  body: string;
  status: 'pending' | 'sent' | 'failed';
  external_id: string | null;
  external_url: string | null;
  error_code: string | null;
  created_at: Date;
  sent_at: Date | null;
  failed_at: Date | null;
}

function toCamel(row: RawOutboundActivityRow): OutboundActivityRow {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    postId: row.post_id,
    userId: row.user_id,
    providerId: row.provider_id,
    credentialId: row.credential_id,
    activityType: row.activity_type,
    body: row.body,
    status: row.status,
    externalId: row.external_id,
    externalUrl: row.external_url,
    errorCode: row.error_code,
    createdAt: row.created_at.toISOString(),
    sentAt: row.sent_at ? row.sent_at.toISOString() : null,
    failedAt: row.failed_at ? row.failed_at.toISOString() : null,
  };
}

/**
 * Story 3.14 (ADR-0073) — inserts a pending `outbound_activities` row for a
 * reply attempt. The REST endpoint updates it to `sent` or `failed` after the
 * connector call completes.
 */
export async function insertPending(input: OutboundActivityInput): Promise<OutboundActivityRow> {
  return withTenant(input.tenantId, async (client) => {
    const { rows } = await client.query<RawOutboundActivityRow>(
      `INSERT INTO outbound_activities
         (tenant_id, post_id, user_id, provider_id, credential_id, activity_type, body, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
       RETURNING *`,
      [input.tenantId, input.postId, input.userId, input.providerId, input.credentialId, input.activityType, input.body]
    );
    return toCamel(rows[0]);
  });
}

/**
 * Marks the row as `sent` with the platform's returned identifiers.
 */
export async function setSent(
  tenantId: string,
  id: string,
  externalId: string,
  externalUrl: string,
  sentAt: string
): Promise<OutboundActivityRow> {
  return withTenant(tenantId, async (client) => {
    const { rows } = await client.query<RawOutboundActivityRow>(
      `UPDATE outbound_activities
       SET status = 'sent', external_id = $2, external_url = $3, sent_at = $4
       WHERE id = $1
       RETURNING *`,
      [id, externalId, externalUrl, sentAt]
    );
    return toCamel(rows[0]);
  });
}

/**
 * Marks the row as `failed` with a normalized error code.
 */
export async function setFailed(
  tenantId: string,
  id: string,
  errorCode: string,
  failedAt: string
): Promise<OutboundActivityRow> {
  return withTenant(tenantId, async (client) => {
    const { rows } = await client.query<RawOutboundActivityRow>(
      `UPDATE outbound_activities
       SET status = 'failed', error_code = $2, failed_at = $3
       WHERE id = $1
       RETURNING *`,
      [id, errorCode, failedAt]
    );
    return toCamel(rows[0]);
  });
}

export interface ListForPostOptions {
  limit?: number;
}

const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 100;

/**
 * Lists `activity_type = 'reply'` rows for a single post, newest first.
 */
export async function listForPost(
  tenantId: string,
  postId: string,
  options: ListForPostOptions = {}
): Promise<OutboundActivityRow[]> {
  const requested = options.limit === undefined || isNaN(options.limit) || options.limit <= 0
    ? DEFAULT_LIST_LIMIT
    : options.limit;
  const limit = Math.min(requested, MAX_LIST_LIMIT);
  return withTenant(tenantId, async (client) => {
    const { rows } = await client.query<RawOutboundActivityRow>(
      `SELECT *
       FROM outbound_activities
       WHERE post_id = $1 AND activity_type = 'reply'
       ORDER BY created_at DESC
       LIMIT $2`,
      [postId, limit]
    );
    return rows.map(toCamel);
  });
}
