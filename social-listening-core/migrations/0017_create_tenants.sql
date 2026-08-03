-- Story 5.8 (ADR-0031): `tenants` table — the first table whose own primary
-- key IS the tenant identity, not a separate tenant_id foreign key (ADR-0031
-- §2's own rationale: this table defines what a tenant is; every other
-- tenant-scoped table merely references it via its own tenant_id column).

CREATE TABLE IF NOT EXISTS tenants (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  license_seat_count  INTEGER NOT NULL,
  active_seat_count   INTEGER NOT NULL DEFAULT 0,
  domain              TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ADR-0031 §5, added at review: nullable, unique only when non-null — one
-- tenant per captured sign-up domain. The public/free-email-provider
-- exclusion and the exact rerouting UX are both explicitly out of this
-- story's scope (ADR-0031's own Open Questions) — this index only proves
-- the constraint, not domain-matching logic.
CREATE UNIQUE INDEX IF NOT EXISTS uq_tenants_domain ON tenants (domain) WHERE domain IS NOT NULL;

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants FORCE ROW LEVEL SECURITY;

-- Scoped by id, not a tenant_id column — this table IS the tenant (ADR-0031
-- §2). Same NULLIF-normalized, fail-closed pattern as every other RLS
-- policy in this project (see migrations/0002's own comment for why NULLIF
-- matters on a pooled connection).
DROP POLICY IF EXISTS tenant_isolation ON tenants;
CREATE POLICY tenant_isolation ON tenants
  FOR ALL
  USING (id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

-- app_user: SELECT for a Tenant-Admin's own self-service read (Story 5.8
-- AC2 — RLS above is what actually confines it to the caller's own row);
-- UPDATE is deliberately column-scoped to active_seat_count only, the one
-- field a tenant-scoped session (via tenantStore.ts's atomic seat-count
-- functions) is allowed to change about its own tenant. A Tenant-Admin
-- cannot rename or unsuspend its own tenant via a raw update — only
-- platform_admin_role can (see .claude/skills/tenants/SKILL.md's
-- "Load-bearing constraints").
GRANT SELECT ON tenants TO app_user;
GRANT UPDATE (active_seat_count) ON tenants TO app_user;

-- platform_admin_role (Story 5.7, ADR-0030): can create tenants and
-- administer status/license_seat_count, but is column-level DENIED from
-- writing active_seat_count — a real, DB-enforced boundary (Story 5.8 AC3),
-- not an application convention that trusts the caller not to. Narrower
-- than the blanket `GRANT UPDATE` platform-admin-access/SKILL.md originally
-- sketched, on purpose.
GRANT SELECT, INSERT ON tenants TO platform_admin_role;
GRANT UPDATE (status, license_seat_count) ON tenants TO platform_admin_role;

-- Reuses the trigger function migrations/0014_create_watchlists.sql already
-- defined — no new machinery for auto-updating updated_at. A BEFORE UPDATE
-- trigger's internal column writes are not subject to the invoking role's
-- own column-level UPDATE grants (Postgres only checks privileges against
-- the client statement's own SET list), so this works under both app_user's
-- and platform_admin_role's narrower grants above without a separate
-- updated_at grant to either.
DROP TRIGGER IF EXISTS update_tenants_updated_at ON tenants;
CREATE TRIGGER update_tenants_updated_at
  BEFORE UPDATE ON tenants
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
