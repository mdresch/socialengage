-- Story 9.2 (ADR-0078, BRD-0078, FDD-0078) — Metric Explainability Endpoint.
-- Adds explanations_enabled flag to tenants table (default true) as a tenant-wide cost/governance kill switch.

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS explanations_enabled BOOLEAN NOT NULL DEFAULT true;

GRANT UPDATE (explanations_enabled) ON tenants TO app_user;
