import { withTenant } from '../db/withTenant';

export interface AuthorProfile {
  handle?: string;
  displayName?: string;
  followerCount?: number;
  profileLocation?: string;
  rawProfile?: unknown;
}

export interface UpsertedAuthor {
  id: string;
}

/** Story 2.13 (ADR-0042) — enough to decide "already discovered" and to re-poll by title. */
export interface AuthorSummary {
  externalAuthorId: string;
  handle: string | null;
  displayName: string | null;
}

/**
 * Upserts an Author by (tenantId, platformId, externalAuthorId) — see
 * .claude/skills/social-post-lineage/SKILL.md. A second call for the same
 * external author advances lastSeenAt rather than creating a new row.
 */
export async function upsertAuthor(
  tenantId: string,
  platformId: string,
  externalAuthorId: string,
  profile: AuthorProfile
): Promise<UpsertedAuthor> {
  return withTenant(tenantId, async (client) => {
    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO authors
         (tenant_id, platform_id, external_author_id, handle, display_name, follower_count, profile_location, raw_profile)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (tenant_id, platform_id, external_author_id)
       DO UPDATE SET
         handle = EXCLUDED.handle,
         display_name = EXCLUDED.display_name,
         follower_count = EXCLUDED.follower_count,
         profile_location = EXCLUDED.profile_location,
         raw_profile = EXCLUDED.raw_profile,
         last_seen_at = now()
       RETURNING id`,
      [
        tenantId,
        platformId,
        externalAuthorId,
        profile.handle ?? null,
        profile.displayName ?? null,
        profile.followerCount ?? null,
        profile.profileLocation ?? null,
        profile.rawProfile ? JSON.stringify(profile.rawProfile) : null,
      ]
    );
    return { id: rows[0].id };
  });
}

/**
 * Every already-known Author for one platform — a connector's own
 * "already discovered" membership check (Story 2.13, ADR-0042: the
 * Wikipedia connector's own two-phase discovery/re-poll design). See
 * .claude/skills/social-post-lineage/SKILL.md.
 */
export async function listAuthorsByPlatform(tenantId: string, platformId: string): Promise<AuthorSummary[]> {
  return withTenant(tenantId, async (client) => {
    const { rows } = await client.query<{ external_author_id: string; handle: string | null; display_name: string | null }>(
      `SELECT external_author_id, handle, display_name FROM authors WHERE platform_id = $1`,
      [platformId]
    );
    return rows.map((row) => ({
      externalAuthorId: row.external_author_id,
      handle: row.handle,
      displayName: row.display_name,
    }));
  });
}

export interface AuthorRecord {
  id: string;
  tenantId: string;
  platformId: string;
  authorExternalId: string;
  handle: string | null;
  displayName: string | null;
  followerCount: number | null;
  profileLocation: string | null;
  rawProfile: unknown;
  firstSeenAt: Date;
  lastSeenAt: Date;
}

/** Story 2.23 (ADR-0067) — fetches a single Author by primary key id within tenant boundary */
export async function getAuthorById(tenantId: string, authorId: string): Promise<AuthorRecord | null> {
  return withTenant(tenantId, async (client) => {
    const { rows } = await client.query<{
      id: string;
      tenant_id: string;
      platform_id: string;
      external_author_id: string;
      handle: string | null;
      display_name: string | null;
      follower_count: number | null;
      profile_location: string | null;
      raw_profile: unknown;
      first_seen_at: Date;
      last_seen_at: Date;
    }>(
      `SELECT id, tenant_id, platform_id, external_author_id, handle, display_name, follower_count, profile_location, raw_profile, first_seen_at, last_seen_at FROM authors WHERE id = $1`,
      [authorId]
    );
    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      id: r.id,
      tenantId: r.tenant_id,
      platformId: r.platform_id,
      authorExternalId: r.external_author_id,
      handle: r.handle,
      displayName: r.display_name,
      followerCount: r.follower_count,
      profileLocation: r.profile_location,
      rawProfile: r.raw_profile,
      firstSeenAt: r.first_seen_at,
      lastSeenAt: r.last_seen_at,
    };
  });
}
