-- Story 12.15 (ADR-0108): Add scoring columns to authors table

ALTER TABLE authors
  ADD COLUMN IF NOT EXISTS reach_score NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS engagement_score NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS authenticity_score NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS influence_score NUMERIC(5,2) DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_authors_influence_score ON authors (tenant_id, influence_score DESC);
