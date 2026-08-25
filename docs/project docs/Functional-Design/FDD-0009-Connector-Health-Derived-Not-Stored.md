# Functional Design Document

## 1. Document Control

| Field | Value |
|---|---|
| Document Title | FDD-0009 Connector Health Derived, Not Stored — Functional Design Document |
| Version | 1.0 |
| Date | 2026-08-23 |
| Author(s) | Menno, FDD Writer |
| Reviewer(s) | Menno |
| Status | Approved (source ADR-0009 is Accepted; the `failing` rule is superseded by ADR-0023's rate-relative threshold, folded in below; unaffected by ADR-0051's later connector-activation concept) |
| Related Documents | ADR-0009, ADR-0005, ADR-0010, ADR-0022, ADR-0023, ADR-0051, BRD-0009, Story 4.3, Story 2.5, Story 6.5 |

---

## 2. Purpose and Scope

### 2.1 Purpose

This document translates ADR-0009 (`ConnectorHealth` is fully derived from `IngestionRun` history, not stored mutable state) and BRD-0009 into a functional design for how tenants and the admin UI see accurate, never-drifting connector status.

### 2.2 Scope

- **In scope:** the derivation rules for `status` (`healthy`/`degraded`/`failing`/`disconnected`), `lastSuccessfulFetchAt`, `lastAttemptAt`, `consecutiveFailures`; the separate, genuinely-stored `credentialStatus` field; the `GET /v1/connectors` and `GET /v1/connectors/:platformId` read surface.
- **Out of scope:** the `IngestionRun` entity itself (ADR-0005/FDD-0005, consumed here as the sole data source); connector auto-disable/retry policy (ADR-0010/ADR-0023, which supplies the `failing` threshold rule but is otherwise separate); read-through caching implementation details (ADR-0022/FDD-0022); connector activation state (ADR-0051, a genuinely separate concept — see §3); alerting/notification rules beyond the health state itself.

### 2.3 Target Audience

Backend engineers implementing the derivation query; admin UI engineers rendering connector status screens; the technical lead validating that no second, driftable health record ever gets introduced.

---

## 3. Context and Background

- **Problem/opportunity:** tenants and the admin UI need to see connector status (healthy/degraded/failing/disconnected) per `(tenantId, platformId)`. If health were tracked as its own mutable record, it would need to be kept in sync with every ingestion attempt's outcome — a second place that can drift from the actual run history, especially under concurrent runs or partial failures.
- **Business/user value:** a single source of truth — because health is a query over `IngestionRun` (ADR-0005), health state cannot drift from what actually happened during ingestion; no additional write path or transaction to keep a separate health record consistent; derivation rules are simple enough to express as a query/view and can be tuned (e.g., the failure threshold) without a data migration, since nothing is stored.
- **Source requirements:** ADR-0009; ADR-0023 (accepted 2026-07-29, supersedes the `failing` rule); BRD-0009 (BR-001–BR-010, BRU-001–BRU-005); Story 4.3 (built `social-listening-core@10e7c43`), Story 2.5 (implemented the ADR-0023 rate-relative rule, 2026-07-30), Story 6.5 (real connector status screen, reworked 2026-08-12).
- **Amendment (ADR-0023, accepted 2026-07-29, implemented via Story 2.5, 2026-07-30):** the original flat "`failing`: ≥10 failed runs within the last hour" rule is superseded by a rate-relative rule: **≥50% of ≥5 attempts failing in the trailing hour, or ≥20 consecutive failures**. Nothing else in ADR-0009's Decision changes — derived-not-stored, the `degraded`/`disconnected`/`healthy` definitions, and `credentialStatus` living separately on `Credential` are all unaffected.
- **Note on ADR-0051 (connector activation, 2026-08-12):** activation (`connector_activations`, whether a Tenant-Admin has turned a connector on) is a genuinely separate concept from `ConnectorHealth`. This ADR's derivation is unaffected — activation adds no new field to `ConnectorHealth`'s derivation and does not make any part of it stored/mutable. Combining activation state with derived health into one API response is a response-shape question for the endpoint (ADR-0022/FDD-0022 territory), not a change to what `ConnectorHealth` is or how it's computed.
- **Constraints/dependencies:** every health read does aggregation work over recent `IngestionRun` rows rather than a single-row lookup — needs an index on `(tenantId, platformId, startedAt)` (or similar) to stay cheap as run volume grows, and may warrant caching if `GET /connectors` is polled frequently (ADR-0022); changing the failure threshold retroactively changes historical health interpretations, since nothing was actually stored at the time.

