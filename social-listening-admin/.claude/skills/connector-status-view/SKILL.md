---
name: connector-status-view
description: Tenant-facing connector status screen for showing per-platform health and unsupported-query warnings in the admin UI.
---

# Connector status view

## What this is

This component renders the tenant-facing connector status screen in the admin UI. It shows each connected platform's derived health state, the last successful poll timestamp, and any watchlist boolean-query features that cannot be evaluated natively by that connector.

## Governing ADRs and Stories

| ADR | Decision | Story |
|---|---|---|
| ADR-0009 | Connector health is derived, not stored as a mutable record. | 6.5 |
| ADR-0021 | Unsupported query features surface on the status view. | 6.5 |
| ADR-0023 | Failing connectors must be visually distinguished from degraded/healthy ones. | 6.5 |

## Contracts that constrain this component

- `contracts/epic-6/story-6.5.connector-status-view.contract.test.ts` — locks down the status view's health, polling, warning, and status-only copy.

## How to extend this safely

- Keep the screen focused on health and status data only; do not surface tenant content.
- Add any new connector-status data by extending the local fixture data first, then wiring it through the page component.

## Load-bearing constraints — do not change casually

- Health values must be rendered as `healthy`, `degraded`, or `failing` and should be visually prioritized for the failing state.
- Unsupported query features are shown as warnings tied to the relevant connector and watchlist boolean query, not suppressed.

## Known gaps / deferred work

- A real tenant-wide connector list endpoint is still a backlog item; this story uses the connected-platform list already established in the connect flow state for v1.
