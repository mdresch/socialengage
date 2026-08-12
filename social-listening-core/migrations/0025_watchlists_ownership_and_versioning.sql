-- Story 1.5 rework (ADR-0044): watchlists gain per-user ownership and
-- optimistic-locking version columns. Additive migration.
-- See .claude/skills/watchlist-crud/SKILL.md and ADR-0044 §3/§5/§5b/§5c.

ALTER TABLE watchlists
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

-- No known pre-existing watchlist rows to backfill in any real deployment of
-- this solo, pre-production project (ADR-0044's own rework note) — added
-- nullable first, then required, so a future real deployment with orphaned
-- rows fails this migration loudly rather than silently leaving ownership
-- unenforced, which is the correct failure mode per ADR-0044 §5c.
--
-- ON DELETE CASCADE: a real, necessary consequence discovered while
-- building Story 1.5, not part of ADR-0044's own text — Story 3.8/ADR-0043's
-- tenant-offboarding hard-delete removes a tenant's `users` rows as one of
-- its own ordered steps; without CASCADE here, a watchlist row surviving
-- past its owner's deletion would violate this FK and hang the whole
-- deletion pipeline (that step runs un-awaited). Personal data disappearing
-- along with the person who owns it is the correct behavior for this
-- specific table regardless of Story 3.8, not a workaround adopted only to
-- satisfy it.
ALTER TABLE watchlists ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE watchlists ALTER COLUMN user_id SET NOT NULL;

-- §5b: RLS now enforces ownership, not just tenant membership — the first
-- table in this project where that's true. `app.user_id` is propagated the
-- same transaction-local way `app.tenant_id` already is, via withTenant().
DROP POLICY IF EXISTS tenant_isolation ON watchlists;
CREATE POLICY tenant_isolation ON watchlists
  FOR ALL
  USING (
    tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    AND user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
  )
  WITH CHECK (
    tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    AND user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
  );

-- Supports the ownership-filtered list/get path (every query now implicitly
-- filters by both columns via RLS) the same way idx_watchlists_tenant_id
-- already supports the tenant-only filter.
CREATE INDEX IF NOT EXISTS idx_watchlists_tenant_user ON watchlists(tenant_id, user_id);

-- Note: `updated_at` is already trigger-maintained by update_updated_at_column()
-- (migration 0014), matching ADR-0044 §4 exactly — no change needed here.
