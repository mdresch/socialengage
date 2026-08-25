-- Story 9.5 (ADR-0080) — tenant-scoped onboarding checklist state.
-- Adds a single JSONB column to the existing tenants table (ADR-0080
-- Decision §1) rather than a separate table (ADR-0080's own "Alternatives
-- considered" §1 rejects that). NOT NULL DEFAULT means every existing
-- tenant row is backfilled with the default-pending shape by this
-- migration itself -- there is no "column is NULL for old tenants" case to
-- special-case in application code.
--
-- Extends ADR-0080's own literal default JSON with one additive key,
-- "hidden_advanced_steps" (a string array), not present in the ADR's
-- Decision §1 example. The ADR's PATCH contract (Decision §3) accepts
-- `hiddenAdvancedSteps?: string[]` but its default-column JSON shape never
-- names where that state persists -- this is the storage location, chosen
-- because it needs no other schema change and keeps all checklist state in
-- the one JSONB column per ADR-0080's own "tightly bound to the tenant"
-- rationale (§1's "Alternatives considered").
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS onboarding_checklist jsonb NOT NULL DEFAULT '{
  "steps": {
    "connect_source": { "completed": false, "completed_at": null },
    "build_watchlist": { "completed": false, "completed_at": null },
    "invite_user": { "completed": false, "completed_at": null },
    "verify_posts": { "completed": false, "completed_at": null }
  },
  "advanced_steps": {
    "enable_enrichment": { "completed": false, "completed_at": null },
    "configure_alerts": { "completed": false, "completed_at": null }
  },
  "dismissed_at": null,
  "dismissed_by_user_id": null,
  "hidden_advanced_steps": []
}';

-- app_user needs to persist one-way milestone-locking writes (ADR-0080
-- Decision §2's own "persist the updated JSONB back to tenants to cache
-- completion permanently") and PATCH's dismiss/reset/visibility writes --
-- both run through the ordinary tenant-scoped app_user session (withTenant()),
-- never platform_admin_role. Column-scoped, matching migrations/0017's own
-- precedent (active_seat_count) of granting app_user exactly the columns a
-- tenant-scoped session may self-service, nothing wider.
GRANT UPDATE (onboarding_checklist) ON tenants TO app_user;
