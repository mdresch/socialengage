import { withTenant } from '../db/withTenant';
import { getAdminPool } from '../db/adminPool';

/**
 * Story 3.16 (ADR-0074) — on-demand, tenant_admin-only workspace JSON archive.
 *
 * This export is intentionally separate from the offboarding/deletion export in
 * `src/tenants/tenantDeletion.ts` (ADR-0043). It uses `withTenant()` for every
 * tenant-content table that already respects the caller's RLS scope, and the
 * same narrow `getAdminPool()` exception as `exportTenantData()` for the one
 * table (`watchlists`) whose per-user ownership RLS would otherwise hide other
 * users' watchlists (ADR-0044 §5c). It never touches credential secrets, OAuth
 * refresh tokens, Key Vault envelopes, or raw `raw_payload` internals.
 */

export interface TenantWorkspaceExport {
  exportedAt: string;
  tenant: {
    id: string;
    name: string;
    domain: string | null;
    licenseSeatCount: number;
    activeSeatCount: number;
    status: string;
    createdAt: string;
  };
  users: Record<string, unknown>[];
  watchlists: Record<string, unknown>[];
  connectorActivations: Record<string, unknown>[];
  platformCredentials: Record<string, unknown>[];
  authors: Record<string, unknown>[];
  socialPosts: Record<string, unknown>[];
  ingestionRuns: Record<string, unknown>[];
}

function toIso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

function getKeywords(enrichment: unknown): string {
  if (!enrichment || typeof enrichment !== 'object') return '';
  const phrases = (enrichment as Record<string, unknown>).keyPhrases;
  if (Array.isArray(phrases)) {
    return phrases
      .filter((p): p is string => typeof p === 'string')
      .join('; ');
  }
  return '';
}

function getSentiment(enrichment: unknown): string {
  if (!enrichment || typeof enrichment !== 'object') return '';
  const sentiment = (enrichment as Record<string, unknown>).sentiment;
  return typeof sentiment === 'string' ? sentiment : '';
}

async function fetchWatchlists(tenantId: string): Promise<Record<string, unknown>[]> {
  const { rows } = await getAdminPool().query<
    Record<string, unknown>
  >(
    `SELECT id, tenant_id, user_id, name, match_type, terms, boolean_query, platform_ids, is_active, version, created_at, updated_at
     FROM watchlists
     WHERE tenant_id = $1
     ORDER BY created_at DESC`,
    [tenantId]
  );
  return rows.map((r) => ({
    id: r.id,
    tenantId: r.tenant_id,
    userId: r.user_id,
    name: r.name,
    matchType: r.match_type,
    terms: r.terms,
    booleanQuery: r.boolean_query,
    platformIds: r.platform_ids,
    isActive: r.is_active,
    version: r.version,
    createdAt: toIso(r.created_at as Date | null),
    updatedAt: toIso(r.updated_at as Date | null),
  }));
}

async function fetchTenant(tenantId: string) {
  const { rows } = await withTenant(tenantId, async (client) => {
    return client.query<
      Record<string, unknown>
    >(
      `SELECT id, name, domain, license_seat_count, active_seat_count, status, created_at
       FROM tenants
       WHERE id = $1`,
      [tenantId]
    );
  });
  if (rows.length === 0) {
    throw new Error('TENANT_NOT_FOUND');
  }
  const r = rows[0];
  return {
    id: r.id as string,
    name: r.name as string,
    domain: (r.domain as string | null) ?? null,
    licenseSeatCount: r.license_seat_count as number,
    activeSeatCount: r.active_seat_count as number,
    status: r.status as string,
    createdAt: toIso(r.created_at as Date | null)!,
  };
}

