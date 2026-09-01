-- Story 10.3 (ADR-0087): Daily aggregate count tables for analytics views

CREATE TABLE IF NOT EXISTS source_daily_counts (
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  platform_id TEXT NOT NULL,
  post_count INTEGER NOT NULL DEFAULT 0,
  positive_count INTEGER NOT NULL DEFAULT 0,
  neutral_count INTEGER NOT NULL DEFAULT 0,
  negative_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, date, platform_id)
);

CREATE TABLE IF NOT EXISTS author_daily_counts (
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  author_id UUID NOT NULL REFERENCES authors(id) ON DELETE CASCADE,
  post_count INTEGER NOT NULL DEFAULT 0,
  engagement_total NUMERIC(15,2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, date, author_id)
);

CREATE TABLE IF NOT EXISTS sentiment_daily_counts (
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  sentiment TEXT NOT NULL CHECK (sentiment IN ('positive', 'neutral', 'negative', 'mixed')),
  post_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, date, sentiment)
);

CREATE TABLE IF NOT EXISTS watchlist_daily_counts (
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  watchlist_id UUID NOT NULL REFERENCES watchlists(id) ON DELETE CASCADE,
  post_count INTEGER NOT NULL DEFAULT 0,
  positive_count INTEGER NOT NULL DEFAULT 0,
  neutral_count INTEGER NOT NULL DEFAULT 0,
  negative_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, date, watchlist_id)
);

-- Performance indexes for date-range queries
CREATE INDEX IF NOT EXISTS idx_source_daily_counts_tenant_date ON source_daily_counts(tenant_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_author_daily_counts_tenant_date ON author_daily_counts(tenant_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_sentiment_daily_counts_tenant_date ON sentiment_daily_counts(tenant_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_watchlist_daily_counts_tenant_date ON watchlist_daily_counts(tenant_id, date DESC);

-- Grants for app_user
GRANT SELECT, INSERT, UPDATE, DELETE ON source_daily_counts TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON author_daily_counts TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON sentiment_daily_counts TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON watchlist_daily_counts TO app_user;

-- RLS for tenant isolation on analytics tables
ALTER TABLE source_daily_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE source_daily_counts FORCE ROW LEVEL SECURITY;
CREATE POLICY source_daily_counts_tenant ON source_daily_counts
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE author_daily_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE author_daily_counts FORCE ROW LEVEL SECURITY;
CREATE POLICY author_daily_counts_tenant ON author_daily_counts
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE sentiment_daily_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sentiment_daily_counts FORCE ROW LEVEL SECURITY;
CREATE POLICY sentiment_daily_counts_tenant ON sentiment_daily_counts
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE watchlist_daily_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE watchlist_daily_counts FORCE ROW LEVEL SECURITY;
CREATE POLICY watchlist_daily_counts_tenant ON watchlist_daily_counts
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