---

## 4. Goals and Objectives

| ID | Goal | Success Criteria |
|---|---|---|
| G1 | Eliminate stale or drifting connector health records | `ConnectorHealth` is computed directly from `IngestionRun` rows with no authoritative backing table of its own |
| G2 | Give tenants and operators a trustworthy status signal | A connector that has just failed is never still displayed as `healthy` because of a missed update |
| G3 | Enable threshold tuning without schema migrations | The `failing` rule can be redefined by updating derivation logic, with no historical data to rewrite |
| G4 | Keep health reads performant as ingestion volume grows | `GET /v1/connectors` health reads complete within target latency for expected run volume |
| G5 | Preserve clear separation between run health and credential health | `credentialStatus` is always sourced from `Credential`, never from `IngestionRun` outcomes |

---

## 5. Functional Requirements

### 5.1 Feature / Capability: `status` derivation (`healthy`/`degraded`/`failing`/`disconnected`)

- **Description:** at read time, `ConnectorHealth.status` for a given `(tenantId, platformId)` is computed by querying that pair's recent `IngestionRun` history — no status is ever written or updated independently.
- **Triggers:** any request for connector health (`GET /v1/connectors`, `GET /v1/connectors/:platformId`).
- **Inputs:** `IngestionRun` rows for the requested `(tenantId, platformId)`, scoped to the relevant lookback window (the trailing hour for most rules).
- **Processing:** apply, in effect, the following rules against recent run history: `disconnected` if no runs are recorded at all; `failing` if the ADR-0023 rate-relative threshold is met — ≥50% of ≥5 attempts failing in the trailing hour, or ≥20 consecutive failures; `degraded` if there are recent failures but at least one successful run within the last hour; `healthy` otherwise.
- **Outputs:** one of the four status values, computed fresh on every read.
- **Error handling:** a query that cannot resolve any runs for a valid `(tenantId, platformId)` pair returns `disconnected`, not an error — "never run" is a legitimate, expected state.
- **Edge cases:** a connector with exactly the threshold boundary (e.g., exactly 20 consecutive failures, or exactly 5 attempts at exactly 50% failure) — must resolve deterministically per the rule's own inclusive/exclusive boundary, verified by contract test; a connector with failures spread across attempts for two different platforms under the same tenant must not have counts bleed across `platformId` values.

### 5.2 Feature / Capability: `lastSuccessfulFetchAt`, `lastAttemptAt`, `consecutiveFailures` derivation

- **Description:** these three supporting fields are likewise computed from `IngestionRun` history, never stored independently.
- **Triggers:** the same connector-health read that computes `status`.
- **Inputs:** the same `IngestionRun` row set for the `(tenantId, platformId)` pair.
- **Processing:** `lastSuccessfulFetchAt` = the most recent run's `completedAt` where `status` indicates success; `lastAttemptAt` = the most recent run's `completedAt` (or `startedAt` for an in-progress run) regardless of outcome; `consecutiveFailures` = the count of failed runs since the most recent successful run, walking backward through the run history.
- **Outputs:** three values consistent with, and derivable purely from, the same run history used for `status`.
- **Error handling:** no successful run ever recorded — `lastSuccessfulFetchAt` is left unset/null, consistent with `disconnected` or a persistently `failing` connector.
- **Edge cases:** a connector whose very first run ever recorded is a failure — `consecutiveFailures = 1`, `lastSuccessfulFetchAt` unset; a connector that recovers after a long failure streak — `consecutiveFailures` resets to 0 at the successful run, and subsequent failures count from there.

