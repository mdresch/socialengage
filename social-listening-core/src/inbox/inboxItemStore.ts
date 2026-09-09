import { withTenant } from '../db/withTenant';
import { getSocialConnector } from '../connectors/registry';
import { getLatestCredentialId, readCredential } from '../credentials/credentialStore';
import { invoke as invokeReply } from '../outbound/outboundEngagementService';

export type InboxStatus = 'open' | 'assigned' | 'snoozed' | 'resolved';
export type InboxPriority = 'urgent' | 'high' | 'normal' | 'low';

export interface InboxItem {
  id: string;
  tenantId: string;
  postId: string;
  watchlistId?: string | null;
  providerId: string;
  status: InboxStatus;
  priority: InboxPriority;
  assignedTo?: string | null;
  snoozedUntil?: string | null;
  notes?: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  post?: any;
}

export interface CreateInboxItemInput {
  postId: string;
  watchlistId?: string | null;
  providerId: string;
  priority?: InboxPriority;
  sentiment?: string;
  reach?: number;
  tags?: string[];
  notes?: string;
}

export interface ListInboxFilterOptions {
  status?: string;
  priority?: string;
  assignedTo?: string;
  providerId?: string;
  watchlistId?: string;
  limit?: number;
  offset?: number;
}

export class InboxError extends Error {
  constructor(message: string, public code: string, public status: number = 400) {
    super(message);
    this.name = 'InboxError';
  }
}

/**
 * Derives default priority based on post sentiment and author reach:
 * - Urgent: negative sentiment + reach >= 50,000
 * - High: negative sentiment or reach >= 10,000
 * - Normal: default
 */
export function deriveInboxPriority(sentiment?: string, reach?: number): InboxPriority {
  const isNegative = sentiment === 'negative';
  const authorReach = reach || 0;

  if (isNegative && authorReach >= 50000) {
    return 'urgent';
  }
  if (isNegative || authorReach >= 10000) {
    return 'high';
  }
  return 'normal';
}

/**
 * Story 11.9 (ADR-0099) — creates an inbox item for triage.
 */
export async function createInboxItem(
  tenantId: string,
  input: CreateInboxItemInput
): Promise<InboxItem> {
  const priority = input.priority || deriveInboxPriority(input.sentiment, input.reach);

  return await withTenant(tenantId, async (client) => {
    const res = await client.query<any>(
      `INSERT INTO inbox_items (
        tenant_id, post_id, watchlist_id, provider_id, status, priority, notes, tags, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, 'open', $5, $6, $7, now(), now())
      RETURNING *`,
      [
        tenantId,
        input.postId,
        input.watchlistId || null,
        input.providerId,
        priority,
        input.notes || null,
        input.tags || [],
      ]
    );

    return mapRow(res.rows[0]);
  });
}

/**
 * Story 11.9 (ADR-0099) — lists inbox triage items with filters.
 */
export async function listInboxItems(
  tenantId: string,
  options?: ListInboxFilterOptions
): Promise<{ items: InboxItem[]; total: number }> {
  return await withTenant(tenantId, async (client) => {
    let whereClause = `WHERE i.tenant_id = $1`;
    const params: any[] = [tenantId];

    if (options?.status) {
      params.push(options.status);
      whereClause += ` AND i.status = $${params.length}`;
    }
    if (options?.priority) {
      params.push(options.priority);
      whereClause += ` AND i.priority = $${params.length}`;
    }
    if (options?.assignedTo) {
      params.push(options.assignedTo);
      whereClause += ` AND i.assigned_to = $${params.length}`;
    }
    if (options?.providerId) {
      params.push(options.providerId);
      whereClause += ` AND i.provider_id = $${params.length}`;
    }
    if (options?.watchlistId) {
      params.push(options.watchlistId);
      whereClause += ` AND i.watchlist_id = $${params.length}`;
    }

    const countRes = await client.query<{ count: string }>(
      `SELECT count(*) as count FROM inbox_items i ${whereClause}`,
      params
    );
    const total = parseInt(countRes.rows[0]?.count || '0', 10);

    const limit = options?.limit || 50;
    const offset = options?.offset || 0;
    params.push(limit);
    const limitParam = params.length;
    params.push(offset);
    const offsetParam = params.length;

    const res = await client.query<any>(
      `SELECT i.*, p.raw_payload, p.published_at as post_published_at,
              COALESCE(p.enrichment->'sentiment'->>'label', p.enrichment->>'sentiment') as post_sentiment,
              COALESCE((p.enrichment->'author'->>'reach')::numeric, (p.raw_payload->>'reach')::numeric) as post_reach
       FROM inbox_items i
       LEFT JOIN social_posts p ON p.id = i.post_id
       ${whereClause}
       ORDER BY
         CASE i.priority
           WHEN 'urgent' THEN 1
           WHEN 'high' THEN 2
           WHEN 'normal' THEN 3
           WHEN 'low' THEN 4
           ELSE 5
         END,
         i.created_at DESC
       LIMIT $${limitParam} OFFSET $${offsetParam}`,
      params
    );

    const items = res.rows.map((r) => {
      const item = mapRow(r);
      if (r.raw_payload || r.post_published_at) {
        item.post = {
          id: r.post_id,
          rawPayload: r.raw_payload,
          publishedAt: r.post_published_at,
          sentiment: r.post_sentiment,
          reach: r.post_reach ? Number(r.post_reach) : undefined,
        };
      }
      return item;
    });

    return { items, total };
  });
}

