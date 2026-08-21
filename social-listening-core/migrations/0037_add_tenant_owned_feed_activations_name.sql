-- Story 2.19 (ADR-0050, 2026-08-20 Amendment Log entry): lets a tenant give
-- a tenant-owned feed activation its own display name, distinct from the
-- verified domain/feed URL — useful once a tenant has more than one feed
-- (Story 6.20/ADR-0057's own multi-feed support) and wants to tell them
-- apart by something more meaningful than a raw domain string. Nullable,
-- no default: setting a name is optional, never required — the setup UI
-- falls back to displaying `domain` when it's absent. Does not touch
-- Author modeling (still the verified domain, ADR-0050 Decision §4) or
-- providerId — see this migration's own governing Amendment Log entry for
-- what this column does and does not change.
-- See .claude/skills/tenant-owned-feed-connector/SKILL.md.

ALTER TABLE tenant_owned_feed_activations ADD COLUMN IF NOT EXISTS name TEXT;
