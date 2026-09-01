import { withTenant } from '../db/withTenant';
import type { ExtractedTopic } from '../connectors/types';

export interface TopicRow {
  id: string;
  tenant_id: string;
  name: string;
  slug: string;
  description: string | null;
  status: 'active' | 'merged' | 'hidden';
  merged_into_topic_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface PostTopicRow {
  post_id: string;
  topic_id: string;
  tenant_id: string;
  confidence: number;
  extracted_at: string;
}

export function slugifyTopicName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/**
 * Story 12.7 (ADR-0104 §1) — Finds existing topic by slug/name or creates a new one under tenant isolation.
 */
export async function findOrCreateTopic(
  tenantId: string,
  name: string,
  description?: string
): Promise<TopicRow> {
  const trimmedName = name.trim();
  const slug = slugifyTopicName(trimmedName);

  return withTenant(tenantId, async (client) => {
    const existing = await client.query(
      `SELECT id, tenant_id, name, slug, description, status, merged_into_topic_id, created_at, updated_at
       FROM topics
       WHERE slug = $1`,
      [slug]
    );

    if (existing.rows.length > 0) {
      return existing.rows[0];
    }

    const inserted = await client.query(
      `INSERT INTO topics (tenant_id, name, slug, description, status)
       VALUES ($1, $2, $3, $4, 'active')
       ON CONFLICT (tenant_id, slug) DO UPDATE SET updated_at = now()
       RETURNING id, tenant_id, name, slug, description, status, merged_into_topic_id, created_at, updated_at`,
      [tenantId, trimmedName, slug, description ?? null]
    );

    return inserted.rows[0];
  });
}

/**
 * Story 12.7 (ADR-0104 §4) — Retrieves topic by ID.
 */
export async function getTopicById(tenantId: string, id: string): Promise<TopicRow | null> {
  return withTenant(tenantId, async (client) => {
    const res = await client.query(
      `SELECT id, tenant_id, name, slug, description, status, merged_into_topic_id, created_at, updated_at
       FROM topics
       WHERE id = $1`,
      [id]
    );
    return res.rows[0] ?? null;
  });
}

/**
 * Story 12.7 (ADR-0104 §4) — Lists topics for tenant.
 */
export async function listTopics(
  tenantId: string,
  options?: {
    status?: 'active' | 'merged' | 'hidden' | 'all';
    search?: string;
  }
): Promise<TopicRow[]> {
  const statusFilter = options?.status ?? 'active';
  const search = options?.search?.trim();

  return withTenant(tenantId, async (client) => {
    let query = `SELECT id, tenant_id, name, slug, description, status, merged_into_topic_id, created_at, updated_at
                 FROM topics WHERE true`;
    const params: any[] = [];

    if (statusFilter !== 'all') {
      params.push(statusFilter);
      query += ` AND status = $${params.length}`;
    }

    if (search) {
      params.push(`%${search}%`);
      query += ` AND (name ILIKE $${params.length} OR description ILIKE $${params.length})`;
    }

    query += ` ORDER BY name ASC`;

    const res = await client.query(query, params);
    return res.rows;
  });
}

/**
 * Story 12.7 (ADR-0104 §4) — Renames topic and regenerates slug.
 */
export async function renameTopic(
  tenantId: string,
  id: string,
  newName: string
): Promise<TopicRow> {
  const trimmedName = newName.trim();
  const newSlug = slugifyTopicName(trimmedName);

  return withTenant(tenantId, async (client) => {
    const res = await client.query(
      `UPDATE topics
       SET name = $1, slug = $2, updated_at = now()
       WHERE id = $3
       RETURNING id, tenant_id, name, slug, description, status, merged_into_topic_id, created_at, updated_at`,
      [trimmedName, newSlug, id]
    );

    if (res.rows.length === 0) {
      throw new Error(`Topic with id '${id}' not found`);
    }

    return res.rows[0];
  });
}

/**
 * Story 12.7 (ADR-0104 §4) — Merges source topic into target topic.
 */
export async function mergeTopic(
  tenantId: string,
  sourceTopicId: string,
  targetTopicId: string
): Promise<TopicRow> {
  if (sourceTopicId === targetTopicId) {
    throw new Error('Cannot merge a topic into itself');
  }

  return withTenant(tenantId, async (client) => {
    // 1. Verify target topic exists
    const targetRes = await client.query(
      `SELECT id FROM topics WHERE id = $1`,
      [targetTopicId]
    );
    if (targetRes.rows.length === 0) {
      throw new Error(`Target topic '${targetTopicId}' not found`);
    }

    // 2. Reassign post_topics from source to target (avoiding primary key collisions)
    await client.query(
      `INSERT INTO post_topics (post_id, topic_id, tenant_id, confidence, extracted_at)
       SELECT pt.post_id, $1, pt.tenant_id, pt.confidence, pt.extracted_at
       FROM post_topics pt
       WHERE pt.topic_id = $2
       ON CONFLICT (post_id, topic_id) DO UPDATE
       SET confidence = GREATEST(post_topics.confidence, EXCLUDED.confidence)`,
      [targetTopicId, sourceTopicId]
    );

    // Delete old post_topics entries for source topic
    await client.query(
      `DELETE FROM post_topics WHERE topic_id = $1`,
      [sourceTopicId]
    );

    // 3. Mark source topic as merged
    const updated = await client.query(
      `UPDATE topics
       SET status = 'merged', merged_into_topic_id = $1, updated_at = now()
       WHERE id = $2
       RETURNING id, tenant_id, name, slug, description, status, merged_into_topic_id, created_at, updated_at`,
      [targetTopicId, sourceTopicId]
    );

    if (updated.rows.length === 0) {
      throw new Error(`Source topic '${sourceTopicId}' not found`);
    }

    return updated.rows[0];
  });
}

/**
 * Story 12.7 (ADR-0104 §4) — Hides topic from default listing.
 */
export async function hideTopic(tenantId: string, id: string): Promise<TopicRow> {
  return withTenant(tenantId, async (client) => {
    const res = await client.query(
      `UPDATE topics
       SET status = 'hidden', updated_at = now()
       WHERE id = $1
       RETURNING id, tenant_id, name, slug, description, status, merged_into_topic_id, created_at, updated_at`,
      [id]
    );

    if (res.rows.length === 0) {
      throw new Error(`Topic with id '${id}' not found`);
    }

    return res.rows[0];
  });
}

/**
 * Story 12.7 (ADR-0104 §2) — Attaches extracted topics to post in post_topics junction.
 */
export async function attachPostTopics(
  tenantId: string,
  postId: string,
  topics: ExtractedTopic[]
): Promise<PostTopicRow[]> {
  if (!topics || topics.length === 0) {
    return [];
  }

  const results: PostTopicRow[] = [];

  for (const topicItem of topics) {
    const topicRecord = await findOrCreateTopic(tenantId, topicItem.name);
    const attached = await withTenant(tenantId, async (client) => {
      const res = await client.query(
        `INSERT INTO post_topics (post_id, topic_id, tenant_id, confidence, extracted_at)
         VALUES ($1, $2, $3, $4, now())
         ON CONFLICT (post_id, topic_id) DO UPDATE
         SET confidence = EXCLUDED.confidence, extracted_at = now()
         RETURNING post_id, topic_id, tenant_id, confidence, extracted_at`,
        [postId, topicRecord.id, tenantId, topicItem.confidence ?? 1.0]
      );
      return res.rows[0];
    });
    results.push(attached);
  }

  return results;
}

/**
 * Story 12.7 (ADR-0104 §2) — Retrieves topics attached to a post.
 */
export async function getPostTopics(
  tenantId: string,
  postId: string
): Promise<Array<PostTopicRow & { topic_name: string; topic_slug: string }>> {
  return withTenant(tenantId, async (client) => {
    const res = await client.query(
      `SELECT pt.post_id, pt.topic_id, pt.tenant_id, pt.confidence, pt.extracted_at,
              t.name as topic_name, t.slug as topic_slug
       FROM post_topics pt
       JOIN topics t ON t.id = pt.topic_id
       WHERE pt.post_id = $1
       ORDER BY pt.confidence DESC`,
      [postId]
    );
    return res.rows;
  });
}
