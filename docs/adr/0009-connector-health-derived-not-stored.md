# ADR-0009: `ConnectorHealth` is fully derived from `IngestionRun` history, not stored mutable state

**Status:** Accepted (2026-07-28)
**Source:** Design Spec §5 "Connector Health"

## Context

Tenants and the admin UI need to see connector status (healthy/degraded/failing/disconnected) per `(tenantId, platformId)`. If health were tracked as its own mutable record, it would need to be kept in sync with every ingestion attempt's outcome — a second place that can drift from the actual run history, especially under concurrent runs or partial failures.

## Decision

`ConnectorHealth` is not separately tracked mutable state. `status`, `lastSuccessfulFetchAt`, `lastAttemptAt`, and `consecutiveFailures` are all derived from querying `IngestionRun` history at read time:
- `failing`: ≥10 failed runs within the last hour for that `(tenantId, platformId)`
- `degraded`: some recent failures, but a successful run within the last hour
- `disconnected`: no runs recorded
- `healthy`: otherwise

`credentialStatus` (`valid`/`expiring_soon`/`expired`/`revoked`) is the one field on `ConnectorHealth` that is genuinely separate state, living on `Credential` rather than being derived from run history.

## Consequences

**Positive**
- Single source of truth: because health is a query over `IngestionRun` (ADR-0005), there is no possibility of health state drifting from what actually happened during ingestion.
- No additional write path or transaction to keep a separate health record consistent with run outcomes — one less place for a bug to cause a tenant to see a stale "healthy" status after failures started.
- The derivation rules are simple enough to express as a query/view, and can be tuned (e.g., the failure threshold) without a data migration since nothing is stored.

**Negative**
- Every health read does aggregation work over recent `IngestionRun` rows rather than a single-row lookup; this needs an index on `(tenantId, platformId, startedAt)` (or similar) to stay cheap as run volume grows, and may warrant caching if `GET /connectors` is polled frequently by the admin UI.
- The failure threshold (10 consecutive failures/hour) is explicitly called out in §10 as a placeholder — changing it retroactively changes historical health interpretations, since nothing was actually stored at the time.

## Alternatives Considered

- **Store `ConnectorHealth` as a mutable row updated after each `IngestionRun` completes** — cheaper reads (no aggregation), but introduces a second piece of state that must be updated in lockstep with run completion, including under retries and partial failures, reintroducing the drift risk this design avoids. `ConnectorHealthChangedEvent` (§7) would also need to be the trigger for that write, adding a dependency between eventing and storage that the derived approach avoids.

## Pending supersession note (2026-07-28)

**ADR-0023** (Proposed, not yet accepted) would replace the `failing` derivation rule above (the flat "≥10 failed runs within the last hour") with a rate-relative rule. If ADR-0023 is accepted, only that one bullet in this ADR's Decision changes — the core architecture here (derived, not stored; the `degraded`/`disconnected`/`healthy` definitions; `credentialStatus` living separately on `Credential`) is unaffected and does not need re-deciding. This note is a forward-pointer only; per this series' convention, the original Decision text above is not edited. See `docs/adr/README.md`'s governance table.