### 5.3 Feature / Capability: `credentialStatus` (genuinely stored, not derived)

- **Description:** the one field on the `ConnectorHealth` response that is real, separately tracked state — read from the `Credential` entity, not computed from `IngestionRun`.
- **Triggers:** the same connector-health read.
- **Inputs:** the `Credential` row associated with the `(tenantId, platformId)` pair, if one exists.
- **Processing:** read `Credential.credentialStatus` (`valid`/`expiring_soon`/`expired`/`revoked`) directly; combine it into the same response object as the derived fields, without conflating it with run-based `status`.
- **Outputs:** a `credentialStatus` value independent of, and never inferred from, ingestion run outcomes.
- **Error handling:** a `(tenantId, platformId)` pair with no `Credential` row at all (e.g., a connector that's never been configured) returns an absent/null `credentialStatus`, distinct from `expired`/`revoked`.
- **Edge cases:** a credential that is `expired` but whose connector still shows `healthy` run history from before expiry (stale success) — both values are reported as-is, independently; the UI's job (not this ADR's) is to reconcile that apparent contradiction for the viewer.

### 5.4 Feature / Capability: `GET /v1/connectors` / `GET /v1/connectors/:platformId` read surface

- **Description:** the public API endpoints that expose derived `ConnectorHealth` (plus `credentialStatus`) to callers, without ever persisting or mutating anything as a side effect of the read.
- **Triggers:** an API consumer (admin UI, future subsystem) requesting connector status.
- **Inputs:** the requesting tenant's identity; optionally a specific `platformId`.
- **Processing:** run the derivations in 5.1–5.3 against the requested tenant's `IngestionRun`/`Credential` data; assemble the response; return it. No write occurs.
- **Outputs:** a `ConnectorHealth`-shaped response containing `status`, `lastSuccessfulFetchAt`, `lastAttemptAt`, `consecutiveFailures`, `credentialStatus` — and nothing else (no tenant content).
- **Error handling:** a request for a `platformId` the tenant has never interacted with returns `disconnected`/absent-credential values, not a 404 — the absence of activity is itself a valid, representable state.
- **Edge cases:** high-frequency polling by the admin UI — each call re-derives fresh (subject to any caching layered on separately per ADR-0022); the endpoint itself performs no memoization of its own.

### 5.5 Feature / Capability: Tenant-content-free health responses

- **Description:** health endpoint responses never embed tenant-scoped content — no post bodies, watchlist queries, or user data, only operational status/timestamps/counts.
- **Triggers:** every health read.
- **Inputs:** the same `IngestionRun`/`Credential` data as above.
- **Processing:** the response assembly step is restricted to the enumerated health fields; nothing from `SocialPost` content, `Watchlist` definitions, or user records is ever included.
- **Outputs:** a minimal, operationally-scoped response object.
- **Error handling:** a code change that would leak content into this response is a defect caught by contract tests asserting the response shape, not a runtime filtering step relied upon to redact after the fact.
- **Edge cases:** `errorSummary` on an underlying `IngestionRun` — if it could ever contain tenant content (e.g., an error message echoing part of a post), the health response must not surface it verbatim without review; this is a boundary to watch, not fully resolved by this ADR alone.

---

## 6. User Interaction and Workflows

### 6.1 Primary Actors

| Actor | Role |
|---|---|
| Tenant Admin / Tenant User | Views connector status in the admin UI to know whether posts are flowing in |
| Platform Admin | Investigates cross-tenant connector issues without accessing tenant content |
| API Consumer | Calls `GET /v1/connectors`/`GET /v1/connectors/:platformId` for health data |
| Ingestion Pipeline (system actor) | Produces the `IngestionRun` history this derivation reads, without writing health directly |

### 6.2 User Stories / Use Cases

