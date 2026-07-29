-- Story 3.2 (ADR-0005): IngestionRun as the immutable acquisition/audit anchor
-- for every SocialPost. tenant_id makes this a Story 5.4 (ADR-0015) table too.
-- `retryable` (named in ADR-0005's field list) is deliberately not added here —
-- it belongs to Story 2.3's error-classification work, which is what actually
-- populates and uses it; Story 3.2's own Acceptance Criteria don't require it.
CREATE TABLE IF NOT EXISTS ingestion_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  platform_id TEXT NOT NULL,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('poll', 'webhook')),
  connector_version TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'succeeded', 'failed')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  posts_ingested INTEGER NOT NULL DEFAULT 0,
  posts_skipped INTEGER NOT NULL DEFAULT 0,
  error_summary TEXT
);

GRANT SELECT, INSERT, UPDATE, DELETE ON ingestion_runs TO app_user;

ALTER TABLE ingestion_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingestion_runs FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON ingestion_runs;
CREATE POLICY tenant_isolation ON ingestion_runs
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

-- Nullable at the schema level, same rationale as social_posts.author_id
-- (Story 3.1's migration) — see .claude/skills/social-post-lineage/SKILL.md.
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS acquisition_id UUID REFERENCES ingestion_runs(id);