async function fetchUsers(tenantId: string): Promise<Record<string, unknown>[]> {
  const { rows } = await withTenant(tenantId, async (client) => {
    return client.query<Record<string, unknown>>(
      `SELECT id, email, role, status, created_at FROM users WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [tenantId]
    );
  });
  return rows.map((r) => ({
    id: r.id,
    email: r.email,
    role: r.role,
    status: r.status,
    createdAt: toIso(r.created_at as Date | null),
  }));
}

async function fetchConnectorActivations(tenantId: string): Promise<Record<string, unknown>[]> {
  const { rows } = await withTenant(tenantId, async (client) => {
    return client.query<Record<string, unknown>>(
      `SELECT id, platform_id, is_active, activated_at, deactivated_at, updated_by, created_at, updated_at
       FROM connector_activations
       WHERE tenant_id = $1
       ORDER BY created_at DESC`,
      [tenantId]
    );
  });
  return rows.map((r) => ({
    id: r.id,
    platformId: r.platform_id,
    isActive: r.is_active,
    activatedAt: toIso(r.activated_at as Date | null),
    deactivatedAt: toIso(r.deactivated_at as Date | null),
    updatedBy: r.updated_by,
    createdAt: toIso(r.created_at as Date | null),
    updatedAt: toIso(r.updated_at as Date | null),
  }));
}

async function fetchPlatformCredentials(tenantId: string): Promise<Record<string, unknown>[]> {
  const { rows } = await withTenant(tenantId, async (client) => {
    return client.query<Record<string, unknown>>(
      `SELECT id, platform_id, owner_type, user_id, status, created_at
       FROM platform_credentials
       WHERE tenant_id = $1
       ORDER BY created_at DESC`,
      [tenantId]
    );
  });
  return rows.map((r) => ({
    id: r.id,
    platformId: r.platform_id,
    ownerType: r.owner_type,
    userId: r.user_id,
    status: r.status,
    createdAt: toIso(r.created_at as Date | null),
  }));
}

async function fetchAuthors(tenantId: string): Promise<Record<string, unknown>[]> {
  const { rows } = await withTenant(tenantId, async (client) => {
    return client.query<Record<string, unknown>>(
      `SELECT id, platform_id, external_author_id, handle, display_name, follower_count, profile_location, first_seen_at, last_seen_at
       FROM authors
       WHERE tenant_id = $1
       ORDER BY last_seen_at DESC`,
      [tenantId]
    );
  });
  return rows.map((r) => ({
    id: r.id,
    platformId: r.platform_id,
    externalAuthorId: r.external_author_id,
    handle: r.handle,
    displayName: r.display_name,
    followerCount: r.follower_count,
    profileLocation: r.profile_location,
    firstSeenAt: toIso(r.first_seen_at as Date | null),
    lastSeenAt: toIso(r.last_seen_at as Date | null),
  }));
}

async function fetchSocialPosts(tenantId: string): Promise<Record<string, unknown>[]> {
  return withTenant(tenantId, async (client) => {
    const { rows } = await client.query<Record<string, unknown>>(
      `SELECT sp.id,
              sp.published_at,
              sp.body_markdown,
              sp.enrichment,
              COALESCE(sp.raw_payload->>'providerId', '') as provider,
              COALESCE(sp.raw_payload->>'title', sp.raw_payload->>'text', '') as title,
              COALESCE(sp.raw_payload->>'url', '') as url,
              a.display_name as author_display_name,
              a.handle as author_handle,
              a.external_author_id as author_external_author_id
       FROM social_posts sp
       LEFT JOIN authors a ON a.id = sp.author_id
       WHERE sp.tenant_id = $1
       ORDER BY sp.seq ASC`,
      [tenantId]
    );

    const postIds = rows.map((r) => r.id as string);
    const watchlistIdMap = new Map<string, string[]>();
    if (postIds.length > 0) {
      const { rows: matches } = await client.query<{ post_id: string; watchlist_id: string }>(
        `SELECT post_id, watchlist_id
         FROM post_watchlist_matches
         WHERE tenant_id = $1 AND post_id = ANY($2::uuid[])
         ORDER BY watchlist_id`,
        [tenantId, postIds]
      );
      for (const m of matches) {
        const list = watchlistIdMap.get(m.post_id) ?? [];
        list.push(m.watchlist_id);
        watchlistIdMap.set(m.post_id, list);
      }
    }

    return rows.map((r) => {
      const authorName =
        (r.author_display_name as string | null) ??
        (r.author_handle as string | null) ??
        (r.author_external_author_id as string | null) ??
        '';
      const authorUrl = (r.author_handle as string | null) ?? (r.author_external_author_id as string | null) ?? '';
      const watchlistIds = watchlistIdMap.get(r.id as string) ?? [];
      return {
        id: r.id,
        publishedAt: toIso(r.published_at as Date | null),
        provider: r.provider,
        authorName,
        authorUrl,
        title: r.title,
        bodyMarkdown: r.body_markdown ?? null,
        url: r.url,
        sentiment: getSentiment(r.enrichment),
        keywords: getKeywords(r.enrichment),
        watchlistIds: watchlistIds.join(','),
      };
    });
  });
}

async function fetchIngestionRuns(tenantId: string): Promise<Record<string, unknown>[]> {
  const { rows } = await withTenant(tenantId, async (client) => {
    return client.query<Record<string, unknown>>(
      `SELECT id, platform_id, trigger_type, connector_version, status, started_at, completed_at, posts_ingested, posts_skipped, error_summary
       FROM ingestion_runs
       WHERE tenant_id = $1
       ORDER BY started_at DESC`,
      [tenantId]
    );
  });
  return rows.map((r) => ({
    id: r.id,
    platformId: r.platform_id,
    triggerType: r.trigger_type,
    connectorVersion: r.connector_version,
    status: r.status,
    startedAt: toIso(r.started_at as Date | null),
    completedAt: toIso(r.completed_at as Date | null),
    postsIngested: r.posts_ingested,
    postsSkipped: r.posts_skipped,
    errorSummary: r.error_summary,
  }));
}

/**
 * Builds a safe-metadata JSON archive of the caller's own tenant workspace.
 * The returned object does not enforce the response-size cap; the router is
 * responsible for serializing and checking `WORKSPACE_EXPORT_MAX_BYTES`.
 */
export async function buildTenantWorkspaceExport(tenantId: string): Promise<TenantWorkspaceExport> {
  const [
    tenant,
    users,
    watchlists,
    connectorActivations,
    platformCredentials,
    authors,
    socialPosts,
    ingestionRuns,
  ] = await Promise.all([
    fetchTenant(tenantId),
    fetchUsers(tenantId),
    fetchWatchlists(tenantId),
    fetchConnectorActivations(tenantId),
    fetchPlatformCredentials(tenantId),
    fetchAuthors(tenantId),
    fetchSocialPosts(tenantId),
    fetchIngestionRuns(tenantId),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    tenant,
    users,
    watchlists,
    connectorActivations,
    platformCredentials,
    authors,
    socialPosts,
    ingestionRuns,
  };
}