| ID | As a ... | I want to ... | So that ... | Acceptance Criteria |
|---|---|---|---|---|
| US1 (Story 4.3) | tenant administrator | have `GET /connectors` report health computed live from `IngestionRun` history — never a separately stored, independently updatable health record | the status I see can never drift from what actually happened during ingestion | (1) `ConnectorHealth` has no backing table of its own; (2) `failing`/`degraded`/`disconnected`/`healthy` derived per the rules in §5.1 (rate-relative `failing` rule per Story 2.5/ADR-0023); (3) `credentialStatus` read from `Credential` directly; (4) a test inserting a known `IngestionRun` sequence asserts all four derived states with no health-table writes; (5) `GET /v1/connectors`/`GET /v1/connectors/:platformId` return derived health with no tenant-scoped content |
| US2 (Story 6.5) | tenant user or Tenant-Admin | see each connected platform's current health status at a glance, from real data | I know whether posts are actually flowing in before I go looking for missing data | for each connected platform, shows a real `GET /v1/connectors/:platformId` call's derived status, `lastSuccessfulFetchAt`, `lastAttemptAt`, `consecutiveFailures` — no fixture data anywhere in the render path (a real, confirmed backend gap — no "list all connectors for a tenant" endpoint — is named as a known follow-up, not solved by this story) |

### 6.3 Workflow Diagrams / Steps

**Workflow: Tenant views connector status**

