-- Story 3.10 (ADR-0053): a canonical Markdown post-body representation,
-- computed once at ingestion time by the shared htmlToMarkdown() utility
-- (src/content/htmlToMarkdown.ts), stored -- never derived at read time
-- (ADR-0053 Decision §2's own "enrichment-shaped, not ConnectorHealth-
-- shaped" argument: raw_payload is not always-live past its 90-day
-- archival window, ADR-0018). See
-- .claude/skills/canonical-markdown-conversion/SKILL.md.
--
-- Both columns are nullable, and NULL exactly when no body source was
-- available for a given post (no body-eligible field, or one that
-- converted to empty text) -- never an empty string. Additive only:
-- existing rows get NULL, no backfill (ADR-0053 Open Question 1 -- a
-- real, deliberate, standing gap for historical data, not designed here).
ALTER TABLE social_posts
  ADD COLUMN IF NOT EXISTS body_markdown TEXT,
  ADD COLUMN IF NOT EXISTS body_markdown_version SMALLINT;

COMMENT ON COLUMN social_posts.body_markdown IS
  'Canonical Markdown post body, computed once at ingestion via htmlToMarkdown() (ADR-0053). Source, not display text -- any future consumer (HTML render, export) must convert it to that surface''s own format before showing it to a human, and must sanitize a Markdown-to-HTML render''s own output, since this content ultimately originates from untrusted third-party sources (ADR-0053 Decision §8). NULL exactly when no body source was available at ingestion (no body-eligible field, or one that converted to empty text) -- never an empty string. Not backfilled for pre-Story-3.10 rows.';

COMMENT ON COLUMN social_posts.body_markdown_version IS
  'Which htmlToMarkdown() pipeline ruleset produced body_markdown (ADR-0053 Decision §2) -- this story''s own pipeline is version 1. NULL exactly when body_markdown is NULL. Lets a future backfill selectively target only outdated-version rows.';
