-- Story 17.3 (ADR-0131, BRD-0131, FDD-0131) — Crisis threshold baseline
-- calibration and escalation matrix. Replaces ADR-0079's static percentage
-- thresholds with a rolling 14-day per-watchlist statistical baseline
-- (crisis_baseline_metrics), a per-tenant/per-watchlist escalation
-- configuration (crisis_escalation_rules), and the incident lifecycle/audit
-- trail (crisis_incident_logs). See ADR-0131 §1-§3 for the full design
-- rationale and .claude/skills/crisis-baseline-escalation/SKILL.md.

-- 1. crisis_baseline_metrics — current-state (upsert-only) rolling 14-day
-- mean/stddev per (watchlist_id, metric_type, day_of_week, hour_of_day)
-- bucket. Written exclusively by CrisisBaselineCalibrationWorker.
CREATE TABLE IF NOT EXISTS crisis_baseline_metrics (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID NOT NULL REFERENCES tenants(id),
  watchlist_id       UUID NOT NULL REFERENCES watchlists(id) ON DELETE CASCADE,
  metric_type        TEXT NOT NULL,
  day_of_week        SMALLINT NOT NULL,
  hour_of_day        SMALLINT NOT NULL,
  mean_14d           NUMERIC NOT NULL,
  stddev_14d         NUMERIC NOT NULL,
  sample_count       INT NOT NULL DEFAULT 0,
  last_calibrated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT crisis_baseline_metrics_metric_type_check
    CHECK (metric_type IN ('mention_velocity', 'negative_sentiment_ratio')),
  CONSTRAINT crisis_baseline_metrics_day_of_week_check CHECK (day_of_week BETWEEN 0 AND 6),
  CONSTRAINT crisis_baseline_metrics_hour_of_day_check CHECK (hour_of_day BETWEEN 0 AND 23),
  CONSTRAINT crisis_baseline_metrics_unique_bucket
    UNIQUE (watchlist_id, metric_type, day_of_week, hour_of_day)
);

GRANT SELECT, INSERT, UPDATE ON crisis_baseline_metrics TO app_user;

CREATE INDEX IF NOT EXISTS idx_crisis_baseline_metrics_tenant_watchlist
  ON crisis_baseline_metrics (tenant_id, watchlist_id);
-- Time-bucket lookup path: "give me this watchlist's baseline for the
-- bucket the current hour falls into" (evaluation engine's hot path).
CREATE INDEX IF NOT EXISTS idx_crisis_baseline_metrics_bucket_lookup
  ON crisis_baseline_metrics (watchlist_id, metric_type, day_of_week, hour_of_day);

ALTER TABLE crisis_baseline_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE crisis_baseline_metrics FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON crisis_baseline_metrics;
CREATE POLICY tenant_isolation ON crisis_baseline_metrics
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

