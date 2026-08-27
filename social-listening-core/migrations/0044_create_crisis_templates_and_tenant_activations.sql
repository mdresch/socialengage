-- Story 9.3 (ADR-0079, BRD-0079, FDD-0079) — Crisis Template Bundle and Activation.
-- Platform-wide crisis_templates catalog + tenant-scoped tenant_crisis_templates activation state.

CREATE TABLE IF NOT EXISTS crisis_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  default_query TEXT NOT NULL,
  default_ast JSONB NOT NULL,
  parameters JSONB NOT NULL DEFAULT '[]'::jsonb,
  default_thresholds JSONB NOT NULL DEFAULT '{}'::jsonb,
  playbook JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed initial standard platform templates
INSERT INTO crisis_templates (template_key, name, description, default_query, default_ast, parameters, default_thresholds, playbook, is_active)
VALUES
  (
    'brand-crisis',
    'Brand Crisis & Controversy',
    'Monitors viral backlash, boycotts, fraud allegations, and active reputation scandals.',
    '{{brand_name}} AND (boycott OR scandal OR resign OR fraud OR corrupt OR lawsuit OR illegal)',
    '{"type":"AND","left":{"type":"TERM","value":"{{brand_name}}"},"right":{"type":"OR","left":{"type":"TERM","value":"boycott"},"right":{"type":"OR","left":{"type":"TERM","value":"scandal"},"right":{"type":"OR","left":{"type":"TERM","value":"lawsuit"},"right":{"type":"TERM","value":"fraud"}}}}}'::jsonb,
    '[{"key": "brand_name", "label": "Brand Name", "type": "string", "required": true}]'::jsonb,
    '{"volume_spike_pct": 50, "negative_sentiment_pct": 60, "time_window_minutes": 60}'::jsonb,
    '[{"step": 1, "owner": "PR Lead", "action": "Assess scope and draft executive holding statement", "sla_minutes": 30}, {"step": 2, "owner": "Legal", "action": "Review regulatory exposure and public response", "sla_minutes": 60}]'::jsonb,
    true
  ),
  (
    'product-recall',
    'Product Recall & Safety Hazard',
    'Tracks defect reports, safety hazards, injury claims, and active recall chatter.',
    '{{brand_name}} AND (recall OR defect OR injury OR hazard OR contaminated OR toxic OR explosion)',
    '{"type":"AND","left":{"type":"TERM","value":"{{brand_name}}"},"right":{"type":"OR","left":{"type":"TERM","value":"recall"},"right":{"type":"OR","left":{"type":"TERM","value":"defect"},"right":{"type":"OR","left":{"type":"TERM","value":"hazard"},"right":{"type":"TERM","value":"injury"}}}}}'::jsonb,
    '[{"key": "brand_name", "label": "Brand Name", "type": "string", "required": true}]'::jsonb,
    '{"volume_spike_pct": 40, "negative_sentiment_pct": 50, "time_window_minutes": 30}'::jsonb,
    '[{"step": 1, "owner": "Product Operations", "action": "Identify affected SKU/batch and freeze distribution", "sla_minutes": 15}, {"step": 2, "owner": "Support Lead", "action": "Deploy customer return & FAQ macros", "sla_minutes": 45}]'::jsonb,
    true
  ),
  (
    'exec-attack',
    'Executive & Leadership Attack',
    'Detects targeted attacks, rumors, and allegations regarding C-suite leaders and key executives.',
    '{{executive_names}} AND (arrest OR resign OR assault OR scandal OR fired OR allegations OR insider)',
    '{"type":"AND","left":{"type":"TERM","value":"{{executive_names}}"},"right":{"type":"OR","left":{"type":"TERM","value":"resign"},"right":{"type":"OR","left":{"type":"TERM","value":"scandal"},"right":{"type":"OR","left":{"type":"TERM","value":"allegations"},"right":{"type":"TERM","value":"insider"}}}}}'::jsonb,
    '[{"key": "executive_names", "label": "Executive Names", "type": "string", "required": true}]'::jsonb,
    '{"volume_spike_pct": 50, "negative_sentiment_pct": 60, "time_window_minutes": 60}'::jsonb,
    '[{"step": 1, "owner": "Communications Lead", "action": "Coordinate personal and corporate PR response", "sla_minutes": 30}]'::jsonb,
    true
  ),
  (
    'competitor-surge',
    'Competitor Campaign Surge',
    'Monitors sudden volume spikes and competitive moves from key market rivals.',
    '({{competitors}}) AND (launch OR breakthrough OR disruptive OR acquire OR discount OR market)',
    '{"type":"AND","left":{"type":"TERM","value":"{{competitors}}"},"right":{"type":"OR","left":{"type":"TERM","value":"launch"},"right":{"type":"OR","left":{"type":"TERM","value":"breakthrough"},"right":{"type":"OR","left":{"type":"TERM","value":"acquire"},"right":{"type":"TERM","value":"discount"}}}}}'::jsonb,
    '[{"key": "competitors", "label": "Competitor Names", "type": "string", "required": true}]'::jsonb,
    '{"volume_spike_pct": 100, "negative_sentiment_pct": 30, "time_window_minutes": 120}'::jsonb,
    '[{"step": 1, "owner": "Marketing Lead", "action": "Analyze counter-positioning strategy", "sla_minutes": 120}]'::jsonb,
    true
  ),
  (
    'data-breach',
    'Data Breach & Security Incident',
    'Monitors leaked customer records, ransomware claims, credential dumps, and CVE exposure.',
    '{{brand_name}} AND (breach OR leaked OR hacked OR ransomware OR credentials OR database OR compromised)',
    '{"type":"AND","left":{"type":"TERM","value":"{{brand_name}}"},"right":{"type":"OR","left":{"type":"TERM","value":"breach"},"right":{"type":"OR","left":{"type":"TERM","value":"hacked"},"right":{"type":"OR","left":{"type":"TERM","value":"ransomware"},"right":{"type":"TERM","value":"leaked"}}}}}'::jsonb,
    '[{"key": "brand_name", "label": "Brand Name", "type": "string", "required": true}]'::jsonb,
    '{"volume_spike_pct": 30, "negative_sentiment_pct": 70, "time_window_minutes": 30}'::jsonb,
    '[{"step": 1, "owner": "CISO / Security Lead", "action": "Activate Incident Response Team and isolate affected systems", "sla_minutes": 15}, {"step": 2, "owner": "Legal & DPO", "action": "Prepare regulatory 72h notification draft", "sla_minutes": 60}]'::jsonb,
    true
  )
ON CONFLICT (template_key) DO NOTHING;

GRANT SELECT ON crisis_templates TO app_user;

-- Tenant-scoped crisis activations table
CREATE TABLE IF NOT EXISTS tenant_crisis_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  template_key TEXT NOT NULL,
  watchlist_id UUID NOT NULL REFERENCES watchlists(id) ON DELETE CASCADE,
  thresholds JSONB NOT NULL DEFAULT '{}'::jsonb,
  notification_channel_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  variables JSONB NOT NULL DEFAULT '{}'::jsonb,
  custom_thresholds JSONB,
  playbook JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by_user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON tenant_crisis_templates TO app_user;

ALTER TABLE tenant_crisis_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_crisis_templates FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON tenant_crisis_templates;
CREATE POLICY tenant_isolation ON tenant_crisis_templates
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

CREATE INDEX IF NOT EXISTS idx_tenant_crisis_templates_tenant_id ON tenant_crisis_templates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_crisis_templates_watchlist_id ON tenant_crisis_templates(watchlist_id);