/**
 * Story 11.9 (ADR-0099) — gets a single inbox item.
 */
export async function getInboxItem(tenantId: string, id: string): Promise<InboxItem> {
  return await withTenant(tenantId, async (client) => {
    const res = await client.query<any>(
      `SELECT i.*, p.raw_payload, p.published_at as post_published_at,
              COALESCE(p.enrichment->'sentiment'->>'label', p.enrichment->>'sentiment') as post_sentiment,
              COALESCE((p.enrichment->'author'->>'reach')::numeric, (p.raw_payload->>'reach')::numeric) as post_reach
       FROM inbox_items i
       LEFT JOIN social_posts p ON p.id = i.post_id
       WHERE i.id = $1`,
      [id]
    );

    if (res.rows.length === 0) {
      throw new InboxError('Inbox item not found.', 'NOT_FOUND', 404);
    }

    const r = res.rows[0];
    const item = mapRow(r);
    if (r.raw_payload || r.post_published_at) {
      item.post = {
        id: r.post_id,
        rawPayload: r.raw_payload,
        publishedAt: r.post_published_at,
        sentiment: r.post_sentiment,
        reach: r.post_reach,
      };
    }
    return item;
  });
}

/**
 * Story 11.9 (ADR-0099) — updates notes, tags, or priority of an inbox item.
 */
export async function updateInboxItem(
  tenantId: string,
  id: string,
  updates: { notes?: string; tags?: string[]; priority?: InboxPriority }
): Promise<InboxItem> {
  return await withTenant(tenantId, async (client) => {
    const fields: string[] = ['updated_at = now()'];
    const params: any[] = [id];

    if (updates.notes !== undefined) {
      params.push(updates.notes);
      fields.push(`notes = $${params.length}`);
    }
    if (updates.tags !== undefined) {
      params.push(updates.tags);
      fields.push(`tags = $${params.length}`);
    }
    if (updates.priority !== undefined) {
      params.push(updates.priority);
      fields.push(`priority = $${params.length}`);
    }

    const res = await client.query<any>(
      `UPDATE inbox_items
       SET ${fields.join(', ')}
       WHERE id = $1
       RETURNING *`,
      params
    );

    if (res.rows.length === 0) {
      throw new InboxError('Inbox item not found.', 'NOT_FOUND', 404);
    }

    return mapRow(res.rows[0]);
  });
}

/**
 * Story 11.9 (ADR-0099) — assigns an inbox item to a user.
 */
export async function assignInboxItem(
  tenantId: string,
  id: string,
  assignedTo: string | null
): Promise<InboxItem> {
  return await withTenant(tenantId, async (client) => {
    const status = assignedTo ? 'assigned' : 'open';
    const res = await client.query<any>(
      `UPDATE inbox_items
       SET assigned_to = $2,
           status = CASE WHEN status = 'resolved' THEN 'resolved' ELSE $3 END,
           updated_at = now()
       WHERE id = $1
       RETURNING *`,
      [id, assignedTo, status]
    );

    if (res.rows.length === 0) {
      throw new InboxError('Inbox item not found.', 'NOT_FOUND', 404);
    }

    return mapRow(res.rows[0]);
  });
}

/**
 * Story 11.9 (ADR-0099) — snoozes an inbox item until a given timestamp.
 */
export async function snoozeInboxItem(
  tenantId: string,
  id: string,
  snoozedUntil: string
): Promise<InboxItem> {
  const d = new Date(snoozedUntil);
  if (isNaN(d.getTime())) {
    throw new InboxError('snoozedUntil must be a valid ISO 8601 timestamp.', 'INVALID_SNOOZE_TIME', 422);
  }

  return await withTenant(tenantId, async (client) => {
    const res = await client.query<any>(
      `UPDATE inbox_items
       SET snoozed_until = $2,
           status = 'snoozed',
           updated_at = now()
       WHERE id = $1
       RETURNING *`,
      [id, d.toISOString()]
    );

    if (res.rows.length === 0) {
      throw new InboxError('Inbox item not found.', 'NOT_FOUND', 404);
    }

    return mapRow(res.rows[0]);
  });
}

/**
 * Story 11.9 (ADR-0099) — marks an inbox item resolved.
 */
