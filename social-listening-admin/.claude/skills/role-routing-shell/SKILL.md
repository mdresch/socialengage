# Role-gated routing shell

## Story
Story 6.2 — Role-gated routing shell (Tenant-Admin/Tenant User vs. Platform Admin)

## Intent
Provide a server-side role-aware routing shell for social-listening-admin so that tenant-facing routes are separated from Platform-Admin routes and role-appropriate actions are surfaced without relying on client-side only checks.

## Governing decisions
- ADR-0035: one admin app with two role-gated route trees, not two deployables.
- ADR-0036 §4: the coarse-grained auth gate is server-side; role-gating is an additional shell-level concern.

## Contract
- social-listening-admin/contracts/epic-6/story-6.2.role-gated-routing-shell.contract.test.ts

## Notes
- Tenant-facing shell covers tenant_admin and tenant_user.
- Platform-admin shell covers platform_admin.
- Tenant-admin-only actions are a UX convenience only; the real backend enforcement remains in social-listening-core.
