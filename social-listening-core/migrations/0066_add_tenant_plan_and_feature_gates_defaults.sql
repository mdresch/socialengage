-- Story 13.5 (ADR-0112): add the `plan` column to `tenants`, backfill
-- existing rows, and add the column-scoped UPDATE grant needed by
-- `updateTenantAdmin()` for plan changes.

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'starter';

UPDATE tenants SET plan = 'starter' WHERE plan IS NULL OR plan = '';

-- platform_admin_role may update the plan (feature_gates UPDATE already
-- granted by migration 0061).
GRANT UPDATE (plan) ON tenants TO platform_admin_role;