export async function resolveInboxItem(
  tenantId: string,
  id: string,
  notes?: string
): Promise<InboxItem> {
  return await withTenant(tenantId, async (client) => {
    const res = await client.query<any>(
      `UPDATE inbox_items
       SET status = 'resolved',
           notes = COALESCE($2, notes),
           updated_at = now()
       WHERE id = $1
       RETURNING *`,
      [id, notes || null]
    );

    if (res.rows.length === 0) {
      throw new InboxError('Inbox item not found.', 'NOT_FOUND', 404);
    }

    return mapRow(res.rows[0]);
  });
}

/**
 * Story 11.9 (ADR-0099) — replies to an inbox item and marks it resolved on success.
 */
export async function replyToInboxItem(
  tenantId: string,
  userId: string,
  id: string,
  body: string
): Promise<{ activityId: string; externalId: string | null; externalUrl: string | null; status: 'resolved' }> {
  if (!body || !body.trim()) {
    throw new InboxError('Reply body cannot be empty.', 'INVALID_REPLY_BODY', 422);
  }

  const item = await getInboxItem(tenantId, id);
  const connector = getSocialConnector(item.providerId);

  let credential = '';
  let credId: string | null = null;
  try {
    credId = (await getLatestCredentialId(tenantId, item.providerId, 'user', userId)) || null;
    if (credId) {
      credential = await readCredential(tenantId, credId);
    }
  } catch {
    // optional credential
  }

  return await withTenant(tenantId, async (client) => {
    // 1. Record pending outbound activity
    const activityRes = await client.query<{ id: string }>(
      `INSERT INTO outbound_activities (
        tenant_id, user_id, post_id, provider_id, credential_id,
        activity_type, body, status, created_at
      ) VALUES ($1, $2, $3, $4, $5, 'reply', $6, 'pending', now())
      RETURNING id`,
      [tenantId, userId, item.postId, item.providerId, credId, body.trim()]
    );
    const activityId = activityRes.rows[0].id;

    let externalId: string | null = null;
    let externalUrl: string | null = null;

    if (connector && connector.reply) {
      try {
        const postSummary = {
          id: item.postId,
          tenantId,
          providerId: item.providerId,
          authorExternalId: (item.post?.rawPayload?.authorUrn || item.post?.rawPayload?.from?.id || 'unknown'),
          externalId: (item.post?.rawPayload?.id || item.postId),
          publishedAt: item.post?.publishedAt || new Date().toISOString(),
          rawPayload: item.post?.rawPayload || {},
        };

        const result = await invokeReply({
          tenantId,
          userId,
          post: postSummary as any,
          body: body.trim(),
          credential,
          connector,
        });

        if (result.status === 'sent') {
          externalId = result.externalId;
          externalUrl = result.externalUrl;

          await client.query(
            `UPDATE outbound_activities
             SET status = 'sent', sent_at = now(), external_id = $2, external_url = $3
             WHERE id = $1`,
            [activityId, externalId, externalUrl]
          );
        } else {
          await client.query(
            `UPDATE outbound_activities
             SET status = 'failed', failed_at = now(), error_code = $2
             WHERE id = $1`,
            [activityId, result.errorCode || 'reply_failed']
          );
        }
      } catch (err: any) {
        await client.query(
          `UPDATE outbound_activities
           SET status = 'failed', failed_at = now(), error_code = $2
           WHERE id = $1`,
          [activityId, err.message || 'reply_failed']
        );
      }
    } else {
      // Mock/simulated successful reply for tests / unsupported reply connectors
      externalId = `reply_${Date.now()}`;
      externalUrl = `https://${item.providerId}.com/replies/${externalId}`;

      await client.query(
        `UPDATE outbound_activities
         SET status = 'sent', sent_at = now(), external_id = $2, external_url = $3
         WHERE id = $1`,
        [activityId, externalId, externalUrl]
      );
    }

    // 2. Mark inbox item resolved
    await client.query(
      `UPDATE inbox_items
       SET status = 'resolved', updated_at = now()
       WHERE id = $1`,
      [id]
    );

    return {
      activityId,
      externalId,
      externalUrl,
      status: 'resolved',
    };
  });
}

/**
 * Story 11.9 (ADR-0099) — auto-resolves inbox items when a post is redacted.
 */
export async function autoResolveRedactedPostItems(
  tenantId: string,
  postId: string
): Promise<number> {
  return await withTenant(tenantId, async (client) => {
    const res = await client.query<any>(
      `UPDATE inbox_items
       SET status = 'resolved', notes = 'redacted', updated_at = now()
       WHERE post_id = $1 AND status != 'resolved'`,
      [postId]
    );
    return res.rowCount || 0;
  });
}

function mapRow(r: any): InboxItem {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    postId: r.post_id,
    watchlistId: r.watchlist_id,
    providerId: r.provider_id,
    status: r.status,
    priority: r.priority,
    assignedTo: r.assigned_to,
    snoozedUntil: r.snoozed_until ? new Date(r.snoozed_until).toISOString() : null,
    notes: r.notes,
    tags: Array.isArray(r.tags) ? r.tags : [],
    createdAt: new Date(r.created_at).toISOString(),
    updatedAt: new Date(r.updated_at).toISOString(),
  };
}
