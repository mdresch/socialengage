-- Story 1.2 (ADR-0016): minimal SocialPost table, proving Postgres JSONB backs
-- rawPayload. Only the columns this story's Acceptance Criteria require — every
-- other SocialPost column/relation (authorId, acquisitionId, platformId,
-- publishedAt, ...) belongs to its own owning story (3.1 Author, 3.2 IngestionRun,
-- 3.4 pagination, etc.) and is added by a later migration, not speculated here.
CREATE TABLE IF NOT EXISTS social_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  raw_payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
