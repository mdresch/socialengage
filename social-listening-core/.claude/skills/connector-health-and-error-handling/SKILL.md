---
name: connector-health-and-error-handling
description: Retryable/non-retryable error classification, the ingestion-attempt orchestrator, and ConnectorHealth derivation for social-listening-core. Read this before adding a new error kind, before wiring a real connector's HTTP calls, or before touching how health/auto-disable is computed.
---

# Connector health and error handling

## What this is

The judgment layer sitting on top of `IngestionRun` history: `src/ingestion/errorClassification.ts` classifies a failure as retryable or not; `src/ingestion/runIngestionAttempt.ts` is the generic orchestrator every real connector's poll/webhook handler will call through — it opens an `IngestionRun`, retries retryable errors with backoff, attempts an OAuth refresh once before surfacing a credential failure, and closes the run either way; `src/connectors/connectorHealth.ts` derives `ConnectorHealth` (and drives auto-disable) purely by querying that same run history. Two ADRs, two stories, one shared derivation — see ADR-0009/ADR-0010's own text and this project's epic docs, which flag this exact coupling directly.

## Governing ADRs and Stories

| ADR | Decision | Story |
|---|---|---|
| ADR-0010 | Retryable errors get backoff+retry; non-retryable fail immediately; OAuth refreshes once before surfacing a credential failure; auto-disable after the failure threshold, per tenant | 2.3 |
| ADR-0009 | `ConnectorHealth` (`healthy`/`degraded`/`failing`/`disconnected`, `credentialStatus`) is fully derived from `IngestionRun` history at read time — never separately stored mutable state | 4.3 |

## Contracts that constrain this component

- `contracts/epic-2/story-2.3.error-handling-auto-disable.contract.test.ts` — retryable errors retry with backoff; non-retryable errors fail immediately with no further attempts; a failed OAuth refresh (not a successful one) is what surfaces; `shouldAttemptIngestion()` flips to `false` once the trailing-hour failure count crosses `FAILING_THRESHOLD`, with `getAutoDisableReason()` returning the most recent failure's message; a second tenant is provably unaffected.
- `contracts/epic-4/story-4.3.derived-connector-health.contract.test.ts` — no `connector_health` (or similarly named) table exists at all; all four `ConnectorHealth` states derive correctly from a manually inserted `IngestionRun` sequence; `credentialStatus` reads from `platform_credentials.status` directly, independent of run-derived `status`.

## How to extend this safely

- **Wiring a real connector's HTTP calls:** call `runIngestionAttempt({ tenantId, connectorInfo, attempt, refreshOAuthToken? })`, where `attempt` makes the real platform call and throws a `ClassifiableError` (not a raw `Error`) for anything that should be retried, refreshed, or failed — a raw thrown error propagates as a genuine programming bug, not an ingestion outcome, by design (see Load-bearing constraints).
- **Adding a new error kind:** add it to `ErrorKind` in `errorClassification.ts` and place it in `RETRYABLE_KINDS`/`CREDENTIAL_KINDS` (or neither, defaulting to non-retryable) — never add ad hoc classification logic inside `runIngestionAttempt()` itself.
- **Checking whether to schedule the next poll:** call `shouldAttemptIngestion(tenantId, platformId)` before running one — never introduce a separate "disabled" column/flag anywhere; that would reintroduce exactly the drift risk ADR-0009 exists to prevent.
- **Reading connector status for the admin UI:** call `deriveConnectorHealth(tenantId, platformId)` — never cache or persist its result outside Story 4.4's explicitly-reconstructable read-through cache, once that story lands.

## Load-bearing constraints — do not change casually

- **`runIngestionAttempt()` only catches `ClassifiableError` — anything else rethrows.** This is deliberate: an unclassified exception is a bug in the connector's own code, not a legitimate retryable/non-retryable ingestion outcome, and swallowing it into a "failed" `IngestionRun` would hide real programming errors behind ADR-0010's error-handling policy.
- **`FAILING_THRESHOLD` (currently `10`, flat) lives in exactly one place** (`connectorHealth.ts`) and is what both `deriveConnectorHealth()`'s `failing` state and (transitively, via `shouldAttemptIngestion()`) Story 2.3's auto-disable both consult. Story 2.5 (ADR-0023, Blocked) would replace this with a rate-relative rule — when/if accepted, change it here once, not in two places that could drift.
- **Auto-disable has no stored flag anywhere — it is entirely `shouldAttemptIngestion()`'s live read of `deriveConnectorHealth()`.** Don't "optimize" this into a cached boolean column on some connector-config table; that reintroduces the exact drift risk ADR-0009's Alternatives Considered section explicitly rejected.
- **`credentialStatus` and run-derived `status` are independent axes, not merged into one value.** A connector can be `healthy` by run history while its credential is `expired` (the credential just hasn't been *used* yet to fail a run) — this is correct, not a bug, per ADR-0009's explicit separation.

## Known gaps / deferred work

- No real connector calls `runIngestionAttempt()` yet — proven correct against synthetic `attempt()`/`refreshOAuthToken()` functions, the same pattern as Stories 2.1/2.2's example connectors.
- `RequestGate` (Story 2.2) and this orchestrator aren't wired together yet — a real connector's `attempt()` will need to call `acquireForProvider()`/`acquireForAiModel()` itself before making its platform call; that wiring happens when the first real connector is built, not here.
- Story 2.5's rate-relative threshold (ADR-0023, Blocked) and Story 4.4's read-through cache (ADR-0022, Blocked) both build directly on this component once their source ADRs are accepted.