1. Tenant Admin opens the connector status screen in `social-listening-admin`.
2. For each platform the tenant has connected (per Story 6.3's connect/disconnect state, pending a dedicated "list connectors" endpoint), the UI calls `GET /v1/connectors/:platformId`.
3. Core resolves `IngestionRun` history for `(tenantId, platformId)`, applies the derivation rules (5.1/5.2), reads `credentialStatus` from `Credential` (5.3), and returns the combined response.
4. UI renders `status` (healthy/degraded/failing/disconnected), `lastSuccessfulFetchAt`, `lastAttemptAt`, `consecutiveFailures`, with a `failing` connector visually distinguished from `degraded`/`healthy`.
5. No write occurs anywhere in this flow — a repeated call simply re-derives from whatever `IngestionRun` history exists by then.

**Workflow: Ingestion pipeline affects future health reads (without writing health directly)**

1. Ingestion pipeline runs a poll/webhook execution, opening and closing an `IngestionRun` (ADR-0005) with its real outcome.
2. No health-specific write occurs — the pipeline's only obligation to this ADR is producing accurate `IngestionRun` rows.
3. The next health read for that `(tenantId, platformId)` automatically reflects the new run, because derivation always queries current `IngestionRun` state.

---

## 7. Data Requirements

### 7.1 Data Inputs

`IngestionRun` rows (`tenantId`, `platformId`, `startedAt`, `completedAt`, `status`, counts) per ADR-0005; `Credential.credentialStatus` per the credential storage model (ADR-0014/ADR-0028).

### 7.2 Data Outputs

`ConnectorHealth`-shaped API responses: `status`, `lastSuccessfulFetchAt`, `lastAttemptAt`, `consecutiveFailures`, `credentialStatus` — computed fresh per request, never persisted as their own row.

### 7.3 Data Model / Entities

| Entity | Key Attributes | Relationships |
|---|---|---|
| `ConnectorHealth` (virtual/derived, not a table) | `status` (`healthy`\|`degraded`\|`failing`\|`disconnected`), `lastSuccessfulFetchAt`, `lastAttemptAt`, `consecutiveFailures`, `credentialStatus` | Computed from `IngestionRun` (ADR-0005) plus `Credential`; has no backing table of its own |
| `IngestionRun` (referenced, owned by ADR-0005) | `tenantId`, `platformId`, `startedAt`, `completedAt`, `status`, error/retry fields | Sole data source for `status`/`lastSuccessfulFetchAt`/`lastAttemptAt`/`consecutiveFailures` derivation |
| `Credential` (referenced) | `credentialStatus` (`valid`\|`expiring_soon`\|`expired`\|`revoked`) | Sole data source for `credentialStatus`; independent of run outcomes |

### 7.4 Validation Rules

- `ConnectorHealth` is never stored as a mutable, authoritative record (BRU-001).
- `status`, `lastSuccessfulFetchAt`, `lastAttemptAt`, and `consecutiveFailures` are computed exclusively from `IngestionRun` history at read time (BRU-002).
- `credentialStatus` is sourced only from the `Credential` entity, never from run outcomes (BRU-003).
- The `failing` threshold is the rate-relative rule in ADR-0023 (≥50% of ≥5 attempts in the trailing hour, or ≥20 consecutive failures), superseding the earlier flat "≥10 failed runs within the last hour" placeholder (BRU-004).
- Health reads and displays are tenant-content-free: no posts, watchlists, or user data (BRU-005).

---

## 8. Business Rules and Logic

| ID | Rule | Applies To |
|---|---|---|
| BR1 | `ConnectorHealth.status` is derived from `IngestionRun` history, never separately stored. | `ConnectorHealth` |
| BR2 | `failing` follows the rate-relative rule: ≥50% of ≥5 attempts failing in the trailing hour, or ≥20 consecutive failures. | `status` derivation |
| BR3 | `degraded` is reported when recent failures exist and a successful run occurred within the last hour. | `status` derivation |
| BR4 | `disconnected` is reported when no `IngestionRun` rows exist for the tenant-platform pair. | `status` derivation |
| BR5 | `healthy` is reported when none of the above conditions apply. | `status` derivation |
| BR6 | `credentialStatus` is read from `Credential`, never derived from run history. | `credentialStatus` |
| BR7 | Health endpoints must not expose post bodies, watchlist queries, or user content. | API responses |

---

## 9. Interfaces and Integrations

| System / Component | Direction | Purpose | Protocol / Format |
|---|---|---|---|
| `IngestionRun` (ADR-0005) | Inbound to derivation | Sole source of run-based health fields | In-process / Postgres query |
| `Credential` (ADR-0014/ADR-0028) | Inbound to derivation | Sole source of `credentialStatus` | In-process / Postgres query |
| `GET /v1/connectors`, `GET /v1/connectors/:platformId` | Outbound | Public REST surface for connector health | HTTPS REST / JSON |
| `social-listening-admin` connector status screen (Story 6.5) | Outbound consumer | Renders derived health per connected platform | HTTPS REST / JSON |
| Derived-data caching (ADR-0022, optional) | Performance layer | May cache health reads to reduce aggregation cost under frequent polling | In-process |
| Connector activation (ADR-0051, separate concept) | Adjacent, not merged into derivation | Endpoint response may combine activation state with derived health; derivation itself is unaffected | In-process |

---

## 10. Non-Functional Considerations

- **Performance:** `GET /v1/connectors` health reads should complete within 200ms at the 95th percentile for expected tenant run volume (NFR-001); requires an index on `(tenantId, platformId, startedAt)` (or similar) to stay cheap as run volume grows.
- **Security/access control:** health endpoints must enforce multi-tenant isolation — a tenant cannot read another tenant's connector health (NFR-004); responses must never expose tenant content (BR7/NFR-004 combined intent).
- **Scalability:** aggregation cost grows with `IngestionRun` volume and polling frequency; an optional read-through cache (ADR-0022/Story 4.4) mitigates this without changing correctness.
- **Reliability/availability:** health derivation must remain correct under concurrent ingestion for the same tenant-platform pair (NFR-003) — no locking or coordination is needed precisely because nothing is written by the read.
- **Maintainability:** no independently updatable `ConnectorHealth` store exists (NFR-002) — verified by schema and code review; threshold constants are tunable without a data migration (BR-010).
- **Audit and logging:** health itself needs no separate audit trail — `IngestionRun` (ADR-0005) already is the audit trail this derivation reads from.
- **Accessibility/localization:** not applicable to the derivation logic itself; inherited by whatever UI renders it.

---

## 11. Error Handling and Exceptions

| Scenario | User-Facing Message | System Behavior |
|---|---|---|
| No `IngestionRun` rows exist for a `(tenantId, platformId)` pair | Displayed as "Disconnected" (or platform-specific inactive indicator) | Returns `disconnected`, not an error |
| A `(tenantId, platformId)` pair has no `Credential` row | `credentialStatus` shown as absent/not-configured | Returned as null/absent, distinct from `expired`/`revoked` |
| A request attempts to read another tenant's connector health | N/A (structurally prevented) | Blocked by tenant isolation (NFR-004), never reaches derivation logic for the wrong tenant |
| A code change accidentally introduces a persisted, independently updatable health row | N/A (caught at review/schema inspection) | Treated as a violation of BR1/NFR-002, not shipped |
| Health response accidentally includes tenant content (e.g., via `errorSummary`) | N/A (caught by contract tests on response shape) | Treated as a defect against BR7; response shape must be corrected |

---

## 12. Assumptions and Dependencies

- `IngestionRun` is the authoritative, append-only audit record of every ingestion attempt (ADR-0005).
- An index exists on `(tenantId, platformId, startedAt)` or equivalent to keep health reads efficient.
- The admin UI polls connector health endpoints for live status.
- Dependency: ADR-0005 supplies `IngestionRun`, the sole data source for run-based health fields.
- Dependency: ADR-0023 supersedes the `failing` threshold rule with the rate-relative version, implemented by Story 2.5.
- Dependency: ADR-0022/Story 4.4 may layer a read-through cache on top of this derivation for performance, without changing its correctness contract.
- Dependency: ADR-0010 governs retryable/non-retryable error handling and auto-disable — a related but separate mechanism from health derivation.
- Dependency: ADR-0051 introduces connector activation as a genuinely separate concept, unaffecting this ADR's own derivation, though the two may be combined in a single endpoint response.
- Known follow-up (Story 6.5): no "list all connectors for a tenant" core endpoint exists yet — the status screen currently relies on Story 6.3's own connected-platform list rather than a dedicated endpoint; named as a real gap, not solved by this ADR.

---

## 13. Open Questions

| ID | Question | Owner | Target Resolution |
|---|---|---|---|
| Q1 | Should a dedicated "list all connectors for a tenant" endpoint be built, closing the gap Story 6.5 named? | Technical Lead | Open, tracked in `docs/open-items-and-deferred-work.md` §B |
| Q2 | Should `errorSummary` on `IngestionRun` be sanitized/reviewed to guarantee it can never leak tenant content into a health response? | Technical Lead | Open — not fully resolved by this ADR |

---

## 14. Appendix

- **Glossary:** see BRD-0009 §15 (`ConnectorHealth`, `IngestionRun`, `Credential`, `failing`, `degraded`, `disconnected`, `healthy`).
- **Reference links:** `docs/adr/0009-connector-health-derived-not-stored.md`; `docs/adr/0023-proportional-connector-failure-threshold.md`; `docs/adr/0005-ingestion-run-as-audit-anchor.md`; `docs/project docs/Business-Requirements/BRD-0009-Connector-Health-Derived-Not-Stored.md`; `docs/user-stories/epic-4-derived-data-analytics-and-health.md` (Story 4.3); `docs/user-stories/epic-2-ingestion-connectors-and-rate-limits.md` (Story 2.5); `docs/user-stories/epic-6-tenant-admin-ui.md` (Story 6.5).
- **Feature design/deep research:** `docs/product-research/feature-designs/01-multi-source-ingestion.md` (ingestion framework and `IngestionRun` anchoring); `docs/product-research/feature-designs/17-platform-operations-dashboard.md` (platform-wide health/telemetry context). No `docs/product-research/reports/<feature>-deep-research.md` file was found for this specific derivation decision, per BRD-0009's own missing-source note.
- **Diagrams:** none beyond the workflow steps in §6.3.
- **Revision history:** v1.0, 2026-08-23 — regenerated from ADR-0009 (with its ADR-0023 amendment)/BRD-0009/Story 4.3/Story 2.5/Story 6.5 to replace a defective prior version that copied the BRD's flat requirements table instead of a per-capability functional breakdown.
