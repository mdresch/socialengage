-- Enhancement, 2026-08-12, at Menno's own direct request (found live — no
-- path anywhere renames a tenant after creation): PATCH /v1/admin/tenants/:id
-- now also accepts `name`. Confirmed directly, the same way migration 0020
-- had to be confirmed for domain: migration 0017's GRANT UPDATE to
-- platform_admin_role is column-scoped (status, license_seat_count only) —
-- it does NOT cover the whole row, contrary to an initial assumption while
-- wiring tenantStore.ts's PATCH field list. name is administrative metadata,
-- same category as status/license_seat_count/domain, not tenant-content —
-- does not touch platform_admin_role's boundary on any other table
-- (ADR-0030 §2 stays intact).

GRANT UPDATE (name) ON tenants TO platform_admin_role;
