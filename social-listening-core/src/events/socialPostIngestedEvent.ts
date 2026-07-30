export interface SocialPostIngestedEvent {
  tenantId: string;
  postId: string;
  platformId: string;
  watchlistId: string;
  sentiment: string | null;
  publishedAt: string | null;
  occurredAt: string;
}

export interface BuildSocialPostIngestedEventInput {
  tenantId: string;
  postId: string;
  platformId: string;
  watchlistId: string;
  sentiment?: string | null;
  publishedAt?: string | null;
  occurredAt?: string;
}

/**
 * Constructs a SocialPostIngestedEvent — deliberately thin (ADR-0012): only
 * IDs and the minimal fields needed to decide whether to act, never post
 * text, engagement metrics, or raw payload. Pure — no Service Bus call; see
 * .claude/skills/ingestion-events/SKILL.md.
 */
export function buildSocialPostIngestedEvent(
  input: BuildSocialPostIngestedEventInput
): SocialPostIngestedEvent {
  return {
    tenantId: input.tenantId,
    postId: input.postId,
    platformId: input.platformId,
    watchlistId: input.watchlistId,
    sentiment: input.sentiment ?? null,
    publishedAt: input.publishedAt ?? null,
    occurredAt: input.occurredAt ?? new Date().toISOString(),
  };
}
