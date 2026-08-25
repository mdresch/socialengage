import { withTenant } from '../db/withTenant';
import { decodeCursor, encodeCursor } from './cursor';
import { rowsToCsv } from './csvExport';

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
  /**
   * Story 3.9 (ADR-0049): a point-in-time snapshot, set once at insert and
   * never updated afterward — storage-layer only, deliberately not
   * surfaced on SocialPostFull/SocialPostSummary below (ADR-0049's own "no
   * API surface change is mandated" clause). Omit entirely (not `null`) for
   * a connector that doesn't report it — the column stays NULL either way,
   * but omission is what proves a caller genuinely never touched this
   * field, not that it deliberately chose "no value."
   */
  authorFollowerCountAtPublish?: number;
  /**
   * Story 3.10 (ADR-0053): computed once at ingestion by the shared
   * htmlToMarkdown() utility, never a follow-up UPDATE — same
   * enrichment-shaped precedent as `enrichment` above. NULL exactly
   * together with bodyMarkdownVersion, never independently — see
   * .claude/skills/canonical-markdown-conversion/SKILL.md.
   */
  bodyMarkdown?: string;
  /** Story 3.10 (ADR-0053): which htmlToMarkdown() pipeline ruleset produced bodyMarkdown. NULL exactly when bodyMarkdown is NULL. */
  bodyMarkdownVersion?: number;
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
      `INSERT INTO social_posts (tenant_id, raw_payload, author_id, acquisition_id, acquisition_started_at, post_geo_location, published_at, enrichment, author_follower_count_at_publish, body_markdown, body_markdown_version)
       VALUES ($1, $2, $3, $4, (SELECT started_at FROM ingestion_runs WHERE id = $4), $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [
        input.tenantId,
        JSON.stringify(input.rawPayload),
        input.authorId,
        input.acquisitionId,
        input.postGeoLocation ? JSON.stringify(input.postGeoLocation) : null,
        input.publishedAt ?? null,
        input.enrichment ? JSON.stringify(input.enrichment) : null,
        input.authorFollowerCountAtPublish ?? null,
        input.bodyMarkdown ?? null,
        input.bodyMarkdownVersion ?? null,
      ]
    );
    return { id: rows[0].id };
  });
}

/**
 * Dedup lookup for poll-mode connectors (Story 2.6): finds a previously
 * ingested post by the (providerId, externalId) a connector's own attempt()
 * embeds into rawPayload — social_posts has no dedicated external-id column,
 * so this queries the JSONB blob directly rather than adding one speculatively
 * for a single connector. Tenant-scoped via RLS (withTenant), same as every
 * other reader in this file.
 */
export async function findSocialPostByExternalId(
  tenantId: string,
  providerId: string,
  externalId: string
): Promise<{ id: string } | null> {
  return withTenant(tenantId, async (client) => {
    const { rows } = await client.query<{ id: string }>(
      `SELECT id FROM social_posts
       WHERE raw_payload->>'providerId' = $1
         AND raw_payload->>'externalId' = $2
       LIMIT 1`,
      [providerId, externalId]
    );
    return rows.length > 0 ? { id: rows[0].id } : null;
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
  /** Story 6.19 (Story 3.10/ADR-0053) — canonical Markdown body, populated by ingestion. */
  bodyMarkdown: string | null;
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
      body_markdown: string | null;
    }>(
      `SELECT id, created_at, raw_payload, published_at, enrichment, author_id, acquisition_id, post_geo_location, body_markdown
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
      bodyMarkdown: row.body_markdown,
    };
  });
}

/**
 * Story 6.16 — the same enrichment-text rule every real connector's own
 * ingest function already applies inline (GNews:
 * `[title, description].filter(Boolean).join('. ')`; Newswire/
 * tenant-owned-feed: bare `title`, no `description` field). One rule
 * covers both real shapes without branching on `providerId`: when
 * `description` is absent, `filter(Boolean)` drops it and only `title`
 * remains — exactly Newswire's own existing behavior.
 */
