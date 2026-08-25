-- Story 3.14 (ADR-0073) — tenant-scoped, append-only audit table for outbound
-- engagement attempts (v1: replies to ingested posts). References to social_posts
-- and platform_credentials are app-enforced only, matching the post_watchlist_matches
-- precedent: social_posts is partitioned (id is not a unique target for a DB FK),
-- and platform_credentials is RLS-scoped by tenant. See
-- .claude/skills/outbound-engagement/SKILL.md.
CREATE TABLE outbound_activities (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL,
  post_id         UUID        NOT NULL,
  provider_id     TEXT        NOT NULL,
  user_id         UUID        NOT NULL,
  credential_id   UUID        NOT NULL,
  activity_type   TEXT        NOT NULL DEFAULT 'reply',
  body            TEXT        NOT NULL,
  status          TEXT        NOT NULL DEFAULT 'pending',
  external_id     TEXT        NULL,
  external_url    TEXT        NULL,
  error_code      TEXT        NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at         TIMESTAMPTZ NULL,
  failed_at       TIMESTAMPTZ NULL
);

GRANT SELECT, INSERT, UPDATE ON outbound_activities TO app_user;

ALTER TABLE outbound_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE outbound_activities FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON outbound_activities;
CREATE POLICY tenant_isolation ON outbound_activities
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

-- GET /v1/posts/:id/replies ordering and tenant-scoped filter.
CREATE INDEX IF NOT EXISTS idx_outbound_activities_post_tenant_created
  ON outbound_activities (post_id, tenant_id, created_at DESC);
