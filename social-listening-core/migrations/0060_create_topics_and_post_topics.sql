-- Story 12.7 (ADR-0104): AI topic clustering post-topics schema and catalog

CREATE TABLE IF NOT EXISTS topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active', -- 'active' | 'merged' | 'hidden'
  merged_into_topic_id UUID REFERENCES topics(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_topics_tenant_slug UNIQUE (tenant_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_topics_tenant_status ON topics(tenant_id, status);

CREATE TABLE IF NOT EXISTS post_topics (
  post_id UUID NOT NULL,
  topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  confidence NUMERIC(4, 3) NOT NULL DEFAULT 1.000,
  extracted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, topic_id)
);

CREATE INDEX IF NOT EXISTS idx_post_topics_tenant_topic ON post_topics(tenant_id, topic_id);
CREATE INDEX IF NOT EXISTS idx_post_topics_post ON post_topics(post_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON topics TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON topics TO platform_admin_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON post_topics TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON post_topics TO platform_admin_role;

ALTER TABLE topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE topics FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON topics;
CREATE POLICY tenant_isolation ON topics
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE post_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_topics FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON post_topics;
CREATE POLICY tenant_isolation ON post_topics
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
