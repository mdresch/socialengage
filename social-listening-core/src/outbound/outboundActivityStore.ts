import { withTenant } from '../db/withTenant';

export interface OutboundActivityInput {
  tenantId: string;
  postId?: string | null;
  userId: string;
  providerId: string;
  credentialId: string;
  activityType: 'reply' | 'post';
  targetAssetId?: string | null;
  targetAssetType?: string | null;
  body: string;
  payload?: Record<string, unknown> | null;
  scheduledFor?: string | null;
}

export interface OutboundActivityRow {
  id: string;
  tenantId: string;
  postId: string | null;
  userId: string;
  providerId: string;
  credentialId: string;
  activityType: 'reply' | 'post';
  targetAssetId: string | null;
  targetAssetType: string | null;
  body: string;
  payload: Record<string, unknown> | null;
  status: 'pending' | 'sent' | 'failed' | 'cancelled';
  externalId: string | null;
  externalUrl: string | null;
  errorCode: string | null;
  scheduledFor: string | null;
  createdAt: string;
  sentAt: string | null;
  failedAt: string | null;
  cancelledAt: string | null;
}

interface RawOutboundActivityRow {
  id: string;
  tenant_id: string;
  post_id: string | null;
  user_id: string;
  provider_id: string;
  credential_id: string;
  activity_type: 'reply' | 'post';
  target_asset_id: string | null;
  target_asset_type: string | null;
  body: string;
  payload: Record<string, unknown> | null;
  status: 'pending' | 'sent' | 'failed' | 'cancelled';
  external_id: string | null;
  external_url: string | null;
  error_code: string | null;
  scheduled_for: Date | null;
  created_at: Date;
  sent_at: Date | null;
  failed_at: Date | null;
  cancelled_at: Date | null;
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
    targetAssetId: row.target_asset_id,
    targetAssetType: row.target_asset_type,
    body: row.body,
    payload: row.payload,
    status: row.status,
    externalId: row.external_id,
    externalUrl: row.external_url,
    errorCode: row.error_code,
    scheduledFor: row.scheduled_for ? row.scheduled_for.toISOString() : null,
    createdAt: row.created_at.toISOString(),
    sentAt: row.sent_at ? row.sent_at.toISOString() : null,
    failedAt: row.failed_at ? row.failed_at.toISOString() : null,
    cancelledAt: row.cancelled_at ? row.cancelled_at.toISOString() : null,
  };
}

/**
 * Story 3.14/3.15 (ADR-0073/0075) — inserts a pending `outbound_activities` row
 * for an outbound attempt (reply or post). The REST endpoint updates it to
 * `sent`, `failed`, or `cancelled` after validation or the connector call.
 */
export async function insertPending(input: OutboundActivityInput): Promise<OutboundActivityRow> {
  return withTenant(input.tenantId, async (client) => {
    const { rows } = await client.query<RawOutboundActivityRow>(
      `INSERT INTO outbound_activities
         (tenant_id, post_id, user_id, provider_id, credential_id, activity_type,
          target_asset_id, target_asset_type, body, payload, scheduled_for, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'pending')
       RETURNING *`,
      [
        input.tenantId,
        input.postId ?? null,
        input.userId,
        input.providerId,
        input.credentialId,
        input.activityType,
        input.targetAssetId ?? null,
        input.targetAssetType ?? null,
        input.body,
        input.payload ?? null,
        input.scheduledFor ? new Date(input.scheduledFor) : null,
      ]
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

/**
 * Fetches one row by id, or null if it is not visible to the tenant (RLS).
 */
export async function getById(tenantId: string, id: string): Promise<OutboundActivityRow | null> {
  return withTenant(tenantId, async (client) => {
    const { rows } = await client.query<RawOutboundActivityRow>(
      `SELECT * FROM outbound_activities WHERE id = $1`,
      [id]
    );
    return rows.length > 0 ? toCamel(rows[0]) : null;
  });
}

/**
 * Marks a pending row as `cancelled` and sets `cancelled_at = NOW()`.
 * Callers must first verify the row exists, belongs to the tenant, is still
 * `pending`, and has not already passed its scheduled time.
 */
export async function cancel(tenantId: string, id: string): Promise<OutboundActivityRow | null> {
  return withTenant(tenantId, async (client) => {
    const { rows } = await client.query<RawOutboundActivityRow>(
      `UPDATE outbound_activities
       SET status = 'cancelled', cancelled_at = NOW()
       WHERE id = $1 AND status = 'pending'
       RETURNING *`,
      [id]
    );
    return rows.length > 0 ? toCamel(rows[0]) : null;
  });
}

export interface ListPostsOptions {
  status?: string;
  providerId?: string;
  limit?: number;
}

const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 100;

/**
 * Lists `activity_type = 'post'` rows for a tenant, newest first.
 */
export async function listPosts(
  tenantId: string,
  options: ListPostsOptions = {}
): Promise<OutboundActivityRow[]> {
  const requested =
    options.limit === undefined || isNaN(options.limit) || options.limit <= 0
      ? DEFAULT_LIST_LIMIT
      : options.limit;
  const limit = Math.min(requested, MAX_LIST_LIMIT);

  const conditions: string[] = ['activity_type = $1'];
  const params: (string | number)[] = ['post', limit];
  if (options.status) {
    conditions.push(`status = $${params.length + 1}`);
    params.push(options.status);
  }
  if (options.providerId) {
    conditions.push(`provider_id = $${params.length + 1}`);
    params.push(options.providerId);
  }

  return withTenant(tenantId, async (client) => {
    const { rows } = await client.query<RawOutboundActivityRow>(
      `SELECT *
       FROM outbound_activities
       WHERE ${conditions.join(' AND ')}
       ORDER BY created_at DESC
       LIMIT $2`,
      params
    );
    return rows.map(toCamel);
  });
}

export interface ListForPostOptions {
  limit?: number;
}

/**
 * Lists `activity_type = 'reply'` rows for a single post, newest first.
 */
export async function listForPost(
  tenantId: string,
  postId: string,
  options: ListForPostOptions = {}
): Promise<OutboundActivityRow[]> {
  const requested =
    options.limit === undefined || isNaN(options.limit) || options.limit <= 0
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
