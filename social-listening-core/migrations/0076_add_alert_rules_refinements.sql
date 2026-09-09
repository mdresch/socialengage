-- Story 15.1 (ADR-0123 / TDS-0123): Real-time alert rule exclusions, rolling daily caps, and preview index

ALTER TABLE alert_rules
ADD COLUMN IF NOT EXISTS excluded_watchlist_ids UUID[] NOT NULL DEFAULT '{}',
ADD COLUMN IF NOT EXISTS excluded_topic_ids TEXT[] NOT NULL DEFAULT '{}',
ADD COLUMN IF NOT EXISTS max_alerts_per_day INT NOT NULL DEFAULT 20;

CREATE INDEX IF NOT EXISTS idx_tenant_alerts_rolling_cap 
ON tenant_alerts (tenant_id, alert_rule_id, created_at);