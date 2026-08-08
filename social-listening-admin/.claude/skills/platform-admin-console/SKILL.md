---
name: platform-admin-console
description: Platform Admin console surface for tenant registry administration, break-glass support flow, and audit-log visibility in social-listening-admin.
---

# Platform Admin console

## What this is

This component provides the platform-admin route in social-listening-admin for platform operations only. It renders tenant administrative metadata, exposes the break-glass workflow shape, and surfaces audit-log visibility without exposing tenant content.

## Governing ADRs and Stories

| ADR | Decision | Story |
|---|---|---|
| ADR-0030 | Platform Admin uses a narrowly-scoped, audited bypass path for administrative actions only. | 6.6 |
| ADR-0031 | Tenant registry shape and seat/status/domain metadata surfaced for administration. | 6.6 |
| ADR-0035 | One admin app with role-gated routes; platform-admin views remain inside this app. | 6.6 |

## Contracts that constrain this component

- contracts/epic-6/story-6.6.platform-admin-console.contract.test.ts — verifies the route exists, required sections are rendered, admin boundary copy is present, and platform-admin API helpers exist.

## How to extend this safely

- Keep calls to social-listening-core inside src/lib/core-client.ts; do not issue ad hoc fetch calls from the page component.
- Extend tenant registry or audit-log presentation from existing helper responses first, then add view logic.
- Preserve the two-phase break-glass flow language and endpoint mapping when adding UI actions.

## Load-bearing constraints — do not change casually

- This screen must remain platform-admin-only route content and continue to rely on role-routing-shell checks.
- No tenant-content data is allowed on this console: no users list, watchlist content, post content, or credential material.
- This screen does not replace core authorization boundaries; Story 5.12, 5.13, and 5.14 enforce those server-side.

## Known gaps / deferred work

- Interactive submit flows for tenant create/update and break-glass actions are not wired yet; Story 6.6 currently provides the console surface and endpoint mapping text.
- Infrastructure/operations metrics dashboards are explicitly deferred by story scope and remain out of scope here.
