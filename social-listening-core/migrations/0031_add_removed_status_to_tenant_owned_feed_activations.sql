-- Story 6.20 (ADR-0057 Decision §1): widen tenant_owned_feed_activations'
-- status CHECK to include 'removed' — the soft-removal status DELETE
-- /v1/connectors/tenant-owned-feed/:id sets, never a hard SQL DELETE (the
-- table has no DELETE grant, and this project prefers reversible-in-spirit
-- state transitions — same framing as raw_payload's "never discarded"
-- archival tiering and accessEndsAt over hard user deletion). No new GRANT
-- needed: setting 'removed' is an UPDATE, already granted to app_user.
--
-- PostgreSQL cannot alter a CHECK constraint in place — DROP and re-ADD
-- under the auto-generated name Postgres assigned the original inline
-- CHECK in migration 0026 (`<table>_<column>_check`, the default naming
-- convention for an unnamed column-level CHECK).
-- See .claude/skills/tenant-owned-feed-connector/SKILL.md.

ALTER TABLE tenant_owned_feed_activations
  DROP CONSTRAINT tenant_owned_feed_activations_status_check;

ALTER TABLE tenant_owned_feed_activations
  ADD CONSTRAINT tenant_owned_feed_activations_status_check
  CHECK (status IN ('pending', 'verified', 'expired', 'removed'));
