import { withTenant } from '../db/withTenant';

export interface InsertSocialPostInput {
  tenantId: string;
  /** null only for author-less test fixtures — real ingestion always resolves one via upsertAuthor() first. */
  authorId: string | null;
  /** Required: every real post traces back to the IngestionRun that acquired it (ADR-0005). */
  acquisitionId: string;
  rawPayload: unknown;
  postGeoLocation?: unknown;
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
    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO social_posts (tenant_id, raw_payload, author_id, acquisition_id, post_geo_location)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [
        input.tenantId,
        JSON.stringify(input.rawPayload),
        input.authorId,
        input.acquisitionId,
        input.postGeoLocation ? JSON.stringify(input.postGeoLocation) : null,
      ]
    );
    return { id: rows[0].id };
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
