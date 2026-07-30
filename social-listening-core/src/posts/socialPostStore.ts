import { withTenant } from '../db/withTenant';
import { decodeCursor, encodeCursor } from './cursor';

export interface InsertSocialPostInput {
  tenantId: string;
  /** null only for author-less test fixtures — real ingestion always resolves one via upsertAuthor() first. */
  authorId: string | null;
  /** Required: every real post traces back to the IngestionRun that acquired it (ADR-0005). */
  acquisitionId: string;
  rawPayload: unknown;
  postGeoLocation?: unknown;
  /** When the post was actually published on-platform (Story 4.2, ADR-0008) — distinct from createdAt (when this system ingested it). Only set for enriched posts. */
  publishedAt?: string | Date;
  /** entities/keyPhrases (Story 4.2) plus later sentiment/detectedLanguage/modelUsed (Phase 2 enrichment pipeline) — additive keys in one JSONB blob, not separate columns. Only set for enriched posts. See .claude/skills/social-post-enrichment/SKILL.md. */
  enrichment?: Record<string, unknown>;
}

export interface InsertedSocialPost {
  id: string;
}

/**
 * The sanctioned way to insert a SocialPost — see
 * .claude/skills/social-post-lineage/SKILL.md. Never write to social_posts
 * directly outside this function.
 */
export async function insertSocialPost(input: InsertSocialPostInput): Promise<InsertedSocialPost> {
  return withTenant(input.tenantId, async (client) => {
    // acquisition_started_at is resolved via a subquery, not a new required
    // parameter — it's what social_posts' composite FK into partitioned
    // ingestion_runs(id, started_at) needs (Story 3.5, ADR-0018), but every
    // existing caller already only ever provides acquisitionId. See
    // .claude/skills/data-retention-and-archival/SKILL.md.
    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO social_posts (tenant_id, raw_payload, author_id, acquisition_id, acquisition_started_at, post_geo_location, published_at, enrichment)
       VALUES ($1, $2, $3, $4, (SELECT started_at FROM ingestion_runs WHERE id = $4), $5, $6, $7)
       RETURNING id`,
      [
        input.tenantId,
        JSON.stringify(input.rawPayload),
        input.authorId,
        input.acquisitionId,
        input.postGeoLocation ? JSON.stringify(input.postGeoLocation) : null,
        input.publishedAt ?? null,
        input.enrichment ? JSON.stringify(input.enrichment) : null,
      ]
    );
    return { id: rows[0].id };
  });
}

export interface SocialPostFull {
  id: string;
  createdAt: string;
  rawPayload: unknown;
  publishedAt: string | null;
  enrichment: unknown;
  authorId: string | null;
  acquisitionId: string;
  postGeoLocation: unknown;
}

/**
 * Fetches full post data by id, tenant-scoped (RLS) — the REST-fetch-on-demand
 * half of keeping Service Bus events thin (Story 5.1, ADR-0012). Returns null
 * for an unknown id or one belonging to another tenant. See
 * .claude/skills/ingestion-events/SKILL.md and
 * .claude/skills/posts-api/SKILL.md.
 */
export async function getSocialPostById(tenantId: string, id: string): Promise<SocialPostFull | null> {
  return withTenant(tenantId, async (client) => {
    const { rows } = await client.query<{
      id: string;
      created_at: Date;
      raw_payload: unknown;
      published_at: Date | null;
      enrichment: unknown;
      author_id: string | null;
      acquisition_id: string;
      post_geo_location: unknown;
    }>(
      `SELECT id, created_at, raw_payload, published_at, enrichment, author_id, acquisition_id, post_geo_location
       FROM social_posts WHERE id = $1`,
      [id]
    );
    if (rows.length === 0) return null;
    const row = rows[0];
    return {
      id: row.id,
      createdAt: row.created_at.toISOString(),
      rawPayload: row.raw_payload,
      publishedAt: row.published_at ? row.published_at.toISOString() : null,
      enrichment: row.enrichment,
      authorId: row.author_id,
      acquisitionId: row.acquisition_id,
      postGeoLocation: row.post_geo_location,
    };
  });
}

export interface PostIngestionLineage {
  connectorVersion: string;
  triggerType: string;
}

/** Resolves a post's originating run's connectorVersion/triggerType in a single JOIN query. */
export async function getIngestionRunForPost(
  tenantId: string,
  postId: string
): Promise<PostIngestionLineage | null> {
  return withTenant(tenantId, async (client) => {
    const { rows } = await client.query<{ connector_version: string; trigger_type: string }>(
      `SELECT ir.connector_version, ir.trigger_type
       FROM social_posts sp
       JOIN ingestion_runs ir ON sp.acquisition_id = ir.id
       WHERE sp.id = $1`,
      [postId]
    );
    if (rows.length === 0) return null;
    return { connectorVersion: rows[0].connector_version, triggerType: rows[0].trigger_type };
  });
}

export interface ListSocialPostsOptions {
  cursor?: string;
  limit?: number;
}

export interface SocialPostSummary {
  id: string;
  createdAt: string;
  rawPayload: unknown;
  publishedAt: string | null;
  enrichment: unknown;
}

export interface SocialPostsPage {
  posts: SocialPostSummary[];
  nextCursor: string | null;
}

const DEFAULT_PAGE_LIMIT = 20;
const MAX_PAGE_LIMIT = 100;

/**
 * Keyset (cursor-based) pagination over social_posts, ordered by the monotonic
 * `seq` identity column — a page near the end of the table costs about the
 * same as one near the start, unlike skip-N-rows pagination whose cost grows
 * with depth (ADR-0011). See .claude/skills/posts-api/SKILL.md.
 */
export async function listSocialPosts(
  tenantId: string,
  options: ListSocialPostsOptions = {}
): Promise<SocialPostsPage> {
  const limit = Math.min(options.limit ?? DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT);

  return withTenant(tenantId, async (client) => {
    const rows = options.cursor
      ? await queryAfterCursor(client, options.cursor, limit)
      : await queryFirstPage(client, limit);

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const last = page[page.length - 1];

    return {
      posts: page.map((row) => ({
        id: row.id,
        createdAt: row.created_at.toISOString(),
        rawPayload: row.raw_payload,
        publishedAt: row.published_at ? row.published_at.toISOString() : null,
        enrichment: row.enrichment,
      })),
      nextCursor: hasMore && last ? encodeCursor({ seq: last.seq }) : null,
    };
  });
}

interface PostRow {
  id: string;
  seq: string;
  created_at: Date;
  raw_payload: unknown;
  published_at: Date | null;
  enrichment: unknown;
}

async function queryFirstPage(
  client: { query: (sql: string, params: unknown[]) => Promise<{ rows: PostRow[] }> },
  limit: number
): Promise<PostRow[]> {
  const { rows } = await client.query(
    `SELECT id, seq, created_at, raw_payload, published_at, enrichment FROM social_posts
     ORDER BY seq ASC
     LIMIT $1`,
    [limit + 1]
  );
  return rows;
}

async function queryAfterCursor(
  client: { query: (sql: string, params: unknown[]) => Promise<{ rows: PostRow[] }> },
  cursorToken: string,
  limit: number
): Promise<PostRow[]> {
  const { seq } = decodeCursor(cursorToken);
  const { rows } = await client.query(
    `SELECT id, seq, created_at, raw_payload, published_at, enrichment FROM social_posts
     WHERE seq > $1
     ORDER BY seq ASC
     LIMIT $2`,
    [seq, limit + 1]
  );
  return rows;
}
