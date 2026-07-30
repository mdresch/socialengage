-- Story 4.4 (ADR-0022): AuthorTopicSignal refreshed hourly via pg_cron,
-- rather than recomputed live on every read (ADR-0007's own "periodically
-- refreshed materialized view" framing). This migration runs as the
-- admin/superuser role (migrate.ts) and its background scheduler runs as
-- that same role — RLS never applies to superusers (see
-- .claude/skills/postgres-tenant-db/SKILL.md's own Load-bearing constraint),
-- which is exactly the sanctioned cross-tenant access a periodic maintenance
-- job legitimately needs (that SKILL.md's own Known gaps flagged this as
-- unbuilt until a job like this actually existed).
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Recomputes author_topic_signals from social_posts. Only the fields real
-- source columns support today: mentionCount, firstMentionAt/lastMentionAt,
-- activeMonthsCount, all derived from author_id/published_at/enrichment.entities
-- (Story 4.2). avgEngagement/sentimentBreakdown are deliberately left
-- untouched here — social_posts has no engagementMetrics/sentiment column
-- yet (Phase 2 enrichment-pipeline wiring, not this story's scope; see
-- .claude/skills/social-post-enrichment/SKILL.md's Known gaps), so this
-- function must not invent values for them.
CREATE OR REPLACE FUNCTION refresh_author_topic_signals() RETURNS void AS $$
BEGIN
  INSERT INTO author_topic_signals
    (tenant_id, author_id, topic, mention_count, first_mention_at, last_mention_at, active_months_count, refreshed_at)
  SELECT
    p.tenant_id,
    p.author_id,
    entity AS topic,
    COUNT(*) AS mention_count,
    MIN(p.published_at) AS first_mention_at,
    MAX(p.published_at) AS last_mention_at,
    COUNT(DISTINCT date_trunc('month', p.published_at)) AS active_months_count,
    now() AS refreshed_at
  FROM social_posts p, jsonb_array_elements_text(p.enrichment -> 'entities') AS entity
  WHERE p.author_id IS NOT NULL AND p.published_at IS NOT NULL
  GROUP BY p.tenant_id, p.author_id, entity
  ON CONFLICT (tenant_id, author_id, topic) DO UPDATE SET
    mention_count = EXCLUDED.mention_count,
    first_mention_at = EXCLUDED.first_mention_at,
    last_mention_at = EXCLUDED.last_mention_at,
    active_months_count = EXCLUDED.active_months_count,
    refreshed_at = EXCLUDED.refreshed_at;
END;
$$ LANGUAGE plpgsql;

SELECT cron.schedule('refresh-author-topic-signals', '0 * * * *', 'SELECT refresh_author_topic_signals();');
