-- Story 13.9 (ADR-0115) — media upload and asset targeting.
--
-- Tenant-scoped media metadata table. Blobs themselves live in Azure Blob Storage
-- under a tenant-scoped path; this table records ownership, MIME type, size, and
-- the blob path so presigned URLs can be regenerated on demand.

CREATE TABLE IF NOT EXISTS media_assets (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  owner_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blob_path     TEXT        NOT NULL,
  mime_type     TEXT        NOT NULL,
  size_bytes    BIGINT      NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_media_assets_tenant_created
  ON media_assets (tenant_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON media_assets TO app_user;

ALTER TABLE media_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_assets FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS media_assets_isolation ON media_assets;
CREATE POLICY media_assets_isolation ON media_assets
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
