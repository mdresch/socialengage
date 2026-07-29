# ADR-0005: `IngestionRun` as the immutable acquisition/audit anchor for every post

**Status:** Accepted (2026-07-28)
**Source:** Design Spec §4.3 "IngestionRun (acquisition tracking)"

## Context

Posts arrive via multiple trigger types (poll or webhook) across many connector versions over time. When something goes wrong with a tenant's data (bad enrichment, unexpected duplicates, a connector bug), the system needs to answer "which process, at what time, with what connector version, brought this data in" for any given post. Connector health (ADR-0009) also needs a historical record to derive status from.

## Decision

Every ingestion execution creates an `IngestionRun` record (`triggerType`, `connectorVersion`, `startedAt`/`completedAt`, `status`, `postsIngested`/`postsSkipped`, `errorSummary`, `retryable`). Every `SocialPost` carries an `acquisitionId` foreign key to the `IngestionRun` that produced it.

## Consequences

**Positive**
- Provides a single, immutable audit trail per post: exactly which run, connector version, and trigger type produced it, without needing to reconstruct this from logs.
- `ConnectorHealth` (ADR-0009) can be entirely derived from `IngestionRun` history instead of being separately tracked mutable state, eliminating a class of drift bugs.
- `postsSkipped` (e.g., duplicates) on the run record gives visibility into ingestion efficiency per run without scanning the post table.

**Negative**
- Every post insert has a mandatory dependency on an open `IngestionRun` row existing first, which adds a bit of sequencing to the ingestion pipeline (create run → ingest posts → close run).
- `IngestionRun` volume grows with polling frequency × tenant × platform count; retention/archival policy for old runs isn't addressed in this spec and will need a decision before it becomes a storage concern.

## Alternatives Considered

- **Log-based audit trail instead of a DB table** — cheaper to write, but logs are harder to query relationally (e.g., "give me connector health for tenant X over the last hour") and wouldn't support deriving `ConnectorHealth` as a live query the way §5 specifies.
- **Store connector version / trigger type directly on `SocialPost`** — avoids the join, but duplicates the same run-level facts across every post in a run and loses the run as a first-class unit with its own status/error/retry semantics.