-- 2. crisis_escalation_rules — per-tenant (or per-watchlist) tier
-- configuration. tier1_delivery is dispatched for real via ADR-0091's
-- webhook mechanism; tier2_delivery/tier3_delivery are recorded as intent
-- only in v1 (ADR-0131 §4).
CREATE TABLE IF NOT EXISTS crisis_escalation_rules (
  id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                     UUID NOT NULL REFERENCES tenants(id),
  watchlist_id                  UUID REFERENCES watchlists(id) ON DELETE CASCADE,
  tier1_z_threshold             NUMERIC NOT NULL DEFAULT 2.0,
  tier2_z_threshold             NUMERIC NOT NULL DEFAULT 3.0,
  tier3_z_threshold             NUMERIC NOT NULL DEFAULT 4.5,
  negative_sentiment_floor_pct  NUMERIC NOT NULL DEFAULT 40,
  ack_timeout_minutes           INT NOT NULL DEFAULT 15,
  tier1_delivery                JSONB NOT NULL DEFAULT '{"channel": "webhook", "webhookUrls": [], "secret": null}'::jsonb,
  tier2_delivery                JSONB NOT NULL DEFAULT '{"channel": "intent_only", "vendor": "pagerduty_or_sms", "recipients": []}'::jsonb,
  tier3_delivery                JSONB NOT NULL DEFAULT '{"channel": "intent_only", "vendor": "executive_phone_broadcast", "recipients": []}'::jsonb,
  is_active                     BOOLEAN NOT NULL DEFAULT true,
  created_by_user_id            UUID NOT NULL REFERENCES users(id),
  version                       INTEGER NOT NULL DEFAULT 1,
  created_at                    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT crisis_escalation_rules_tier_order_check
    CHECK (tier1_z_threshold < tier2_z_threshold AND tier2_z_threshold < tier3_z_threshold)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON crisis_escalation_rules TO app_user;

CREATE UNIQUE INDEX IF NOT EXISTS idx_crisis_escalation_rules_scope
  ON crisis_escalation_rules (tenant_id, COALESCE(watchlist_id, '00000000-0000-0000-0000-000000000000'::uuid));

CREATE OR REPLACE FUNCTION set_crisis_escalation_rules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_crisis_escalation_rules_updated_at ON crisis_escalation_rules;
CREATE TRIGGER trg_crisis_escalation_rules_updated_at
  BEFORE UPDATE ON crisis_escalation_rules
  FOR EACH ROW EXECUTE FUNCTION set_crisis_escalation_rules_updated_at();

ALTER TABLE crisis_escalation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE crisis_escalation_rules FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON crisis_escalation_rules;
CREATE POLICY tenant_isolation ON crisis_escalation_rules
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

-- 3. crisis_incident_logs — append-only incident lifecycle + audit trail.
-- No updated_at/generic trigger by design (ADR-0131 §3): origin snapshot
-- fields (observed_value/baseline_mean/baseline_stddev/z_score/tier) are
-- immutable once recorded; state transitions each write their own
-- dedicated timestamp column.
CREATE TABLE IF NOT EXISTS crisis_incident_logs (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID NOT NULL REFERENCES tenants(id),
  watchlist_id            UUID NOT NULL REFERENCES watchlists(id) ON DELETE CASCADE,
  escalation_rule_id      UUID NOT NULL REFERENCES crisis_escalation_rules(id),
  metric_type             TEXT NOT NULL,
  observed_value          NUMERIC NOT NULL,
  baseline_mean           NUMERIC NOT NULL,
  baseline_stddev         NUMERIC NOT NULL,
  z_score                 NUMERIC NOT NULL,
  negative_sentiment_pct  NUMERIC NOT NULL,
  tier                    SMALLINT NOT NULL,
  status                  TEXT NOT NULL DEFAULT 'open',
  acknowledged_by_user_id UUID REFERENCES users(id),
  acknowledged_at         TIMESTAMPTZ,
  ack_timeout_at          TIMESTAMPTZ NOT NULL,
  resolved_by_user_id     UUID REFERENCES users(id),
  resolved_at             TIMESTAMPTZ,
  root_cause_notes        TEXT,
  escalation_action_log   JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT crisis_incident_logs_tier_check CHECK (tier IN (1, 2, 3)),
  CONSTRAINT crisis_incident_logs_status_check CHECK (status IN ('open', 'acknowledged', 'resolved')),
  CONSTRAINT crisis_incident_logs_resolved_requires_notes
    CHECK (status <> 'resolved' OR (root_cause_notes IS NOT NULL AND length(trim(root_cause_notes)) > 0))
);

GRANT SELECT, INSERT, UPDATE ON crisis_incident_logs TO app_user;

-- Ack-timeout sweep's own hot path: "which open incidents have crossed
-- ack_timeout_at?"
CREATE INDEX IF NOT EXISTS idx_crisis_incident_logs_open_ack_timeout
  ON crisis_incident_logs (ack_timeout_at)
  WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_crisis_incident_logs_tenant_watchlist_created
  ON crisis_incident_logs (tenant_id, watchlist_id, created_at DESC);

ALTER TABLE crisis_incident_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE crisis_incident_logs FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON crisis_incident_logs;
CREATE POLICY tenant_isolation ON crisis_incident_logs
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

-- 4. Widen users.role (migration 0018) by exactly one value.
-- ADR-0131 §9/BRD-0131 BRU-009 gate acknowledge/resolve to
-- Tenant-Brand-Reputation-Manager or Tenant-Admin, but no such role has
-- ever existed in this project's actual role model (migration 0018's
-- CHECK was, and until now remained, ('tenant_admin', 'tenant_user') only
-- — confirmed by grep, project-wide, 2026-09-09). This is the minimal,
-- additive change that lets the DB hold the role value this story's own
-- explicit Must-priority acceptance criteria requires; it does not touch
-- the existing two values or any other part of the role model.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('tenant_admin', 'tenant_user', 'tenant_brand_reputation_manager'));
