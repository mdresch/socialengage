-- Healing pass (2026-07-29), two gaps found by a full ADR/story consistency audit:
--
-- 1. Story 3.2 (ADR-0005): `retryable` was named in ADR-0005's field list but
--    0005_create_ingestion_runs.sql deferred it to "Story 2.3," which shipped
--    using an in-code, non-persisted classification instead and never added
--    the column. See .claude/skills/social-post-lineage/SKILL.md's Corrections
--    section and contracts/epic-3/story-3.2.ingestion-run-retryable-field.contract.test.ts.
ALTER TABLE ingestion_runs ADD COLUMN IF NOT EXISTS retryable BOOLEAN;

-- 2. Story 4.3 (ADR-0009): ADR-0009's own Negative consequences names an index
--    on (tenantId, platformId, startedAt) as needed for deriveConnectorHealth()
--    to stay cheap as run volume grows; never added when Story 4.3 shipped.
--    See .claude/skills/connector-health-and-error-handling/SKILL.md's
--    Corrections section and
--    contracts/epic-4/story-4.3.health-derivation-index.contract.test.ts.
CREATE INDEX IF NOT EXISTS idx_ingestion_runs_tenant_platform_started
  ON ingestion_runs (tenant_id, platform_id, started_at);
