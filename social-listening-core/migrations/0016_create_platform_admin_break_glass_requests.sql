-- Story 5.7 (ADR-0030 §3, Clarification 2026-08-03): the break-glass
-- credential reset is a two-phase, human-reviewed workflow, never a single
-- self-triggering automated action -- per Menno's own direct instruction,
-- surfaced while actually building this story. A request is recorded here
-- the moment it's made; the Entra-side reset itself only happens when a
-- Platform Admin explicitly picks the request up for execution (a separate
-- step, in src/admin/breakGlassCredentialReset.ts).
CREATE TABLE IF NOT EXISTS platform_admin_break_glass_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by text NOT NULL,
  target_tenant_id text NOT NULL,
  target_user_id text NOT NULL,
  status text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'executed', 'denied')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  executed_by text,
  executed_at timestamptz
);

GRANT SELECT, INSERT, UPDATE ON platform_admin_break_glass_requests TO platform_admin_role;
