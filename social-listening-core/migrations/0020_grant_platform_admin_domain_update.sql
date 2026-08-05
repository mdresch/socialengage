-- Story 5.12 (ADR-0037 §9, decided 2026-08-04): platform_admin_role gains a
-- real, audited recovery path for a wrong tenants.domain value. ADR-0037 §9
-- decided this grant extension at the time, but no migration ever actually
-- built it — confirmed directly, no prior migration file references
-- "domain" in a GRANT statement. This is that missing migration, not a new
-- decision.
--
-- One additional column only, same "administrative metadata, not
-- tenant-content" category as the existing status/license_seat_count grant
-- (migrations/0017) — does not touch platform_admin_role's boundary on any
-- other table (ADR-0030 §2 stays intact).

GRANT UPDATE (domain) ON tenants TO platform_admin_role;
