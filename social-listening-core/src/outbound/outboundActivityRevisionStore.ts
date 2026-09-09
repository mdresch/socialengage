import { withTenant } from '../db/withTenant';

export type RevisionType = 'edit' | 'delete';
export type RevisionStatus = 'pending' | 'applied' | 'failed' | 'cancelled';

export interface OutboundActivityRevisionInput {
  tenantId: string;
  activityId: string;
  userId: string;
  revisionType: RevisionType;
  body?: string | null;
  payload?: Record<string, unknown> | null;
  status?: RevisionStatus;
  externalId?: string | null;
  externalUrl?: string | null;
  errorCode?: string | null;
}

export interface OutboundActivityRevisionRow {
  id: string;
  tenantId: string;
  activityId: string;
  userId: string;
  revisionType: RevisionType;
  body: string | null;
  payload: Record<string, unknown> | null;
  status: RevisionStatus;
  errorCode: string | null;
  externalId: string | null;
  externalUrl: string | null;
  createdAt: string;
}

interface RawOutboundActivityRevisionRow {
  id: string;
  tenant_id: string;
  activity_id: string;
  user_id: string;
  revision_type: RevisionType;
  body: string | null;
  payload: Record<string, unknown> | null;
  status: RevisionStatus;
  error_code: string | null;
  external_id: string | null;
  external_url: string | null;
  created_at: Date;
}

function toCamel(row: RawOutboundActivityRevisionRow): OutboundActivityRevisionRow {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    activityId: row.activity_id,
    userId: row.user_id,
    revisionType: row.revision_type,
    body: row.body,
    payload: row.payload,
    status: row.status,
    errorCode: row.error_code,
    externalId: row.external_id,
    externalUrl: row.external_url,
    createdAt: row.created_at.toISOString(),
  };
}

/**
 * Story 14.2 (ADR-0119) — inserts a new revision row for an edit or delete operation.
 */
export async function createRevision(
  input: OutboundActivityRevisionInput
): Promise<OutboundActivityRevisionRow> {
  return withTenant(input.tenantId, async (client) => {
    const { rows } = await client.query<RawOutboundActivityRevisionRow>(
      `INSERT INTO outbound_activity_revisions
         (tenant_id, activity_id, user_id, revision_type, body, payload, status, error_code, external_id, external_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        input.tenantId,
        input.activityId,
        input.userId,
        input.revisionType,
        input.body ?? null,
        input.payload ? JSON.stringify(input.payload) : null,
        input.status ?? 'pending',
        input.errorCode ?? null,
        input.externalId ?? null,
        input.externalUrl ?? null,
      ]
    );
    return toCamel(rows[0]);
  });
}

/**
 * Story 14.2 (ADR-0119) — marks a revision as 'applied' with optional external id / url.
 */
export async function setRevisionApplied(
  tenantId: string,
  revisionId: string,
  externalId?: string | null,
  externalUrl?: string | null
): Promise<OutboundActivityRevisionRow | null> {
  return withTenant(tenantId, async (client) => {
    const { rows } = await client.query<RawOutboundActivityRevisionRow>(
      `UPDATE outbound_activity_revisions
       SET status = 'applied',
           external_id = COALESCE($2, external_id),
           external_url = COALESCE($3, external_url),
           error_code = NULL
       WHERE id = $1
       RETURNING *`,
      [revisionId, externalId ?? null, externalUrl ?? null]
    );
    return rows.length > 0 ? toCamel(rows[0]) : null;
  });
}

/**
 * Story 14.2 (ADR-0119) — marks a revision as 'failed' with a normalized error code.
 */
export async function setRevisionFailed(
  tenantId: string,
  revisionId: string,
  errorCode: string
): Promise<OutboundActivityRevisionRow | null> {
  return withTenant(tenantId, async (client) => {
    const { rows } = await client.query<RawOutboundActivityRevisionRow>(
      `UPDATE outbound_activity_revisions
       SET status = 'failed',
           error_code = $2
       WHERE id = $1
       RETURNING *`,
      [revisionId, errorCode]
    );
    return rows.length > 0 ? toCamel(rows[0]) : null;
  });
}

/**
 * Story 14.2 (ADR-0119) — marks a revision as 'cancelled'.
 */
export async function setRevisionCancelled(
  tenantId: string,
  revisionId: string
): Promise<OutboundActivityRevisionRow | null> {
  return withTenant(tenantId, async (client) => {
    const { rows } = await client.query<RawOutboundActivityRevisionRow>(
      `UPDATE outbound_activity_revisions
       SET status = 'cancelled'
       WHERE id = $1
       RETURNING *`,
      [revisionId]
    );
    return rows.length > 0 ? toCamel(rows[0]) : null;
  });
}

/**
 * Story 14.2 (ADR-0119) — lists all edits and deletes for an activity in created_at DESC order.
 */
export async function listRevisionsForActivity(
  tenantId: string,
  activityId: string
): Promise<OutboundActivityRevisionRow[]> {
  return withTenant(tenantId, async (client) => {
    const { rows } = await client.query<RawOutboundActivityRevisionRow>(
      `SELECT *
       FROM outbound_activity_revisions
       WHERE activity_id = $1
       ORDER BY created_at DESC`,
      [activityId]
    );
    return rows.map(toCamel);
  });
}

/**
 * Story 14.2 (ADR-0119) — gets the latest non-failed 'edit' revision (applied),
 * which is the source of truth for post content.
 */
export async function getLatestAppliedEditRevision(
  tenantId: string,
  activityId: string
): Promise<OutboundActivityRevisionRow | null> {
  return withTenant(tenantId, async (client) => {
    const { rows } = await client.query<RawOutboundActivityRevisionRow>(
      `SELECT *
       FROM outbound_activity_revisions
       WHERE activity_id = $1 AND revision_type = 'edit' AND status = 'applied'
       ORDER BY created_at DESC
       LIMIT 1`,
      [activityId]
    );
    return rows.length > 0 ? toCamel(rows[0]) : null;
  });
}
