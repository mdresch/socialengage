-- Story 1.9 (ADR-0032 §9) — user_access_audit_log table.
-- Every write to users.access_ends_at (set, clear, or update) is recorded
-- here: who changed it, when, and the before/after value. This is the audit
-- mechanism ADR-0032 §9 named as required but deferred to "whatever mechanism
-- resolves ADR-0030 §5/ADR-0031's shared Open Question." Story 5.17 was
-- drafted to own this design; Story 1.9 is the first caller that actually
-- writes to the table, so the migration lives here.
--
-- This table is append-only — no UPDATE/DELETE grants are given to any role.
-- app_user gets INSERT (through withTenant's session context, so tenant_id
-- is always the caller's own tenant) and SELECT (to surface audit history to
-- Tenant-Admins via a future read endpoint). platform_admin_role gets no
-- access — this is tenant-content data, not platform-admin territory
-- (ADR-0030 §2).

CREATE TABLE user_access_audit_log (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references tenants(id),
  target_user_id uuid not null references users(id),
  actor_user_id  uuid not null,           -- the tenant_admin who made the change
  operation      text not null,           -- 'set_access_ends_at' | 'clear_access_ends_at'
  old_value      timestamptz,             -- NULL when there was no prior value
  new_value      timestamptz,             -- NULL on a clear
  occurred_at    timestamptz not null default now()
);

ALTER TABLE user_access_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_access_audit_log FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON user_access_audit_log
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

GRANT SELECT, INSERT ON user_access_audit_log TO app_user;
