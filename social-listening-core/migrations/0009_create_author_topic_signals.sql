-- Story 4.1 (ADR-0007): AuthorTopicSignal as a per-(tenant, author, topic) row
-- of raw signals only — no computed expertise score (ADR-0007's core decision).
-- tenant_id makes this a Story 5.4 (ADR-0015) table too — RLS enabled in this
-- same migration, same pattern as authors/ingestion_runs.
--
-- Modeled as a plain table here, not yet the literal Postgres MATERIALIZED VIEW
-- ADR-0007 describes: a real materialized view needs a defining SELECT over
-- SocialPost's enrichment fields (entities/keyPhrases for topic extraction,
-- engagementMetrics, sentiment) that don't exist on social_posts yet — that's
-- Story 4.2 (ADR-0008)/the Phase 2 enrichment-pipeline wiring, neither built
-- yet. This table is what that future refresh job (Story 4.4, ADR-0022 —
-- hourly via pg_cron) will write into once it exists; until then, rows are
-- written directly by whatever caller needs them (this story's own contract
-- test does exactly that), which already proves the schema and the read path
-- (GET /topics/:topic/authors) are correct independent of how a row got there.
CREATE TABLE IF NOT EXISTS author_topic_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  author_id UUID NOT NULL REFERENCES authors(id),
  topic TEXT NOT NULL,
  mention_count INTEGER NOT NULL DEFAULT 0,
  first_mention_at TIMESTAMPTZ,
  last_mention_at TIMESTAMPTZ,
  active_months_count INTEGER NOT NULL DEFAULT 0,
  avg_engagement DOUBLE PRECISION,
  sentiment_breakdown JSONB,
  refreshed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, author_id, topic)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON author_topic_signals TO app_user;

ALTER TABLE author_topic_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE author_topic_signals FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON author_topic_signals;
CREATE POLICY tenant_isolation ON author_topic_signals
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