export function deriveEnrichmentText(rawPayload: unknown): string {
  if (rawPayload && typeof rawPayload === 'object') {
    const p = rawPayload as Record<string, unknown>;
    const title = typeof p.title === 'string' ? p.title : '';
    const description = typeof p.description === 'string' ? p.description : '';
    return [title, description].filter(Boolean).join('. ');
  }
  return '';
}

/**
 * Story 6.16 — persists a manually-triggered enrichment result onto an
 * already-ingested post. Tenant-scoped (RLS) like every other write here;
 * the caller (postsRouter.ts) has already confirmed the post exists and
 * belongs to this tenant via getSocialPostById() before calling this.
 */
export async function setPostEnrichment(tenantId: string, id: string, enrichment: Record<string, unknown>): Promise<void> {
  await withTenant(tenantId, async (client) => {
    await client.query(`UPDATE social_posts SET enrichment = $1 WHERE id = $2`, [JSON.stringify(enrichment), id]);
  });
}

/**
 * Story 3.13 (ADR-0071) — updates post enrichment attributes with full override
 * audit lineage and returns the updated SocialPostSummary.
 * Returns null if the post does not exist for the given tenant.
 */
export async function updatePostEnrichment(
  tenantId: string,
  id: string,
  userId: string,
  updates: {
    sentiment?: 'positive' | 'neutral' | 'negative';
    sentimentScore?: number;
    keyPhrases?: string[];
    detectedLanguage?: string | null;
    geoCountry?: string | null;
    geoCountryName?: string | null;
    summary?: string | null;
  }
): Promise<SocialPostSummary | null> {
  return withTenant(tenantId, async (client) => {
    const { rows: postRows } = await client.query<{
      id: string;
      created_at: Date;
      raw_payload: unknown;
      published_at: Date | null;
      enrichment: Record<string, any> | null;
      body_markdown: string | null;
    }>(
      `SELECT id, created_at, raw_payload, published_at, enrichment, body_markdown
       FROM social_posts WHERE id = $1`,
      [id]
    );

    if (postRows.length === 0) return null;
    const post = postRows[0];
    const currentEnrichment: Record<string, any> = post.enrichment ?? {};

    const overriddenFields: string[] = [];

    // Sentiment & Score
    let sentiment = currentEnrichment.sentiment;
    let sentimentScore = currentEnrichment.sentimentScore;

    if (updates.sentiment !== undefined) {
      if (!['positive', 'neutral', 'negative'].includes(updates.sentiment)) {
        throw new Error('INVALID_SENTIMENT');
      }
      sentiment = updates.sentiment;
      overriddenFields.push('sentiment');

      if (updates.sentimentScore === undefined) {
        switch (updates.sentiment) {
          case 'positive':
            sentimentScore = 0.8;
            break;
          case 'negative':
            sentimentScore = 0.2;
            break;
          case 'neutral':
          default:
            sentimentScore = 0.5;
            break;
        }
        overriddenFields.push('sentimentScore');
      }
    }

    if (updates.sentimentScore !== undefined) {
      if (
        typeof updates.sentimentScore !== 'number' ||
        isNaN(updates.sentimentScore) ||
        updates.sentimentScore < 0 ||
        updates.sentimentScore > 1
      ) {
        throw new Error('INVALID_SENTIMENT_SCORE');
      }
      sentimentScore = updates.sentimentScore;
      if (!overriddenFields.includes('sentimentScore')) {
        overriddenFields.push('sentimentScore');
      }
    }

    // Key Phrases
    let keyPhrases = currentEnrichment.keyPhrases;
    if (updates.keyPhrases !== undefined) {
      if (!Array.isArray(updates.keyPhrases)) {
        throw new Error('INVALID_KEY_PHRASES');
      }
      const seen = new Set<string>();
      const sanitized: string[] = [];
      for (const raw of updates.keyPhrases) {
        if (typeof raw !== 'string') continue;
        const stripped = raw.replace(/<[^>]*>/g, '').trim();
        if (!stripped) continue;
        const lower = stripped.toLowerCase();
        if (!seen.has(lower)) {
          seen.add(lower);
          sanitized.push(stripped.slice(0, 200));
          if (sanitized.length >= 50) break;
        }
      }
      keyPhrases = sanitized;
      overriddenFields.push('keyPhrases');
    }

    // Detected Language
    let detectedLanguage = currentEnrichment.detectedLanguage;
    if (updates.detectedLanguage !== undefined) {
      if (updates.detectedLanguage === null) {
        detectedLanguage = null;
        overriddenFields.push('detectedLanguage');
      } else {
        const trimmed = updates.detectedLanguage.trim().toLowerCase();
        if (!/^[a-z]{2}$/.test(trimmed)) {
          throw new Error('INVALID_LANGUAGE_CODE');
        }
        detectedLanguage = trimmed;
        overriddenFields.push('detectedLanguage');
      }
    }

    // Geospatial
    let geoCountry = currentEnrichment.geoCountry;
    let geoCountryName = currentEnrichment.geoCountryName;
    if (updates.geoCountry !== undefined) {
      if (updates.geoCountry === null) {
        geoCountry = null;
        geoCountryName = null;
        overriddenFields.push('geoCountry');
        overriddenFields.push('geoCountryName');
      } else {
        const { normalizeCountryCode, getCountryName } = await import('../connectors/geo/geoCountryUtils');
        const normalized = normalizeCountryCode(updates.geoCountry);
        if (!normalized) {
          throw new Error('INVALID_COUNTRY_CODE');
        }
        geoCountry = normalized;
        geoCountryName = updates.geoCountryName ?? getCountryName(normalized);
        overriddenFields.push('geoCountry');
        overriddenFields.push('geoCountryName');
      }
    }

    // Summary
    let summary = currentEnrichment.summary;
    if (updates.summary !== undefined) {
      summary = updates.summary ? updates.summary.trim() : null;
      overriddenFields.push('summary');
    }

    // Build override metadata
    const existingOverride = currentEnrichment.override;
    const initialOriginalValues = existingOverride?.originalValues ?? {
      sentiment: currentEnrichment.sentiment ?? null,
      sentimentScore: currentEnrichment.sentimentScore ?? null,
      keyPhrases: currentEnrichment.keyPhrases ?? [],
      detectedLanguage: currentEnrichment.detectedLanguage ?? null,
      geoCountry: currentEnrichment.geoCountry ?? null,
      geoCountryName: currentEnrichment.geoCountryName ?? null,
      summary: currentEnrichment.summary ?? null,
    };

    const aiHistory = existingOverride?.aiHistory ? [...existingOverride.aiHistory] : [];
    if (!existingOverride && currentEnrichment.sentiment !== undefined) {
      aiHistory.push({
        generatedAt: post.created_at.toISOString(),
        model: currentEnrichment.modelUsed ?? currentEnrichment.model,
        values: { ...initialOriginalValues },
      });
    }

    const updatedOverride = {
      isOverridden: true,
      overriddenAt: new Date().toISOString(),
      overriddenByUserId: userId,
      overriddenFields: Array.from(new Set([...(existingOverride?.overriddenFields ?? []), ...overriddenFields])),
      originalValues: initialOriginalValues,
      aiHistory,
    };

    const newEnrichment = {
      ...currentEnrichment,
      sentiment,
      sentimentScore,
      keyPhrases,
      detectedLanguage,
      geoCountry,
      geoCountryName,
      summary,
      override: updatedOverride,
    };

    await client.query(`UPDATE social_posts SET enrichment = $1 WHERE id = $2`, [
      JSON.stringify(newEnrichment),
      id,
    ]);

    return {
      id: post.id,
      createdAt: post.created_at.toISOString(),
      rawPayload: post.raw_payload,
      publishedAt: post.published_at ? post.published_at.toISOString() : null,
      enrichment: newEnrichment,
      bodyMarkdown: post.body_markdown,
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
  /** Story 3.11 (ADR-0063) — filters to posts with a real post_watchlist_matches row for this watchlist. */
  watchlistId?: string;
}

export interface SocialPostSummary {
  id: string;
  createdAt: string;
  rawPayload: unknown;
  publishedAt: string | null;
  enrichment: unknown;
  /** Story 6.19 (Story 3.10/ADR-0053) — real, canonical Markdown body, already populated by every real connector's own ingestX(). null when never populated (pre-Story-3.10 posts), never omitted. */
  bodyMarkdown: string | null;
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
      ? await queryAfterCursor(client, options.cursor, limit, options.watchlistId)
      : await queryFirstPage(client, limit, options.watchlistId);

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
        bodyMarkdown: row.body_markdown,
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
  body_markdown: string | null;
}

/**
 * Story 3.11 (ADR-0063 Decision §3) — JOINs post_watchlist_matches when a
 * watchlistId filter is present; RLS on both social_posts and
 * post_watchlist_matches enforces tenant isolation without any additional
 * application-layer predicate. Ordering stays social_posts.seq ASC either
 * way — never matched_at or any other TIMESTAMPTZ column (posts-api's own
 * load-bearing "never a TIMESTAMPTZ column" pagination rule is unchanged by
 * this join). See .claude/skills/post-watchlist-match-persistence/SKILL.md.
 */
async function queryFirstPage(
  client: { query: (sql: string, params: unknown[]) => Promise<{ rows: PostRow[] }> },
  limit: number,
  watchlistId?: string
): Promise<PostRow[]> {
  const join = watchlistId
    ? `JOIN post_watchlist_matches pwm ON pwm.post_id = social_posts.id AND pwm.watchlist_id = $2`
    : '';
  const params = watchlistId ? [limit + 1, watchlistId] : [limit + 1];
  const { rows } = await client.query(
    `SELECT social_posts.id, social_posts.seq, social_posts.created_at, social_posts.raw_payload,
            social_posts.published_at, social_posts.enrichment, social_posts.body_markdown
     FROM social_posts
     ${join}
     ORDER BY seq ASC
     LIMIT $1`,
    params
  );
  return rows;
}

async function queryAfterCursor(
  client: { query: (sql: string, params: unknown[]) => Promise<{ rows: PostRow[] }> },
  cursorToken: string,
  limit: number,
  watchlistId?: string
): Promise<PostRow[]> {
  const { seq } = decodeCursor(cursorToken);
  const join = watchlistId
    ? `JOIN post_watchlist_matches pwm ON pwm.post_id = social_posts.id AND pwm.watchlist_id = $3`
    : '';
  const params = watchlistId ? [seq, limit + 1, watchlistId] : [seq, limit + 1];
  const { rows } = await client.query(
    `SELECT social_posts.id, social_posts.seq, social_posts.created_at, social_posts.raw_payload,
            social_posts.published_at, social_posts.enrichment, social_posts.body_markdown
     FROM social_posts
     ${join}
     WHERE seq > $1
     ORDER BY seq ASC
     LIMIT $2`,
    params
  );
  return rows;
}

const CSV_HEADERS = [
  'id',
  'published_at',
  'provider',
  'author_name',
  'author_url',
  'title',
  'body_markdown',
  'url',
  'sentiment',
  'keywords',
  'watchlist_ids',
];

const DEFAULT_CSV_MAX_ROWS = 10000;

export interface ExportSocialPostsCsvOptions {
  /** Story 3.11 (ADR-0063) — limits the export to posts matching this watchlist. */
  watchlistId?: string;
}

/**
 * Story 3.16 (ADR-0074) — on-demand flat CSV export of the posts the caller is
 * already authorized to see. Honors the same `watchlistId` filter as
 * `listSocialPosts()`, enforces a row cap, and returns a UTF-8 RFC 4180-ish
 * string. The router is responsible for prefixing the BOM and writing headers.
 */
export async function exportSocialPostsCsv(
  tenantId: string,
  options: ExportSocialPostsCsvOptions = {}
): Promise<string> {
  const maxRows = Number(process.env.POSTS_CSV_MAX_ROWS ?? DEFAULT_CSV_MAX_ROWS);

  return withTenant(tenantId, async (client) => {
    const countSql = options.watchlistId
      ? `SELECT COUNT(*)::int as count
         FROM social_posts sp
         JOIN post_watchlist_matches pwm ON pwm.post_id = sp.id AND pwm.watchlist_id = $2 AND pwm.tenant_id = sp.tenant_id
         WHERE sp.tenant_id = $1`
      : `SELECT COUNT(*)::int as count FROM social_posts WHERE tenant_id = $1`;
    const countParams = options.watchlistId ? [tenantId, options.watchlistId] : [tenantId];
    const { rows: countRows } = await client.query<{ count: number }>(countSql, countParams);
    if (countRows[0].count > maxRows) {
      throw new Error('EXPORT_TOO_LARGE');
    }

    const join = options.watchlistId
      ? `JOIN post_watchlist_matches pwm ON pwm.post_id = sp.id AND pwm.watchlist_id = $3 AND pwm.tenant_id = sp.tenant_id`
      : '';
    const params = options.watchlistId ? [tenantId, maxRows, options.watchlistId] : [tenantId, maxRows];
    const { rows } = await client.query<Record<string, unknown>>(
      `SELECT sp.id, sp.published_at, sp.body_markdown, sp.enrichment,
              COALESCE(sp.raw_payload->>'providerId', '') as provider,
              COALESCE(sp.raw_payload->>'title', sp.raw_payload->>'text', '') as title,
              COALESCE(sp.raw_payload->>'url', '') as url,
              a.display_name as author_display_name,
              a.handle as author_handle,
              a.external_author_id as author_external_author_id
       FROM social_posts sp
       LEFT JOIN authors a ON a.id = sp.author_id
       ${join}
       WHERE sp.tenant_id = $1
       ORDER BY sp.seq ASC
       LIMIT $2`,
      params
    );

    const postIds = rows.map((r) => r.id as string);
    const watchlistMap = new Map<string, string[]>();
    if (postIds.length > 0) {
      const { rows: matches } = await client.query<{ post_id: string; watchlist_id: string }>(
        `SELECT post_id, watchlist_id
         FROM post_watchlist_matches
         WHERE tenant_id = $1 AND post_id = ANY($2::uuid[])
         ORDER BY watchlist_id`,
        [tenantId, postIds]
      );
      for (const m of matches) {
        const list = watchlistMap.get(m.post_id) ?? [];
        list.push(m.watchlist_id);
        watchlistMap.set(m.post_id, list);
      }
    }

    const csvRows = rows.map((r) => {
      const authorName =
        ((r.author_display_name as string | null) ??
          (r.author_handle as string | null) ??
          (r.author_external_author_id as string | null)) ??
        '';
      const authorUrl =
        ((r.author_handle as string | null) ?? (r.author_external_author_id as string | null)) ?? '';
      const watchlistIds = watchlistMap.get(r.id as string) ?? [];
      const enrichment = r.enrichment as Record<string, unknown> | null;
      const sentiment = typeof enrichment?.sentiment === 'string' ? enrichment.sentiment : '';
      const keyPhrases = Array.isArray(enrichment?.keyPhrases)
        ? enrichment.keyPhrases.filter((p): p is string => typeof p === 'string').join('; ')
        : '';
      return {
        id: r.id,
        published_at: (r.published_at as Date | null) ? (r.published_at as Date).toISOString() : '',
        provider: r.provider,
        author_name: authorName,
        author_url: authorUrl,
        title: r.title,
        body_markdown: (r.body_markdown as string | null) ?? '',
        url: r.url,
        sentiment,
        keywords: keyPhrases,
        watchlist_ids: watchlistIds.join(','),
      };
    });

    return rowsToCsv(csvRows, CSV_HEADERS);
  });
}
