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
